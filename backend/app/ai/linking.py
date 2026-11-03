"""Linking several AI accounts: create, log in, check, test."""
from __future__ import annotations

import asyncio
import json
import re
import shutil
from typing import Any, Dict, Optional

from .. import database as db
from ..events import publish
from . import pool

# Running interactive logins (device-code flows), keyed by account id.
_logins: Dict[int, Dict[str, Any]] = {}


async def create_account(provider: str, label: str, auth: str, secret: str = "", model: str = "",
                         priority: int = 100, env: Optional[dict] = None) -> Dict[str, Any]:
    if provider not in pool.PROVIDERS:
        raise ValueError("Fournisseur inconnu")
    if auth not in pool.PROVIDERS[provider]["auths"]:
        raise ValueError(f"Mode de connexion « {auth} » non pris en charge pour {provider}")
    if auth in ("token", "api_key") and not secret.strip():
        raise ValueError("Collez le jeton / la clé.")
    aid = await db.insert("ai_accounts", {"provider": provider, "label": label or pool.PROVIDERS[provider]["label"],
                                          "auth": auth, "secret": secret.strip() or None, "model": model or None,
                                          "priority": priority, "env": env or {}, "status": "unknown"})
    a = await db.fetch_one("ai_accounts", "SELECT * FROM ai_accounts WHERE id = ?", (aid,))
    if auth == "config_dir":
        await db.update("ai_accounts", aid, {"config_dir": str(pool.account_dir(a))}, touch=False)
    if provider == "codex" and auth == "api_key":
        await _codex_api_key_login(a)
    a = await db.fetch_one("ai_accounts", "SELECT * FROM ai_accounts WHERE id = ?", (aid,))
    publish("ai_account", pool.public_account(a))
    return pool.public_account(a)


async def _codex_api_key_login(a: Dict[str, Any]) -> None:
    proc = await asyncio.create_subprocess_exec("codex", "login", "--with-api-key", env=pool.account_env(a),
                                                stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE,
                                                stderr=asyncio.subprocess.STDOUT)
    out, _ = await asyncio.wait_for(proc.communicate((a.get("secret") or "").encode()), timeout=60)
    if proc.returncode != 0:
        raise ValueError(f"codex login a échoué : {out.decode(errors='replace')[-200:]}")


async def check_login(account_id: int) -> Dict[str, Any]:
    """Ask the CLI itself whether this account is logged in (no AI call, no usage)."""
    a = await db.fetch_one("ai_accounts", "SELECT * FROM ai_accounts WHERE id = ?", (account_id,))
    if not a:
        raise ValueError("Compte introuvable")
    prov = a["provider"]
    if prov == "anthropic_api":
        return {"logged_in": bool(a.get("secret")), "detail": "clé enregistrée" if a.get("secret") else "clé manquante"}
    binary = {"claude": "claude", "codex": "codex", "agy": "agy"}[prov]
    if not shutil.which(binary):
        await pool._mark(a, status="error", last_error=f"« {binary} » n'est pas installé sur cette machine")
        return {"logged_in": False, "detail": f"{binary} introuvable"}
    if prov == "claude":
        cmd = ["claude", "auth", "status", "--json"]
    elif prov == "codex":
        cmd = ["codex", "login", "status"]
    else:
        return {"logged_in": None, "detail": "Antigravity : utilisez « Tester » (pas de commande de statut)."}
    proc = await asyncio.create_subprocess_exec(*cmd, env=pool.account_env(a), cwd=str(pool.SANDBOX_DIR),
                                                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT)
    out, _ = await asyncio.wait_for(proc.communicate(), timeout=30)
    text = out.decode(errors="replace").strip()
    if prov == "claude":
        try:
            data = json.loads(text)
            ok = bool(data.get("loggedIn"))
            detail = f"{data.get('authMethod', '')} {data.get('email', '') or ''}".strip()
        except Exception:
            ok, detail = False, text[-200:]
    else:
        ok = proc.returncode == 0 and "logged in" in text.lower() and "not logged" not in text.lower()
        detail = text[-200:]
    if ok and a.get("status") in ("needs_login", "unknown", "error"):
        await pool._mark(a, status="ok" if a.get("status") != "limited" else "limited", last_error=None)
    elif not ok:
        await pool._mark(a, status="needs_login", last_error=detail[:300])
    return {"logged_in": ok, "detail": detail}


async def test_account(account_id: int) -> Dict[str, Any]:
    a = await db.fetch_one("ai_accounts", "SELECT * FROM ai_accounts WHERE id = ?", (account_id,))
    if not a:
        raise ValueError("Compte introuvable")
    try:
        text = await pool.call_account(a, "Réponds exactement : OK", timeout=120)
        return {"ok": True, "reply": text.strip()[:80]}
    except Exception as e:
        fresh = await db.fetch_one("ai_accounts", "SELECT * FROM ai_accounts WHERE id = ?", (account_id,))
        return {"ok": False, "error": str(e)[:300], "status": fresh.get("status"), "limited_until": fresh.get("limited_until")}


# ---------------------------------------------------------------- device-code login (Codex)

async def start_device_login(account_id: int) -> Dict[str, Any]:
    """Runs `codex login --device-auth` for this account and exposes the URL + code
    so the user can finish the login from the browser, without a terminal."""
    a = await db.fetch_one("ai_accounts", "SELECT * FROM ai_accounts WHERE id = ?", (account_id,))
    if not a or a["provider"] != "codex" or a.get("auth") != "config_dir":
        raise ValueError("Connexion guidée disponible pour les comptes Codex à dossier séparé.")
    if account_id in _logins and _logins[account_id].get("state") == "waiting":
        return _logins[account_id]
    proc = await asyncio.create_subprocess_exec("codex", "login", "--device-auth", env=pool.account_env(a),
                                                cwd=str(pool.SANDBOX_DIR), stdout=asyncio.subprocess.PIPE,
                                                stderr=asyncio.subprocess.STDOUT)
    info: Dict[str, Any] = {"state": "waiting", "url": None, "code": None, "output": ""}
    _logins[account_id] = info

    async def pump():
        assert proc.stdout
        while True:
            line = await proc.stdout.readline()
            if not line:
                break
            s = re.sub(r"\x1b\[[0-9;]*[a-zA-Z]", "", line.decode(errors="replace"))
            info["output"] = (info["output"] + s)[-2000:]
            url = re.search(r"https?://\S+", s)
            if url and not info["url"]:
                info["url"] = url.group(0).rstrip(".,)")
            code = re.search(r"\b([A-Z0-9]{4}-[A-Z0-9]{4,5})\b", s)
            if code and not info["code"]:
                info["code"] = code.group(1)
            publish("ai_login", {"account_id": account_id, **info})
        rc = await proc.wait()
        info["state"] = "done" if rc == 0 else "failed"
        publish("ai_login", {"account_id": account_id, **info})
        if rc == 0:
            await check_login(account_id)

    asyncio.create_task(pump())
    for _ in range(40):            # wait up to ~10 s for the code to show up
        if info["code"] or info["state"] != "waiting":
            break
        await asyncio.sleep(0.25)
    return info


def device_login_state(account_id: int) -> Dict[str, Any]:
    return _logins.get(account_id) or {"state": "idle"}
