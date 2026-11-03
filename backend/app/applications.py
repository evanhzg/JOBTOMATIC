"""Sending applications and scheduling/sending follow-ups ("relances")."""
from __future__ import annotations

import random
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional

from . import database as db
from . import mailer
from .ai import skills
from .ai.pool import AIUnavailable
from .cv.service import copy_for_attachment
from .events import publish

APPLIED_STATES = ("applied",)


async def _count_today() -> int:
    s = await db.get_settings()
    today = datetime.now().strftime("%Y-%m-%d")
    if s.get("applications_day") != today:
        await db.set_settings({"applications_day": today, "applications_today": 0})
        return 0
    return int(s.get("applications_today") or 0)


async def _bump_today() -> None:
    n = await _count_today()
    await db.set_settings({"applications_today": n + 1})


async def apply(job_id: int, by: str = "user") -> Dict[str, Any]:
    """Send the application by email when the offer gives an address.
    Otherwise return the link: the user applies on the site and confirms."""
    job = await db.fetch_one("jobs", "SELECT * FROM jobs WHERE id = ?", (job_id,))
    if not job:
        raise ValueError("Offre introuvable")
    if job["status"] not in ("new", "ready"):
        raise ValueError("Candidature déjà envoyée pour cette offre.")
    if not job.get("tailored_cv_path") or not Path(job["tailored_cv_path"]).exists():
        raise ValueError("Le CV n'est pas encore adapté pour cette offre.")
    s = await db.get_settings()
    if by == "autopilot" and await _count_today() >= int(s.get("daily_application_limit") or 15):
        raise ValueError("Limite quotidienne d'envois atteinte.")

    to = (job.get("contact_email") or "").strip()
    if not to:
        return {"action": "open_link", "url": job.get("apply_url") or job.get("url")}

    profile = await db.get_profile()
    attachment = copy_for_attachment(job["tailored_cv_path"], profile.get("full_name") or "", job.get("company") or "")
    subject = job.get("email_subject") or f"Candidature : {job['title']} – {profile.get('full_name', '')}"
    body = job.get("cover_letter") or ""
    if not body.strip():
        raise ValueError("Lettre de motivation vide : adaptez d'abord le CV.")
    message_id = await mailer.send(to, subject, body, [attachment])
    await _mark_applied(job, "email", message_id)
    await _bump_today()
    await db.log_activity("SUCCESS", f"Candidature envoyée à {to} pour « {job['title']} ».", job_id)
    return {"action": "sent", "to": to}


async def mark_applied_manually(job_id: int) -> None:
    job = await db.fetch_one("jobs", "SELECT * FROM jobs WHERE id = ?", (job_id,))
    if not job:
        raise ValueError("Offre introuvable")
    await _mark_applied(job, "link", None)
    await _bump_today()
    await db.log_activity("SUCCESS", f"Candidature marquée comme envoyée sur le site pour « {job['title']} ».", job_id)


async def _mark_applied(job: Dict[str, Any], method: str, message_id: Optional[str]) -> None:
    now = db.now_iso()
    await db.update("jobs", job["id"], {"status": "applied", "applied_at": now, "apply_method": method,
                                        "sent_message_id": message_id})
    await schedule_followups(job["id"])
    publish("job_updated", {"id": job["id"]})


# ---------------------------------------------------------------- follow-ups

def _next_slot(base: datetime, days: int, window: List[int], skip_weekends: bool) -> datetime:
    d = base + timedelta(days=days)
    if skip_weekends:
        while d.weekday() >= 5:
            d += timedelta(days=1)
    start, end = (window + [9, 11])[:2]
    hour = random.randint(int(start), max(int(start), int(end) - 1))
    return d.replace(hour=hour, minute=random.randint(0, 59), second=0, microsecond=0)


async def schedule_followups(job_id: int) -> List[int]:
    s = await db.get_settings()
    if not s.get("followups_enabled", True):
        return []
    job = await db.fetch_one("jobs", "SELECT * FROM jobs WHERE id = ?", (job_id,))
    if not job or not job.get("applied_at"):
        return []
    await db.execute("DELETE FROM followups WHERE job_id = ? AND status = 'scheduled'", (job_id,))
    base = datetime.fromisoformat(job["applied_at"])
    channel = "email" if job.get("apply_method") == "email" and job.get("contact_email") else "manual"
    ids = []
    for seq, days in enumerate(s.get("followup_delays_days") or [7, 14], start=1):
        due = _next_slot(base, int(days), s.get("followup_window") or [9, 11], s.get("followup_skip_weekends", True))
        ids.append(await db.insert("followups", {"job_id": job_id, "seq": seq, "due_at": due.isoformat(timespec="seconds"),
                                                 "status": "scheduled", "channel": channel}))
    publish("followups", {"job_id": job_id})
    return ids


async def cancel_followups(job_id: int, reason: str = "réponse reçue") -> None:
    await db.execute("UPDATE followups SET status = 'cancelled', error = ? WHERE job_id = ? AND status IN ('scheduled', 'manual')",
                     (reason, job_id))
    publish("followups", {"job_id": job_id})


async def process_due_followups() -> int:
    """Draft and send relances that are due. Returns how many were handled."""
    s = await db.get_settings()
    if not s.get("followups_enabled", True):
        return 0
    due = await db.fetch_all("followups", "SELECT * FROM followups WHERE status = 'scheduled' AND due_at <= ? ORDER BY due_at",
                             (db.now_iso(),))
    handled = 0
    for f in due:
        job = await db.fetch_one("jobs", "SELECT * FROM jobs WHERE id = ?", (f["job_id"],))
        if not job or job["status"] not in APPLIED_STATES:
            await db.update("followups", f["id"], {"status": "cancelled", "error": "candidature plus en attente"}, touch=False)
            continue
        try:
            await send_followup(f["id"], automatic=True)
            handled += 1
        except AIUnavailable:
            break      # AI at its limit: stays scheduled, retried on the next cycle after reset
        except mailer.MailNotConfigured:
            await db.update("followups", f["id"], {"status": "manual", "error": "Gmail non configuré"}, touch=False)
        except Exception as e:
            await db.update("followups", f["id"], {"status": "failed", "error": str(e)[:300]}, touch=False)
    if handled:
        publish("followups", {})
    return handled


async def draft_only(followup_id: int) -> Dict[str, Any]:
    """Write the relance text without sending it."""
    f = await db.fetch_one("followups", "SELECT * FROM followups WHERE id = ?", (followup_id,))
    if not f:
        raise ValueError("Relance introuvable")
    job = await db.fetch_one("jobs", "SELECT * FROM jobs WHERE id = ?", (f["job_id"],))
    days = (datetime.now() - datetime.fromisoformat(job["applied_at"])).days if job.get("applied_at") else 7
    draft = await skills.draft_followup(job, await db.get_profile(), f["seq"], days)
    await db.update("followups", f["id"], {"subject": draft["subject"], "body": draft["body"]}, touch=False)
    publish("followups", {"job_id": job["id"]})
    return draft


async def send_followup(followup_id: int, automatic: bool = False, subject: Optional[str] = None,
                        body: Optional[str] = None) -> Dict[str, Any]:
    f = await db.fetch_one("followups", "SELECT * FROM followups WHERE id = ?", (followup_id,))
    if not f:
        raise ValueError("Relance introuvable")
    job = await db.fetch_one("jobs", "SELECT * FROM jobs WHERE id = ?", (f["job_id"],))
    profile = await db.get_profile()
    if not (subject and body) and not (f.get("subject") and f.get("body")):
        days = (datetime.now() - datetime.fromisoformat(job["applied_at"])).days if job.get("applied_at") else 7
        draft = await skills.draft_followup(job, profile, f["seq"], days)
        await db.update("followups", f["id"], {"subject": draft["subject"], "body": draft["body"]}, touch=False)
        f.update(draft)
    subject = subject or f["subject"]
    body = body or f["body"]
    s = await db.get_settings()
    if f["channel"] != "email" or (automatic and not s.get("followup_auto_send", True)):
        await db.update("followups", f["id"], {"status": "manual", "subject": subject, "body": body}, touch=False)
        await db.log_activity("INFO", f"Relance n°{f['seq']} prête à envoyer vous-même pour « {job['title']} ».", job["id"])
        publish("followups", {"job_id": job["id"]})
        return {"status": "manual"}
    message_id = await mailer.send(job["contact_email"], subject, body, in_reply_to=job.get("sent_message_id"))
    await db.update("followups", f["id"], {"status": "sent", "sent_at": db.now_iso(), "message_id": message_id,
                                           "subject": subject, "body": body}, touch=False)
    await db.log_activity("SUCCESS", f"Relance n°{f['seq']} envoyée à {job['contact_email']} pour « {job['title']} ».", job["id"])
    publish("followups", {"job_id": job["id"]})
    return {"status": "sent"}
