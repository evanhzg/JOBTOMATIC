"""Source registry. Each module registers one scraper class in SCRAPER_MODULES.

Modules are imported defensively so a broken/missing optional dependency in one
source never takes the others down.
"""
from __future__ import annotations

import importlib
import logging
from typing import Dict, Type

from .base import BaseScraper, JobPosting, ScraperError, SearchParams  # noqa: F401

log = logging.getLogger(__name__)

# module name -> class name
SCRAPER_MODULES = {
    "france_travail": "FranceTravailScraper",
    "la_bonne_alternance": "LaBonneAlternanceScraper",
    "adzuna": "AdzunaScraper",
    "jooble": "JoobleScraper",
}


def load_scrapers() -> Dict[str, Type[BaseScraper]]:
    found: Dict[str, Type[BaseScraper]] = {}
    for mod_name, cls_name in SCRAPER_MODULES.items():
        try:
            mod = importlib.import_module(f".{mod_name}", __name__)
            cls = getattr(mod, cls_name)
            found[cls.key] = cls
        except Exception as e:  # pragma: no cover - depends on optional deps
            log.warning("scraper %s unavailable: %s", mod_name, e)
    return found
