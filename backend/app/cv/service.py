"""CV workflows: master CV versions, per-job tailoring, optimizer, previews."""
from __future__ import annotations

import re
import shutil
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from .. import database as db
from ..ai import skills
from ..config import CVS_DIR, DEFAULT_CANDIDATE_EMAIL, IMPORTED_CV_DIR
from ..events import publish
from . import pdf_engine as pe

PREVIEW_DIR = CVS_DIR / "previews"
PREVIEW_DIR.mkdir(parents=True, exist_ok=True)

ACTION_WORDS = {
    # verbs and the nominal forms French CVs use ("Gestion de...", "Création de...")
    "gestion", "gerer", "gere", "creation", "creer", "cree", "organisation", "organiser", "conception", "concevoir",
    "developpement", "developper", "pilotage", "piloter", "coordination", "coordonner", "mise", "realisation",
    "realiser", "preparation", "preparer", "livraison", "livrer", "accueil", "accueillir", "encadrement", "encadrer",
    "formation", "former", "optimisation", "optimiser", "amelioration", "ameliorer", "suivi", "suivre",
    "analyse", "analyser", "redaction", "rediger", "conduite", "conduire", "maintien", "maintenir", "integration",
    "integrer", "deploiement", "deployer", "animation", "animer", "negociation", "negocier", "vente", "vendre",
    "conseil", "conseiller", "controle", "controler", "supervision", "superviser", "lancement", "lancer",
    "automatisation", "automatiser", "reduction", "reduire", "augmentation", "augmenter", "resolution", "resoudre",
    "contact", "relation", "surveillance", "surveiller", "port", "entretien", "nettoyage", "service", "accompagnement",
}


# ---------------------------------------------------------------- helpers

def _fold(s: str) -> str:
    return pe._fold(s or "")


def _stem(w: str) -> str:
    return w[:6] if len(w) > 6 else w


def keyword_coverage(text: str, keywords: List[str]) -> Tuple[int, List[str], List[str]]:
    """Share of keywords present in text (accent-insensitive, light stemming)."""
    folded = _fold(text)
    tokens = set(_stem(t) for t in re.findall(r"[a-z0-9+#.]{2,}", folded))
    found, missing = [], []
    for kw in keywords:
        k = _fold(kw).strip()
        if not k:
            continue
        words = [w for w in re.findall(r"[a-z0-9+#.]{2,}", k) if len(w) > 2 or w.isalnum()]
        ok = k in folded or (words and all(_stem(w) in tokens for w in words))
        (found if ok else missing).append(kw)
    total = len(found) + len(missing)
    return (round(100 * len(found) / total) if total else 0), found, missing


def measure(units: List[pe.TextUnit], keywords: Optional[List[str]] = None) -> Dict[str, Any]:
    text = " ".join(u.text for u in units)
    bullets = [u for u in units if u.kind == "bullet"]
    quantified = [u for u in bullets if re.search(r"\d", u.text)]
    action = [u for u in bullets if _fold(re.sub(r"^\W+", "", u.text)).split(" ")[0] in ACTION_WORDS]
    long_bullets = [u for u in bullets if len(u.text.split()) > 22]
    words = len(text.split())
    contact = {
        "email": bool(pe.EMAIL_RE.search(text)),
        "telephone": bool(pe.PHONE_RE.search(text)),
    }
    out = {
        "mots": words,
        "puces": len(bullets),
        "puces_chiffrees_pct": round(100 * len(quantified) / len(bullets)) if bullets else 0,
        "puces_verbe_action_pct": round(100 * len(action) / len(bullets)) if bullets else 0,
        "puces_trop_longues": len(long_bullets),
        "contact": contact,
    }
    if keywords:
        cov, found, missing = keyword_coverage(text, keywords)
        out.update({"couverture_mots_cles_pct": cov, "mots_cles_presents": found, "mots_cles_absents": missing})
    return out


async def master() -> Optional[Dict[str, Any]]:
    return await db.get_master_cv()


def _units_public(units: List[pe.TextUnit]) -> List[Dict[str, Any]]:
    return [u.public() for u in units]


async def _profile_email() -> str:
    p = await db.get_profile()
    return (p.get("email") or DEFAULT_CANDIDATE_EMAIL).strip()


def _render_with(source: str, edits: Dict[str, str], out: Path, units: Optional[List[pe.TextUnit]] = None,
                 email: Optional[str] = None) -> pe.ApplyResult:
    units = units or pe.extract_units(source)
    all_edits = dict(edits)
    allow = []
    if email:
        swap = pe.email_swap_edits(units, email)
        all_edits.update(swap)
        allow = list(swap)
    return pe.apply_edits(source, all_edits, out, allow_locked=allow, units=units)


# ---------------------------------------------------------------- import

async def import_cv(filename: str, content: bytes) -> Dict[str, Any]:
    safe = re.sub(r"[^\w.-]+", "_", filename or "cv.pdf")
    path = IMPORTED_CV_DIR / f"{uuid.uuid4().hex[:8]}_{safe}"
    path.write_bytes(content)
    try:
        units = pe.extract_units(path)
    except Exception as e:
        path.unlink(missing_ok=True)
        raise ValueError(f"PDF illisible : {e}")
    if len(units) < 5:
        raise ValueError("Ce PDF ne contient presque pas de texte (CV scanné en image ?). Exportez-le en PDF texte.")
    text = pe.full_text(path)
    await db.execute("UPDATE cv_versions SET is_master = 0")
    vid = await db.insert("cv_versions", {
        "label": filename or "CV importé", "kind": "original", "source_pdf": str(path),
        "edits": {}, "pdf_path": str(path), "text": text, "is_master": 1,
    })
    await db.log_activity("SUCCESS", f"CV importé : {filename} ({len(units)} blocs de texte détectés).")
    publish("cv_updated", {"version_id": vid})
    return {"version_id": vid, "units": len(units)}


async def refresh_profile_from_cv() -> Dict[str, Any]:
    m = await master()
    if not m:
        raise ValueError("Aucun CV importé.")
    data = await skills.extract_profile(m.get("text") or pe.full_text(m["pdf_path"]))
    current = await db.get_profile()
    values = {k: data.get(k) for k in ("full_name", "phone", "city", "headline", "summary", "skills",
                                       "experiences", "education", "languages", "preferences", "target_roles")
              if data.get(k) not in (None, "", [])}
    # The candidate's contact address stays the one chosen in Plonge.
    values["email"] = current.get("email") or DEFAULT_CANDIDATE_EMAIL
    values["updated_at"] = db.now_iso()
    await db.update("profile", 1, values, touch=False)
    await db.log_activity("SUCCESS", "Profil rempli automatiquement depuis le CV.")
    publish("profile_updated", {})
    return await db.get_profile()


# ---------------------------------------------------------------- tailoring

async def tailor_job(job_id: int) -> Dict[str, Any]:
    job = await db.fetch_one("jobs", "SELECT * FROM jobs WHERE id = ?", (job_id,))
    if not job:
        raise ValueError("Offre introuvable")
    m = await master()
    if not m:
        raise ValueError("Importez d'abord votre CV (onglet CV).")
    profile = await db.get_profile()
    email = await _profile_email()
    base_pdf = m["pdf_path"]
    units = pe.extract_units(base_pdf)
    by_id = {u.id: u for u in units}
    keywords = ((job.get("extra") or {}).get("keywords") or []) if isinstance(job.get("extra"), dict) else []

    await db.log_activity("INFO", f"Adaptation du CV pour « {job['title']} »…", job_id)
    res = await skills.tailor_cv(job, _units_public(units), profile, keywords)

    edits: Dict[str, str] = {}
    why: Dict[str, str] = {}
    too_long = []
    for e in res.get("edits", []):
        if not isinstance(e, dict):
            continue
        uid, txt = e.get("id"), e.get("text")
        u = by_id.get(uid)
        if not u or u.locked or txt is None:
            continue
        txt = str(txt).strip()
        why[uid] = e.get("why", "")
        n = len(txt.replace("**", ""))
        if txt and (n > u.max_chars or n < u.min_chars):
            too_long.append({"id": uid, "text": txt, "max_chars": u.max_chars, "min_chars": u.min_chars})
        edits[uid] = txt

    out = CVS_DIR / f"CV_{_file_slug(profile.get('full_name') or 'candidat')}_{job_id}.pdf"
    result = _render_with(base_pdf, edits, out, units, email)
    overflow = [{"id": uid, "text": edits[uid], "max_chars": by_id[uid].max_chars, "min_chars": by_id[uid].min_chars}
                for uid in result.overflow + result.short if uid in edits]
    if overflow or too_long:
        retry = {i["id"]: i for i in overflow + too_long}
        try:
            shorter = await skills.shorten_edits(list(retry.values()))
            edits.update({k: v for k, v in shorter.items() if k in retry})
            result = _render_with(base_pdf, edits, out, units, email)
        except Exception:
            pass
    # Still too long or leaving a hole: keep the original text, the design comes first.
    dropped = [uid for uid in result.overflow + result.short if uid in edits]
    if any(uid in result.short for uid in dropped):
        for uid in dropped:
            edits.pop(uid, None)
        result = _render_with(base_pdf, edits, out, units, email)
    for uid in dropped:
        edits.pop(uid, None)

    tailored_text = pe.full_text(out)
    before, _, _ = keyword_coverage(m.get("text") or pe.full_text(base_pdf), keywords) if keywords else (None, [], [])
    after, found, missing = keyword_coverage(tailored_text, keywords) if keywords else (None, [], [])

    changes = [{"id": uid, "before": by_id[uid].rich, "after": edits[uid], "why": why.get(uid, "")}
               for uid in edits if uid in by_id]
    await db.update("jobs", job_id, {
        "tailor": {"changes": changes, "dropped": dropped, "notes": res.get("notes", ""),
                   "keywords_found": found, "keywords_missing": missing, "master_version": m["id"]},
        "tailored_cv_path": str(out),
        "cover_letter": res.get("cover_letter", ""),
        "email_subject": res.get("email_subject", ""),
        "ats_before": before, "ats_after": after,
        "status": "ready" if job["status"] in ("new", "ready") else job["status"],
    })
    await db.log_activity("SUCCESS", f"CV adapté pour « {job['title']} » : {len(changes)} blocs réécrits"
                          + (f", mots-clés {before}% → {after}%" if keywords else "") + ".", job_id)
    publish("job_updated", {"id": job_id})
    return {"changes": changes, "ats_before": before, "ats_after": after, "pdf": str(out)}


async def save_job_cv_edits(job_id: int, edits: Dict[str, str]) -> Dict[str, Any]:
    """Manual corrections from the UI on a tailored CV."""
    job = await db.fetch_one("jobs", "SELECT * FROM jobs WHERE id = ?", (job_id,))
    m = await master()
    if not job or not m:
        raise ValueError("Offre ou CV introuvable")
    units = pe.extract_units(m["pdf_path"])
    by_id = {u.id: u for u in units}
    out = Path(job.get("tailored_cv_path") or CVS_DIR / f"CV_job_{job_id}.pdf")
    result = _render_with(m["pdf_path"], edits, out, units, await _profile_email())
    tailor = job.get("tailor") or {}
    tailor["changes"] = [{"id": k, "before": by_id[k].rich, "after": v, "why": "modifié à la main"}
                         for k, v in edits.items() if k in by_id and k not in result.overflow]
    await db.update("jobs", job_id, {"tailor": tailor, "tailored_cv_path": str(out)})
    publish("job_updated", {"id": job_id})
    return {"overflow": result.overflow}


# ---------------------------------------------------------------- optimizer

async def audit(target: str) -> Dict[str, Any]:
    m = await master()
    if not m:
        raise ValueError("Importez d'abord votre CV.")
    units = pe.extract_units(m["pdf_path"])
    measured = measure(units)
    res = await skills.audit_cv(_units_public(units), await db.get_profile(), target, measured)
    by_id = {u.id: u for u in units}
    suggestions = []
    for s in res.get("suggestions", []):
        u = by_id.get(s.get("id")) if isinstance(s, dict) else None
        if not u or u.locked or not s.get("text"):
            continue
        suggestions.append({**s, "before": u.rich, "max_chars": u.max_chars,
                            "fits": len(str(s["text"]).replace("**", "")) <= u.max_chars})
    measured = measure(units, res.get("target_keywords") or [])
    audit_data = {"target": target, "scores": res.get("scores", {}), "verdict": res.get("verdict", ""),
                  "measured": measured, "suggestions": suggestions, "questions": res.get("questions", []),
                  "at": db.now_iso()}
    await db.update("cv_versions", m["id"], {"audit": audit_data}, touch=False)
    publish("cv_updated", {"version_id": m["id"]})
    return audit_data


async def preview(edits: Dict[str, str]) -> Dict[str, Any]:
    m = await master()
    if not m:
        raise ValueError("Aucun CV importé.")
    token = uuid.uuid4().hex[:12]
    out = PREVIEW_DIR / f"{token}.pdf"
    result = _render_with(m["pdf_path"], edits, out)
    # keep the preview folder small
    olds = sorted(PREVIEW_DIR.glob("*.pdf"), key=lambda p: p.stat().st_mtime)
    for p in olds[:-30]:
        p.unlink(missing_ok=True)
    units = pe.extract_units(out)
    return {"token": token, "pages": pe.page_count(out), "result": result.as_dict(),
            "measured": measure(units, ((m.get("audit") or {}).get("measured") or {}).get("mots_cles_presents", [])
                                + ((m.get("audit") or {}).get("measured") or {}).get("mots_cles_absents", []))}


async def save_version(edits: Dict[str, str], label: str) -> Dict[str, Any]:
    m = await master()
    if not m:
        raise ValueError("Aucun CV importé.")
    out = CVS_DIR / f"master_{uuid.uuid4().hex[:8]}.pdf"
    result = _render_with(m["pdf_path"], edits, out)
    if result.overflow:
        out.unlink(missing_ok=True)
        raise ValueError(f"{len(result.overflow)} texte(s) ne rentrent pas dans leur bloc : raccourcissez-les.")
    await db.execute("UPDATE cv_versions SET is_master = 0")
    vid = await db.insert("cv_versions", {
        "label": label or "Version optimisée", "kind": "optimized", "source_pdf": m["source_pdf"],
        "edits": {**(m.get("edits") or {}), **edits}, "pdf_path": str(out), "text": pe.full_text(out),
        "is_master": 1,
    })
    await db.log_activity("SUCCESS", f"Nouvelle version du CV enregistrée : « {label} » ({len(edits)} blocs modifiés).")
    publish("cv_updated", {"version_id": vid})
    return {"version_id": vid}


async def set_master(version_id: int) -> None:
    v = await db.fetch_one("cv_versions", "SELECT id FROM cv_versions WHERE id = ?", (version_id,))
    if not v:
        raise ValueError("Version introuvable")
    await db.execute("UPDATE cv_versions SET is_master = CASE WHEN id = ? THEN 1 ELSE 0 END", (version_id,))
    publish("cv_updated", {"version_id": version_id})


def _file_slug(name: str) -> str:
    return re.sub(r"[^\w]+", "_", pe._fold(name)).strip("_").title() or "Candidat"


def copy_for_attachment(path: str, profile_name: str, company: str) -> Path:
    """Attachment name recruiters see: CV_Prenom_Nom_Entreprise.pdf"""
    out = CVS_DIR / "attachments"
    out.mkdir(exist_ok=True)
    target = out / f"CV_{_file_slug(profile_name)}{'_' + _file_slug(company) if company else ''}.pdf"
    shutil.copyfile(path, target)
    return target
