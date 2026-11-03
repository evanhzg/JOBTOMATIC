"""Import a job offer from a URL the user pastes.

One plain GET with a normal browser User-Agent. No anti-bot circumvention: if the
site blocks us, the user is asked to paste the offer text instead.
schema.org `JobPosting` JSON-LD is preferred when the page publishes it.
"""
from __future__ import annotations

import hashlib
import json
import logging
import re
from typing import Any, Dict, Iterator, List, Optional
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import httpx
from bs4 import BeautifulSoup

from .scrapers._contract_guess import from_schema_org, guess_contract, html_to_text
from .scrapers.base import USER_AGENT, JobPosting

log = logging.getLogger(__name__)

MAX_BYTES = 3_000_000
MAX_TEXT = 20_000

PASTE_HINT = "Copiez le texte de l'offre et collez-le à la place."

_BLOCK_MARKERS = (
    "cf-chl", "challenge-platform", "just a moment...", "attention required! | cloudflare",
    "captcha-delivery.com", "datadome", "px-captcha", "perimeterx", "distil_r_captcha",
    "are you a robot", "êtes-vous un robot", "access denied", "request unsuccessful. incapsula",
)

_NOISE_CLASS = re.compile(
    r"other-offers|similar|related|recommend|cookie|consent|breadcrumb", re.I)

_TRACKING_PARAMS =re.compile(r"^(utm_|gclid$|fbclid$|mc_|_hs|ref$|source$|trk)", re.I)


# --------------------------------------------------------------------------- fetch

async def fetch_offer_page(url: str, client: Optional[httpx.AsyncClient] = None) -> Dict[str, Any]:
    """Fetch an offer page -> {"url", "title", "text", "jsonld"}.

    `jsonld` is the normalized schema.org JobPosting (see `extract_jobposting`) or None.
    Raises ValueError (French message) when the page cannot be read.
    """
    url = (url or "").strip()
    parts = urlsplit(url)
    if parts.scheme not in ("http", "https") or not parts.netloc:
        raise ValueError("Adresse invalide : collez un lien complet (https://…).")

    own_client = client is None
    if own_client:
        client = httpx.AsyncClient(follow_redirects=True, timeout=20.0)
    try:
        try:
            r = await client.get(url, headers={
                "User-Agent": USER_AGENT,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.6",
            }, follow_redirects=True)
        except httpx.HTTPError as e:
            log.info("import fetch failed for %s: %s", url, type(e).__name__)
            raise ValueError(f"Impossible de joindre cette page. {PASTE_HINT}") from e
    finally:
        if own_client:
            await client.aclose()

    if r.status_code in (401, 403, 429, 503):
        raise ValueError(f"Ce site bloque la lecture automatique (HTTP {r.status_code}). {PASTE_HINT}")
    if r.status_code == 404 or r.status_code == 410:
        raise ValueError("Offre introuvable (page supprimée ou lien erroné).")
    if r.status_code >= 400:
        raise ValueError(f"La page a répondu par une erreur (HTTP {r.status_code}). {PASTE_HINT}")
    ctype = r.headers.get("content-type", "").lower()
    if ctype and "html" not in ctype and "xml" not in ctype:
        raise ValueError(f"Ce lien n'est pas une page web ({ctype.split(';')[0]}). {PASTE_HINT}")

    html = r.content[:MAX_BYTES].decode(r.encoding or "utf-8", errors="replace")
    result = parse_offer_html(html, str(r.url))
    if looks_blocked(html, result["text"]) and not result["jsonld"]:
        raise ValueError(f"Ce site bloque la lecture automatique. {PASTE_HINT}")
    if not result["jsonld"] and len(result["text"]) < 500:
        raise ValueError(
            "Page lue mais presque vide (contenu chargé par JavaScript ou connexion requise). "
            + PASTE_HINT
        )
    return result


_EMPLOYMENT_FR = {
    "FULL_TIME": "temps plein", "PART_TIME": "temps partiel", "CONTRACTOR": "indépendant",
    "TEMPORARY": "temporaire", "INTERN": "stage", "VOLUNTEER": "bénévolat",
    "PER_DIEM": "à la journée", "OTHER": "autre",
}


def _contract_line(j: Dict[str, Any]) -> str:
    emp = [e.strip() for e in (j.get("employment_type") or "").split(",") if e.strip()]
    emp_fr = [_EMPLOYMENT_FR.get(e.upper().replace("-", "_").replace(" ", "_"), e) for e in emp]
    bits = [j.get("contract_type") or ""] + [e for e in emp_fr if e.lower() != (j.get("contract_type") or "").lower()]
    return ", ".join(b for b in bits if b)


def looks_blocked(html: str, text: str) -> bool:
    head = html[:20_000].lower()
    return any(m in head for m in _BLOCK_MARKERS) and len(text) < 2_000


# --------------------------------------------------------------------------- parse

def parse_offer_html(html: str, url: str) -> Dict[str, Any]:
    soup = BeautifulSoup(html, "html.parser")
    jsonld = extract_jobposting(soup)

    page_title = ""
    og = soup.find("meta", attrs={"property": "og:title"})
    if og and og.get("content"):
        page_title = og["content"].strip()
    elif soup.title and soup.title.string:
        page_title = soup.title.string.strip()
    else:
        h1 = soup.find("h1")
        page_title = h1.get_text(" ", strip=True) if h1 else ""

    main_text = readable_text(soup)
    if jsonld and jsonld.get("description"):
        header = [
            f"Poste : {jsonld['title']}" if jsonld.get("title") else "",
            f"Entreprise : {jsonld['company']}" if jsonld.get("company") else "",
            f"Lieu : {jsonld['location']}" if jsonld.get("location") else "",
            f"Contrat : {_contract_line(jsonld)}" if _contract_line(jsonld) else "",
            f"Salaire : {jsonld['salary']}" if jsonld.get("salary") else "",
            f"Publiée le : {jsonld['date_posted']}" if jsonld.get("date_posted") else "",
        ]
        text = "\n".join(h for h in header if h) + "\n\n" + jsonld["description"]
    else:
        text = main_text

    return {
        "url": url,
        "title": (jsonld or {}).get("title") or page_title,
        "text": text[:MAX_TEXT].strip(),
        "jsonld": jsonld,
    }


def readable_text(soup: BeautifulSoup) -> str:
    """Main readable content of a page, without scripts, navigation and chrome."""
    soup = BeautifulSoup(str(soup), "html.parser")  # work on a copy
    for tag in soup.find_all(["script", "style", "noscript", "template", "svg", "iframe",
                              "nav", "header", "footer", "aside", "form", "button"]):
        tag.decompose()
    for tag in soup.find_all(attrs={"role": ["navigation", "banner", "contentinfo"]}):
        tag.decompose()
    for tag in soup.find_all(attrs={"aria-hidden": "true"}):
        tag.decompose()
    # Lists of *other* offers would be mistaken for this one.
    for tag in soup.find_all(attrs={"class": _NOISE_CLASS}):
        tag.decompose()
    for tag in soup.find_all(attrs={"id": _NOISE_CLASS}):
        tag.decompose()
    root = (soup.find("main") or soup.find(attrs={"role": "main"})
            or soup.find("article") or soup.body or soup)
    return html_to_text(str(root))[:MAX_TEXT]


def _iter_jsonld_objects(soup: BeautifulSoup) -> Iterator[Dict[str, Any]]:
    for script in soup.find_all("script", attrs={"type": re.compile(r"ld\+json", re.I)}):
        raw = script.string or script.get_text() or ""
        raw = raw.strip().rstrip(";")
        if not raw:
            continue
        try:
            data = json.loads(raw)
        except ValueError:
            try:  # some sites leave raw control characters inside strings
                data = json.loads(re.sub(r"[\x00-\x1f]", " ", raw))
            except ValueError:
                continue
        stack = [data]
        while stack:
            node = stack.pop()
            if isinstance(node, list):
                stack.extend(node)
            elif isinstance(node, dict):
                yield node
                if "@graph" in node:
                    stack.append(node["@graph"])


def _is_jobposting(node: Dict[str, Any]) -> bool:
    t = node.get("@type")
    types = t if isinstance(t, list) else [t]
    return any(isinstance(x, str) and x.split("/")[-1] == "JobPosting" for x in types)


def _as_list(v: Any) -> List[Any]:
    if v is None:
        return []
    return v if isinstance(v, list) else [v]


def _name(v: Any) -> str:
    if isinstance(v, str):
        return v.strip()
    if isinstance(v, dict):
        return str(v.get("name") or v.get("legalName") or "").strip()
    if isinstance(v, list) and v:
        return _name(v[0])
    return ""


def _location(job: Dict[str, Any]) -> str:
    places = []
    for loc in _as_list(job.get("jobLocation")):
        addr = loc.get("address") if isinstance(loc, dict) else loc
        if isinstance(addr, str):
            places.append(addr.strip())
            continue
        if not isinstance(addr, dict):
            continue
        country = _name(addr.get("addressCountry"))
        bits = [addr.get("addressLocality"), addr.get("postalCode"), addr.get("addressRegion")]
        bits = [str(b).strip() for b in bits if b]
        locality = bits[0] if bits else ""
        if len(bits) > 1 and bits[1] and bits[1] not in locality:
            locality = f"{locality} ({bits[1]})" if locality else bits[1]
        elif not locality and len(bits) > 2:
            locality = bits[2]
        if not locality and country:
            locality = country
        if locality and locality not in places:
            places.append(locality)
    return " ; ".join(places)


def _salary(job: Dict[str, Any]) -> str:
    base = job.get("baseSalary") or job.get("estimatedSalary")
    if isinstance(base, list):
        base = base[0] if base else None
    if isinstance(base, (str, int, float)):
        return str(base)
    if not isinstance(base, dict):
        return ""
    currency = base.get("currency") or ""
    value = base.get("value")
    unit = ""
    if isinstance(value, dict):
        unit = value.get("unitText") or ""
        lo, hi, exact = value.get("minValue"), value.get("maxValue"), value.get("value")
    else:
        lo = hi = None
        exact = value
    def fmt(x: Any) -> str:
        try:
            return f"{int(round(float(x))):,}".replace(",", " ")
        except (TypeError, ValueError):
            return str(x)
    if lo not in (None, "") and hi not in (None, "") and str(lo) != str(hi):
        s = f"{fmt(lo)} – {fmt(hi)}"
    elif exact not in (None, "") or lo not in (None, "") or hi not in (None, ""):
        s = fmt(exact if exact not in (None, "") else (lo if lo not in (None, "") else hi))
    else:
        return ""
    sym = {"EUR": "€", "USD": "$", "GBP": "£"}.get(str(currency).upper(), currency)
    units = {"YEAR": "an", "MONTH": "mois", "HOUR": "heure", "DAY": "jour", "WEEK": "semaine"}
    unit_fr = units.get(str(unit).upper(), str(unit).lower())
    return " ".join(x for x in [s, sym, f"/ {unit_fr}" if unit_fr else ""] if x)


def normalize_jobposting(job: Dict[str, Any]) -> Dict[str, Any]:
    """schema.org JobPosting dict -> flat dict of the fields the app uses."""
    emp = [str(x) for x in _as_list(job.get("employmentType")) if x]
    ident = job.get("identifier")
    ident_val = ""
    if isinstance(ident, dict):
        ident_val = str(ident.get("value") or ident.get("@id") or "").strip()
    elif isinstance(ident, (str, int)):
        ident_val = str(ident).strip()
    remote = None
    if "TELECOMMUTE" in str(job.get("jobLocationType") or "").upper():
        remote = True
    raw_title = job.get("title") or job.get("name") or ""
    if isinstance(raw_title, list):
        raw_title = raw_title[0] if raw_title else ""
    title = html_to_text(str(raw_title))
    description = _description(job)
    return {
        "title": title,
        "company": _name(job.get("hiringOrganization")),
        "location": _location(job),
        "employment_type": ", ".join(emp),
        "contract_type": _contract(title, emp, description),
        "date_posted": str(job.get("datePosted") or "").strip() or None,
        "valid_through": str(job.get("validThrough") or "").strip() or None,
        "salary": _salary(job),
        "remote": remote,
        "identifier": ident_val,
        "url": str(job.get("url") or "").strip(),
        "description": description,
    }


def _contract(title: str, emp: List[str], description: str) -> str:
    # The title is the most explicit signal ("Alternance - ...", "Stage ..."), then
    # employmentType. TEMPORARY covers both CDD and intérim: the text decides.
    label = guess_contract(title) or from_schema_org(emp)
    if label == "CDD" and re.search(r"int[ée]rim", description, re.I):
        return "Intérim"
    return label


_EXTRA_SECTIONS = [
    ("responsibilities", "Missions"),
    ("qualifications", "Profil"),
    ("skills", "Compétences"),
    ("experienceRequirements", "Expérience"),
    ("educationRequirements", "Formation"),
    ("jobBenefits", "Avantages"),
    ("incentives", "Avantages"),
]


def _description(job: Dict[str, Any]) -> str:
    """description + the optional schema.org sections not already contained in it."""
    parts = [html_to_text(_flat_text(job.get("description")))]
    for prop, heading in _EXTRA_SECTIONS:
        txt = html_to_text(_flat_text(job.get(prop)))
        if txt and not any(txt in p for p in parts):
            parts.append(f"{heading} :\n{txt}")
    return "\n\n".join(p for p in parts if p)[:MAX_TEXT]


def _flat_text(v: Any) -> str:
    if v is None:
        return ""
    if isinstance(v, list):
        return "\n".join(_flat_text(x) for x in v)
    if isinstance(v, dict):  # e.g. EducationalOccupationalCredential
        return str(v.get("description") or v.get("name") or v.get("credentialCategory") or "")
    return str(v)


def extract_jobposting(soup_or_html: Any) -> Optional[Dict[str, Any]]:
    """The richest schema.org JobPosting in the page, normalized, or None.

    JSON-LD first; schema.org microdata (itemscope/itemprop, used by e.g.
    SmartRecruiters) as a fallback. `schema_format` tells which one was read.
    """
    soup = soup_or_html if isinstance(soup_or_html, BeautifulSoup) else BeautifulSoup(
        soup_or_html or "", "html.parser")
    best = None
    for node in _iter_jsonld_objects(soup):
        if _is_jobposting(node):
            norm = normalize_jobposting(node)
            norm["schema_format"] = "json-ld"
            if best is None or len(norm["description"]) > len(best["description"]):
                best = norm
    if best and best["title"]:
        return best
    for el in soup.find_all(attrs={"itemscope": True, "itemtype": re.compile(r"schema\.org/JobPosting", re.I)}):
        norm = normalize_jobposting(_microdata(el))
        norm["schema_format"] = "microdata"
        if norm["title"] and (best is None or len(norm["description"]) > len(best["description"])):
            best = norm
    return best


_HTML_PROPS = {"description", "responsibilities", "qualifications", "skills", "incentives",
               "jobBenefits", "experienceRequirements", "educationRequirements"}


def _microdata(scope) -> Dict[str, Any]:
    """schema.org microdata item -> dict shaped like its JSON-LD equivalent."""
    out: Dict[str, Any] = {}

    def visit(node):
        for child in node.find_all(True, recursive=False):
            props = (child.get("itemprop") or "").split()
            if props:
                if child.has_attr("itemscope"):
                    value: Any = _microdata(child)
                elif child.name == "meta":
                    value = child.get("content") or ""
                elif child.name in ("a", "link") and child.get("href") and props[0] == "url":
                    value = child["href"]
                elif child.name == "time" and child.get("datetime"):
                    value = child["datetime"]
                elif child.get("content"):
                    value = child["content"]
                elif props[0] in _HTML_PROPS:
                    value = child.decode_contents()
                else:
                    value = child.get_text(" ", strip=True)
                for prop in props:
                    if prop in out:
                        out[prop] = _as_list(out[prop]) + [value]
                    else:
                        out[prop] = value
                if child.has_attr("itemscope"):
                    continue  # nested item: its props belong to it
            visit(child)

    visit(scope)
    return out


# --------------------------------------------------------------------------- posting

def canonical_url(url: str) -> str:
    p = urlsplit(url.strip())
    query = urlencode([(k, v) for k, v in parse_qsl(p.query) if not _TRACKING_PARAMS.match(k)])
    return urlunsplit((p.scheme.lower(), p.netloc.lower(), p.path.rstrip("/") or "/", query, ""))


def posting_from_jsonld(url: str, data: Dict[str, Any]) -> Optional[JobPosting]:
    """Build a JobPosting from JSON-LD when it is complete enough, else None.

    `data` may be the normalized dict returned under "jsonld" or a raw schema.org
    JobPosting object. Needs a title, a real description and a company or location.
    """
    if not data:
        return None
    if "@type" in data or "hiringOrganization" in data:
        data = normalize_jobposting(data)
    title = (data.get("title") or "").strip()
    desc = (data.get("description") or "").strip()
    company = (data.get("company") or "").strip()
    location = (data.get("location") or "").strip()
    if not title or len(desc) < 80 or not (company or location):
        return None
    canon = canonical_url(url)
    host = urlsplit(canon).netloc
    native = data.get("identifier") or ""
    key = f"{host}:{native}" if native else canon
    digest = hashlib.sha1(key.encode("utf-8")).hexdigest()[:16]
    return JobPosting(
        source="import",
        source_label="Import manuel",
        external_id=f"import_{digest}",
        title=title,
        company=company,
        location=location,
        contract_type=data.get("contract_type") or "",
        description=desc,
        url=url,
        salary=data.get("salary") or "",
        posted_at=data.get("date_posted") or None,
        remote=data.get("remote"),
        extra={
            "employment_type": data.get("employment_type") or "",
            "valid_through": data.get("valid_through"),
            "identifier": native,
            "jsonld_url": data.get("url") or "",
            "via": "jsonld",
        },
    )
