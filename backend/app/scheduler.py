import asyncio
import json
from datetime import datetime
from typing import Any, Dict, List
import aiosqlite

from .config import DB_PATH
from .database import log_activity
from .agy_bridge import ai_bridge
from .cv_renderer import cv_renderer
from .scrapers import run_all_scrapers
from .apply_engine import apply_engine
from .inbox_tracker import inbox_tracker

class JobHunterScheduler:
    def __init__(self):
        self._task: asyncio.Task | None = None
        self._running = False

    async def start(self):
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._worker_loop())
        await log_activity("INFO", "Moteur d'automatisation JobHunter AGY démarré.")

    async def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
            self._task = None
        await log_activity("INFO", "Moteur d'automatisation JobHunter AGY arrêté.")

    async def _worker_loop(self):
        """Main loop that executes periodic scraping, evaluation, and application."""
        while self._running:
            try:
                await self.run_cycle()
            except asyncio.CancelledError:
                break
            except Exception as e:
                await log_activity("ERROR", f"Erreur dans la boucle de planification: {e}")

            # Sleep between cycles (e.g. 60 seconds)
            await asyncio.sleep(60)

    async def run_cycle(self, force_search: bool = False):
        """Executes a workflow cycle: check inbox, scrape active queries, evaluate and auto-apply."""
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row

            # Get settings
            cursor = await db.execute("SELECT * FROM settings WHERE id = 1")
            row = await cursor.fetchone()
            settings = dict(row) if row else {}

            # Reset daily counter if date changed
            today = datetime.now().strftime("%Y-%m-%d")
            if settings.get("last_reset_date") != today:
                await db.execute("UPDATE settings SET applications_sent_today = 0, last_reset_date = ? WHERE id = 1", (today,))
                await db.commit()
                settings["applications_sent_today"] = 0

            # Get profile
            cursor = await db.execute("SELECT * FROM profile WHERE id = 1")
            row = await cursor.fetchone()
            profile = dict(row) if row else {}

            # Parse profile JSON fields
            for field in ["skills", "experiences", "education", "languages", "preferences"]:
                if isinstance(profile.get(field), str):
                    try:
                        profile[field] = json.loads(profile[field])
                    except Exception:
                        pass

            # Check for incoming replies
            await inbox_tracker.check_for_replies()

            # If paused, halt
            if settings.get("is_paused") == 1:
                return

            # If autopilot disabled and not forcing manual search, stop here
            if settings.get("is_autopilot_enabled") != 1 and not force_search:
                return

            # Check daily application cap
            sent_today = settings.get("applications_sent_today", 0)
            daily_limit = settings.get("daily_application_limit", 20)
            threshold = settings.get("match_score_threshold", 75)

            # Get active search queries
            cursor = await db.execute("SELECT * FROM search_queries WHERE is_active = 1")
            queries = [dict(r) for r in await cursor.fetchall()]

        # 1. Scrape new jobs for each active query
        for q in queries:
            c_types = json.loads(q["contract_types"]) if isinstance(q.get("contract_types"), str) else (q.get("contract_types") or [])
            plats = json.loads(q["platforms"]) if isinstance(q.get("platforms"), str) else (q.get("platforms") or [])

            # Support multiple cities separated by commas or semicolons
            raw_locations = q.get("location", "Rouen")
            city_list = [loc.strip() for loc in raw_locations.replace(";", ",").split(",") if loc.strip()]
            if not city_list:
                city_list = ["Rouen"]

            all_postings = []
            for target_city in city_list:
                postings = await run_all_scrapers(
                    query=q["query_text"],
                    location=target_city,
                    radius_km=q.get("radius_km", 25),
                    contract_types=c_types,
                    platforms=plats
                )
                all_postings.extend(postings)

            # Insert new postings into database
            async with aiosqlite.connect(DB_PATH) as db:
                for p in all_postings:
                    try:
                        await db.execute("""
                            INSERT INTO jobs (external_id, title, company, location, contract_type, description, url, contact_email, salary, source, apply_method, status)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'discovered')
                        """, (p.external_id, p.title, p.company, p.location, p.contract_type, p.description, p.url, p.contact_email, p.salary, p.source, p.apply_method))
                    except aiosqlite.IntegrityError:
                        pass # already exists

                now_iso = datetime.now().isoformat()
                await db.execute("UPDATE search_queries SET last_run_at = ?, total_found = total_found + ? WHERE id = ?", (now_iso, len(all_postings), q["id"]))
                await db.commit()

        # 2. Process pending discovered jobs (fit analysis and CV tailoring)
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("SELECT * FROM jobs WHERE status = 'discovered' ORDER BY id DESC LIMIT 5")
            pending_jobs = [dict(r) for r in await cursor.fetchall()]

        for job in pending_jobs:
            # Check pause state again
            async with aiosqlite.connect(DB_PATH) as db:
                db.row_factory = aiosqlite.Row
                cur = await db.execute("SELECT is_paused, is_autopilot_enabled FROM settings WHERE id = 1")
                curr_s = dict(await cur.fetchone())
                if curr_s.get("is_paused") == 1 or curr_s.get("is_autopilot_enabled") != 1:
                    break

            # Evaluate fit with AI
            await log_activity("INFO", f"Évaluation de la correspondance IA pour {job['title']} ({job['company']})...", job["id"])
            fit = await ai_bridge.analyze_job_fit(job["title"], job["company"], job["description"], profile)
            score = fit.get("match_score", 0)
            reasons = json.dumps(fit.get("match_reasons", []), ensure_ascii=False)

            async with aiosqlite.connect(DB_PATH) as db:
                await db.execute("UPDATE jobs SET match_score = ?, match_reasons = ? WHERE id = ?", (score, reasons, job["id"]))
                await db.commit()

            # If score >= threshold, tailor CV
            if score >= threshold:
                await log_activity("SUCCESS", f"Score élevé ({score}% >= {threshold}%). Personnalisation automatique du CV...", job["id"])

                tailored = await ai_bridge.tailor_cv_and_letter(job["title"], job["company"], job["description"], profile)
                pdf_path = await cv_renderer.generate_pdf(job["id"], profile, tailored, job["title"], job["company"])

                async with aiosqlite.connect(DB_PATH) as db:
                    await db.execute("""
                        UPDATE jobs
                        SET status = 'tailored',
                            tailored_title = ?,
                            tailored_summary = ?,
                            tailored_skills = ?,
                            tailored_cv_path = ?,
                            cover_letter = ?
                        WHERE id = ?
                    """, (
                        tailored.get("tailored_headline"),
                        tailored.get("tailored_summary"),
                        json.dumps(tailored.get("highlighted_skills", []), ensure_ascii=False),
                        pdf_path,
                        tailored.get("cover_letter"),
                        job["id"]
                    ))
                    await db.commit()

                # Refresh job dict with tailored data
                job["tailored_cv_path"] = pdf_path
                job["cover_letter"] = tailored.get("cover_letter")
                job["tailored_title"] = tailored.get("tailored_headline")

                # If batch validation is required, stop here and wait for user 1-click batch validation!
                if settings.get("wait_for_batch_validation") == 1:
                    await log_activity("INFO", f"Candidature prête et en attente de validation du lot pour {job['title']} ({job['company']})", job["id"])
                else:
                    # Auto-apply directly on Autopilot!
                    if job.get("contact_email") and "@" in job["contact_email"]:
                        await apply_engine.apply_via_email(job, profile, settings)
                    else:
                        await apply_engine.apply_via_web_form(job, profile)
            else:
                await log_activity("INFO", f"Score insuffisant ({score}% < {threshold}%) pour {job['title']}. Conservé dans Découvertes sans auto-candidature.", job["id"])

scheduler = JobHunterScheduler()
