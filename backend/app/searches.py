"""Running saved searches across sources and storing new offers."""
from __future__ import annotations

import asyncio
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from . import database as db
from .events import publish
from .scrapers.base import SearchParams

_running: Dict[int, bool] = {}


def running_ids() -> List[int]:
    return [k for k, v in _running.items() if v]


async def run_search(search_id: int, manual: bool = False) -> Dict[str, Any]:
    from .scrapers import filters
    from .scrapers.runner import run_search as run_sources
    from .tasks import enqueue

    s = await db.fetch_one("searches", "SELECT * FROM searches WHERE id = ?", (search_id,))
    if not s:
        raise ValueError("Recherche introuvable")
    if _running.get(search_id):
        return {"status": "already_running"}
    _running[search_id] = True
    publish("search_running", {"id": search_id, "running": True})
    settings = await db.get_settings()
    try:
        locations = s.get("locations") or [""]
        reports, postings = [], []
        for loc in locations:
            params = SearchParams(query=s["query"], location=loc, radius_km=s.get("radius_km") or 30,
                                  contract_types=s.get("contract_types") or [], remote=s.get("remote") or "any",
                                  max_age_days=s.get("max_age_days") or 14)
            rep = await run_sources(params, s.get("sources") or None, settings.get("source_credentials") or {},
                                    exclude_keywords=s.get("exclude_keywords") or [],
                                    include_keywords=s.get("include_keywords") or [])
            postings.extend(rep.postings)
            for r in rep.sources:
                reports.append({**r.model_dump(), "location": loc or "France"})

        new_ids = []
        for p in filters.dedupe(postings):
            fp = filters.fingerprint(p)
            if await db.fetch_one("jobs", "SELECT id FROM jobs WHERE fingerprint = ? OR external_id = ?", (fp, p.external_id)):
                continue
            school, reason = filters.detect_school_ad(p)
            hide = school and settings.get("hide_school_ads", True)
            jid = await db.insert("jobs", {
                "external_id": p.external_id, "fingerprint": fp, "source": p.source, "source_label": p.source_label,
                "title": p.title, "company": p.company, "location": p.location, "contract_type": p.contract_type,
                "description": p.description, "url": p.url, "apply_url": p.apply_url, "contact_email": p.contact_email,
                "salary": p.salary, "posted_at": p.posted_at, "remote": p.remote, "search_id": search_id,
                "is_school_ad": school, "school_reason": reason or None,
                "status": "archived" if hide else "new", "archived_reason": "Publicité d'école / CFA" if hide else None,
                "extra": p.extra,
            }, or_ignore=True)
            if jid:
                new_ids.append(jid)
                if not hide and settings.get("auto_score", True):
                    await enqueue("score", jid, priority=60)

        interval = s.get("interval_mins") or settings.get("search_interval_mins") or 180
        now = datetime.now()
        await db.update("searches", search_id, {
            "last_run_at": now.isoformat(timespec="seconds"),
            "next_run_at": (now + timedelta(minutes=int(interval))).isoformat(timespec="seconds"),
            "last_report": reports, "total_found": (s.get("total_found") or 0) + len(new_ids),
            "new_last_run": len(new_ids),
        }, touch=False)
        ok = sum(1 for r in reports if r.get("ok"))
        failed = sum(1 for r in reports if not r.get("ok") and not r.get("skipped"))
        await db.log_activity("SUCCESS" if new_ids else "INFO",
                              f"Recherche « {s['label'] or s['query']} » : {len(new_ids)} nouvelle(s) offre(s) — "
                              f"{ok} source(s) OK" + (f", {failed} en erreur" if failed else "") + ".")
        publish("jobs_changed", {"new": len(new_ids), "search_id": search_id})
        return {"status": "ok", "new": len(new_ids), "report": reports}
    finally:
        _running[search_id] = False
        publish("search_running", {"id": search_id, "running": False})


async def run_due_searches() -> None:
    due = await db.fetch_all("searches", "SELECT * FROM searches WHERE active = 1 AND (next_run_at IS NULL OR next_run_at <= ?)",
                             (db.now_iso(),))
    for s in due:
        try:
            await run_search(s["id"])
        except Exception as e:
            await db.log_activity("ERROR", f"Recherche « {s['label'] or s['query']} » en erreur : {str(e)[:200]}")
            await db.update("searches", s["id"], {"next_run_at": (datetime.now() + timedelta(minutes=30)).isoformat(timespec="seconds")},
                            touch=False)
