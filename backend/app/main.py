"""Plonge API."""
from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import Body, FastAPI, File, HTTPException, Query, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import applications, mailer, scheduler, searches, tasks
from . import database as db
from . import pipeline  # noqa: F401  (registers task handlers)
from .ai import linking, pool
from .config import APP_NAME, BASE_DIR
from .cv import pdf_engine as pe
from .cv import service as cv
from .events import publish, subscribe, unsubscribe


@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.init_db()
    # First launch with a CV carried over from the old app: read the profile from it.
    if not (await db.get_profile()).get("full_name") and await db.get_master_cv():
        await tasks.enqueue("profile_from_cv", None, {}, priority=5)
    await scheduler.runner.start()
    yield
    await scheduler.runner.stop()


app = FastAPI(title=f"{APP_NAME} API", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def bad(e: Exception, code: int = 400):
    raise HTTPException(status_code=code, detail=str(e))


# ================================================================== general

@app.get("/api/health")
async def health():
    return {"status": "ok", "app": APP_NAME}


@app.get("/api/status")
async def status():
    return await scheduler.status()


@app.get("/api/logs")
async def logs(limit: int = 80):
    return await db.fetch_all("logs", "SELECT * FROM logs ORDER BY id DESC LIMIT ?", (limit,))


@app.websocket("/ws")
async def ws(websocket: WebSocket):
    await websocket.accept()
    q = subscribe()
    try:
        while True:
            msg = await q.get()
            await websocket.send_text(msg)
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        unsubscribe(q)


# ================================================================== jobs

JOB_LIST_COLS = ("id, external_id, source, source_label, title, company, location, contract_type, url, apply_url, "
                 "contact_email, salary, posted_at, remote, search_id, status, archived_reason, match_score, ai_summary, "
                 "match_reasons, strengths, gaps, is_school_ad, school_reason, ats_before, ats_after, tailored_cv_path, "
                 "apply_method, applied_at, answer_at, answer_class, answer_snippet, starred, notes, created_at, updated_at, "
                 "substr(description, 1, 400) AS description_preview")


@app.get("/api/jobs")
async def list_jobs(status: Optional[str] = None, q: Optional[str] = None, min_score: Optional[int] = None,
                    source: Optional[str] = None, contract: Optional[str] = None, archived: bool = False,
                    limit: int = 500):
    where, params = [], []
    if status:
        where.append("status IN (%s)" % ",".join("?" for _ in status.split(",")))
        params += status.split(",")
    elif not archived:
        where.append("status != 'archived'")
    if q:
        where.append("(title LIKE ? OR company LIKE ? OR location LIKE ? OR description LIKE ?)")
        params += [f"%{q}%"] * 4
    if min_score is not None:
        where.append("match_score >= ?")
        params.append(min_score)
    if source:
        where.append("source = ?")
        params.append(source)
    if contract:
        where.append("contract_type = ?")
        params.append(contract)
    sql = f"SELECT {JOB_LIST_COLS} FROM jobs" + (" WHERE " + " AND ".join(where) if where else "")
    sql += " ORDER BY starred DESC, COALESCE(match_score, -1) DESC, id DESC LIMIT ?"
    params.append(limit)
    jobs = await db.fetch_all("jobs", sql, params)
    fu = await db.fetch_all("followups", "SELECT job_id, status, due_at, seq FROM followups WHERE status IN ('scheduled','manual') ORDER BY due_at")
    nxt: Dict[int, Dict[str, Any]] = {}
    for f in fu:
        nxt.setdefault(f["job_id"], f)
    for j in jobs:
        j["next_followup"] = nxt.get(j["id"])
        j["has_cv"] = bool(j.pop("tailored_cv_path", None))
    return jobs


@app.get("/api/jobs/counts")
async def job_counts():
    rows = await db.fetch_all("jobs", "SELECT status, COUNT(*) AS n FROM jobs GROUP BY status")
    return {r["status"]: r["n"] for r in rows}


@app.get("/api/jobs/{job_id}")
async def get_job(job_id: int):
    job = await db.fetch_one("jobs", "SELECT * FROM jobs WHERE id = ?", (job_id,))
    if not job:
        raise HTTPException(404, "Offre introuvable")
    job["followups"] = await db.fetch_all("followups", "SELECT * FROM followups WHERE job_id = ? ORDER BY seq", (job_id,))
    job["tasks"] = await db.fetch_all("ai_tasks", "SELECT id, kind, status, last_error, run_after FROM ai_tasks WHERE job_id = ? "
                                      "AND status IN ('queued','running','failed') ORDER BY id DESC LIMIT 5", (job_id,))
    job["has_cv"] = bool(job.get("tailored_cv_path") and Path(job["tailored_cv_path"]).exists())
    job["cv_pages"] = pe.page_count(job["tailored_cv_path"]) if job["has_cv"] else 0
    return job


class JobPatch(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    starred: Optional[bool] = None
    contact_email: Optional[str] = None
    cover_letter: Optional[str] = None
    email_subject: Optional[str] = None
    archived_reason: Optional[str] = None


@app.patch("/api/jobs/{job_id}")
async def patch_job(job_id: int, payload: JobPatch):
    values = payload.model_dump(exclude_none=True)
    if values.get("status") and values["status"] not in ("new", "ready", "applied", "answered", "interview", "archived"):
        raise HTTPException(400, "Statut inconnu")
    await db.update("jobs", job_id, values)
    if values.get("status") in ("answered", "interview", "archived"):
        await applications.cancel_followups(job_id, "statut changé à la main")
    publish("job_updated", {"id": job_id})
    return {"ok": True}


@app.delete("/api/jobs/{job_id}")
async def delete_job(job_id: int):
    await db.execute("DELETE FROM followups WHERE job_id = ?", (job_id,))
    await db.execute("DELETE FROM jobs WHERE id = ?", (job_id,))
    publish("job_deleted", {"id": job_id})
    return {"ok": True}


@app.post("/api/jobs/{job_id}/score")
async def score_job(job_id: int):
    return {"task_id": await tasks.enqueue("score", job_id, priority=10)}


@app.post("/api/jobs/{job_id}/tailor")
async def tailor_job(job_id: int):
    return {"task_id": await tasks.enqueue("tailor", job_id, priority=10)}


@app.post("/api/jobs/{job_id}/apply")
async def apply_job(job_id: int):
    try:
        return await applications.apply(job_id)
    except mailer.MailNotConfigured as e:
        bad(e, 412)
    except ValueError as e:
        bad(e)
    except Exception as e:
        bad(Exception(f"Envoi impossible : {e}"), 502)


@app.post("/api/jobs/{job_id}/mark-applied")
async def mark_applied(job_id: int):
    await applications.mark_applied_manually(job_id)
    return {"ok": True}


@app.post("/api/jobs/apply-ready")
async def apply_ready():
    jobs = await db.fetch_all("jobs", "SELECT id FROM jobs WHERE status = 'ready' AND contact_email != '' AND tailored_cv_path IS NOT NULL")
    sent, errors = 0, []
    for j in jobs:
        try:
            r = await applications.apply(j["id"])
            sent += r.get("action") == "sent"
        except Exception as e:
            errors.append(str(e))
            if isinstance(e, mailer.MailNotConfigured):
                break
    return {"sent": sent, "errors": errors[:5]}


@app.put("/api/jobs/{job_id}/cv-edits")
async def job_cv_edits(job_id: int, edits: Dict[str, str] = Body(...)):
    try:
        return await cv.save_job_cv_edits(job_id, edits)
    except ValueError as e:
        bad(e)


@app.get("/api/jobs/{job_id}/cv.pdf")
async def job_cv_pdf(job_id: int, download: bool = False):
    job = await db.fetch_one("jobs", "SELECT tailored_cv_path, title FROM jobs WHERE id = ?", (job_id,))
    if not job or not job.get("tailored_cv_path") or not Path(job["tailored_cv_path"]).exists():
        raise HTTPException(404, "CV adapté non disponible")
    return FileResponse(job["tailored_cv_path"], media_type="application/pdf",
                        content_disposition_type="attachment" if download else "inline",
                        filename=Path(job["tailored_cv_path"]).name)


@app.get("/api/jobs/{job_id}/cv/page/{n}.png")
async def job_cv_png(job_id: int, n: int, dpi: int = 110):
    job = await db.fetch_one("jobs", "SELECT tailored_cv_path FROM jobs WHERE id = ?", (job_id,))
    if not job or not job.get("tailored_cv_path") or not Path(job["tailored_cv_path"]).exists():
        raise HTTPException(404, "CV adapté non disponible")
    png = await asyncio.to_thread(pe.render_page_png, job["tailored_cv_path"], n, min(dpi, 200))
    return Response(png, media_type="image/png", headers={"Cache-Control": "no-store"})


class ImportOffer(BaseModel):
    url: str = ""
    text: str = ""


@app.post("/api/jobs/import")
async def import_offer(payload: ImportOffer):
    if not payload.url.strip() and not payload.text.strip():
        raise HTTPException(400, "Collez un lien ou le texte de l'offre.")
    return {"task_id": await tasks.enqueue("import_offer", None, payload.model_dump(), priority=10, dedupe=False)}


# ================================================================== searches & sources

class SearchIn(BaseModel):
    label: str = ""
    query: str
    locations: List[str] = []
    radius_km: int = 30
    contract_types: List[str] = []
    remote: str = "any"
    max_age_days: int = 14
    sources: List[str] = []
    exclude_keywords: List[str] = []
    include_keywords: List[str] = []
    active: bool = True
    interval_mins: Optional[int] = None


@app.get("/api/searches")
async def list_searches():
    rows = await db.fetch_all("searches", "SELECT * FROM searches ORDER BY id DESC")
    running = set(searches.running_ids())
    for r in rows:
        r["running"] = r["id"] in running
    return rows


@app.post("/api/searches")
async def create_search(payload: SearchIn):
    sid = await db.insert("searches", payload.model_dump())
    publish("searches_changed", {})
    asyncio.create_task(searches.run_search(sid, manual=True))
    return {"id": sid}


@app.put("/api/searches/{sid}")
async def update_search(sid: int, payload: SearchIn):
    await db.update("searches", sid, payload.model_dump(), touch=False)
    publish("searches_changed", {})
    return {"ok": True}


@app.delete("/api/searches/{sid}")
async def delete_search(sid: int):
    await db.execute("DELETE FROM searches WHERE id = ?", (sid,))
    publish("searches_changed", {})
    return {"ok": True}


@app.post("/api/searches/{sid}/run")
async def run_search(sid: int):
    asyncio.create_task(searches.run_search(sid, manual=True))
    return {"started": True}


@app.post("/api/searches/run-all")
async def run_all():
    for s in await db.fetch_all("searches", "SELECT id FROM searches WHERE active = 1"):
        asyncio.create_task(searches.run_search(s["id"], manual=True))
    return {"started": True}


@app.get("/api/sources")
async def sources():
    from .scrapers.runner import list_sources
    s = await db.get_settings()
    return list_sources(s.get("source_credentials") or {})


@app.put("/api/sources/credentials")
async def set_source_credentials(payload: Dict[str, Dict[str, str]] = Body(...)):
    s = await db.get_settings()
    creds = s.get("source_credentials") or {}
    for key, values in payload.items():
        cur = creds.get(key, {})
        cur.update({k: v.strip() for k, v in values.items() if v is not None and "•" not in v})
        creds[key] = {k: v for k, v in cur.items() if v}
    await db.set_settings({"source_credentials": creds})
    return {"ok": True}


# ================================================================== CV & profile

@app.get("/api/cv")
async def get_cv():
    m = await cv.master()
    versions = await db.fetch_all("cv_versions", "SELECT id, label, kind, is_master, created_at, edits FROM cv_versions ORDER BY id DESC")
    for v in versions:
        v["edited_blocks"] = len(v.pop("edits") or {})
    out: Dict[str, Any] = {"master": None, "versions": versions, "units": [], "profile": await db.get_profile()}
    if m:
        units = await asyncio.to_thread(pe.extract_units, m["pdf_path"])
        out["master"] = {"id": m["id"], "label": m["label"], "kind": m["kind"], "audit": m.get("audit"),
                         "pages": pe.page_count(m["pdf_path"]), "created_at": m["created_at"],
                         "measured": cv.measure(units)}
        out["units"] = [u.public() for u in units]
    return out


@app.post("/api/cv/upload")
async def upload_cv(file: UploadFile = File(...)):
    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(400, "Importez un PDF (exporté depuis Canva, Word, etc.).")
    try:
        res = await cv.import_cv(file.filename, await file.read())
    except ValueError as e:
        bad(e)
    res["task_id"] = await tasks.enqueue("profile_from_cv", None, {"version": res["version_id"]}, priority=10)
    return res


@app.get("/api/cv/versions/{vid}.pdf")
async def version_pdf(vid: int):
    v = await db.fetch_one("cv_versions", "SELECT pdf_path, label FROM cv_versions WHERE id = ?", (vid,))
    if not v or not Path(v["pdf_path"]).exists():
        raise HTTPException(404, "Version introuvable")
    return FileResponse(v["pdf_path"], media_type="application/pdf", content_disposition_type="inline")


@app.get("/api/cv/versions/{vid}/page/{n}.png")
async def version_png(vid: int, n: int, dpi: int = 110):
    v = await db.fetch_one("cv_versions", "SELECT pdf_path FROM cv_versions WHERE id = ?", (vid,))
    if not v or not Path(v["pdf_path"]).exists():
        raise HTTPException(404, "Version introuvable")
    png = await asyncio.to_thread(pe.render_page_png, v["pdf_path"], n, min(dpi, 200))
    return Response(png, media_type="image/png", headers={"Cache-Control": "max-age=3600"})


@app.post("/api/cv/versions/{vid}/master")
async def version_master(vid: int):
    try:
        await cv.set_master(vid)
    except ValueError as e:
        bad(e)
    return {"ok": True}


@app.delete("/api/cv/versions/{vid}")
async def version_delete(vid: int):
    v = await db.fetch_one("cv_versions", "SELECT * FROM cv_versions WHERE id = ?", (vid,))
    if not v:
        raise HTTPException(404, "Version introuvable")
    if v["is_master"]:
        raise HTTPException(400, "Choisissez d'abord une autre version principale.")
    await db.execute("DELETE FROM cv_versions WHERE id = ?", (vid,))
    publish("cv_updated", {})
    return {"ok": True}


@app.post("/api/cv/audit")
async def cv_audit(target: str = Body("", embed=True)):
    p = await db.get_profile()
    target = target.strip() or ", ".join(p.get("target_roles") or []) or "postes visés"
    return {"task_id": await tasks.enqueue("audit", None, {"target": target}, priority=10)}


@app.post("/api/cv/preview")
async def cv_preview(edits: Dict[str, str] = Body(..., embed=True)):
    try:
        return await cv.preview(edits)
    except ValueError as e:
        bad(e)


@app.get("/api/cv/preview/{token}/page/{n}.png")
async def cv_preview_png(token: str, n: int, dpi: int = 110):
    path = cv.PREVIEW_DIR / f"{token}.pdf"
    if not token.isalnum() or not path.exists():
        raise HTTPException(404, "Aperçu expiré")
    png = await asyncio.to_thread(pe.render_page_png, path, n, min(dpi, 200))
    return Response(png, media_type="image/png")


class SaveVersion(BaseModel):
    edits: Dict[str, str]
    label: str = ""


@app.post("/api/cv/save")
async def cv_save(payload: SaveVersion):
    try:
        return await cv.save_version(payload.edits, payload.label)
    except ValueError as e:
        bad(e)


@app.post("/api/cv/profile-refresh")
async def profile_refresh():
    return {"task_id": await tasks.enqueue("profile_from_cv", None, {}, priority=10)}


class ProfileIn(BaseModel):
    full_name: str = ""
    email: str = ""
    phone: str = ""
    city: str = ""
    headline: str = ""
    summary: str = ""
    skills: List[str] = []
    experiences: List[Dict[str, Any]] = []
    education: List[Dict[str, Any]] = []
    languages: List[str] = []
    preferences: Dict[str, Any] = {}
    target_roles: List[str] = []


@app.get("/api/profile")
async def get_profile():
    return await db.get_profile()


@app.put("/api/profile")
async def put_profile(payload: ProfileIn):
    await db.update("profile", 1, {**payload.model_dump(), "updated_at": db.now_iso()}, touch=False)
    publish("profile_updated", {})
    return {"ok": True}


# ================================================================== follow-ups

@app.get("/api/followups")
async def list_followups(include_done: bool = False):
    sql = ("SELECT f.*, j.title, j.company, j.contact_email, j.applied_at, j.status AS job_status, j.url "
           "FROM followups f JOIN jobs j ON j.id = f.job_id")
    if not include_done:
        sql += " WHERE f.status IN ('scheduled', 'manual', 'failed')"
    sql += " ORDER BY CASE f.status WHEN 'manual' THEN 0 WHEN 'failed' THEN 1 ELSE 2 END, f.due_at"
    return await db.fetch_all("followups", sql)


class FollowupPatch(BaseModel):
    due_at: Optional[str] = None
    subject: Optional[str] = None
    body: Optional[str] = None


@app.patch("/api/followups/{fid}")
async def patch_followup(fid: int, payload: FollowupPatch):
    await db.update("followups", fid, payload.model_dump(exclude_none=True), touch=False)
    publish("followups", {})
    return {"ok": True}


@app.post("/api/followups/{fid}/send")
async def send_followup_now(fid: int):
    try:
        return await applications.send_followup(fid)
    except pool.AIUnavailable as e:
        bad(Exception(f"IA indisponible jusqu'à {e.resume_at:%H:%M}" if e.resume_at else str(e)), 503)
    except mailer.MailNotConfigured as e:
        bad(e, 412)
    except Exception as e:
        bad(e, 502)


@app.post("/api/followups/{fid}/draft")
async def draft_followup(fid: int):
    try:
        return await applications.draft_only(fid)
    except pool.AIUnavailable as e:
        bad(Exception(f"IA indisponible jusqu'à {e.resume_at:%H:%M}" if e.resume_at else str(e)), 503)
    except ValueError as e:
        bad(e)


@app.post("/api/followups/{fid}/done")
async def followup_done(fid: int):
    await db.update("followups", fid, {"status": "sent", "sent_at": db.now_iso()}, touch=False)
    publish("followups", {})
    return {"ok": True}


@app.delete("/api/followups/{fid}")
async def cancel_followup(fid: int):
    await db.update("followups", fid, {"status": "cancelled", "error": "annulée à la main"}, touch=False)
    publish("followups", {})
    return {"ok": True}


@app.post("/api/jobs/{job_id}/followups/reschedule")
async def reschedule(job_id: int):
    return {"ids": await applications.schedule_followups(job_id)}


# ================================================================== AI accounts & queue

@app.get("/api/ai/providers")
async def providers():
    return pool.PROVIDERS


@app.get("/api/ai/accounts")
async def ai_accounts():
    return await pool.pool_status()


class AccountIn(BaseModel):
    provider: str
    label: str = ""
    auth: str = "default"
    secret: str = ""
    model: str = ""
    priority: int = 100
    env: Dict[str, str] = {}


@app.post("/api/ai/accounts")
async def add_account(payload: AccountIn):
    try:
        return await linking.create_account(**payload.model_dump())
    except ValueError as e:
        bad(e)


class AccountPatch(BaseModel):
    label: Optional[str] = None
    enabled: Optional[bool] = None
    priority: Optional[int] = None
    model: Optional[str] = None
    secret: Optional[str] = None


@app.patch("/api/ai/accounts/{aid}")
async def patch_account(aid: int, payload: AccountPatch):
    values = payload.model_dump(exclude_none=True)
    if values.get("secret") == "":
        values.pop("secret")
    if "secret" in values:
        values["status"] = "unknown"
    await db.update("ai_accounts", aid, values, touch=False)
    a = await db.fetch_one("ai_accounts", "SELECT * FROM ai_accounts WHERE id = ?", (aid,))
    publish("ai_account", pool.public_account(a))
    tasks.wake()
    return pool.public_account(a)


@app.delete("/api/ai/accounts/{aid}")
async def delete_account(aid: int):
    await db.execute("DELETE FROM ai_accounts WHERE id = ?", (aid,))
    publish("ai_account", {"id": aid, "deleted": True})
    return {"ok": True}


@app.post("/api/ai/accounts/{aid}/test")
async def test_account(aid: int):
    res = await linking.test_account(aid)
    tasks.wake()
    return res


@app.post("/api/ai/accounts/{aid}/check")
async def check_account(aid: int):
    try:
        res = await linking.check_login(aid)
    except ValueError as e:
        bad(e)
    tasks.wake()
    return res


@app.post("/api/ai/accounts/{aid}/clear-limit")
async def clear_limit(aid: int):
    await db.update("ai_accounts", aid, {"status": "unknown", "limited_until": None, "consecutive_errors": 0}, touch=False)
    await db.execute("UPDATE ai_tasks SET run_after = NULL WHERE status = 'queued'")
    tasks.wake()
    a = await db.fetch_one("ai_accounts", "SELECT * FROM ai_accounts WHERE id = ?", (aid,))
    publish("ai_account", pool.public_account(a))
    return {"ok": True}


@app.post("/api/ai/accounts/{aid}/login")
async def device_login(aid: int):
    try:
        return await linking.start_device_login(aid)
    except ValueError as e:
        bad(e)


@app.get("/api/ai/accounts/{aid}/login")
async def device_login_state(aid: int):
    return linking.device_login_state(aid)


@app.get("/api/tasks")
async def list_tasks():
    return await tasks.queue_summary()


@app.get("/api/tasks/{tid}")
async def get_task(tid: int):
    t = await tasks.get_task(tid)
    if not t:
        raise HTTPException(404, "Tâche introuvable")
    return t


@app.post("/api/tasks/{tid}/cancel")
async def cancel_task(tid: int):
    await tasks.cancel(tid)
    return {"ok": True}


@app.post("/api/tasks/{tid}/retry")
async def retry_task(tid: int):
    await tasks.retry(tid)
    return {"ok": True}


# ================================================================== settings

SECRET_KEYS = {"gmail_app_password"}
HIDDEN_KEYS = {"imap_seen", "source_credentials"}


@app.get("/api/settings")
async def get_settings():
    s = await db.get_settings()
    out = {k: v for k, v in s.items() if k not in HIDDEN_KEYS}
    for k in SECRET_KEYS:
        out[k + "_set"] = bool(s.get(k))
        out[k] = ""
    return out


@app.put("/api/settings")
async def put_settings(payload: Dict[str, Any] = Body(...)):
    allowed = set(db.DEFAULT_SETTINGS) | {"auto_search", "auto_score"}
    values = {k: v for k, v in payload.items() if k in allowed and k not in HIDDEN_KEYS}
    for k in SECRET_KEYS:
        if not values.get(k):
            values.pop(k, None)
    await db.set_settings(values)
    if "paused" in values or "autopilot_enabled" in values:
        tasks.wake()
    publish("settings", {k: v for k, v in values.items() if k not in SECRET_KEYS})
    publish("status", await scheduler.status())
    return {"ok": True}


@app.post("/api/settings/email-test")
async def email_test():
    return await mailer.test_connection()


# ================================================================== frontend (built)

DIST = BASE_DIR.parent / "frontend" / "dist"
if DIST.exists():
    app.mount("/", StaticFiles(directory=str(DIST), html=True), name="ui")
