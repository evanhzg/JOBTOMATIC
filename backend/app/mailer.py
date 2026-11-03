"""Gmail SMTP sending. Nothing is ever marked as sent unless the SMTP server accepted it."""
from __future__ import annotations

import time
import uuid
from email.message import EmailMessage
from email.utils import formataddr, make_msgid
from pathlib import Path
from typing import Dict, List, Optional

import aiosmtplib

from . import database as db


class MailNotConfigured(Exception):
    pass


async def credentials() -> Dict[str, str]:
    s = await db.get_settings()
    user = (s.get("gmail_address") or "").strip()
    pw = (s.get("gmail_app_password") or "").replace(" ", "").strip()
    if not user or not pw:
        raise MailNotConfigured("Gmail non configuré : ajoutez un mot de passe d'application dans Réglages.")
    return {"user": user, "password": pw, "sender_name": s.get("sender_name") or ""}


async def send(to: str, subject: str, body: str, attachments: Optional[List[Path]] = None,
               in_reply_to: Optional[str] = None, references: Optional[str] = None) -> str:
    creds = await credentials()
    profile = await db.get_profile()
    name = creds["sender_name"] or profile.get("full_name") or ""
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = formataddr((name, creds["user"]))
    msg["To"] = to
    reply_to = (profile.get("email") or "").strip()
    if reply_to and reply_to.lower() != creds["user"].lower():
        msg["Reply-To"] = reply_to
    message_id = make_msgid(idstring=f"plonge{int(time.time())}{uuid.uuid4().hex[:6]}", domain="gmail.com")
    msg["Message-ID"] = message_id
    if in_reply_to:
        msg["In-Reply-To"] = in_reply_to
        msg["References"] = (references + " " if references else "") + in_reply_to
    msg.set_content(body)
    for path in attachments or []:
        msg.add_attachment(Path(path).read_bytes(), maintype="application", subtype="pdf", filename=Path(path).name)
    await aiosmtplib.send(msg, hostname="smtp.gmail.com", port=465, use_tls=True,
                          username=creds["user"], password=creds["password"], timeout=30)
    return message_id


async def test_connection() -> Dict[str, str]:
    import imaplib
    import asyncio
    try:
        creds = await credentials()
    except MailNotConfigured as e:
        return {"status": "warning", "message": str(e)}

    def _imap():
        m = imaplib.IMAP4_SSL("imap.gmail.com", 993, timeout=15)
        m.login(creds["user"], creds["password"])
        m.logout()

    try:
        await asyncio.to_thread(_imap)
        smtp = aiosmtplib.SMTP(hostname="smtp.gmail.com", port=465, use_tls=True, timeout=15)
        await smtp.connect()
        await smtp.login(creds["user"], creds["password"])
        await smtp.quit()
        return {"status": "success", "message": f"Connexion Gmail OK ({creds['user']}) : envoi et lecture."}
    except Exception as e:
        return {"status": "error", "message": f"Échec de connexion Gmail : {e}"}
