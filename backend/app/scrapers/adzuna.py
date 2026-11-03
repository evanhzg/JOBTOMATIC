"""Adzuna — official job search API (https://developer.adzuna.com).

GET https://api.adzuna.com/v1/api/jobs/fr/search/{page}
Response (Adzuna::API::Response::JobSearchResults): {"count", "mean", "results": [Job]}
Job: id, title, description (truncated to ~500 chars), created (ISO 8601),
redirect_url, company.display_name, location.display_name / location.area[],
salary_min, salary_max, salary_is_predicted, contract_type ("permanent" |
"contract"), contract_time ("full_time" | "part_time"), category.label/tag,
latitude, longitude, adref.
Contract filters are flags: permanent=1, contract=1, full_time=1, part_time=1.
"""
from __future__ import annotations

import logging
import math
from typing import Any, Dict, List, Optional

import httpx

from ._contract_guess import guess_contract, html_to_text
from .base import BaseScraper, JobPosting, ScraperError, SearchParams

log = logging.getLogger(__name__)

API_URL = "https://api.adzuna.com/v1/api/jobs/fr/search/{page}"
MAX_PER_PAGE = 50
MAX_PAGES = 3   # free tier is rate-limited; never page deeper than this per call

_REMOTE_LOCATIONS = {"teletravail", "télétravail", "remote", "à distance", "a distance"}

_API_CONTRACT = {"permanent": "CDI", "contract": "CDD"}
_PERMANENT_SET = {"CDI"}
_CONTRACT_SET = {"CDD", "Intérim", "Freelance", "Saisonnier"}


def _fmt_amount(v: float) -> str:
    return f"{int(round(v)):,}".replace(",", " ")


def format_salary(job: Dict[str, Any]) -> str:
    lo, hi = job.get("salary_min"), job.get("salary_max")
    try:
        lo = float(lo) if lo not in (None, "") else None
        hi = float(hi) if hi not in (None, "") else None
    except (TypeError, ValueError):
        return ""
    if not lo and not hi:
        return ""
    if lo and hi and abs(lo - hi) > 1:
        s = f"{_fmt_amount(lo)} – {_fmt_amount(hi)} €"
    else:
        s = f"{_fmt_amount(lo or hi)} €"
    # Adzuna France salaries are yearly gross figures.
    s += " / an"
    if str(job.get("salary_is_predicted", "0")).lower() in ("1", "true"):
        s += " (estimation Adzuna)"
    return s


def build_query(params: SearchParams, page_size: int) -> Dict[str, Any]:
    what = params.query.strip()
    q: Dict[str, Any] = {
        "results_per_page": page_size,
        "max_days_old": max(1, params.max_age_days),
        "sort_by": "date",
        "content-type": "application/json",
    }
    loc = params.location.strip()
    if loc and loc.lower() not in _REMOTE_LOCATIONS:
        q["where"] = loc
        q["distance"] = max(1, params.radius_km)
    elif loc:
        what = f"{what} télétravail".strip()

    wanted = set(params.contract_types)
    if wanted:
        if wanted <= _PERMANENT_SET:
            q["permanent"] = "1"
        elif wanted <= _CONTRACT_SET:
            q["contract"] = "1"
        elif wanted == {"Alternance"} and "alternance" not in what.lower():
            what = f"{what} alternance"
        elif wanted == {"Stage"} and "stage" not in what.lower():
            what = f"{what} stage"
    q["what"] = what
    return q


def parse_job(job: Dict[str, Any]) -> Optional[JobPosting]:
    native_id = str(job.get("id") or "").strip()
    url = (job.get("redirect_url") or "").strip()
    title = html_to_text(job.get("title") or "")
    if not native_id or not url or not title:
        return None
    company = (job.get("company") or {}).get("display_name") or ""
    loc = job.get("location") or {}
    location = loc.get("display_name") or ""
    category = job.get("category") or {}
    contract = guess_contract(title) or _API_CONTRACT.get(job.get("contract_type") or "", "")
    extra: Dict[str, Any] = {
        "contract_time": job.get("contract_time") or "",
        "category": category.get("label") or "",
        "area": loc.get("area") or [],
        "snippet_only": True,
    }
    for k in ("latitude", "longitude", "adref"):
        if job.get(k) is not None:
            extra[k] = job[k]
    return JobPosting(
        source=AdzunaScraper.key,
        source_label=AdzunaScraper.label,
        external_id=f"adzuna_{native_id}",
        title=title,
        company=company.strip(),
        location=location.strip(),
        contract_type=contract,
        description=html_to_text(job.get("description") or ""),
        url=url,
        salary=format_salary(job),
        posted_at=job.get("created") or None,
        extra=extra,
    )


class AdzunaScraper(BaseScraper):
    key = "adzuna"
    label = "Adzuna"
    required_credentials = ["app_id", "app_key"]
    help = (
        "Clé gratuite : créez un compte sur https://developer.adzuna.com (Register), "
        "puis copiez « Application ID » et « Application Key » depuis votre tableau de bord. "
        "Descriptions tronquées (~500 caractères) ; l'offre complète est sur le site d'origine."
    )

    async def search(self, params: SearchParams, client: httpx.AsyncClient) -> List[JobPosting]:
        if not self.is_configured():
            raise ScraperError("Adzuna : identifiants manquants (app_id et app_key).")
        limit = max(1, params.limit)
        page_size = min(limit, MAX_PER_PAGE)
        pages = min(MAX_PAGES, math.ceil(limit / page_size))
        base_q = build_query(params, page_size)
        base_q["app_id"] = self.credentials["app_id"]
        base_q["app_key"] = self.credentials["app_key"]

        out: List[JobPosting] = []
        seen = set()
        for page in range(1, pages + 1):
            data = await self._get(client, page, base_q)
            results = data.get("results")
            if not isinstance(results, list):
                raise ScraperError("Adzuna : réponse inattendue de l'API.")
            for job in results:
                p = parse_job(job) if isinstance(job, dict) else None
                if p and p.external_id not in seen:
                    seen.add(p.external_id)
                    out.append(p)
            if len(results) < page_size or len(out) >= limit:
                break
        return out[:limit]

    async def _get(self, client: httpx.AsyncClient, page: int, q: Dict[str, Any]) -> Dict[str, Any]:
        try:
            r = await client.get(API_URL.format(page=page), params=q, timeout=20.0)
        except httpx.HTTPError as e:
            log.warning("adzuna request failed: %s", type(e).__name__)  # URL holds the key
            raise ScraperError("Adzuna injoignable (erreur réseau).") from e
        if r.status_code in (401, 403):
            raise ScraperError("Adzuna : identifiants refusés (vérifiez app_id / app_key).")
        if r.status_code == 429:
            raise ScraperError("Adzuna : quota d'appels atteint, réessayez plus tard.")
        if r.status_code >= 400:
            detail = ""
            try:
                detail = r.json().get("display") or r.json().get("exception") or ""
            except Exception:
                pass
            raise ScraperError(f"Adzuna : erreur HTTP {r.status_code}{' (' + detail + ')' if detail else ''}.")
        try:
            data = r.json()
        except ValueError as e:
            raise ScraperError("Adzuna : réponse illisible (JSON attendu).") from e
        if not isinstance(data, dict):
            raise ScraperError("Adzuna : réponse inattendue de l'API.")
        if data.get("exception"):
            raise ScraperError(f"Adzuna : {data.get('display') or data['exception']}.")
        return data
