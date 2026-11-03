"""Jooble — official REST API (key on request: https://jooble.org/api/about).

POST https://jooble.org/api/{api_key}, JSON body:
  keywords (str, required), location (str, required),
  radius (str, km; allowed 0, 4, 8, 16, 26, 40, 80), salary (int),
  page (int, default 1), ResultOnPage (int), SearchMode (int), companysearch (bool)
Response: {"totalCount": int, "jobs": [{id (int), title, location, snippet (HTML),
  salary, source, type, link, company, updated (ISO timestamp)}]}
Errors: 403 = invalid key, 404 = unknown endpoint.
"""
from __future__ import annotations

import logging
import math
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import httpx

from ._contract_guess import guess_contract, html_to_text
from .base import BaseScraper, JobPosting, ScraperError, SearchParams

log = logging.getLogger(__name__)

API_URL = "https://jooble.org/api/{key}"
ALLOWED_RADII = [0, 4, 8, 16, 26, 40, 80]
PAGE_SIZE = 30
MAX_PAGES = 2   # free keys have a small request quota

_REMOTE_LOCATIONS = {"teletravail", "télétravail", "remote", "à distance", "a distance"}


def snap_radius(km: int) -> int:
    """Smallest allowed radius that covers the requested one (80 max)."""
    for r in ALLOWED_RADII:
        if km <= r:
            return r
    return ALLOWED_RADII[-1]


def build_body(params: SearchParams, page: int, page_size: int) -> Dict[str, Any]:
    keywords = params.query.strip()
    loc = params.location.strip()
    body: Dict[str, Any] = {"page": str(page), "ResultOnPage": str(page_size)}
    if loc and loc.lower() not in _REMOTE_LOCATIONS:
        body["location"] = loc
        body["radius"] = str(snap_radius(params.radius_km))
    else:
        body["location"] = "France"
        if loc:
            keywords = f"{keywords} télétravail".strip()
    wanted = set(params.contract_types)
    if len(wanted) == 1:
        only = next(iter(wanted))
        if only.lower() not in keywords.lower():
            keywords = f"{keywords} {only}"
    body["keywords"] = keywords
    return body


def parse_updated(value: Any) -> Optional[str]:
    """Jooble returns e.g. '2024-01-15T00:00:00.0000000' (7 fractional digits)."""
    if not value or not isinstance(value, str):
        return None
    s = value.strip()
    if "." in s:
        head, frac = s.split(".", 1)
        digits = "".join(c for c in frac if c.isdigit())[:6]
        tz = frac[len("".join(c for c in frac if c.isdigit())):]
        s = f"{head}.{digits}{tz}" if digits else head + tz
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).isoformat()
    except ValueError:
        return None


def parse_job(job: Dict[str, Any]) -> Optional[JobPosting]:
    native_id = job.get("id")
    link = (job.get("link") or "").strip()
    title = html_to_text(job.get("title") or "")
    if native_id in (None, "") or not link or not title:
        return None
    jtype = (job.get("type") or "").strip()
    return JobPosting(
        source=JoobleScraper.key,
        source_label=JoobleScraper.label,
        external_id=f"jooble_{native_id}",
        title=title,
        company=(job.get("company") or "").strip(),
        location=(job.get("location") or "").strip(),
        contract_type=guess_contract(jtype, title),
        description=html_to_text(job.get("snippet") or ""),
        url=link,
        salary=(job.get("salary") or "").strip(),
        posted_at=parse_updated(job.get("updated")),
        extra={"type": jtype, "via": (job.get("source") or "").strip(), "snippet_only": True},
    )


class JoobleScraper(BaseScraper):
    key = "jooble"
    label = "Jooble"
    required_credentials = ["api_key"]
    help = (
        "Clé gratuite sur demande : remplissez le formulaire https://jooble.org/api/about, "
        "la clé arrive par e-mail. Quota d'appels limité ; descriptions = extraits."
    )

    async def search(self, params: SearchParams, client: httpx.AsyncClient) -> List[JobPosting]:
        if not self.is_configured():
            raise ScraperError("Jooble : clé API manquante (api_key).")
        limit = max(1, params.limit)
        page_size = min(limit, PAGE_SIZE)
        pages = min(MAX_PAGES, math.ceil(limit / page_size))
        cutoff = datetime.now(timezone.utc) - timedelta(days=max(1, params.max_age_days))

        out: List[JobPosting] = []
        seen = set()
        for page in range(1, pages + 1):
            data = await self._post(client, build_body(params, page, page_size))
            jobs = data.get("jobs")
            if not isinstance(jobs, list):
                raise ScraperError("Jooble : réponse inattendue de l'API.")
            for job in jobs:
                p = parse_job(job) if isinstance(job, dict) else None
                if not p or p.external_id in seen:
                    continue
                if p.posted_at:
                    dt = datetime.fromisoformat(p.posted_at)
                    if dt.tzinfo is None:
                        dt = dt.replace(tzinfo=timezone.utc)
                    if dt < cutoff:   # last update older than the window: certainly too old
                        continue
                seen.add(p.external_id)
                out.append(p)
            if len(jobs) < page_size or len(out) >= limit:
                break
        return out[:limit]

    async def _post(self, client: httpx.AsyncClient, body: Dict[str, Any]) -> Dict[str, Any]:
        try:
            r = await client.post(
                API_URL.format(key=self.credentials["api_key"]),
                json=body,
                headers={"Content-Type": "application/json"},
                timeout=20.0,
            )
        except httpx.HTTPError as e:
            log.warning("jooble request failed: %s", type(e).__name__)  # URL holds the key
            raise ScraperError("Jooble injoignable (erreur réseau).") from e
        if r.status_code in (401, 403):
            raise ScraperError("Jooble : clé API refusée (vérifiez api_key).")
        if r.status_code == 429:
            raise ScraperError("Jooble : quota d'appels atteint, réessayez plus tard.")
        if r.status_code >= 400:
            raise ScraperError(f"Jooble : erreur HTTP {r.status_code}.")
        try:
            data = r.json()
        except ValueError as e:
            raise ScraperError("Jooble : réponse illisible (JSON attendu).") from e
        if not isinstance(data, dict):
            raise ScraperError("Jooble : réponse inattendue de l'API.")
        return data
