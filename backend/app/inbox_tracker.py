import asyncio
import email
from email.header import decode_header
import imaplib
from datetime import datetime
from typing import Any, Dict, List, Optional
import aiosqlite

from .config import DB_PATH
from .agy_bridge import agy_bridge
from .database import log_activity

class InboxTracker:
    def _decode_mime_words(self, s: Optional[str]) -> str:
        if not s:
            return ""
        decoded = decode_header(s)
        parts = []
        for content, encoding in decoded:
            if isinstance(content, bytes):
                parts.append(content.decode(encoding or "utf-8", errors="replace"))
            else:
                parts.append(str(content))
        return "".join(parts)

    def _extract_body_snippet(self, msg: email.message.Message) -> str:
        body = ""
        if msg.is_multipart():
            for part in msg.walk():
                ctype = part.get_content_type()
                cdispo = str(part.get("Content-Disposition"))
                if ctype == "text/plain" and "attachment" not in cdispo:
                    payload = part.get_payload(decode=True)
                    if payload:
                        body = payload.decode(errors="replace")
                        break
        else:
            payload = msg.get_payload(decode=True)
            if payload:
                body = payload.decode(errors="replace")
        return body[:400].strip()

    async def poll_inbox_sync(self, gmail_user: str, gmail_pass: str) -> List[Dict[str, Any]]:
        """Synchronously polls IMAP in a worker thread."""
        def _check():
            matches = []
            try:
                mail = imaplib.IMAP4_SSL("imap.gmail.com", 993, timeout=15)
                mail.login(gmail_user, gmail_pass)
                mail.select("INBOX", readonly=True)

                status, messages = mail.search(None, "UNSEEN")
                if status != "OK":
                    mail.logout()
                    return []

                msg_ids = messages[0].split()
                # Inspect recent messages up to 15
                for m_id in msg_ids[-15:]:
                    res, data = mail.fetch(m_id, "(RFC822)")
                    if res != "OK":
                        continue
                    raw_email = data[0][1]
                    msg = email.message_from_bytes(raw_email)
                    subject = self._decode_mime_words(msg.get("Subject"))
                    from_header = self._decode_mime_words(msg.get("From"))
                    in_reply_to = msg.get("In-Reply-To", "")
                    references = msg.get("References", "")
                    body_snippet = self._extract_body_snippet(msg)

                    matches.append({
                        "subject": subject,
                        "from": from_header,
                        "in_reply_to": in_reply_to,
                        "references": references,
                        "body_snippet": body_snippet
                    })

                mail.logout()
            except Exception as e:
                print(f"IMAP poll error: {e}")
            return matches

        return await asyncio.to_thread(_check)

    async def check_for_replies(self):
        """Scans the inbox and correlates new responses to applied jobs."""
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row

            # Get applied jobs
            cursor = await db.execute("""
                SELECT * FROM jobs
                WHERE status = 'applied'
            """)
            applied_jobs = [dict(row) for row in await cursor.fetchall()]

            # Get settings
            cursor = await db.execute("SELECT * FROM settings WHERE id = 1")
            row = await cursor.fetchone()
            settings = dict(row) if row else {}

        if not applied_jobs:
            return

        gmail_user = settings.get("gmail_address", "").strip()
        gmail_pass = settings.get("gmail_app_password", "").strip()

        if gmail_user and gmail_pass:
            incoming_emails = await self.poll_inbox_sync(gmail_user, gmail_pass)
            for em in incoming_emails:
                for job in applied_jobs:
                    # Match by Message-ID or Company / Contact Email
                    is_match = False
                    if job.get("sent_message_id") and (job["sent_message_id"] in em["in_reply_to"] or job["sent_message_id"] in em["references"]):
                        is_match = True
                    elif job.get("contact_email") and job["contact_email"].lower() in em["from"].lower():
                        is_match = True
                    elif job.get("company") and job["company"].lower() in (em["from"] + " " + em["subject"]).lower():
                        is_match = True

                    if is_match:
                        await self._record_answer(job, em["subject"], em["body_snippet"])
                        break

    async def _record_answer(self, job: Dict[str, Any], subject: str, snippet: str):
        """Records a detected answer and classifies tone with AGY."""
        job_id = job["id"]
        company = job["company"]
        title = job["title"]

        await log_activity("SUCCESS", f"RÉPONSE DÉTECTÉE ! Le recruteur de {company} a répondu pour l'offre {title} !", job_id)

        # Classify via AGY
        analysis = await agy_bridge.classify_reply(subject, snippet, title)
        classification = analysis.get("classification", "INTERVIEW")
        summary = analysis.get("summary", "Réponse du recruteur")

        now_iso = datetime.now().isoformat()
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute("""
                UPDATE jobs
                SET status = 'answer_received',
                    answer_at = ?,
                    answer_snippet = ?,
                    answer_classification = ?,
                    updated_at = ?
                WHERE id = ?
            """, (now_iso, f"[{classification}] {summary} — {snippet}", classification, now_iso, job_id))
            await db.commit()

        await log_activity("SUCCESS", f"Statut mis à jour sur le Kanban: Réponse reçue [{classification}] de {company}", job_id)

    async def simulate_mock_reply(self, job_id: int):
        """Simulates an incoming recruiter reply for testing the full cycle."""
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("SELECT * FROM jobs WHERE id = ?", (job_id,))
            row = await cursor.fetchone()
            if not row:
                return False
            job = dict(row)

        sample_reply = (
            f"Bonjour {job.get('company', 'Candidat')},\n\n"
            f"Nous avons bien reçu votre candidature pour le poste de {job['title']} et votre profil a retenu toute notre attention. "
            f"Seriez-vous disponible pour un premier entretien téléphonique cette semaine afin d'échanger sur vos motivations et vos disponibilités ?\n\n"
            f"Bien cordialement,\nL'équipe Recrutement {job['company']}"
        )
        await self._record_answer(job, f"Re: Candidature {job['title']}", sample_reply)
        return True

inbox_tracker = InboxTracker()
