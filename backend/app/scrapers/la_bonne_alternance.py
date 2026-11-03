"""La bonne alternance (apprentissage.beta.gouv.fr) — apprenticeship offers.

Uses the public search endpoint the labonnealternance.apprentissage.beta.gouv.fr
frontend calls (/api/v1/search: free-text q + lat/lon + radius, no key needed).
The documented partner API (api.apprentissage.beta.gouv.fr/api/job/v1/search)
needs a personal API key; it is not required here.

We keep only real offers ("Offres d'emploi La bonne alternance" and "Offres
d'emploi partenaires") and drop "Candidatures spontanées" (algorithmically
suggested companies that have not published any offer).
"""
from __future__ import annotations

import html
import json
import re
from typing import List, Optional

import httpx
from bs4 import BeautifulSoup

from .base import BaseScraper, JobPosting, ScraperError, SearchParams
from .filters import find_email, plain
from .geo import resolve_location

BASE = "https://labonnealternance.apprentissage.beta.gouv.fr"
SEARCH_API = f"{BASE}/api/v1/search"
OFFER_TYPES = ["Offres d'emploi La bonne alternance", "Offres d'emploi partenaires"]


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", plain(text)).strip("-") or "offre"


def _short_location(address: str) -> str:
    """'420 AVENUE DES CANADIENS 76650 PETIT-COURONNE' -> '76650 PETIT-COURONNE'."""
    m = re.search(r"\b(\d{5})\s+(.+)$", address or "")
    return f"{m.group(1)} {m.group(2).strip()}" if m else (address or "")


class LaBonneAlternanceScraper(BaseScraper):
    key = "la_bonne_alternance"
    label = "La bonne alternance"
    required_credentials: List[str] = []
    help = (
        "Offres en alternance (apprentissage / professionnalisation) du service public, sans identifiants. "
        "Les « candidatures spontanées » suggérées par l'algorithme sont ignorées : seules les vraies offres sont gardées. "
        "Utilisée seulement si le filtre de contrat inclut Alternance (ou est vide)."
    )

    @staticmethod
    def wanted(params: SearchParams) -> bool:
        return not params.contract_types or "Alternance" in params.contract_types

    async def search(self, params: SearchParams, client: httpx.AsyncClient) -> List[JobPosting]:
        if not self.wanted(params):
            return []
        limit = max(1, min(params.limit, 100))
        loc = await resolve_location(client, params.location)
        # No department filter on this endpoint: for a département, search nationally
        # with a bigger page and keep that département's offers.
        per_page = 100 if loc.kind == "departement" else limit
        q: list = [("q", params.query), ("mode", "emplois"), ("hitsPerPage", str(per_page))]
        q += [("type_filter_label", t) for t in OFFER_TYPES]
        if loc.kind == "commune" and loc.lat is not None:
            q += [("latitude", str(loc.lat)), ("longitude", str(loc.lon)),
                  ("radius", str(min(max(params.radius_km, 1), 200)))]
        try:
            r = await client.get(SEARCH_API, params=q, headers={"Accept": "application/json"})
        except httpx.HTTPError as e:
            raise ScraperError(f"La bonne alternance injoignable : {e!r}")
        if r.status_code != 200:
            raise ScraperError(f"La bonne alternance HTTP {r.status_code} : {r.text[:200]}")
        try:
            data = r.json()
        except ValueError:
            raise ScraperError("La bonne alternance : réponse non JSON")
        if "hits" not in data:
            raise ScraperError(f"La bonne alternance : réponse inattendue ({str(data)[:200]})")

        out: List[JobPosting] = []
        for h in data["hits"]:
            if h.get("type") != "offre" or h.get("sub_type") == "recruteurs_lba":
                continue
            if loc.kind == "departement" and h.get("departement_code") != loc.departement:
                continue
            p = self._from_hit(h)
            if p:
                out.append(p)
        return out[:limit]

    def _from_hit(self, h: dict) -> Optional[JobPosting]:
        uid = h.get("url_id") or h.get("_id")
        title = html.unescape(h.get("title") or "").strip()
        if not uid or not title:
            return None
        sub_type = h.get("sub_type") or "offres_emploi_lba"
        lon, lat = ((h.get("location") or {}).get("coordinates") or [None, None])[:2]
        return JobPosting(
            source=self.key, source_label=self.label, external_id=f"{self.key}_{uid}",
            title=title, company=html.unescape(h.get("organization_name") or "").strip(),
            location=_short_location(html.unescape(h.get("address") or "")), contract_type="Alternance",
            description=html.unescape(h.get("description") or "").strip(),
            url=f"{BASE}/emploi/{sub_type}/{uid}/{_slug(title)}",
            posted_at=h.get("publication_date"),
            extra={
                "sub_type": sub_type, "contracts": h.get("contract_type") or [],
                "level": h.get("level") or "", "sector": h.get("activity_sector") or "",
                "start_date": h.get("start_date"), "distance_km": h.get("distance"),
                "smart_apply": bool(h.get("smart_apply")), "application_count": h.get("application_count"),
                "lat": lat, "lon": lon, "rome_labels": h.get("rome_labels") or [],
            },
        )

    async def fetch_details(self, posting: JobPosting, client: httpx.AsyncClient) -> JobPosting:
        try:
            r = await client.get(posting.url, headers={"Accept": "text/html"})
        except httpx.HTTPError as e:
            raise ScraperError(f"La bonne alternance détail : {e!r}")
        if r.status_code != 200:
            raise ScraperError(f"La bonne alternance détail : HTTP {r.status_code}")
        soup = BeautifulSoup(r.text, "html.parser")
        p = posting.model_copy(deep=True)
        ld = soup.select_one("script#job-posting-schema") or soup.find("script", type="application/ld+json")
        if ld is not None:
            try:
                j = json.loads(ld.string or "")
            except ValueError:
                j = {}
            desc = (j.get("description") or "").strip()
            if len(desc) > len(p.description):
                p.description = desc
            p.posted_at = p.posted_at or j.get("datePosted")
            p.extra["valid_through"] = j.get("validThrough")
        a = soup.select_one('a[data-tracking-id="postuler-offre-job-partner"][href]')
        if a is not None:
            p.apply_url = a["href"]
            p.extra["apply_label"] = a.get_text(" ", strip=True)
        elif p.extra.get("smart_apply"):
            p.apply_url = p.apply_url or p.url   # candidature via the LBA form on the offer page
        p.contact_email = p.contact_email or find_email(p.description)
        p.extra["details_fetched"] = True
        return p
