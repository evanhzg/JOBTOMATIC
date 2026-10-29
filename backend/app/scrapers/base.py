from abc import ABC, abstractmethod
from typing import Any, Dict, List
from pydantic import BaseModel

class JobPosting(BaseModel):
    external_id: str
    title: str
    company: str
    location: str
    contract_type: str
    description: str
    url: str
    contact_email: str = ""
    salary: str = ""
    source: str
    apply_method: str = "form" # "form" or "email"

class BaseScraper(ABC):
    @abstractmethod
    async def search(self, query: str, location: str, radius_km: int, contract_types: List[str]) -> List[JobPosting]:
        pass
