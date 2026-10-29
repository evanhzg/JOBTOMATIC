from typing import List
from .base import JobPosting
from .france_travail import FranceTravailScraper
from .hellowork import HelloWorkScraper
from .interim import InterimAgenciesScraper
from .indeed import IndeedScraper

async def run_all_scrapers(query: str, location: str, radius_km: int, contract_types: List[str], platforms: List[str]) -> List[JobPosting]:
    all_results: List[JobPosting] = []

    # Map platforms to instances
    scrapers = []
    plats_lower = [p.lower() for p in platforms] if platforms else ["france travail", "indeed", "hellowork", "adecco", "manpower"]

    if any("france travail" in p or "pole" in p for p in plats_lower):
        scrapers.append(FranceTravailScraper())
    if any("hellowork" in p for p in plats_lower):
        scrapers.append(HelloWorkScraper())
    if any("indeed" in p for p in plats_lower):
        scrapers.append(IndeedScraper())
    if any("adecco" in p or "manpower" in p or "randstad" in p or "intérim" in p for p in plats_lower):
        scrapers.append(InterimAgenciesScraper())

    # Fallback to at least FranceTravail & Interim if empty
    if not scrapers:
        scrapers = [FranceTravailScraper(), InterimAgenciesScraper()]

    for s in scrapers:
        try:
            items = await s.search(query, location, radius_km, contract_types)
            for item in items:
                # Deduplicate by external_id
                if not any(existing.external_id == item.external_id for existing in all_results):
                    all_results.append(item)
        except Exception as e:
            print(f"Error executing scraper {s.__class__.__name__}: {e}")

    return all_results
