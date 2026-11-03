"""Watch the Gmail inbox for recruiter replies (IMAP, read-only)."""
from __future__ import annotations

import asyncio
import email
import imaplib
import re
from datetime import datetime, timedelta
from email.header import decode_header
from email.utils import parseaddr
from typing import Any, Dict, List

from . import database as db
from . import mailer
from .applications import cancel_followups
from .events import publish

GENERIC_DOMAINS = {"gmail.com", "yahoo.fr", "yahoo.com", "hotmail.com", "hotmail.fr", "outlook.com", "outlook.fr",
                   "orange.fr", "free.fr", "wanadoo.fr", "laposte.net", "icloud.com", "live.fr", "sfr.fr"}


def _decode(s: str | None) -> str:
    if not s:
        return ""
    parts = []
    for content, enc in decode_header(s):
        parts.append(content.decode(enc or "utf-8", errors="replace") if isinstance(content, bytes) else str(content))
    return "".join(parts)


def _body(msg: email.message.Message) -> str:
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() == "text/plain" and "attachment" not in str(part.get("Content-Disposition")):
                payload = part.get_payload(decode=True)
                if payload:
                    return payload.decode(part.get_content_charset() or "utf-8", errors="replace")
        for part in msg.walk():
            if part.get_content_type() == "text/html":
                payload = part.get_payload(decode=True)
                if payload:
                    return re.sub(r"<[^>]+>", " ", payload.decode(part.get_content_charset() or "utf-8", errors="replace"))
        return ""
    payload = msg.get_payload(decode=True)
    return payload.decode(msg.get_content_charset() or "utf-8", errors="replace") if payload else ""


def _fetch(user: str, password: str, since_days: int) -> List[Dict[str, Any]]:
    out = []
    m = imaplib.IMAP4_SSL("imap.gmail.com", 993, timeout=20)
    try:
        m.login(user, password)
        m.select("INBOX", readonly=True)
        since = (datetime.now() - timedelta(days=since_days)).strftime("%d-%b-%Y")
        status, data = m.search(None, f'(SINCE "{since}")')
        if status != "OK":
            return out
        for num in data[0].split()[-200:]:
            st, msgdata = m.fetch(num, "(BODY.PEEK[])")
            if st != "OK" or not msgdata or not isinstance(msgdata[0], tuple):
                continue
            msg = email.message_from_bytes(msgdata[0][1])
            out.append({
                "message_id": (msg.get("Message-ID") or "").strip(),
                "from": _decode(msg.get("From")),
                "subject": _decode(msg.get("Subject")),
                "in_reply_to": msg.get("In-Reply-To", "") or "",
                "references": msg.get("References", "") or "",
                "body": _body(msg)[:4000],
            })
    finally:
        try:
            m.logout()
        except Exception:
            pass
    return out


def _matches(job: Dict[str, Any], em: Dict[str, Any], followup_ids: List[str]) -> bool:
    thread = em["in_reply_to"] + " " + em["references"]
    if job.get("sent_message_id") and job["sent_message_id"] in thread:
        return True
    if any(fid and fid in thread for fid in followup_ids):
        return True
    sender = parseaddr(em["from"])[1].lower()
    contact = (job.get("contact_email") or "").lower()
    if contact and sender == contact:
        return True
    if contact and "@" in contact:
        domain = contact.split("@", 1)[1]
        if domain not in GENERIC_DOMAINS and sender.endswith("@" + domain):
            return True
    company = (job.get("company") or "").strip().lower()
    if len(company) > 3 and company in em["subject"].lower() and "candidature" in (em["subject"] + em["body"][:500]).lower():
        return True
    return False


async def check_replies() -> int:
    s = await db.get_settings()
    if not s.get("imap_enabled", True):
        return 0
    try:
        creds = await mailer.credentials()
    except mailer.MailNotConfigured:
        return 0
    jobs = await db.fetch_all("jobs", "SELECT * FROM jobs WHERE status = 'applied'")
    if not jobs:
        return 0
    emails = await asyncio.to_thread(_fetch, creds["user"], creds["password"], 30)
    seen = set(s.get("imap_seen") or [])
    own = creds["user"].lower()
    found = 0
    from .tasks import enqueue
    for em in emails:
        if not em["message_id"] or em["message_id"] in seen or parseaddr(em["from"])[1].lower() == own:
            continue
        seen.add(em["message_id"])
        for job in jobs:
            fids = [f["message_id"] for f in await db.fetch_all(
                "followups", "SELECT message_id FROM followups WHERE job_id = ? AND message_id IS NOT NULL", (job["id"],))]
            if _matches(job, em, fids):
                await db.update("jobs", job["id"], {"status": "answered", "answer_at": db.now_iso(),
                                                    "answer_snippet": f"{em['subject']} — {em['body'][:600]}",
                                                    "answer_class": "UNKNOWN"})
                await cancel_followups(job["id"])
                await enqueue("classify_reply", job["id"], {"subject": em["subject"], "body": em["body"][:3000]}, priority=20)
                await db.log_activity("SUCCESS", f"Réponse reçue de {em['from']} pour « {job['title']} » ! Relances annulées.", job["id"])
                publish("job_updated", {"id": job["id"]})
                found += 1
                jobs = [j for j in jobs if j["id"] != job["id"]]
                break
    await db.set_settings({"imap_seen": list(seen)[-800:], "imap_last_check": db.now_iso()})
    return found
