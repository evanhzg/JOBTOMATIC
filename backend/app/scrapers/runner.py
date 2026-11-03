"""Run a search across sources: concurrent fetch, dedupe, filter, enrich."""
from __future__ import annotations

import asyncio
import logging
import time
from typing import Dict, Iterable, List, Optional, Sequence, Type

import httpx
from pydantic import BaseModel

from . import load_scrapers
from .base import USER_AGENT, BaseScraper, JobPosting, ScraperError, SearchParams
from .filters import apply_filters, dedupe

log = logging.getLogger(__name__)

SOURCE_TIMEOUT_S = 45
DETAIL_TIMEOUT_S = 20
DETAIL_CONCURRENCY = 4
SHORT_DESCRIPTION = 400

DEFAULT_HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
    "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.6",
}


class SourceResult(BaseModel):
    key: str
    label: str
    ok: bool
    count: int = 0
    error: str = ""
    skipped: str = ""
    duration_ms: int = 0


class SearchReport(BaseModel):
    postings: List[JobPosting]
    sources: List[SourceResult]


def make_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(headers=DEFAULT_HEADERS, timeout=httpx.Timeout(20.0), follow_redirects=True)


def list_sources(credentials: Dict[str, Dict[str, str]]) -> List[dict]:
    """Source metadata for the settings UI."""
    out = []
    for key, cls in load_scrapers().items():
        inst = cls((credentials or {}).get(key))
        out.append({
            "key": key, "label": cls.label, "help": cls.help,
            "required_credentials": list(cls.required_credentials),
            "optional_credentials": list(getattr(cls, "optional_credentials", [])),
            "configured": inst.is_configured(),
            "has_credentials": sorted(k for k, v in ((credentials or {}).get(key) or {}).items() if v),
        })
    return out


def _skip_reason(scraper: BaseScraper, params: SearchParams) -> str:
    if not scraper.is_configured():
        return "Identifiants manquants"
    if scraper.key == "la_bonne_alternance" and params.contract_types and "Alternance" not in params.contract_types:
        return "Filtre de contrat sans Alternance"
    return ""


async def _run_one(scraper: BaseScraper, params: SearchParams, client: httpx.AsyncClient):
    t0 = time.monotonic()
    res = SourceResult(key=scraper.key, label=scraper.label, ok=False)
    postings: List[JobPosting] = []
    try:
        postings = await asyncio.wait_for(scraper.search(params, client), timeout=SOURCE_TIMEOUT_S)
        res.ok = True
        res.count = len(postings)
    except asyncio.TimeoutError:
        res.error = f"Délai dépassé ({SOURCE_TIMEOUT_S} s)"
    except ScraperError as e:
        res.error = str(e) or e.__class__.__name__
    except Exception as e:  # a broken source must never take the search down
        log.exception("source %s crashed", scraper.key)
        res.error = f"Erreur interne : {e.__class__.__name__}: {e}"
    res.duration_ms = int((time.monotonic() - t0) * 1000)
    return res, postings


async def _enrich(
    postings: List[JobPosting], scrapers: Dict[str, BaseScraper], client: httpx.AsyncClient, limit: int
) -> List[JobPosting]:
    targets = [i for i, p in enumerate(postings)
               if p.source in scrapers and len(p.description or "") < SHORT_DESCRIPTION][:max(0, limit)]
    sem = asyncio.Semaphore(DETAIL_CONCURRENCY)

    async def one(i: int) -> None:
        p = postings[i]
        async with sem:
            try:
                postings[i] = await asyncio.wait_for(scrapers[p.source].fetch_details(p, client), timeout=DETAIL_TIMEOUT_S)
            except Exception as e:  # details are best effort; keep the list record
                log.info("details failed for %s: %s", p.external_id, e)

    await asyncio.gather(*(one(i) for i in targets))
    return postings


async def run_search(
    params: SearchParams,
    sources: Optional[Sequence[str]],
    credentials: Dict[str, Dict[str, str]],
    exclude_keywords: Iterable[str] = (),
    include_keywords: Iterable[str] = (),
    fetch_details: bool = True,
    detail_limit: int = 15,
    client: Optional[httpx.AsyncClient] = None,
) -> SearchReport:
    available: Dict[str, Type[BaseScraper]] = load_scrapers()
    keys = list(available) if sources is None else list(dict.fromkeys(sources))
    credentials = credentials or {}

    results: List[SourceResult] = []
    runnable: Dict[str, BaseScraper] = {}
    for k in keys:
        cls = available.get(k)
        if cls is None:
            results.append(SourceResult(key=k, label=k, ok=False, error="Source inconnue ou indisponible"))
            continue
        inst = cls(credentials.get(k))
        reason = _skip_reason(inst, params)
        if reason:
            results.append(SourceResult(key=k, label=cls.label, ok=False, skipped=reason))
        else:
            runnable[k] = inst

    own_client = client is None
    client = client or make_client()
    try:
        outcomes = await asyncio.gather(*(_run_one(s, params, client) for s in runnable.values()))
        all_postings: List[JobPosting] = []
        for res, posts in outcomes:
            results.append(res)
            all_postings.extend(posts)

        postings = apply_filters(dedupe(all_postings), params, list(exclude_keywords), list(include_keywords))
        if fetch_details and postings and detail_limit > 0:
            postings = await _enrich(postings, runnable, client, detail_limit)
            # details can reveal the real contract / text: filter again
            postings = apply_filters(postings, params, list(exclude_keywords), list(include_keywords))
    finally:
        if own_client:
            await client.aclose()

    order = {k: i for i, k in enumerate(keys)}
    results.sort(key=lambda r: order.get(r.key, len(order)))
    return SearchReport(postings=postings, sources=results)
