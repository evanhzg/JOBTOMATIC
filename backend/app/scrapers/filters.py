"""Pure post-processing helpers shared by all sources (no network)."""
from __future__ import annotations

import re
import unicodedata
from datetime import date, datetime, timedelta, timezone
from typing import Iterable, List, Optional, Sequence, Tuple

from .base import JobPosting, SearchParams


# --------------------------------------------------------------------------- text

def plain(text: str) -> str:
    """Lowercase, strip accents, collapse whitespace."""
    t = unicodedata.normalize("NFKD", text or "")
    t = "".join(c for c in t if not unicodedata.combining(c))
    t = t.replace("œ", "oe").replace("æ", "ae").replace("’", "'")
    return re.sub(r"\s+", " ", t).strip().lower()


def _words(text: str) -> str:
    """plain() + punctuation -> spaces (for fingerprints and keyword matching)."""
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", plain(text))).strip()


def contains_word(haystack: str, needle: str) -> bool:
    """Accent/case-insensitive whole-word (or whole-phrase) match."""
    n = _words(needle)
    if not n:
        return False
    return re.search(rf"(?<![a-z0-9]){re.escape(n)}(?![a-z0-9])", _words(haystack)) is not None


EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}")
_EMAIL_JUNK = ("example.", "exemple.", "domain.", "@sentry", "noreply", "no-reply", ".png", ".jpg")


def find_email(*texts: str) -> str:
    """First plausible email address published in the given texts, else ''."""
    for t in texts:
        for m in EMAIL_RE.findall(t or ""):
            low = m.lower()
            if not any(j in low for j in _EMAIL_JUNK):
                return m.rstrip(".")
    return ""


# ---------------------------------------------------------------------- contracts

_CODE_MAP = {
    "CDI": "CDI", "CDD": "CDD", "MIS": "Intérim", "DIN": "Intérim", "SAI": "Saisonnier",
    "E2": "Alternance", "FS": "Alternance", "LIB": "Freelance",
}

# Order matters: the first family that matches wins ("CDD - Contrat apprentissage" -> Alternance).
_CONTRACT_PATTERNS: List[Tuple[str, str]] = [
    ("Alternance", r"alternance|alternant|apprenti|apprentissage|professionnalisation|contrat pro\b|work[- ]?study"),
    ("Stage", r"\bstages?\b|stagiaire|internship|\bintern\b"),
    ("Intérim", r"interim|interimaire|travail temporaire|mission temporaire|\btemporary\b|\btemp\b"),
    ("Saisonnier", r"saisonnier|saisonniere|\bsaison\b|seasonal"),
    ("Freelance", r"freelance|free-lance|independant|auto[- ]entrepreneur|portage salarial|profession liberale|contractor"),
    ("CDD", r"\bcdd\b|duree determinee|fixed[- ]term"),
    ("CDI", r"\bcdi\b|duree indeterminee|\bpermanent\b"),
]


def normalize_contract(text: str) -> str:
    """Map a free-text contract label or source code to CONTRACT_TYPES ('' if unknown)."""
    if not text:
        return ""
    code = text.strip().upper()
    if code in _CODE_MAP:
        return _CODE_MAP[code]
    t = plain(text)
    for label, pat in _CONTRACT_PATTERNS:
        if re.search(pat, t):
            return label
    return ""


# ------------------------------------------------------------------ fingerprinting

_TITLE_NOISE = re.compile(r"\b(h\s*/\s*f(\s*/\s*[xd])?|f\s*/\s*h(\s*/\s*[xd])?|hf|fh|m\s*/\s*f|f\s*/\s*m)\b")
_CITY_NOISE = {"e", "er", "eme", "arrondissement", "arr", "cedex", "france"}


def _norm_title(title: str) -> str:
    t = plain(title)
    t = re.sub(r"\(.*?\)", " ", t)
    t = _TITLE_NOISE.sub(" ", t)
    return _words(t)


def _norm_city(location: str) -> str:
    t = _words(location)
    t = re.sub(r"\d+", " ", t)
    toks = [w for w in t.split() if w not in _CITY_NOISE]
    return " ".join(toks)


def _norm_company(company: str) -> str:
    t = _words(company)
    t = re.sub(r"\b(sas|sasu|sarl|sa|eurl|sci|groupe|group|france)\b", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def fingerprint(p: JobPosting) -> str:
    """Normalized title|company|city key used for cross-source dedupe."""
    return f"{_norm_title(p.title)}|{_norm_company(p.company)}|{_norm_city(p.location)}"


def _richness(p: JobPosting) -> tuple:
    return (bool(p.contact_email), len(p.description or ""), bool(p.posted_at), bool(p.salary), bool(p.apply_url))


def dedupe(postings: Iterable[JobPosting]) -> List[JobPosting]:
    """Collapse duplicates (same fingerprint or same external_id), keeping the richest record.

    Empty fields of the kept record are filled from its duplicates, and the other
    copies are listed in extra["also_on"] as {source, url}.
    """
    groups: dict = {}
    order: List[str] = []
    by_id: dict = {}
    for p in postings:
        key = by_id.get(p.external_id) or fingerprint(p)
        by_id.setdefault(p.external_id, key)
        if key not in groups:
            groups[key] = []
            order.append(key)
        groups[key].append(p)

    out: List[JobPosting] = []
    for key in order:
        items = groups[key]
        best = max(items, key=_richness)
        if len(items) > 1:
            best = best.model_copy(deep=True)
            seen = {(best.source, best.url)}
            also = list(best.extra.get("also_on", []))
            for other in items:
                if other is best:
                    continue
                for f in ("company", "contract_type", "contact_email", "salary", "posted_at", "apply_url", "location"):
                    if not getattr(best, f) and getattr(other, f):
                        setattr(best, f, getattr(other, f))
                if best.remote is None and other.remote is not None:
                    best.remote = other.remote
                if (other.source, other.url) not in seen and other.url != best.url:
                    seen.add((other.source, other.url))
                    also.append({"source": other.source, "label": other.source_label, "url": other.url})
            if also:
                best.extra["also_on"] = also
        out.append(best)
    return out


# ------------------------------------------------------------- school ad detection

_SCHOOL_BRANDS = [
    "openclassrooms", "studi", "iscod", "ifocop", "my digital school", "mydigitalschool", "digital campus",
    "ascencia", "efap", "iscom", "ipac", "aston ecole", "nextformation", "next formation", "ecole iris",
    "pigier", "eduservices", "win sport school", "sup de vente", "school", "the bridge",
    "o'clock", "oclock", "wild code school", "simplon", "3w academy", "epitech", "ynov", "ieseg",
    "ecoris", "vatel", "enaco", "gefor", "cesi", "esiee", "itic", "esgi", "iris ecole",
]
_SCHOOL_NAME_RE = re.compile(
    r"\b(ecole|school|institut|institute|campus|academy|academie|formations?|cfa|business school|"
    r"universite|university|enseignement|education|learning|college|lycee)\b"
)
_TRAINING_SECTOR_RE = re.compile(
    r"formation continue|enseignement|formation professionnelle|organisme de formation|education|"
    r"centre de formation|apprentissage \(cfa\)"
)
_TRAINING_ORG_TEXT_RE = re.compile(
    r"\b(notre|nos) (ecole|cfa|centre de formation|organisme de formation|campus|formations?)\b.{0,40}"
    r"\b(forme|former|propose|prepare|accompagne|delivre)|"
    r"\bnous formons\b|\bformer des (experts|professionnels|talents)|\becole (superieure|de commerce|d'ingenieurs?|du digital|du numerique)\b"
)

# (regex on plain text, weight, short reason)
_AD_SIGNALS: List[Tuple[re.Pattern, int, str]] = [
    (re.compile(r"frais de scolarite|frais de formation (sont |entierement )?pris en charge|formation (100 ?% )?(gratuite|financee) et remuneree"), 2, "frais de scolarité / formation financée"),
    (re.compile(r"trouve[rz]? (ton|votre) (entreprise|alternance|employeur)|nous (t'|vous )?aid(ons|er) a trouver|accompagn\w* (dans|pour) (la |ta |votre )?recherche d'(entreprise|alternance|employeur)|recherche d'entreprise d'accueil"), 3, "propose de « trouver votre entreprise »"),
    (re.compile(r"\b(nos|notre reseau d') ?entreprises partenaires\b|\breseau de \d+ ?(entreprises|partenaires)"), 2, "réseau d'« entreprises partenaires »"),
    (re.compile(r"\badmissions?\b|jury d'admission|test d'admission|entretien d'admission|dossier de candidature"), 2, "parle d'admission"),
    (re.compile(r"\binscriptions? (ouvertes?|en cours)|\bpre-?inscription|\bpostule a (notre|la) formation|candidate a (notre|la) formation|candidature a (notre|la) formation"), 2, "inscriptions à une formation"),
    (re.compile(r"rejoins? (notre|nos) (ecole|formations?|programme|cursus|campus|bachelor|mba)|rejoignez (notre|nos) (ecole|formations?|programme|cursus|campus|bachelor|mba)|integre[rz]? (notre|nos) (ecole|formations?|programme|cursus|bachelor|mba)"), 3, "invite à rejoindre une formation"),
    (re.compile(r"\btitre (professionnel |certifie )?(rncp|de niveau)|\brncp\b"), 1, "mentionne un titre RNCP"),
    (re.compile(r"\brentree (de |en )?(septembre|octobre|janvier|fevrier|mars|20\d\d)|prochaine rentree"), 1, "parle de rentrée"),
    (re.compile(r"\bnos campus\b|\bnotre campus\b|places limitees|session de recrutement|reunion d'information|journee portes ouvertes"), 2, "vocabulaire d'école"),
    (re.compile(r"(bachelor|mba|mastere|bts|licence) .{0,30}(en alternance )?(avec|chez) nous\b|\bnotre (bachelor|mba|mastere|bts|programme)\b"), 2, "promeut son programme"),
]


def _is_alternance_context(p: JobPosting, text: str) -> bool:
    return p.contract_type in ("Alternance", "Stage") or re.search(r"alternan|apprenti|contrat pro", text) is not None


def detect_school_ad(p: JobPosting) -> Tuple[bool, str]:
    """Flag school / CFA / training-org ads posing as alternance offers.

    Returns (flagged, short French reason). A real employer that merely describes
    the school rhythm ("2 jours à l'école, 3 en entreprise") is not flagged: we need
    either a training-organisation publisher or recruitment-for-a-course wording.
    """
    title_desc = plain(f"{p.title}\n{p.description}")
    company = plain(p.company)
    sector = plain(str(p.extra.get("sector", "")))
    company_desc = plain(str(p.extra.get("company_description", "")))

    score = 0
    reasons: List[str] = []

    # Publisher looks like a school / training organisation (signals add up, capped at 3).
    org = 0
    brand = next((b for b in _SCHOOL_BRANDS if re.search(rf"(?<![a-z]){re.escape(b)}(?![a-z])", company)), None)
    if brand:
        org += 3
        reasons.append(f"publiée par un organisme de formation ({p.company})")
    elif company and _SCHOOL_NAME_RE.search(company):
        org += 2
        reasons.append(f"employeur au nom d'école ({p.company})")
    if sector and _TRAINING_SECTOR_RE.search(sector):
        org += 2
        reasons.append(f"secteur « {p.extra.get('sector')} »")
    if company_desc and _TRAINING_ORG_TEXT_RE.search(company_desc):
        org += 2
        reasons.append("l'entreprise se présente comme une école")
    org = min(org, 3)

    alternance = _is_alternance_context(p, title_desc)
    if org:
        # A school hiring its own staff on a CDI is a real job: weigh the org only for
        # alternance/internship offers.
        score += org if alternance else 1

    for rx, weight, why in _AD_SIGNALS:
        if rx.search(title_desc):
            score += weight
            reasons.append(why)

    if _TRAINING_ORG_TEXT_RE.search(title_desc):
        score += 2
        reasons.append("le texte présente une école/formation")

    flagged = score >= 3 and (alternance or org > 0)
    if not flagged:
        return False, ""
    # de-dup reasons, keep it short
    uniq: List[str] = []
    for r in reasons:
        if r not in uniq:
            uniq.append(r)
    return True, "Annonce d'école probable : " + ", ".join(uniq[:3])


# ------------------------------------------------------------------------ filters

def _parse_date(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    v = value.strip()
    try:
        if len(v) == 10:
            d = date.fromisoformat(v)
            return datetime(d.year, d.month, d.day, tzinfo=timezone.utc)
        dt = datetime.fromisoformat(v.replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


_FULL_REMOTE_RE = re.compile(r"full ?remote|100 ?% (en )?(teletravail|remote|a distance)|teletravail (complet|total|integral)|totalement a distance|poste (en )?(teletravail|remote)\b")
_ANY_REMOTE_RE = re.compile(r"teletravail|remote|hybride|a distance")


def _remote_ok(p: JobPosting, mode: str) -> bool:
    if mode in ("", "any"):
        return True
    text = plain(f"{p.title} {p.location} {p.description}")
    full = p.remote is True or bool(_FULL_REMOTE_RE.search(text))
    if mode == "remote_only":
        return full
    if mode == "onsite":
        return not full
    if mode == "hybrid_ok":
        return full or p.remote is not False or bool(_ANY_REMOTE_RE.search(text))
    return True


def apply_filters(
    postings: Iterable[JobPosting],
    params: SearchParams,
    exclude_keywords: Sequence[str] = (),
    include_keywords: Sequence[str] = (),
    now: Optional[datetime] = None,
) -> List[JobPosting]:
    """Keep postings matching the search params.

    - contract: unknown contract ('') passes.
    - age: missing/unparseable posted_at passes; max_age_days <= 0 disables.
    - remote: see _remote_ok.
    - exclude: any keyword in title/company/description drops the posting.
    - include: if given, at least one keyword must appear in title/description.
    """
    wanted = set(params.contract_types or [])
    now = now or datetime.now(timezone.utc)
    cutoff = now - timedelta(days=params.max_age_days) if params.max_age_days and params.max_age_days > 0 else None
    excl = [k for k in (exclude_keywords or []) if k and k.strip()]
    incl = [k for k in (include_keywords or []) if k and k.strip()]

    out: List[JobPosting] = []
    for p in postings:
        if wanted and p.contract_type and p.contract_type not in wanted:
            continue
        if cutoff is not None:
            dt = _parse_date(p.posted_at)
            if dt is not None and dt < cutoff:
                continue
        if not _remote_ok(p, params.remote):
            continue
        if excl:
            hay = f"{p.title}\n{p.company}\n{p.description}"
            if any(contains_word(hay, k) for k in excl):
                continue
        if incl:
            hay = f"{p.title}\n{p.description}"
            if not any(contains_word(hay, k) for k in incl):
                continue
        out.append(p)
    return out
