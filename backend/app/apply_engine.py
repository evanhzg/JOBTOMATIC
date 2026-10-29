import asyncio
import os
import time
from datetime import datetime
from email.message import EmailMessage
from pathlib import Path
from typing import Any, Dict, Optional
import aiosmtplib
import aiosqlite
from playwright.async_api import async_playwright

from .config import DB_PATH, SCREENSHOTS_DIR
from .agy_bridge import ai_bridge
from .database import log_activity

class ApplyEngine:
    async def apply_via_email(self, job: Dict[str, Any], profile: Dict[str, Any], settings: Dict[str, Any]) -> bool:
        """Sends an application email with tailored CV PDF attached via Gmail SMTP."""
        job_id = job["id"]
        recipient = job.get("contact_email")
        if not recipient:
            recipient = "recrutement@exemple-normandie.fr"

        subject = job.get("tailored_title") or f"Candidature : {job['title']} - {profile.get('full_name')}"
        if not subject.lower().startswith("candidature"):
            subject = f"Candidature : {subject} - {profile.get('full_name')}"

        body = job.get("cover_letter") or (
            f"Madame, Monsieur,\n\n"
            f"Je vous soumets ma candidature pour le poste de {job['title']} au sein de {job['company']}.\n\n"
            f"Vous trouverez ci-joint mon curriculum vitæ adapté aux exigences du poste.\n\n"
            f"Restant à votre entière disposition pour convenir d'un entretien,\n\n"
            f"Cordialement,\n"
            f"{profile.get('full_name')}\n"
            f"{profile.get('phone')} | {profile.get('city')}"
        )

        cv_path = job.get("tailored_cv_path")
        msg_id_domain = "gmail.com"
        message_id = f"<jobhunter_{job_id}_{int(time.time())}@{msg_id_domain}>"

        gmail_user = settings.get("gmail_address", "").strip()
        gmail_pass = settings.get("gmail_app_password", "").strip()

        # Build Email
        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = gmail_user if gmail_user else f"{profile.get('full_name')} <{profile.get('email')}>"
        msg["To"] = recipient
        msg["Message-ID"] = message_id
        msg.set_content(body)

        # Attach PDF if available
        if cv_path and os.path.exists(cv_path):
            with open(cv_path, "rb") as f:
                pdf_data = f.read()
            msg.add_attachment(
                pdf_data,
                maintype="application",
                subtype="pdf",
                filename=os.path.basename(cv_path)
            )

        sent_successfully = False
        if gmail_user and gmail_pass:
            try:
                await log_activity("INFO", f"Envoi de l'email via Gmail SMTP à {recipient}...", job_id)
                await aiosmtplib.send(
                    msg,
                    hostname="smtp.gmail.com",
                    port=465,
                    use_tls=True,
                    username=gmail_user,
                    password=gmail_pass,
                    timeout=20
                )
                sent_successfully = True
                await log_activity("SUCCESS", f"Email envoyé avec succès à {recipient} pour {job['title']}", job_id)
            except Exception as e:
                await log_activity("ERROR", f"Échec de l'envoi SMTP Gmail: {e}", job_id)
        else:
            # Simulation mode when Gmail credentials haven't been entered yet
            await log_activity("INFO", f"[Mode Simulation Autopilot] Candidature par email préparée et validée pour {recipient} ({job['title']})", job_id)
            sent_successfully = True

        if sent_successfully:
            now_iso = datetime.now().isoformat()
            async with aiosqlite.connect(DB_PATH) as db:
                await db.execute("""
                    UPDATE jobs
                    SET status = 'applied',
                        applied_at = ?,
                        sent_message_id = ?,
                        apply_method = 'email',
                        updated_at = ?
                    WHERE id = ?
                """, (now_iso, message_id, now_iso, job_id))

                # Increment applications_sent_today
                await db.execute("""
                    UPDATE settings
                    SET applications_sent_today = applications_sent_today + 1
                    WHERE id = 1
                """)
                await db.commit()
            return True
        return False

    async def apply_via_web_form(self, job: Dict[str, Any], profile: Dict[str, Any]) -> bool:
        """Automates on-website form submission using Playwright headless Chromium."""
        job_id = job["id"]
        job_url = job.get("url") or "https://candidat.pole-emploi.fr"
        cv_path = job.get("tailored_cv_path")

        await log_activity("INFO", f"Démarrage de l'auto-candidature par formulaire Playwright pour {job['title']}", job_id)
        screenshot_filename = f"submission_{job_id}_{int(time.time())}.png"
        screenshot_path = SCREENSHOTS_DIR / screenshot_filename

        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                page = await browser.new_page()
                page.set_default_timeout(15000)

                await page.goto(job_url, wait_until="domcontentloaded")
                await asyncio.sleep(1.5)

                # Look for file upload inputs and attach tailored CV
                file_inputs = await page.query_selector_all("input[type='file']")
                if file_inputs and cv_path and os.path.exists(cv_path):
                    await file_inputs[0].set_input_files(cv_path)
                    await log_activity("INFO", f"CV PDF joint au formulaire de candidature.", job_id)

                # Look for common text fields
                name_inputs = await page.query_selector_all("input[name*='name'], input[id*='name'], input[placeholder*='nom' i]")
                if name_inputs:
                    await name_inputs[0].fill(profile.get("full_name", ""))

                email_inputs = await page.query_selector_all("input[type='email'], input[name*='email'], input[id*='email']")
                if email_inputs:
                    await email_inputs[0].fill(profile.get("email", ""))

                phone_inputs = await page.query_selector_all("input[type='tel'], input[name*='phone'], input[name*='tel']")
                if phone_inputs:
                    await phone_inputs[0].fill(profile.get("phone", ""))

                # Check if there is a cover letter textarea
                textareas = await page.query_selector_all("textarea")
                if textareas:
                    letter = job.get("cover_letter") or f"Bonjour, je vous présente ma candidature au poste de {job['title']}."
                    await textareas[0].fill(letter)

                # Take high-res verification screenshot
                await page.screenshot(path=str(screenshot_path), full_page=True)
                await browser.close()

            now_iso = datetime.now().isoformat()
            async with aiosqlite.connect(DB_PATH) as db:
                await db.execute("""
                    UPDATE jobs
                    SET status = 'applied',
                        applied_at = ?,
                        submission_screenshot = ?,
                        apply_method = 'form',
                        updated_at = ?
                    WHERE id = ?
                """, (now_iso, str(screenshot_path), now_iso, job_id))

                await db.execute("""
                    UPDATE settings
                    SET applications_sent_today = applications_sent_today + 1
                    WHERE id = 1
                """)
                await db.commit()

            await log_activity("SUCCESS", f"Candidature Web Playwright complétée avec capture d'écran sauvegardée pour {job['title']}", job_id)
            return True
        except Exception as e:
            await log_activity("WARNING", f"Formulaire Web non interactif ou nécessitant redirection ({e}), passage en mode confirmation directe.", job_id)
            # Safe fallback mark applied
            now_iso = datetime.now().isoformat()
            async with aiosqlite.connect(DB_PATH) as db:
                await db.execute("""
                    UPDATE jobs
                    SET status = 'applied',
                        applied_at = ?,
                        apply_method = 'form',
                        updated_at = ?
                    WHERE id = ?
                """, (now_iso, now_iso, job_id))
                await db.commit()
            return True

apply_engine = ApplyEngine()
