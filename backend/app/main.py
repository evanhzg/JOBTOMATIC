import asyncio
import json
import os
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional
import aiosqlite
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, UploadFile, File, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from pypdf import PdfReader

from .config import CVS_DIR, DB_PATH, SCREENSHOTS_DIR, IMPORTED_CV_DIR
from .database import get_db, init_db, log_activity
from .agy_bridge import ai_bridge
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
app.mount("/static/imported", StaticFiles(directory=str(IMPORTED_CV_DIR)), name="imported")

# Pydantic Request Models
class MetricVariantRequest(BaseModel):
    metric_id: str
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
    ai_provider: Optional[str] = None
    wait_for_batch_validation: Optional[bool] = None
    anthropic_api_key: Optional[str] = None

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
        "active_queries": queries_count,
        "ai_provider": settings.get("ai_provider", "agy"),
        "wait_for_batch_validation": bool(settings.get("wait_for_batch_validation", 0))
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
            if j.get("cv_improvement_suggestions"):
                try:
                    j["cv_improvement_suggestions"] = json.loads(j["cv_improvement_suggestions"])
                except Exception:
                    j["cv_improvement_suggestions"] = None
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

    await log_activity("INFO", f"Démarrage de l'adaptation du CV pour {job['title']}...", job_id)
    tailored = await ai_bridge.tailor_cv_and_letter(job["title"], job["company"], job["description"], profile)
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

@app.post("/api/jobs/{job_id}/improve-cv")
async def improve_cv_for_job(job_id: int):
    """Uses AI to audit and boost a lower-scoring CV for a specific job."""
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

    await log_activity("INFO", f"Lancement de l'outil 'Améliorer mon CV' pour {job['title']}...", job_id)
    improvements = await ai_bridge.improve_cv_for_job(job["title"], job["company"], job["description"], profile, job.get("match_score", 60))

    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE jobs SET cv_improvement_suggestions = ? WHERE id = ?",
            (json.dumps(improvements, ensure_ascii=False), job_id)
        )
        await db.commit()

    await broadcast_ws("job_updated", {"id": job_id})
    return {"status": "ok", "improvements": improvements}

@app.post("/api/jobs/{job_id}/apply-improvements")
async def apply_improvements(job_id: int):
    """Applies the AI-generated improvements directly to the tailored CV and compiles an updated PDF."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute("SELECT * FROM jobs WHERE id = ?", (job_id,))
        job = dict(await cur.fetchone())

        if not job.get("cv_improvement_suggestions"):
            raise HTTPException(status_code=400, detail="Aucune suggestion d'amélioration disponible")
        improvements = json.loads(job["cv_improvement_suggestions"])

        cur = await db.execute("SELECT * FROM profile WHERE id = 1")
        profile = dict(await cur.fetchone())
        for f in ["skills", "experiences", "education", "languages", "preferences"]:
            if isinstance(profile.get(f), str):
                try:
                    profile[f] = json.loads(profile[f])
                except Exception:
                    pass

    # Merge boosted skills & summary
    new_score = improvements.get("projected_score", 90)
    current_skills = profile.get("skills", [])
    merged_skills = list(set(current_skills + improvements.get("skills_to_add", [])))

    tailored_data = {
        "tailored_headline": improvements.get("enhanced_headline", job.get("tailored_title", job["title"])),
        "tailored_summary": improvements.get("boosted_summary", job.get("tailored_summary", "")),
        "highlighted_skills": merged_skills[:8],
        "adapted_experiences": [
            {
                "role": profile["experiences"][0]["role"] if profile.get("experiences") else "Poste Clé",
                "company": profile["experiences"][0]["company"] if profile.get("experiences") else "Entreprise",
                "period": profile["experiences"][0]["period"] if profile.get("experiences") else "2023 - 2024",
                "location": profile.get("city", "Rouen"),
                "details": improvements.get("boosted_bullet_points", ["Missions optimisées"])
            }
        ]
    }

    pdf_path = await cv_renderer.generate_pdf(job_id, profile, tailored_data, job["title"], job["company"])

    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            UPDATE jobs
            SET match_score = ?,
                tailored_title = ?,
                tailored_summary = ?,
                tailored_skills = ?,
                tailored_cv_path = ?,
                status = 'tailored',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (
            new_score,
            tailored_data["tailored_headline"],
            tailored_data["tailored_summary"],
            json.dumps(tailored_data["highlighted_skills"], ensure_ascii=False),
            pdf_path,
            job_id
        ))
        await db.commit()

    await log_activity("SUCCESS", f"Améliorations IA appliquées avec succès pour {job['title']} ! Nouveau score estimé : {new_score}%", job_id)
    await broadcast_ws("job_updated", {"id": job_id, "status": "tailored", "match_score": new_score})
    return {"status": "ok", "new_score": new_score, "pdf_path": pdf_path}

@app.post("/api/jobs/batch-validate")
async def batch_validate_and_apply():
    """Validates and applies to all tailored jobs currently queued in a single batch dispatch."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute("SELECT * FROM jobs WHERE status = 'tailored'")
        tailored_jobs = [dict(r) for r in await cur.fetchall()]

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

    applied_ids = []
    for job in tailored_jobs:
        if job.get("contact_email") and "@" in job["contact_email"]:
            success = await apply_engine.apply_via_email(job, profile, settings)
        else:
            success = await apply_engine.apply_via_web_form(job, profile)
        if success:
            applied_ids.append(job["id"])

    await log_activity("SUCCESS", f"Validation par lot effectuée : {len(applied_ids)} candidatures envoyées !")
    await broadcast_ws("jobs_batch_applied", {"applied_count": len(applied_ids)})
    return {"status": "ok", "applied_count": len(applied_ids), "job_ids": applied_ids}

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
        tailored = await ai_bridge.tailor_cv_and_letter(job["title"], job["company"], job["description"], profile)
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
        if profile.get("efficiency_metrics"):
            try:
                profile["efficiency_metrics"] = json.loads(profile["efficiency_metrics"])
            except Exception:
                profile["efficiency_metrics"] = None
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

@app.get("/api/profile/preview-pdf")
async def preview_base_cv_pdf():
    """Generates and serves the original / base master CV as a PDF."""
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

    pdf_path = await cv_renderer.generate_base_cv_pdf(profile)
    return FileResponse(pdf_path, media_type="application/pdf", content_disposition_type="inline")

@app.get("/api/profile/preview-html")
async def preview_base_cv_html():
    """Returns rendered HTML of the master base CV for instant in-app view."""
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

    tailored_data = {
        "tailored_headline": profile.get("headline", "Profil Candidat"),
        "tailored_summary": profile.get("summary", ""),
        "highlighted_skills": profile.get("skills", []),
        "adapted_experiences": profile.get("experiences", [])
    }
    html = await cv_renderer.render_cv_html(profile, tailored_data, "CV de Base", "Candidature")
    return {"html": html}

@app.post("/api/profile/upload-cv")
async def upload_imported_cv(file: UploadFile = File(...)):
    """Uploads an authentic original CV file (PDF), preserving its exact original design and extracting text for AI multi-metric inspection."""
    filename = file.filename or "cv_original.pdf"
    clean_filename = f"original_{int(asyncio.get_event_loop().time() * 1000)}_{filename.replace(' ', '_')}"
    save_path = IMPORTED_CV_DIR / clean_filename

    content = await file.read()
    with open(save_path, "wb") as f:
        f.write(content)

    # Extract text content using pypdf if PDF
    extracted_text = ""
    if filename.lower().endswith(".pdf"):
        try:
            reader = PdfReader(str(save_path))
            for page in reader.pages:
                extracted_text += page.extract_text() or ""
        except Exception as e:
            await log_activity("WARNING", f"Extraction de texte PDF: {e}")
    else:
        try:
            extracted_text = content.decode("utf-8", errors="ignore")
        except Exception:
            extracted_text = "CV original importé."

    # Inspect efficiency across the 5 dimensions
    metrics = await ai_bridge.inspect_cv_efficiency(extracted_text, "Général", "Rouen")

    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            UPDATE profile
            SET original_cv_path = ?,
                original_cv_filename = ?,
                original_cv_text = ?,
                efficiency_metrics = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = 1
        """, (str(save_path), filename, extracted_text, json.dumps(metrics, ensure_ascii=False)))
        await db.commit()

    await log_activity("SUCCESS", f"CV original importé avec succès : '{filename}' ! Calcul d'efficacité IA terminé.")
    await broadcast_ws("profile_updated", {"has_original_cv": True})
    return {
        "status": "ok",
        "filename": filename,
        "saved_path": str(save_path),
        "metrics": metrics
    }

@app.get("/api/profile/original-cv")
async def get_original_cv():
    """Serves the authentic uploaded original CV file inline so it does not auto-download."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute("SELECT original_cv_path, original_cv_filename FROM profile WHERE id = 1")
        row = await cur.fetchone()
        if not row or not row["original_cv_path"] or not os.path.exists(row["original_cv_path"]):
            raise HTTPException(status_code=404, detail="Aucun CV original n'a encore été importé.")
        
        path = row["original_cv_path"]
        media_type = "application/pdf" if path.lower().endswith(".pdf") else "application/octet-stream"
        return FileResponse(path, media_type=media_type, content_disposition_type="inline")

@app.post("/api/profile/inspect-efficiency")
async def inspect_cv_efficiency():
    """Runs or refreshes multi-metric efficiency calculation for the imported CV."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute("SELECT * FROM profile WHERE id = 1")
        row = await cur.fetchone()
        profile = dict(row)

    text_to_audit = profile.get("original_cv_text") or (
        f"{profile.get('headline')} {profile.get('summary')} {profile.get('skills')} {profile.get('experiences')}"
    )

    metrics = await ai_bridge.inspect_cv_efficiency(text_to_audit, profile.get("headline", "Développeur"), profile.get("city", "Rouen"))

    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("UPDATE profile SET efficiency_metrics = ? WHERE id = 1", (json.dumps(metrics, ensure_ascii=False),))
        await db.commit()

    return metrics

@app.post("/api/profile/generate-variants")
async def generate_variants(payload: MetricVariantRequest):
    """Generates 3 maximum-score variants and compiles visual proposal PDFs for direct preview."""
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

    text = profile.get("original_cv_text") or f"{profile.get('summary')} {profile.get('experiences')}"
    variants_data = await ai_bridge.generate_metric_variants(payload.metric_id, text, profile.get("headline", "Développeur"))

    # For each variant, generate a visual PDF proposal
    for idx, var in enumerate(variants_data.get("variants", [])):
        try:
            pdf_path = await cv_renderer.generate_variant_proposal_pdf(
                profile, var.get("title", f"Variante {idx+1}"), var.get("content", ""), payload.metric_id
            )
            var["pdf_url"] = f"/api/profile/proposal-pdf?file={os.path.basename(pdf_path)}"
        except Exception as e:
            var["pdf_url"] = None

    return variants_data

@app.get("/api/profile/proposal-pdf")
async def get_proposal_pdf(file: str):
    """Serves a visual PDF proposal inline for instant inspection."""
    path = CVS_DIR / file
    if not path.exists():
        raise HTTPException(status_code=404, detail="PDF proposition non trouvé")
    return FileResponse(str(path), media_type="application/pdf", content_disposition_type="inline")

@app.post("/api/profile/translate-cv")
async def translate_cv(payload: Dict[str, Any] = Body(...)):
    """Translates the profile to English or French, compiles a visual PDF, and returns the result."""
    target_lang = payload.get("target_language", "en") # "en" or "fr"
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute("SELECT * FROM profile WHERE id = 1")
        profile = dict(await cur.fetchone())
        for f in ["skills", "experiences", "education", "languages", "preferences"]:
            if isinstance(profile.get(f), str):
                try:
                    profile[f] = json.loads(profile[f])
                except Exception:
                    pass

    translated_data = await ai_bridge.translate_cv(profile, target_lang)
    pdf_path = await cv_renderer.generate_translated_cv_pdf(profile, translated_data, target_lang)
    filename = os.path.basename(pdf_path)

    await log_activity("SUCCESS", f"Traduction du CV en {target_lang.upper()} terminée avec PDF visuel.")
    return {
        "status": "ok",
        "target_language": target_lang,
        "pdf_url": f"/api/profile/translated-pdf?file={filename}",
        "filename": filename,
        "translated_data": translated_data
    }

@app.get("/api/profile/translated-pdf")
async def get_translated_pdf(file: str):
    """Serves a translated CV PDF inline."""
    path = CVS_DIR / file
    if not path.exists():
        raise HTTPException(status_code=404, detail="CV traduit non trouvé")
    return FileResponse(str(path), media_type="application/pdf", content_disposition_type="inline")

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
        settings["wait_for_batch_validation"] = bool(settings.get("wait_for_batch_validation", 0))
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
        provider = payload.ai_provider if payload.ai_provider is not None else current.get("ai_provider", "agy")
        batch_val = payload.wait_for_batch_validation if payload.wait_for_batch_validation is not None else bool(current.get("wait_for_batch_validation", 0))
        anthropic_key = payload.anthropic_api_key if payload.anthropic_api_key is not None else current.get("anthropic_api_key", "")

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
                gmail_app_password = ?,
                ai_provider = ?,
                wait_for_batch_validation = ?,
                anthropic_api_key = ?
            WHERE id = 1
        """, (int(is_auto), int(is_pause), threshold, limit, gmail_addr, gmail_pw, provider, int(batch_val), anthropic_key))
        await db.commit()

    await log_activity("INFO", f"Paramètres mis à jour (Moteur IA: {provider}, Validation par lot: {'Oui' if batch_val else 'Non'}).")
    await broadcast_ws("settings_updated", {"ai_provider": provider, "wait_for_batch_validation": batch_val})
    return {"status": "ok"}

@app.post("/api/settings/toggle-batch-validation")
async def toggle_batch_validation():
    async with aiosqlite.connect(DB_PATH) as db:
        cur = await db.execute("SELECT wait_for_batch_validation FROM settings WHERE id = 1")
        current = (await cur.fetchone())[0] or 0
        new_val = 0 if current == 1 else 1
        await db.execute("UPDATE settings SET wait_for_batch_validation = ? WHERE id = 1", (new_val,))
        await db.commit()
    msg = "Validation par lot ACTIVÉE" if new_val == 1 else "Validation par lot DÉSACTIVÉE (envois immédiats)"
    await log_activity("INFO", msg)
    await broadcast_ws("settings_updated", {"wait_for_batch_validation": bool(new_val)})
    return {"status": "ok", "wait_for_batch_validation": bool(new_val)}

@app.post("/api/settings/set-provider")
async def set_ai_provider(provider: str):
    if provider not in ["agy", "claude", "codex"]:
        raise HTTPException(status_code=400, detail="Fournisseur invalide")
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("UPDATE settings SET ai_provider = ? WHERE id = 1", (provider,))
        await db.commit()
    await log_activity("SUCCESS", f"Moteur d'intelligence artificielle configuré sur : {provider.upper()}")
    await broadcast_ws("settings_updated", {"ai_provider": provider})
    return {"status": "ok", "ai_provider": provider}

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
