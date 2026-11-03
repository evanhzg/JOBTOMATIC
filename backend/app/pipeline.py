"""AI task handlers: what happens to an offer from discovery to sending."""
from __future__ import annotations

from typing import Any, Dict

from . import applications
from . import database as db
from .ai import skills
from .cv import service as cv
from .events import publish
from .tasks import enqueue, handler


async def _cv_text() -> str:
    m = await db.get_master_cv()
    return (m or {}).get("text") or ""


@handler("score")
async def score(task: Dict[str, Any]):
    job = await db.fetch_one("jobs", "SELECT * FROM jobs WHERE id = ?", (task["job_id"],))
    if not job or job["status"] == "archived":
        return {"skipped": True}
    profile = await db.get_profile()
    res = await skills.score_job(job, profile, await _cv_text())
    extra = job.get("extra") if isinstance(job.get("extra"), dict) else {}
    extra["keywords"] = res.get("keywords") or []
    values = {
        "match_score": res["score"], "ai_summary": res.get("summary"), "match_reasons": res.get("reasons") or [],
        "strengths": res.get("strengths") or [], "gaps": res.get("gaps") or [], "extra": extra,
    }
    if res.get("contact_email") and not job.get("contact_email") and "@" in res["contact_email"]:
        values["contact_email"] = res["contact_email"].strip()
    settings = await db.get_settings()
    if res.get("is_school_ad"):
        values.update({"is_school_ad": True, "school_reason": res.get("school_reason") or "Publicité d'école"})
        if settings.get("hide_school_ads", True):
            values.update({"status": "archived", "archived_reason": "Publicité d'école / CFA"})
    await db.update("jobs", job["id"], values)
    publish("job_updated", {"id": job["id"]})
    if (settings.get("autopilot_enabled") and not settings.get("paused") and values.get("status") != "archived"
            and res["score"] >= int(settings.get("match_threshold") or 70)):
        await enqueue("tailor", job["id"], {"auto": True}, priority=40)
    return {"score": res["score"]}


@handler("tailor")
async def tailor(task: Dict[str, Any]):
    job = await db.fetch_one("jobs", "SELECT * FROM jobs WHERE id = ?", (task["job_id"],))
    if not job:
        return {"skipped": True}
    if job.get("match_score") is None:          # keywords come from scoring
        await score({"job_id": job["id"]})
    out = await cv.tailor_job(job["id"])
    settings = await db.get_settings()
    auto = (task.get("payload") or {}).get("auto")
    if auto and settings.get("autopilot_enabled") and not settings.get("require_validation", True):
        try:
            await applications.apply(job["id"], by="autopilot")
        except Exception as e:
            await db.log_activity("INFO", f"Envoi automatique non effectué : {e}", job["id"])
    return {"changes": len(out["changes"]), "ats_after": out["ats_after"]}


@handler("profile_from_cv")
async def profile_from_cv(task: Dict[str, Any]):
    await cv.refresh_profile_from_cv()
    return {"ok": True}


@handler("audit")
async def audit(task: Dict[str, Any]):
    res = await cv.audit((task.get("payload") or {}).get("target") or "postes visés")
    return {"suggestions": len(res["suggestions"])}


@handler("classify_reply")
async def classify_reply(task: Dict[str, Any]):
    job = await db.fetch_one("jobs", "SELECT * FROM jobs WHERE id = ?", (task["job_id"],))
    if not job:
        return {"skipped": True}
    p = task.get("payload") or {}
    res = await skills.classify_reply(p.get("subject", ""), p.get("body", ""), job["title"])
    cls = str(res.get("classification", "OTHER")).upper()
    status = {"INTERVIEW": "interview", "REJECTION": "archived"}.get(cls, "answered")
    values = {"answer_class": cls, "answer_snippet": f"[{cls}] {res.get('summary', '')} — {(job.get('answer_snippet') or '')[:500]}",
              "status": status}
    if cls == "REJECTION":
        values["archived_reason"] = "Refus du recruteur"
    if cls == "ACKNOWLEDGMENT":
        # an automatic "bien reçu" is not an answer: keep waiting (and relaunching)
        values["status"] = "applied"
        await applications.schedule_followups(job["id"])
    await db.update("jobs", job["id"], values)
    publish("job_updated", {"id": job["id"]})
    return {"classification": cls}


@handler("import_offer")
async def import_offer(task: Dict[str, Any]):
    from .importer import fetch_offer_page, posting_from_jsonld
    from .scrapers import filters
    p = task.get("payload") or {}
    url, text = p.get("url", ""), p.get("text", "")
    posting = None
    if url and not text:
        page = await fetch_offer_page(url)
        posting = posting_from_jsonld(url, page.get("jsonld")) if page.get("jsonld") else None
        text = page.get("text", "")
    if posting is None:
        data = await skills.parse_offer_text(text, url)
        from .scrapers.base import JobPosting
        import hashlib
        posting = JobPosting(source="import", source_label="Import manuel",
                             external_id="import_" + hashlib.md5((url or text[:400]).encode()).hexdigest()[:12],
                             title=data.get("title") or "Offre importée", company=data.get("company", ""),
                             location=data.get("location", ""), contract_type=filters.normalize_contract(data.get("contract_type", "")),
                             description=data.get("description", text), url=url or "", contact_email=data.get("contact_email", ""),
                             salary=data.get("salary", ""))
    jid = await db.insert("jobs", {
        "external_id": posting.external_id, "fingerprint": filters.fingerprint(posting), "source": posting.source,
        "source_label": posting.source_label, "title": posting.title, "company": posting.company,
        "location": posting.location, "contract_type": posting.contract_type, "description": posting.description,
        "url": posting.url, "apply_url": posting.apply_url, "contact_email": posting.contact_email,
        "salary": posting.salary, "posted_at": posting.posted_at, "status": "new", "extra": posting.extra,
    }, or_ignore=True)
    if jid:
        await enqueue("score", jid, priority=15)
        await db.log_activity("SUCCESS", f"Offre importée : « {posting.title} ».", jid)
        publish("jobs_changed", {"new": 1})
    return {"job_id": jid}
