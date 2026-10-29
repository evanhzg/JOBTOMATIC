import asyncio
import json
import os
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional
import aiosqlite
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .config import CVS_DIR, DB_PATH, SCREENSHOTS_DIR
from .database import get_db, init_db, log_activity
from .agy_bridge import agy_bridge
from .cv_renderer import cv_renderer
from .scrapers import run_all_scrapers
from .apply_engine import apply_engine
from .inbox_tracker import inbox_tracker
from .scheduler import scheduler

# Connected WebSocket clients
connected_clients: List[WebSocket] = []

async def broadcast_ws(event_type: str, data: Any):
    msg = json.dumps({"type": event_type, "data": data})
    for client in list(connected_clients):
        try:
            await client.send_text(msg)
        except Exception:
            if client in connected_clients:
                connected_clients.remove(client)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    await scheduler.start()
    yield
    # Shutdown
    await scheduler.stop()

app = FastAPI(title="JobHunter AGY API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount storage directories for PDFs and screenshots
app.mount("/static/cvs", StaticFiles(directory=str(CVS_DIR)), name="cvs")
app.mount("/static/screenshots", StaticFiles(directory=str(SCREENSHOTS_DIR)), name="screenshots")

# Pydantic Request Models
class SearchQueryCreate(BaseModel):
    query_text: str
    location: str
    radius_km: int = 25
    contract_types: List[str] = ["Alternance", "Intérim"]
    platforms: List[str] = ["France Travail", "Indeed", "HelloWork"]

class JobStatusUpdate(BaseModel):
    status: str

class ProfileUpdate(BaseModel):
    full_name: str
    email: str
    phone: str
    city: str
    headline: str
    summary: str
    skills: List[str]
    experiences: List[Dict[str, Any]]
    education: List[Dict[str, Any]]
    languages: List[str] = []
    preferences: Dict[str, Any] = {}

class SettingsUpdate(BaseModel):
    is_autopilot_enabled: Optional[bool] = None
    is_paused: Optional[bool] = None
    match_score_threshold: Optional[int] = None
    daily_application_limit: Optional[int] = None
    gmail_address: Optional[str] = None
    gmail_app_password: Optional[str] = None

# Endpoints

@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "JobHunter AGY"}

@app.get("/api/stats")
async def get_stats():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute("SELECT status, COUNT(*) as cnt FROM jobs GROUP BY status")
        counts = {row["status"]: row["cnt"] for row in await cur.fetchall()}

        cur = await db.execute("SELECT * FROM settings WHERE id = 1")
        settings = dict(await cur.fetchone())

        cur = await db.execute("SELECT COUNT(*) FROM search_queries WHERE is_active = 1")
        queries_count = (await cur.fetchone())[0]

    return {
        "discovered": counts.get("discovered", 0),
        "tailored": counts.get("tailored", 0),
        "applied": counts.get("applied", 0),
        "answer_received": counts.get("answer_received", 0),
        "interview": counts.get("interview", 0),
        "archived": counts.get("archived", 0),
        "total_jobs": sum(counts.values()),
        "applications_today": settings.get("applications_sent_today", 0),
        "daily_limit": settings.get("daily_application_limit", 20),
        "autopilot_enabled": bool(settings.get("is_autopilot_enabled", 0)),
        "is_paused": bool(settings.get("is_paused", 0)),
        "threshold": settings.get("match_score_threshold", 75),
        "active_queries": queries_count
    }

@app.get("/api/jobs")
async def get_jobs():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute("SELECT * FROM jobs ORDER BY id DESC")
        jobs = [dict(row) for row in await cur.fetchall()]

        # Parse JSON fields
        for j in jobs:
            if j.get("match_reasons"):
                try:
                    j["match_reasons"] = json.loads(j["match_reasons"])
                except Exception:
                    j["match_reasons"] = []
            if j.get("tailored_skills"):
                try:
                    j["tailored_skills"] = json.loads(j["tailored_skills"])
                except Exception:
                    j["tailored_skills"] = []

    return jobs

@app.get("/api/jobs/{job_id}")
async def get_job(job_id: int):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute("SELECT * FROM jobs WHERE id = ?", (job_id,))
        row = await cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Offre non trouvée")
        job = dict(row)
        if job.get("match_reasons"):
            try:
                job["match_reasons"] = json.loads(job["match_reasons"])
            except Exception:
                job["match_reasons"] = []
        if job.get("tailored_skills"):
            try:
                job["tailored_skills"] = json.loads(job["tailored_skills"])
            except Exception:
                job["tailored_skills"] = []
    return job

@app.patch("/api/jobs/{job_id}/status")
async def update_job_status(job_id: int, payload: JobStatusUpdate):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("UPDATE jobs SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (payload.status, job_id))
        await db.commit()
    await broadcast_ws("job_updated", {"id": job_id, "status": payload.status})
    return {"status": "ok", "job_id": job_id, "new_status": payload.status}

@app.post("/api/jobs/{job_id}/tailor")
async def tailor_job(job_id: int):
    """Manually triggers AGY CV adaptation and PDF generation for a job."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute("SELECT * FROM jobs WHERE id = ?", (job_id,))
        job = dict(await cur.fetchone())

        cur = await db.execute("SELECT * FROM profile WHERE id = 1")
        profile = dict(await cur.fetchone())
        for f in ["skills", "experiences", "education", "languages", "preferences"]:
            if isinstance(profile.get(f), str):
                try:
                    profile[f] = json.loads(profile[f])
                except Exception:
                    pass

    await log_activity("INFO", f"Démarrage manuel de l'adaptation du CV pour {job['title']}...", job_id)
    tailored = await agy_bridge.tailor_cv_and_letter(job["title"], job["company"], job["description"], profile)
    pdf_path = await cv_renderer.generate_pdf(job_id, profile, tailored, job["title"], job["company"])

    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            UPDATE jobs
            SET status = 'tailored',
                tailored_title = ?,
                tailored_summary = ?,
                tailored_skills = ?,
                tailored_cv_path = ?,
                cover_letter = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (
            tailored.get("tailored_headline"),
            tailored.get("tailored_summary"),
            json.dumps(tailored.get("highlighted_skills", []), ensure_ascii=False),
            pdf_path,
            tailored.get("cover_letter"),
            job_id
        ))
        await db.commit()

    await broadcast_ws("job_updated", {"id": job_id, "status": "tailored"})
    return {"status": "ok", "pdf_path": pdf_path, "tailored": tailored}

@app.post("/api/jobs/{job_id}/apply")
async def apply_to_job(job_id: int):
    """Manually triggers application submission (via email or web form)."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute("SELECT * FROM jobs WHERE id = ?", (job_id,))
        job = dict(await cur.fetchone())

        cur = await db.execute("SELECT * FROM profile WHERE id = 1")
        profile = dict(await cur.fetchone())
        for f in ["skills", "experiences", "education", "languages", "preferences"]:
            if isinstance(profile.get(f), str):
                try:
                    profile[f] = json.loads(profile[f])
                except Exception:
                    pass

        cur = await db.execute("SELECT * FROM settings WHERE id = 1")
        settings = dict(await cur.fetchone())

    # Ensure CV is tailored first if missing
    if not job.get("tailored_cv_path") or not os.path.exists(job["tailored_cv_path"]):
        tailored = await agy_bridge.tailor_cv_and_letter(job["title"], job["company"], job["description"], profile)
        pdf_path = await cv_renderer.generate_pdf(job_id, profile, tailored, job["title"], job["company"])
        job["tailored_cv_path"] = pdf_path
        job["cover_letter"] = tailored.get("cover_letter")
        job["tailored_title"] = tailored.get("tailored_headline")

    if job.get("contact_email") and "@" in job["contact_email"]:
        success = await apply_engine.apply_via_email(job, profile, settings)
    else:
        success = await apply_engine.apply_via_web_form(job, profile)

    await broadcast_ws("job_updated", {"id": job_id, "status": "applied"})
    return {"status": "ok", "applied": success}

@app.post("/api/jobs/{job_id}/simulate-reply")
async def simulate_reply(job_id: int):
    """Simulates an incoming recruiter answer for testing reply detection."""
    success = await inbox_tracker.simulate_mock_reply(job_id)
    await broadcast_ws("job_updated", {"id": job_id, "status": "answer_received"})
    return {"status": "ok", "simulated": success}

@app.delete("/api/jobs/{job_id}")
async def delete_job(job_id: int):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM jobs WHERE id = ?", (job_id,))
        await db.commit()
    await broadcast_ws("job_deleted", {"id": job_id})
    return {"status": "ok", "deleted_id": job_id}

@app.get("/api/cv-preview/{job_id}")
async def cv_preview(job_id: int):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute("SELECT tailored_cv_path FROM jobs WHERE id = ?", (job_id,))
        row = await cur.fetchone()
        if not row or not row["tailored_cv_path"] or not os.path.exists(row["tailored_cv_path"]):
            raise HTTPException(status_code=404, detail="CV PDF non trouvé")
        return FileResponse(row["tailored_cv_path"], media_type="application/pdf")

# Search Queries Endpoints

@app.get("/api/search-queries")
async def get_search_queries():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute("SELECT * FROM search_queries ORDER BY id DESC")
        queries = [dict(r) for r in await cur.fetchall()]
        for q in queries:
            try:
                q["contract_types"] = json.loads(q["contract_types"])
            except Exception:
                q["contract_types"] = []
            try:
                q["platforms"] = json.loads(q["platforms"])
            except Exception:
                q["platforms"] = []
    return queries

@app.post("/api/search-queries")
async def add_search_query(payload: SearchQueryCreate):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            INSERT INTO search_queries (query_text, location, radius_km, contract_types, platforms, is_active)
            VALUES (?, ?, ?, ?, ?, 1)
        """, (
            payload.query_text,
            payload.location,
            payload.radius_km,
            json.dumps(payload.contract_types),
            json.dumps(payload.platforms)
        ))
        await db.commit()
    await log_activity("INFO", f"Nouveau critère de recherche ajouté: '{payload.query_text}' à '{payload.location}'")
    return {"status": "ok"}

@app.delete("/api/search-queries/{query_id}")
async def delete_search_query(query_id: int):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM search_queries WHERE id = ?", (query_id,))
        await db.commit()
    return {"status": "ok", "deleted_id": query_id}

@app.post("/api/search-queries/run-now")
async def run_search_now():
    """Runs immediate scraper run for all active queries."""
    asyncio.create_task(scheduler.run_cycle(force_search=True))
    return {"status": "started", "message": "Recherche et évaluation lancées en tâche de fond"}

# Profile Endpoints

@app.get("/api/profile")
async def get_profile():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute("SELECT * FROM profile WHERE id = 1")
        row = await cur.fetchone()
        profile = dict(row)
        for f in ["skills", "experiences", "education", "languages", "preferences"]:
            if isinstance(profile.get(f), str):
                try:
                    profile[f] = json.loads(profile[f])
                except Exception:
                    pass
    return profile

@app.post("/api/profile")
async def update_profile(payload: ProfileUpdate):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            UPDATE profile
            SET full_name = ?,
                email = ?,
                phone = ?,
                city = ?,
                headline = ?,
                summary = ?,
                skills = ?,
                experiences = ?,
                education = ?,
                languages = ?,
                preferences = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = 1
        """, (
            payload.full_name,
            payload.email,
            payload.phone,
            payload.city,
            payload.headline,
            payload.summary,
            json.dumps(payload.skills, ensure_ascii=False),
            json.dumps(payload.experiences, ensure_ascii=False),
            json.dumps(payload.education, ensure_ascii=False),
            json.dumps(payload.languages, ensure_ascii=False),
            json.dumps(payload.preferences, ensure_ascii=False)
        ))
        await db.commit()
    await log_activity("SUCCESS", "Profil et CV maître mis à jour.")
    return {"status": "ok"}

# Settings Endpoints

@app.get("/api/settings")
async def get_settings():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute("SELECT * FROM settings WHERE id = 1")
        settings = dict(await cur.fetchone())
        # Mask password
        if settings.get("gmail_app_password"):
            settings["gmail_app_password_set"] = True
            settings["gmail_app_password"] = "••••••••••••••••"
        else:
            settings["gmail_app_password_set"] = False
    return settings

@app.post("/api/settings")
async def update_settings(payload: SettingsUpdate):
    async with aiosqlite.connect(DB_PATH) as db:
        cur = await db.execute("SELECT * FROM settings WHERE id = 1")
        current = dict(await cur.fetchone())

        is_auto = payload.is_autopilot_enabled if payload.is_autopilot_enabled is not None else current["is_autopilot_enabled"]
        is_pause = payload.is_paused if payload.is_paused is not None else current["is_paused"]
        threshold = payload.match_score_threshold if payload.match_score_threshold is not None else current["match_score_threshold"]
        limit = payload.daily_application_limit if payload.daily_application_limit is not None else current["daily_application_limit"]
        gmail_addr = payload.gmail_address if payload.gmail_address is not None else current["gmail_address"]

        # Only update password if provided and not masked
        gmail_pw = current["gmail_app_password"]
        if payload.gmail_app_password and "•" not in payload.gmail_app_password:
            gmail_pw = payload.gmail_app_password

        await db.execute("""
            UPDATE settings
            SET is_autopilot_enabled = ?,
                is_paused = ?,
                match_score_threshold = ?,
                daily_application_limit = ?,
                gmail_address = ?,
                gmail_app_password = ?
            WHERE id = 1
        """, (int(is_auto), int(is_pause), threshold, limit, gmail_addr, gmail_pw))
        await db.commit()

    await log_activity("INFO", "Paramètres du système mis à jour.")
    return {"status": "ok"}

@app.post("/api/settings/toggle-autopilot")
async def toggle_autopilot():
    async with aiosqlite.connect(DB_PATH) as db:
        cur = await db.execute("SELECT is_autopilot_enabled FROM settings WHERE id = 1")
        current = (await cur.fetchone())[0]
        new_val = 0 if current == 1 else 1
        await db.execute("UPDATE settings SET is_autopilot_enabled = ? WHERE id = 1", (new_val,))
        await db.commit()
    state_str = "ACTIVÉ" if new_val == 1 else "DÉSACTIVÉ"
    await log_activity("INFO", f"Pilote automatique {state_str}.")
    await broadcast_ws("settings_updated", {"is_autopilot_enabled": bool(new_val)})
    return {"status": "ok", "is_autopilot_enabled": bool(new_val)}

@app.post("/api/settings/toggle-pause")
async def toggle_pause():
    async with aiosqlite.connect(DB_PATH) as db:
        cur = await db.execute("SELECT is_paused FROM settings WHERE id = 1")
        current = (await cur.fetchone())[0]
        new_val = 0 if current == 1 else 1
        await db.execute("UPDATE settings SET is_paused = ? WHERE id = 1", (new_val,))
        await db.commit()
    state_str = "EN PAUSE" if new_val == 1 else "REPRIS"
    await log_activity("WARNING" if new_val == 1 else "INFO", f"Système {state_str}.")
    await broadcast_ws("settings_updated", {"is_paused": bool(new_val)})
    return {"status": "ok", "is_paused": bool(new_val)}

@app.post("/api/email/test-connection")
async def test_email():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute("SELECT gmail_address, gmail_app_password FROM settings WHERE id = 1")
        s = dict(await cur.fetchone())

    user = s.get("gmail_address", "").strip()
    pw = s.get("gmail_app_password", "").strip()
    if not user or not pw:
        return {"status": "warning", "message": "Identifiants Gmail non renseignés. Le système fonctionne en mode simulation."}

    try:
        import imaplib
        mail = imaplib.IMAP4_SSL("imap.gmail.com", 993, timeout=10)
        mail.login(user, pw)
        mail.logout()
        return {"status": "success", "message": "Connexion IMAP & SMTP Gmail réussie !"}
    except Exception as e:
        return {"status": "error", "message": f"Erreur d'authentification Gmail: {str(e)}"}

@app.get("/api/logs")
async def get_logs(limit: int = 50):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute("SELECT * FROM logs ORDER BY id DESC LIMIT ?", (limit,))
        logs = [dict(r) for r in await cur.fetchall()]
    return logs

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        if websocket in connected_clients:
            connected_clients.remove(websocket)
