"""Relances: scheduled on business days after sending, threaded, cancelled on reply."""
from datetime import datetime, timedelta

import pytest

from app import applications, database as db, mailer
from app.ai import skills


@pytest.fixture()
async def fresh_db(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "t.db")
    await db.init_db()
    yield


async def _job(**kw):
    values = {"external_id": f"t{datetime.now().timestamp()}", "title": "Serveur", "company": "Brasserie",
              "contact_email": "rh@brasserie.fr", "status": "applied", "apply_method": "email",
              "sent_message_id": "<orig@gmail.com>", "applied_at": "2026-11-06T10:00:00"}  # a Friday
    values.update(kw)
    return await db.insert("jobs", values)


async def test_schedule_skips_weekends_and_window(fresh_db):
    jid = await _job()
    await applications.schedule_followups(jid)
    rows = await db.fetch_all("followups", "SELECT * FROM followups WHERE job_id = ? ORDER BY seq", (jid,))
    assert [r["seq"] for r in rows] == [1, 2]
    for r in rows:
        due = datetime.fromisoformat(r["due_at"])
        assert due.weekday() < 5 and 9 <= due.hour < 11
        assert r["channel"] == "email"


async def test_due_followup_is_sent_in_thread(fresh_db, monkeypatch):
    jid = await _job()
    await applications.schedule_followups(jid)
    await db.execute("UPDATE followups SET due_at = ? WHERE seq = 1", ((datetime.now() - timedelta(minutes=1)).isoformat(),))
    sent = {}

    async def fake_send(to, subject, body, attachments=None, in_reply_to=None, references=None):
        sent.update(to=to, subject=subject, in_reply_to=in_reply_to)
        return "<relance@gmail.com>"

    async def fake_draft(job, profile, seq, days):
        return {"subject": "Re: Candidature Serveur", "body": "Bonjour, je me permets de revenir vers vous."}

    monkeypatch.setattr(mailer, "send", fake_send)
    monkeypatch.setattr(skills, "draft_followup", fake_draft)
    assert await applications.process_due_followups() == 1
    assert sent == {"to": "rh@brasserie.fr", "subject": "Re: Candidature Serveur", "in_reply_to": "<orig@gmail.com>"}
    f = await db.fetch_one("followups", "SELECT * FROM followups WHERE seq = 1")
    assert f["status"] == "sent" and f["message_id"] == "<relance@gmail.com>"


async def test_no_email_means_manual_and_reply_cancels(fresh_db, monkeypatch):
    jid = await _job(contact_email="", apply_method="link", sent_message_id=None)
    await applications.schedule_followups(jid)
    rows = await db.fetch_all("followups", "SELECT * FROM followups WHERE job_id = ?", (jid,))
    assert all(r["channel"] == "manual" for r in rows)
    await applications.cancel_followups(jid)
    rows = await db.fetch_all("followups", "SELECT * FROM followups WHERE job_id = ?", (jid,))
    assert all(r["status"] == "cancelled" for r in rows)


async def test_apply_without_gmail_never_marks_sent(fresh_db, tmp_path):
    pdf = tmp_path / "cv.pdf"
    pdf.write_bytes(b"%PDF-1.4 test")
    jid = await _job(status="ready", applied_at=None, sent_message_id=None, tailored_cv_path=str(pdf),
                     cover_letter="Madame, Monsieur…", email_subject="Candidature")
    with pytest.raises(mailer.MailNotConfigured):
        await applications.apply(jid)
    job = await db.fetch_one("jobs", "SELECT status FROM jobs WHERE id = ?", (jid,))
    assert job["status"] == "ready"
