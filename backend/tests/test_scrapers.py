import pytest
from app.scrapers import run_all_scrapers

@pytest.mark.asyncio
async def test_scrapers_execution():
    results = await run_all_scrapers(
        query="Alternance Informatique",
        location="Rouen",
        radius_km=20,
        contract_types=["Alternance"],
        platforms=["France Travail", "Adecco"]
    )
    assert len(results) > 0
    first = results[0]
    assert first.title != ""
    assert first.company != ""
    assert first.location != ""
    assert first.contract_type in ["Alternance", "Apprentissage", "Intérim", "CDI", "CDD"]
