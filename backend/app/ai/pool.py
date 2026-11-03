"""AI account pool.

Every AI call goes through `ask()` / `ask_json()`. The pool tries the linked
accounts in priority order. When an account hits its usage limit, it is parked
until its reset time (parsed from the CLI message) and the next account is used.
When every account is parked, `AIUnavailable(resume_at)` is raised; the task
queue (app/tasks.py) re-schedules the work for `resume_at`, so everything
continues on its own once a session limit ends.
"""
from __future__ import annotations

import asyncio
import json
import os
import re
import tempfile
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

import httpx

from .. import database as db
from ..config import ACCOUNTS_DIR, DATA_DIR
from ..events import publish
from .limits import is_auth_error, is_limit, parse_reset

SANDBOX_DIR = DATA_DIR / "ai_sandbox"      # neutral cwd so CLIs never read the repo
SANDBOX_DIR.mkdir(parents=True, exist_ok=True)

PROVIDERS = {
    "claude": {"label": "Claude Code", "auths": ["default", "token", "config_dir"], "default_model": "sonnet"},
    "anthropic_api": {"label": "API Anthropic", "auths": ["api_key"], "default_model": "claude-sonnet-5-5"},
    "codex": {"label": "Codex", "auths": ["default", "config_dir", "api_key"], "default_model": ""},
    "agy": {"label": "Antigravity", "auths": ["default", "config_dir"], "default_model": ""},
}


class AIUnavailable(Exception):
    def __init__(self, message: str, resume_at: Optional[datetime] = None):
        super().__init__(message)
        self.resume_at = resume_at


class AIBadOutput(Exception):
    pass


class _Limited(Exception):
    def __init__(self, msg: str, reset: Optional[datetime]):
        super().__init__(msg)
        self.reset = reset


class _AuthFailed(Exception):
    pass


# ------------------------------------------------------------------ accounts

async def list_accounts() -> List[Dict[str, Any]]:
    return await db.fetch_all("ai_accounts", "SELECT * FROM ai_accounts ORDER BY priority, id")


def public_account(a: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(a)
    out["has_secret"] = bool(a.get("secret"))
    out.pop("secret", None)
    if a.get("status") == "limited" and a.get("limited_until"):
        try:
            if datetime.fromisoformat(a["limited_until"]) <= datetime.now():
                out["status"] = "ok"
        except ValueError:
            pass
    out["provider_label"] = PROVIDERS.get(a["provider"], {}).get("label", a["provider"])
    out["login_command"] = login_command(a)
    return out


def account_dir(a: Dict[str, Any]) -> Path:
    d = Path(a.get("config_dir") or ACCOUNTS_DIR / f"{a['provider']}-{a['id']}")
    d.mkdir(parents=True, exist_ok=True)
    return d


def login_command(a: Dict[str, Any]) -> str:
    if a.get("auth") != "config_dir":
        if a["provider"] == "claude" and a.get("auth") == "token":
            return "claude setup-token   # puis collez le jeton dans Plonge"
        return ""
    d = a.get("config_dir") or str(ACCOUNTS_DIR / f"{a['provider']}-{a['id']}")
    if a["provider"] == "claude":
        return f'CLAUDE_CONFIG_DIR="{d}" claude auth login'
    if a["provider"] == "codex":
        return f'CODEX_HOME="{d}" codex login --device-auth'
    if a["provider"] == "agy":
        return f'HOME="{d}" agy'
    return ""


def account_env(a: Dict[str, Any]) -> Dict[str, str]:
    env = dict(os.environ)
    env.pop("CLAUDECODE", None)               # never inherit a parent Claude Code session
    env.pop("CLAUDE_CODE_ENTRYPOINT", None)
    prov, auth = a["provider"], a.get("auth") or "default"
    if prov == "claude":
        if auth == "token" and a.get("secret"):
            env["CLAUDE_CODE_OAUTH_TOKEN"] = a["secret"]
        elif auth == "config_dir":
            env["CLAUDE_CONFIG_DIR"] = str(account_dir(a))
    elif prov == "codex":
        if auth in ("config_dir", "api_key"):
            env["CODEX_HOME"] = str(account_dir(a))
    elif prov == "agy" and auth == "config_dir":
        env["HOME"] = str(account_dir(a))
    extra = a.get("env") or {}
    if isinstance(extra, dict):
        env.update({str(k): str(v) for k, v in extra.items()})
    return env


async def _mark(a: Dict[str, Any], **values) -> None:
    await db.update("ai_accounts", a["id"], values, touch=False)
    fresh = await db.fetch_one("ai_accounts", "SELECT * FROM ai_accounts WHERE id = ?", (a["id"],))
    if fresh:
        publish("ai_account", public_account(fresh))


async def _count_call(a: Dict[str, Any]) -> None:
    today = datetime.now().strftime("%Y-%m-%d")
    calls_today = (a.get("calls_today") or 0) + 1 if a.get("calls_day") == today else 1
    await db.update("ai_accounts", a["id"], {
        "calls_day": today, "calls_today": calls_today,
        "calls_total": (a.get("calls_total") or 0) + 1, "last_used_at": db.now_iso(),
    }, touch=False)


async def usable_accounts() -> List[Dict[str, Any]]:
    now = datetime.now()
    out = []
    for a in await list_accounts():
        if not a.get("enabled"):
            continue
        if a.get("status") == "needs_login":
            continue
        lu = a.get("limited_until")
        if lu:
            try:
                if datetime.fromisoformat(lu) > now:
                    continue
            except ValueError:
                pass
        out.append(a)
    return out


async def pool_status() -> Dict[str, Any]:
    accounts = [public_account(a) for a in await list_accounts()]
    enabled = [a for a in accounts if a.get("enabled")]
    usable = await usable_accounts()
    resume_at = None
    if enabled and not usable:
        times = [a["limited_until"] for a in enabled if a.get("limited_until")]
        resume_at = min(times) if times else None
    return {
        "accounts": accounts,
        "available": len(usable),
        "total": len(enabled),
        "state": "ok" if usable else ("waiting" if resume_at else "down"),
        "resume_at": resume_at,
    }


# ------------------------------------------------------------------ calls

async def _run_proc(cmd: List[str], env: Dict[str, str], stdin: Optional[str], timeout: int) -> tuple[int, str, str]:
    proc = await asyncio.create_subprocess_exec(
        *cmd, cwd=str(SANDBOX_DIR), env=env,
        stdin=asyncio.subprocess.PIPE if stdin is not None else asyncio.subprocess.DEVNULL,
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
    )
    try:
        out, err = await asyncio.wait_for(proc.communicate(stdin.encode() if stdin is not None else None), timeout=timeout)
    except asyncio.TimeoutError:
        proc.kill()
        await proc.wait()
        raise TimeoutError(f"délai dépassé ({timeout}s)")
    return proc.returncode, out.decode(errors="replace"), err.decode(errors="replace")


def _raise_for(text: str) -> None:
    if is_limit(text):
        raise _Limited(text.strip()[:300], parse_reset(text))
    if is_auth_error(text):
        raise _AuthFailed(text.strip()[:300])


async def _call_claude(a, prompt: str, timeout: int) -> str:
    model = a.get("model") or PROVIDERS["claude"]["default_model"]
    cmd = ["claude", "-p", "--output-format", "json", "--tools", "", "--setting-sources", "",
           "--strict-mcp-config", "--no-session-persistence", "--model", model]
    code, out, err = await _run_proc(cmd, account_env(a), prompt, timeout)
    data = None
    try:
        data = json.loads(out.strip().splitlines()[-1]) if out.strip() else None
    except Exception:
        data = None
    if data and not data.get("is_error") and data.get("result") is not None:
        return data["result"]
    msg = (data or {}).get("result") or err or out or f"code {code}"
    _raise_for(str(msg))
    raise RuntimeError(str(msg)[:300])


async def _call_codex(a, prompt: str, timeout: int) -> str:
    with tempfile.NamedTemporaryFile("r", suffix=".txt", delete=False, dir=SANDBOX_DIR) as tf:
        last = tf.name
    cmd = ["codex", "exec", "--skip-git-repo-check", "--sandbox", "read-only", "--ephemeral",
           "--color", "never", "-o", last]
    if a.get("model"):
        cmd += ["-m", a["model"]]
    cmd.append("-")
    try:
        code, out, err = await _run_proc(cmd, account_env(a), prompt, timeout)
        text = Path(last).read_text(errors="replace").strip() if os.path.exists(last) else ""
    finally:
        try:
            os.unlink(last)
        except OSError:
            pass
    if code == 0 and text:
        return text
    msg = err + "\n" + out
    _raise_for(msg)
    raise RuntimeError(msg.strip()[-300:] or f"code {code}")


async def _call_agy(a, prompt: str, timeout: int) -> str:
    cmd = ["agy", "-p", prompt, "--output-format", "json", "--mode", "plan"]
    if a.get("model"):
        cmd += ["--model", a["model"]]
    code, out, err = await _run_proc(cmd, account_env(a), None, timeout)
    try:
        data = json.loads(out)
        if str(data.get("status", "")).upper() == "SUCCESS" and data.get("response"):
            return data["response"]
        msg = json.dumps(data)[:500]
    except Exception:
        msg = err + "\n" + out
    _raise_for(msg)
    raise RuntimeError(msg.strip()[:300] or f"code {code}")


async def _call_anthropic_api(a, prompt: str, timeout: int) -> str:
    key = a.get("secret") or ""
    if not key:
        raise _AuthFailed("clé API manquante")
    payload = {
        "model": a.get("model") or PROVIDERS["anthropic_api"]["default_model"],
        "max_tokens": 8000,
        "messages": [{"role": "user", "content": prompt}],
    }
    headers = {"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"}
    async with httpx.AsyncClient(timeout=timeout) as client:
        r = await client.post("https://api.anthropic.com/v1/messages", json=payload, headers=headers)
    if r.status_code == 200:
        return "".join(b.get("text", "") for b in r.json().get("content", []) if b.get("type") == "text")
    if r.status_code in (429, 529):
        ra = r.headers.get("retry-after")
        reset = datetime.now() + timedelta(seconds=int(ra)) if ra and ra.isdigit() else None
        raise _Limited(f"HTTP {r.status_code}: {r.text[:200]}", reset)
    if r.status_code in (401, 403):
        raise _AuthFailed(f"HTTP {r.status_code}: {r.text[:200]}")
    raise RuntimeError(f"HTTP {r.status_code}: {r.text[:200]}")


CALLERS = {"claude": _call_claude, "codex": _call_codex, "agy": _call_agy, "anthropic_api": _call_anthropic_api}


async def call_account(a: Dict[str, Any], prompt: str, timeout: int = 240) -> str:
    """Single call on one account, updating its status. Raises on failure."""
    settings = await db.get_settings()
    caller = CALLERS[a["provider"]]
    await _count_call(a)
    try:
        text = await caller(a, prompt, timeout)
    except _Limited as e:
        reset = e.reset or datetime.now() + timedelta(minutes=int(settings.get("ai_default_cooldown_mins", 60)))
        await _mark(a, status="limited", limited_until=reset.isoformat(timespec="seconds"), last_error=str(e)[:300])
        await db.log_activity("WARNING", f"IA « {a['label']} » : limite atteinte, reprise prévue à {reset:%H:%M} ({reset:%d/%m}).")
        raise
    except _AuthFailed as e:
        await _mark(a, status="needs_login", last_error=str(e)[:300])
        await db.log_activity("ERROR", f"IA « {a['label']} » : connexion requise ({str(e)[:120]}).")
        raise
    except FileNotFoundError:
        await _mark(a, status="error", last_error=f"commande « {a['provider']} » introuvable sur cette machine")
        raise
    except Exception as e:
        errs = (a.get("consecutive_errors") or 0) + 1
        values = {"status": "error", "last_error": str(e)[:300], "consecutive_errors": errs}
        if errs >= 3:  # flaky account: rest it a little so the others take over
            values["limited_until"] = (datetime.now() + timedelta(minutes=10 * errs)).isoformat(timespec="seconds")
        await _mark(a, **values)
        raise
    await _mark(a, status="ok", limited_until=None, last_error=None, last_ok_at=db.now_iso(), consecutive_errors=0)
    return text


async def ask(prompt: str, timeout: int = 240) -> str:
    """Run a prompt on the first available account, rotating on limits/errors."""
    settings = await db.get_settings()
    order = settings.get("ai_provider_order") or list(PROVIDERS)
    accounts = await usable_accounts()
    accounts.sort(key=lambda a: (a.get("priority", 100), order.index(a["provider"]) if a["provider"] in order else 99))
    errors = []
    for a in accounts:
        try:
            return await call_account(a, prompt, timeout)
        except (_Limited, _AuthFailed, FileNotFoundError, TimeoutError, RuntimeError, httpx.HTTPError) as e:
            errors.append(f"{a['label']}: {str(e)[:120]}")
            continue
    status = await pool_status()
    resume = datetime.fromisoformat(status["resume_at"]) if status.get("resume_at") else None
    if resume is None and status["total"]:
        # Only errors (no limit): retry in a few minutes rather than never.
        resume = datetime.now() + timedelta(minutes=15)
    publish("ai_pool", {k: v for k, v in status.items() if k != "accounts"})
    raise AIUnavailable("Aucun compte IA disponible. " + " | ".join(errors[-3:]), resume)


# ------------------------------------------------------------------ JSON helpers

def extract_json(text: str) -> Any:
    """Find the first complete JSON object/array in model output."""
    text = text.strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fence:
        text = fence.group(1).strip()
    try:
        return json.loads(text)
    except Exception:
        pass
    for opener, closer in (("{", "}"), ("[", "]")):
        start = text.find(opener)
        while start != -1:
            depth, in_str, esc = 0, False, False
            for i in range(start, len(text)):
                ch = text[i]
                if in_str:
                    if esc:
                        esc = False
                    elif ch == "\\":
                        esc = True
                    elif ch == '"':
                        in_str = False
                    continue
                if ch == '"':
                    in_str = True
                elif ch == opener:
                    depth += 1
                elif ch == closer:
                    depth -= 1
                    if depth == 0:
                        try:
                            return json.loads(text[start:i + 1])
                        except Exception:
                            break
            start = text.find(opener, start + 1)
    raise AIBadOutput("réponse IA sans JSON valide")


async def ask_json(prompt: str, validate: Optional[Callable[[Any], Any]] = None, timeout: int = 240) -> Any:
    """ask() + JSON parsing + optional validation, with one repair retry."""
    suffix = "\n\nRéponds UNIQUEMENT avec le JSON demandé, sans texte autour, sans balises markdown."
    last_err = None
    for attempt in range(2):
        raw = await ask(prompt + suffix if attempt == 0 else
                        prompt + suffix + f"\n\nTa réponse précédente était invalide ({last_err}). Corrige-la.", timeout)
        try:
            data = extract_json(raw)
            return validate(data) if validate else data
        except Exception as e:
            last_err = str(e)[:200]
    raise AIBadOutput(f"réponse IA invalide : {last_err}")
