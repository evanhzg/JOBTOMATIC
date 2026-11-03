"""Live tests against the real sites. Skipped unless LIVE=1.

    LIVE=1 ./venv/bin/python -m pytest tests/test_sources_live.py -v

They assert that real, non-empty postings come back; they do not assert exact
counts (the job market moves).
"""
import os

import pytest

from app.scrapers.base import ScraperError, SearchParams
from app.scrapers.france_travail import FranceTravailScraper
from app.scrapers.la_bonne_alternance import LaBonneAlternanceScraper
from app.scrapers.runner import list_sources, make_client, run_search

pytestmark = [
    pytest.mark.live,
    pytest.mark.skipif(os.environ.get("LIVE") != "1", reason="live network test (set LIVE=1)"),
]


def _assert_real(postings, source_key):
    assert postings, f"{source_key}: no results"
    for p in postings:
        assert p.source == source_key
        assert p.title.strip()
        assert p.url.startswith("https://")
        assert p.external_id.startswith(f"{source_key}_")


@pytest.mark.parametrize("query,location", [("serveur", "Lyon"), ("développeur", "Rouen")])
async def test_france_travail_public_site(query, location):
    params = SearchParams(query=query, location=location, radius_km=30, max_age_days=31, limit=20)
    async with make_client() as c:
        s = FranceTravailScraper()
        res = await s.search(params, c)
        _assert_real(res, "france_travail")
        d = await s.fetch_details(res[0], c)
        assert len(d.description) >= len(res[0].description)
        assert d.extra.get("details_fetched")


async def test_france_travail_interim_filter():
    params = SearchParams(query="préparateur de commandes", location="Lyon", contract_types=["Intérim"])
    async with make_client() as c:
        res = await FranceTravailScraper().search(params, c)
    _assert_real(res, "france_travail")
    assert all(p.contract_type == "Intérim" for p in res)


async def test_france_travail_alternance_filter():
    params = SearchParams(query="développeur", contract_types=["Alternance"], max_age_days=31)
    async with make_client() as c:
        res = await FranceTravailScraper().search(params, c)
    _assert_real(res, "france_travail")
    assert all(p.contract_type == "Alternance" for p in res)


async def test_la_bonne_alternance_lyon():
    params = SearchParams(query="serveur", location="Lyon", radius_km=30, max_age_days=0)
    async with make_client() as c:
        s = LaBonneAlternanceScraper()
        res = await s.search(params, c)
        _assert_real(res, "la_bonne_alternance")
        assert all(p.contract_type == "Alternance" for p in res)
        d = await s.fetch_details(res[0], c)
        assert d.description


async def test_la_bonne_alternance_developpeur_france():
    params = SearchParams(query="développeur", contract_types=["Alternance"], max_age_days=0)
    async with make_client() as c:
        res = await LaBonneAlternanceScraper().search(params, c)
    _assert_real(res, "la_bonne_alternance")


async def test_la_bonne_alternance_skipped_without_alternance():
    params = SearchParams(query="serveur", location="Lyon", contract_types=["CDI"])
    async with make_client() as c:
        assert await LaBonneAlternanceScraper().search(params, c) == []


async def test_runner_end_to_end():
    params = SearchParams(query="serveur", location="Lyon", radius_km=30, max_age_days=31, limit=15)
    report = await run_search(params, ["france_travail", "la_bonne_alternance"], {}, detail_limit=4)
    by_key = {s.key: s for s in report.sources}
    assert by_key["france_travail"].ok and by_key["france_travail"].count > 0
    assert by_key["la_bonne_alternance"].ok
    assert report.postings
    assert all(p.title and p.url for p in report.postings)
    assert len({p.external_id for p in report.postings}) == len(report.postings)


async def test_runner_skips_lba_for_cdi_only():
    params = SearchParams(query="serveur", location="Lyon", contract_types=["CDI"], limit=10)
    report = await run_search(params, ["france_travail", "la_bonne_alternance"], {}, fetch_details=False)
    by_key = {s.key: s for s in report.sources}
    assert by_key["la_bonne_alternance"].skipped
    assert all(p.contract_type in ("CDI", "") for p in report.postings)


def test_list_sources_shape():
    rows = {r["key"]: r for r in list_sources({})}
    for k in ("france_travail", "la_bonne_alternance"):
        assert rows[k]["configured"] is True
        assert rows[k]["required_credentials"] == []
        assert rows[k]["help"]
