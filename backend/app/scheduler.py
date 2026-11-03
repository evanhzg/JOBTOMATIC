"""Background loop: refresh searches, send due follow-ups, watch the inbox.
AI work itself runs in the task queue worker (app/tasks.py)."""
from __future__ import annotations

import asyncio
from datetime import datetime
from typing import Any, Dict, Optional

from . import applications, inbox, searches
from . import database as db
from . import tasks
from .ai.pool import pool_status
from .events import publish

TICK_SECONDS = 60
IMAP_EVERY_SECONDS = 300

state: Dict[str, Any] = {"started_at": None, "last_tick": None, "last_imap": None, "next_search_at": None}


async def status() -> Dict[str, Any]:
    s = await db.get_settings()
    nxt = await db.fetch_one("searches", "SELECT MIN(next_run_at) AS n FROM searches WHERE active = 1")
    fu = await db.fetch_one("followups", "SELECT MIN(due_at) AS n, COUNT(*) AS c FROM followups WHERE status = 'scheduled'")
    manual = await db.fetch_one("followups", "SELECT COUNT(*) AS c FROM followups WHERE status = 'manual'")
    pool = await pool_status()
    q = await tasks.queue_summary()
    return {
        "autopilot": bool(s.get("autopilot_enabled")), "paused": bool(s.get("paused")),
        "auto_search": bool(s.get("auto_search", True)),
        "next_search_at": (nxt or {}).get("n"), "searches_running": searches.running_ids(),
        "next_followup_at": (fu or {}).get("n"), "followups_scheduled": (fu or {}).get("c", 0),
        "followups_manual": (manual or {}).get("c", 0),
        "ai": {k: v for k, v in pool.items() if k != "accounts"},
        "ai_accounts": [{"id": a["id"], "label": a["label"], "provider": a["provider"], "status": a["status"],
                         "limited_until": a.get("limited_until"), "enabled": a["enabled"]} for a in pool["accounts"]],
        "queue": {"counts": q["counts"], "running": q["running"], "waiting_until": q["waiting_until"]},
        "applications_today": s.get("applications_today", 0) if s.get("applications_day") == datetime.now().strftime("%Y-%m-%d") else 0,
        "daily_limit": s.get("daily_application_limit"),
        "last_imap": state["last_imap"], "last_tick": state["last_tick"],
    }


async def tick() -> None:
    s = await db.get_settings()
    state["last_tick"] = db.now_iso()
    if s.get("paused"):
        publish("status", await status())
        return
    if s.get("auto_search", True):
        await searches.run_due_searches()
    await applications.process_due_followups()
    last = state["last_imap"]
    if not last or (datetime.now() - datetime.fromisoformat(last)).total_seconds() > IMAP_EVERY_SECONDS:
        state["last_imap"] = db.now_iso()
        try:
            await inbox.check_replies()
        except Exception as e:
            await db.log_activity("WARNING", f"Lecture de la boîte mail impossible : {str(e)[:160]}")
    publish("status", await status())


async def loop() -> None:
    state["started_at"] = db.now_iso()
    await asyncio.sleep(3)
    while True:
        try:
            await tick()
        except asyncio.CancelledError:
            raise
        except Exception as e:
            await db.log_activity("ERROR", f"Boucle d'automatisation : {str(e)[:200]}")
        await asyncio.sleep(TICK_SECONDS)


class Runner:
    def __init__(self):
        self._tasks: list[asyncio.Task] = []

    async def start(self):
        self._tasks = [asyncio.create_task(loop()), asyncio.create_task(tasks.worker())]

    async def stop(self):
        for t in self._tasks:
            t.cancel()
        self._tasks = []


runner = Runner()
