"""France Travail (ex Pôle emploi).

Two modes:
- API: "Offres d'emploi v2" on francetravail.io when client_id/client_secret are set
  (OAuth2 client_credentials). Full descriptions and recruiter contact in one call.
- Public site (no credentials): the server-rendered search page on
  candidat.francetravail.fr, plus the JSON the offer page's web component loads
  (/api-descriptifoffre/offre/<id>) for the full description.
"""
from __future__ import annotations

import asyncio
import html as htmlmod
import logging
import re
import time
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple

import httpx
from bs4 import BeautifulSoup

from .base import BaseScraper, JobPosting, ScraperError, SearchParams
from .filters import find_email, normalize_contract
from .geo import Location, resolve_location

log = logging.getLogger(__name__)

SITE = "https://candidat.francetravail.fr"
SEARCH_URL = f"{SITE}/offres/recherche"
DETAIL_URL = f"{SITE}/offres/recherche/detail/{{id}}"
DETAIL_JSON = f"{SITE}/api-descriptifoffre/offre/{{id}}"
CONTACT_URL = f"{SITE}/offres/recherche/detail.detailstandalone.postuler.contact:chargercontact"

TOKEN_URL = "https://entreprise.francetravail.fr/connexion/oauth2/access_token"
API_SEARCH = "https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search"
API_SCOPE = "api_offresdemploiv2 o2dsoffre"

# Normalized label -> France Travail typeContrat codes
TYPE_CODES = {"CDI": ["CDI"], "CDD": ["CDD"], "Intérim": ["MIS"], "Saisonnier": ["SAI"], "Freelance": ["LIB"]}
ALTERNANCE_CODES = ["E2", "FS"]   # natureContrat / natureOffre: apprentissage, professionnalisation
RAYONS = [0, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
EMISSIONS = [1, 3, 7, 14, 31]

_token_cache: Dict[str, Tuple[str, float]] = {}


def _contract_query(types: List[str]) -> Tuple[List[str], bool]:
    """Return (typeContrat codes, alternance_only). Mixed requests (Alternance + others)
    can't be expressed in one query, so we send no contract filter and post-filter."""
    types = [t for t in types or [] if t]
    if not types:
        return [], False
    if types == ["Alternance"]:
        return [], True
    if "Alternance" in types or any(t not in TYPE_CODES for t in types):
        return [], False
    codes: List[str] = []
    for t in types:
        codes += TYPE_CODES[t]
    return codes, False


def _rayon(km: int) -> int:
    for r in RAYONS:
        if km <= r:
            return r
    return RAYONS[-1]


def _emission(days: int) -> Optional[int]:
    if not days or days <= 0:
        return None
    for e in EMISSIONS:
        if days <= e:
            return e
    return None


def _relative_date(text: str, now: Optional[datetime] = None) -> Optional[str]:
    """'Publié hier' / 'Publié il y a 4 jours' / "Publié aujourd'hui" -> ISO date."""
    now = now or datetime.now(timezone.utc)
    t = text.lower()
    if "aujourd" in t:
        d = 0
    elif "hier" in t:
        d = 1
    elif "plus de 30" in t:
        return None   # unknown exact date; filters treat missing as pass
    else:
        m = re.search(r"il y a (\d+) jour", t)
        if not m:
            return None
        d = int(m.group(1))
    return (now - timedelta(days=d)).date().isoformat()


RETRY_DELAYS = (1.5, 4.0)   # the site intermittently answers a bare HTTP 500 under bursts


async def _get_with_retry(client: httpx.AsyncClient, url: str, **kw) -> httpx.Response:
    """GET with a short backoff on 5xx / transport errors. Raises ScraperError if unreachable."""
    last_exc: Optional[Exception] = None
    r: Optional[httpx.Response] = None
    for delay in (0.0, *RETRY_DELAYS):
        if delay:
            await asyncio.sleep(delay)
        try:
            r = await client.get(url, **kw)
            last_exc = None
        except httpx.HTTPError as e:
            last_exc = e
            continue
        if r.status_code < 500:
            return r
    if r is None:
        raise ScraperError(f"France Travail injoignable : {last_exc!r}")
    return r


def _clean_text(s: Optional[str]) -> str:
    if not s:
        return ""
    s = s.replace("\\n", "\n").replace("\\t", " ").replace("\r", "")
    s = htmlmod.unescape(s)
    s = re.sub(r"[ \t]+\n", "\n", s)
    return re.sub(r"\n{3,}", "\n\n", s).strip()


class FranceTravailScraper(BaseScraper):
    key = "france_travail"
    label = "France Travail"
    required_credentials: List[str] = []
    optional_credentials: List[str] = ["client_id", "client_secret"]
    help = (
        "Fonctionne sans identifiants (site public candidat.francetravail.fr, offres partenaires incluses). "
        "Optionnel : client_id + client_secret d'une application francetravail.io abonnée à l'API "
        "« Offres d'emploi v2 » pour passer par l'API officielle (contacts recruteurs inclus)."
    )

    def _has_api(self) -> bool:
        return bool(self.credentials.get("client_id") and self.credentials.get("client_secret"))

    async def search(self, params: SearchParams, client: httpx.AsyncClient) -> List[JobPosting]:
        loc = await resolve_location(client, params.location)
        if self._has_api():
            try:
                return await self._search_api(params, loc, client)
            except ScraperError as e:
                # Bad/expired credentials should not cost the user their France Travail results.
                log.warning("France Travail API failed (%s); falling back to the public site", e)
        return await self._search_site(params, loc, client)

    # ------------------------------------------------------------------ site
    async def _search_site(self, params: SearchParams, loc: Location, client: httpx.AsyncClient) -> List[JobPosting]:
        limit = max(1, min(params.limit, 100))
        q: Dict[str, str] = {"motsCles": params.query, "offresPartenaires": "true", "tri": "0", "range": f"0-{limit - 1}"}
        if loc.kind == "commune" and loc.insee:
            q["lieux"] = loc.insee
            q["rayon"] = str(_rayon(params.radius_km))
        elif loc.kind == "departement":
            q["lieux"] = f"{loc.departement}D"
        codes, alternance_only = _contract_query(params.contract_types)
        if codes:
            q["typeContrat"] = ",".join(codes)
        if alternance_only:
            q["natureOffre"] = ",".join(ALTERNANCE_CODES)
        em = _emission(params.max_age_days)
        if em:
            q["emission"] = str(em)

        r = await _get_with_retry(client, SEARCH_URL, params=q, headers={"Accept": "text/html"})
        if r.status_code != 200:
            raise ScraperError(f"France Travail a répondu HTTP {r.status_code} (réessayé {len(RETRY_DELAYS)} fois)")
        soup = BeautifulSoup(r.text, "html.parser")
        title = soup.title.get_text(strip=True) if soup.title else ""
        if "indisponible" in title.lower():
            raise ScraperError("France Travail : service indisponible")
        zone = soup.select_one("#zoneAfficherListeOffres")
        if zone is None:
            raise ScraperError("France Travail : page de résultats méconnaissable (structure modifiée ?)")

        out: List[JobPosting] = []
        for li in zone.select("li.result[data-id-offre]"):
            p = self._parse_list_item(li, alternance_only)
            if p:
                out.append(p)
        return out[:limit]

    def _parse_list_item(self, li, alternance_only: bool) -> Optional[JobPosting]:
        oid = li.get("data-id-offre", "").strip()
        h = li.select_one(".media-heading-title") or li.select_one("h2")
        if not oid or h is None:
            return None
        title = h.get_text(" ", strip=True)
        company, location = "", ""
        sub = li.select_one("p.subtext")
        if sub is not None:
            span = sub.find("span")
            location = span.get_text(" ", strip=True) if span else ""
            if span:
                span.extract()
            company = re.sub(r"\s*-\s*$", "", sub.get_text(" ", strip=True)).strip()
        desc_el = li.select_one("p.description")
        snippet = desc_el.get_text("\n", strip=True) if desc_el else ""
        contract_el = li.select_one(".media-right p.contrat") or li.select_one("p.contrat")
        contract_raw = ""
        if contract_el is not None:
            first = contract_el.find(string=True, recursive=False)
            contract_raw = (first or contract_el.get_text(" ", strip=True)).strip()
        contract = "Alternance" if alternance_only else normalize_contract(contract_raw)
        date_el = li.select_one("p.date")
        posted = _relative_date(date_el.get_text(" ", strip=True)) if date_el else None
        img = li.select_one("img[alt]")
        origin = ""
        if img is not None:
            origin = re.sub(r"^Origine de l'offre\s*:\s*", "", img.get("alt", "")).strip()
        return JobPosting(
            source=self.key, source_label=self.label, external_id=f"{self.key}_{oid}",
            title=title, company=company, location=location, contract_type=contract,
            description=snippet, url=DETAIL_URL.format(id=oid), posted_at=posted,
            contact_email=find_email(snippet),
            extra={"origin": origin, "contract_raw": contract_raw, "ft_id": oid, "mode": "site"},
        )

    # ------------------------------------------------------------------- API
    async def _token(self, client: httpx.AsyncClient) -> str:
        cid, secret = self.credentials["client_id"], self.credentials["client_secret"]
        cached = _token_cache.get(cid)
        if cached and cached[1] > time.time() + 30:
            return cached[0]
        try:
            r = await client.post(
                TOKEN_URL, params={"realm": "/partenaire"},
                data={"grant_type": "client_credentials", "client_id": cid, "client_secret": secret, "scope": API_SCOPE},
                headers={"Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json"},
            )
        except httpx.HTTPError as e:
            raise ScraperError(f"France Travail OAuth injoignable : {e!r}")
        if r.status_code != 200:
            raise ScraperError(f"Identifiants France Travail refusés (HTTP {r.status_code}) : {r.text[:200]}")
        data = r.json()
        tok = data.get("access_token")
        if not tok:
            raise ScraperError("France Travail OAuth : pas de jeton dans la réponse")
        _token_cache[cid] = (tok, time.time() + float(data.get("expires_in", 1400)))
        return tok

    async def _search_api(self, params: SearchParams, loc: Location, client: httpx.AsyncClient) -> List[JobPosting]:
        token = await self._token(client)
        limit = max(1, min(params.limit, 150))
        q: Dict[str, str] = {"motsCles": params.query, "range": f"0-{limit - 1}", "sort": "1"}
        if loc.kind == "commune" and loc.insee:
            q["commune"] = loc.insee
            q["distance"] = str(min(max(params.radius_km, 0), 200))
        elif loc.kind == "departement":
            q["departement"] = loc.departement
        codes, alternance_only = _contract_query(params.contract_types)
        if codes:
            q["typeContrat"] = ",".join(codes)
        if alternance_only:
            q["natureContrat"] = ",".join(ALTERNANCE_CODES)
        em = _emission(params.max_age_days)
        if em:
            q["publieeDepuis"] = str(em)
        try:
            r = await client.get(API_SEARCH, params=q, headers={"Authorization": f"Bearer {token}", "Accept": "application/json"})
        except httpx.HTTPError as e:
            raise ScraperError(f"API France Travail injoignable : {e!r}")
        if r.status_code == 204:
            return []
        if r.status_code in (401, 403):
            _token_cache.pop(self.credentials["client_id"], None)
            raise ScraperError(f"API France Travail : accès refusé (HTTP {r.status_code}) — application abonnée à « Offres d'emploi v2 » ?")
        if r.status_code not in (200, 206):
            raise ScraperError(f"API France Travail HTTP {r.status_code} : {r.text[:200]}")
        return [self._from_api(o) for o in r.json().get("resultats", [])][:limit]

    def _from_api(self, o: dict) -> JobPosting:
        oid = o.get("id", "")
        lieu = o.get("lieuTravail") or {}
        contact = o.get("contact") or {}
        origine = o.get("origineOffre") or {}
        partners = origine.get("partenaires") or []
        nature = o.get("natureContrat", "") or ""
        contract = "Alternance" if (o.get("alternance") or normalize_contract(nature) == "Alternance") else (
            normalize_contract(o.get("typeContrat", "")) or normalize_contract(o.get("typeContratLibelle", ""))
        )
        desc = _clean_text(o.get("description"))
        contact_text = " ".join(str(v) for v in contact.values() if isinstance(v, str))
        apply_url = contact.get("urlPostulation") or (partners[0].get("url") if partners else "") or ""
        if not apply_url and origine.get("urlOrigine") and "francetravail" not in origine.get("urlOrigine", ""):
            apply_url = origine["urlOrigine"]
        return JobPosting(
            source=self.key, source_label=self.label, external_id=f"{self.key}_{oid}",
            title=o.get("intitule", ""), company=(o.get("entreprise") or {}).get("nom", "") or "",
            location=lieu.get("libelle", ""), contract_type=contract, description=desc,
            url=DETAIL_URL.format(id=oid), apply_url=apply_url,
            contact_email=find_email(contact.get("courriel", ""), contact_text, desc),
            salary=(o.get("salaire") or {}).get("libelle", "") or "",
            posted_at=o.get("dateCreation"),
            extra={
                "mode": "api", "ft_id": oid, "rome": o.get("romeCode", ""), "sector": o.get("secteurActiviteLibelle", ""),
                "contract_raw": f"{o.get('typeContratLibelle', '')} {nature}".strip(),
                "contact_name": contact.get("nom", ""), "phone": contact.get("telephone", ""),
                "company_description": (o.get("entreprise") or {}).get("description", "") or "",
                "lat": lieu.get("latitude"), "lon": lieu.get("longitude"),
                "origin": ", ".join(p.get("nom", "") for p in partners),
            },
        )

    # --------------------------------------------------------------- details
    async def fetch_details(self, posting: JobPosting, client: httpx.AsyncClient) -> JobPosting:
        oid = posting.extra.get("ft_id") or posting.external_id.split("_", 2)[-1]
        if posting.extra.get("mode") == "api" and len(posting.description) >= 400:
            return posting
        r = await _get_with_retry(client, DETAIL_JSON.format(id=oid), headers={"Accept": "application/json"})
        if r.status_code != 200:
            raise ScraperError(f"France Travail détail {oid} : HTTP {r.status_code}")
        d = r.json()
        p = posting.model_copy(deep=True)
        desc = _clean_text(d.get("descriptif"))
        if len(desc) > len(p.description):
            p.description = desc
        etab = d.get("etablissement") or {}
        enseigne = (etab.get("libelleEnseigne") or etab.get("raisonSociale") or "").strip()
        if enseigne.lower() in ("enseigne non disponible", "non disponible"):
            enseigne = ""   # anonymous offer: France Travail hides the employer
            p.extra["anonymous_employer"] = True
        p.company = p.company or enseigne
        synth = d.get("syntheseContrat") or ""
        c = normalize_contract(synth)
        if c:
            p.contract_type = c
        sal = d.get("salaire") or ""
        if sal and sal.lower() not in ("non disponible", ""):
            p.salary = p.salary or sal
        p.location = p.location or (d.get("lieuTravail") or {}).get("syntheseLieuTravail", "")
        company_desc = _clean_text(d.get("descriptionEntreprise"))
        p.extra.update({
            "contract_raw": synth or p.extra.get("contract_raw", ""),
            "sector": d.get("syntheseSecteurActivite") or p.extra.get("sector", ""),
            "company_description": company_desc or p.extra.get("company_description", ""),
            "company_url": etab.get("urlEntreprise") or "",
            "rome": d.get("codeRome", ""), "qualification": d.get("qualification", ""),
            "experience": (d.get("experienceProfil") or {}).get("experience", ""),
            "partner": bool(d.get("flagOffrePartenaireAOM")),
        })
        p.contact_email = p.contact_email or find_email(desc, company_desc)
        if d.get("flagOffrePartenaireAOM") and not p.apply_url:
            p.apply_url = await self._partner_link(oid, client)
        p.extra["details_fetched"] = True
        return p

    async def _partner_link(self, oid: str, client: httpx.AsyncClient) -> str:
        """Partner offers (APEC, Hellowork...) are applied to on the partner site."""
        try:
            r = await client.get(CONTACT_URL, params={"t:ac": oid}, headers={"X-Requested-With": "XMLHttpRequest", "Accept": "application/json"})
            if r.status_code != 200:
                return ""
            content = r.json().get("_tapestry", {}).get("content") or []
            html = "".join(c[1] for c in content if isinstance(c, list) and len(c) > 1)
        except (httpx.HTTPError, ValueError):
            return ""
        a = BeautifulSoup(html, "html.parser").select_one("a#idLienPartenaire[href], .block-related-services a[href]")
        return a["href"] if a else ""
