"""Persistent AI work queue.

Anything that needs the AI goes through here. If every AI account is at its
usage limit, the task is simply re-queued for the reset time and the worker
sleeps until then: work continues by itself after a session limit ends, even
across restarts (the queue lives in SQLite)."""
from __future__ import annotations

import asyncio
import json
import traceback
from datetime import datetime, timedelta
from typing import Any, Awaitable, Callable, Dict, Optional

from . import database as db
from .ai.pool import AIUnavailable, pool_status
from .events import publish

Handler = Callable[[Dict[str, Any]], Awaitable[Any]]
HANDLERS: Dict[str, Handler] = {}
LABELS = {
    "score": "Évaluer l'offre",
    "tailor": "Adapter le CV",
    "profile_from_cv": "Lire le profil depuis le CV",
    "audit": "Audit du CV",
    "followup": "Rédiger une relance",
    "classify_reply": "Lire une réponse recruteur",
    "import_offer": "Importer une offre",
}
MAX_ATTEMPTS = 3

_wake = asyncio.Event()
_state: Dict[str, Any] = {"waiting_until": None, "running": None}


def handler(kind: str):
    def deco(fn: Handler) -> Handler:
        HANDLERS[kind] = fn
        return fn
    return deco


async def enqueue(kind: str, job_id: Optional[int] = None, payload: Optional[dict] = None,
                  priority: int = 50, dedupe: bool = True) -> int:
    if dedupe:
        existing = await db.fetch_one(
            "ai_tasks",
            "SELECT id, priority FROM ai_tasks WHERE kind = ? AND IFNULL(job_id, -1) = IFNULL(?, -1) "
            "AND status IN ('queued', 'running') AND payload = ?",
            (kind, job_id, json.dumps(payload or {}, ensure_ascii=False)),
        )
        if existing:
            if priority < existing["priority"]:   # user clicked: move it to the front
                await db.update("ai_tasks", existing["id"], {"priority": priority, "run_after": None}, touch=False)
                _wake.set()
            return existing["id"]
    tid = await db.insert("ai_tasks", {"kind": kind, "job_id": job_id, "payload": payload or {},
                                       "priority": priority, "status": "queued", "updated_at": db.now_iso()})
    publish("task", await get_task(tid))
    _wake.set()
    return tid


async def get_task(tid: int) -> Optional[Dict[str, Any]]:
    t = await db.fetch_one("ai_tasks", "SELECT * FROM ai_tasks WHERE id = ?", (tid,))
    if t:
        t["label"] = LABELS.get(t["kind"], t["kind"])
    return t


async def queue_summary() -> Dict[str, Any]:
    rows = await db.fetch_all("ai_tasks", "SELECT status, COUNT(*) AS n FROM ai_tasks GROUP BY status")
    counts = {r["status"]: r["n"] for r in rows}
    recent = await db.fetch_all(
        "ai_tasks",
        "SELECT t.*, j.title AS job_title, j.company AS job_company FROM ai_tasks t LEFT JOIN jobs j ON j.id = t.job_id "
        "WHERE t.status IN ('queued','running') OR t.updated_at > datetime('now', '-1 day', 'localtime') "
        "ORDER BY CASE t.status WHEN 'running' THEN 0 WHEN 'queued' THEN 1 ELSE 2 END, t.priority, t.id DESC LIMIT 40",
    )
    for t in recent:
        t["label"] = LABELS.get(t["kind"], t["kind"])
    return {"counts": counts, "tasks": recent, "waiting_until": _state["waiting_until"], "running": _state["running"]}


async def cancel(tid: int) -> None:
    await db.execute("UPDATE ai_tasks SET status = 'cancelled', updated_at = ? WHERE id = ? AND status = 'queued'",
                     (db.now_iso(), tid))
    publish("task", await get_task(tid))


async def retry(tid: int) -> None:
    await db.execute("UPDATE ai_tasks SET status = 'queued', attempts = 0, run_after = NULL, last_error = NULL, "
                     "priority = MIN(priority, 20), updated_at = ? WHERE id = ?", (db.now_iso(), tid))
    _wake.set()


def wake() -> None:
    _wake.set()


async def _next_task() -> Optional[Dict[str, Any]]:
    return await db.fetch_one(
        "ai_tasks",
        "SELECT * FROM ai_tasks WHERE status = 'queued' AND (run_after IS NULL OR run_after <= ?) "
        "ORDER BY priority, id LIMIT 1",
        (db.now_iso(),),
    )


async def _seconds_until_next() -> float:
    t = await db.fetch_one("ai_tasks", "SELECT MIN(run_after) AS ra FROM ai_tasks WHERE status = 'queued'")
    if t and t.get("ra"):
        try:
            return max(1.0, (datetime.fromisoformat(t["ra"]) - datetime.now()).total_seconds())
        except ValueError:
            pass
    return 300.0


async def worker() -> None:
    # tasks left "running" by a crash/restart go back to the queue
    await db.execute("UPDATE ai_tasks SET status = 'queued' WHERE status = 'running'")
    while True:
        try:
            settings = await db.get_settings()
            task = None if settings.get("paused") else await _next_task()
            if task is None:
                _wake.clear()
                try:
                    await asyncio.wait_for(_wake.wait(), timeout=min(await _seconds_until_next(), 300))
                except asyncio.TimeoutError:
                    pass
                continue
            await _run(task)
        except asyncio.CancelledError:
            raise
        except Exception as e:  # never let the worker die
            print("task worker error:", e)
            await asyncio.sleep(5)


async def _run(task: Dict[str, Any]) -> None:
    tid = task["id"]
    fn = HANDLERS.get(task["kind"])
    if fn is None:
        await db.update("ai_tasks", tid, {"status": "failed", "last_error": "type de tâche inconnu"}, touch=False)
        return
    await db.update("ai_tasks", tid, {"status": "running", "attempts": task["attempts"] + 1,
                                      "updated_at": db.now_iso()}, touch=False)
    _state["running"] = {"id": tid, "kind": task["kind"], "label": LABELS.get(task["kind"]), "job_id": task["job_id"]}
    publish("task", await get_task(tid))
    try:
        result = await fn(task)
        await db.update("ai_tasks", tid, {"status": "done", "result": result if isinstance(result, (dict, list)) else {"ok": True},
                                          "last_error": None, "updated_at": db.now_iso()}, touch=False)
        if _state["waiting_until"]:
            _state["waiting_until"] = None
            publish("ai_pool", {k: v for k, v in (await pool_status()).items() if k != "accounts"})
    except AIUnavailable as e:
        resume = e.resume_at or datetime.now() + timedelta(minutes=15)
        _state["waiting_until"] = resume.isoformat(timespec="seconds")
        # Not the task's fault: don't count the attempt; every queued task waits for the reset.
        await db.update("ai_tasks", tid, {"status": "queued", "attempts": task["attempts"],
                                          "run_after": _state["waiting_until"], "last_error": str(e)[:300],
                                          "updated_at": db.now_iso()}, touch=False)
        await db.execute("UPDATE ai_tasks SET run_after = ? WHERE status = 'queued' AND (run_after IS NULL OR run_after < ?)",
                         (_state["waiting_until"], _state["waiting_until"]))
        await db.log_activity("WARNING", f"IA indisponible : la file d'attente reprendra automatiquement à {resume:%H:%M} le {resume:%d/%m}.")
        publish("ai_waiting", {"until": _state["waiting_until"]})
    except Exception as e:
        attempts = task["attempts"] + 1
        failed = attempts >= MAX_ATTEMPTS
        await db.update("ai_tasks", tid, {
            "status": "failed" if failed else "queued",
            "run_after": None if failed else (datetime.now() + timedelta(minutes=2 * attempts)).isoformat(timespec="seconds"),
            "last_error": f"{type(e).__name__}: {str(e)[:280]}", "updated_at": db.now_iso(),
        }, touch=False)
        if failed:
            await db.log_activity("ERROR", f"Tâche « {LABELS.get(task['kind'], task['kind'])} » abandonnée après {attempts} essais : {str(e)[:160]}", task.get("job_id"))
            traceback.print_exc()
    finally:
        _state["running"] = None
        publish("task", await get_task(tid))
