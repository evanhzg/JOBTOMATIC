"""Shared contract for every job source.

Rules every scraper follows:
- Never invent data. If a source fails, raise ScraperError; the runner reports it.
- Return real postings with a stable `external_id` (prefixed with the source key)
  and the canonical offer `url`.
- `contract_type` uses the normalized labels in CONTRACT_TYPES.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, ClassVar, Dict, List, Optional

import httpx
from pydantic import BaseModel, Field

# Normalized contract labels used across the app (UI filters use these too).
CONTRACT_TYPES = ["CDI", "CDD", "Intérim", "Alternance", "Stage", "Freelance", "Saisonnier"]

USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/130.0.0.0 Safari/537.36"
)


class SearchParams(BaseModel):
    query: str
    location: str = ""            # one city/area per call ("" = whole country). "Télétravail" means remote.
    radius_km: int = 30
    contract_types: List[str] = Field(default_factory=list)   # normalized labels, empty = any
    remote: str = "any"           # any | remote_only | hybrid_ok | onsite
    max_age_days: int = 14
    limit: int = 30               # max postings per source per call


class JobPosting(BaseModel):
    source: str                   # scraper key, e.g. "france_travail"
    source_label: str             # human label, e.g. "France Travail"
    external_id: str              # "<source>_<native id>", stable across runs
    title: str
    company: str = ""
    location: str = ""
    contract_type: str = ""       # one of CONTRACT_TYPES or "" if unknown
    description: str = ""         # full plain text when the source gives it
    url: str                      # canonical offer page
    apply_url: str = ""           # direct apply link if different
    contact_email: str = ""       # only when the offer itself publishes one
    salary: str = ""
    posted_at: Optional[str] = None   # ISO 8601
    remote: Optional[bool] = None
    extra: Dict[str, Any] = Field(default_factory=dict)


class ScraperError(Exception):
    """Raised when a source cannot be queried (network, blocked, missing credentials...)."""


class BaseScraper(ABC):
    key: ClassVar[str]
    label: ClassVar[str]
    # Credential keys this source needs (read from settings.source_credentials).
    # A scraper with missing required creds is reported as "needs setup", not run.
    required_credentials: ClassVar[List[str]] = []
    # Credential keys that unlock a better mode but are not needed.
    optional_credentials: ClassVar[List[str]] = []
    # One-line help for the settings UI (where to get credentials, limits, etc.).
    help: ClassVar[str] = ""

    def __init__(self, credentials: Optional[Dict[str, str]] = None):
        self.credentials = credentials or {}

    def is_configured(self) -> bool:
        return all(self.credentials.get(k) for k in self.required_credentials)

    @abstractmethod
    async def search(self, params: SearchParams, client: httpx.AsyncClient) -> List[JobPosting]:
        """Return real postings for the params. Raise ScraperError on failure."""

    async def fetch_details(self, posting: JobPosting, client: httpx.AsyncClient) -> JobPosting:
        """Optionally enrich a posting (full description, contact email). Default: no-op."""
        return posting
