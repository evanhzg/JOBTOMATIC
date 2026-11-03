"""Resolve a free-text French location to codes/coordinates via the public geo APIs.

- https://geo.api.gouv.fr (communes / départements): INSEE code, postcodes, centre.
- https://api-adresse.data.gouv.fr as a fallback for odd spellings.

Results are cached in-process (locations rarely change).
"""
from __future__ import annotations

import re
import unicodedata
from typing import Dict, Optional

import httpx
from pydantic import BaseModel

GEO_API = "https://geo.api.gouv.fr"
ADRESSE_API = "https://api-adresse.data.gouv.fr/search/"

REMOTE_WORDS = {"teletravail", "remote", "full remote", "a distance", "100% teletravail"}
NATIONAL_WORDS = {"", "france", "toute la france", "partout", "national"}


class Location(BaseModel):
    kind: str                 # "commune" | "departement" | "remote" | "none"
    name: str = ""
    insee: str = ""           # commune INSEE code (kind=commune)
    postcode: str = ""
    departement: str = ""     # "76", "2A"...
    lat: Optional[float] = None
    lon: Optional[float] = None


_cache: Dict[str, Location] = {}


def _plain(text: str) -> str:
    t = unicodedata.normalize("NFKD", text or "")
    t = "".join(c for c in t if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", t).strip().lower()


async def resolve_location(client: httpx.AsyncClient, text: str) -> Location:
    """Turn "Rouen", "69003", "Seine-Maritime", "76" or "Télétravail" into a Location.

    Returns kind="none" for empty/national input. Raises nothing: an unresolvable
    location yields kind="none" with the original name so callers can decide.
    """
    raw = (text or "").strip()
    key = _plain(raw)
    if key in NATIONAL_WORDS:
        return Location(kind="none")
    if key in REMOTE_WORDS or "teletravail" in key:
        return Location(kind="remote", name=raw)
    if key in _cache:
        return _cache[key]

    loc: Optional[Location] = None
    # "Lyon (69)" / "Rouen, 76" -> keep the city part
    city = re.sub(r"\(.*?\)|,.*$", "", raw).strip() or raw
    try:
        if re.fullmatch(r"(\d{2}|2[AaBb]|97\d)", city):
            loc = await _departement_by_code(client, city.upper())
        elif re.fullmatch(r"\d{5}", city):
            loc = await _commune(client, {"codePostal": city})
        else:
            loc = await _commune(client, {"nom": city})
            if loc is None:
                loc = await _departement_by_name(client, city)
            if loc is None:
                loc = await _adresse(client, city)
    except (httpx.HTTPError, ValueError, KeyError, IndexError):
        loc = None

    if loc is None:
        return Location(kind="none", name=raw)
    _cache[key] = loc
    return loc


async def _commune(client: httpx.AsyncClient, query: dict) -> Optional[Location]:
    params = {
        **query,
        "fields": "nom,code,codesPostaux,population,centre,codeDepartement",
        "boost": "population",
        "limit": 1,
    }
    r = await client.get(f"{GEO_API}/communes", params=params, timeout=10)
    r.raise_for_status()
    data = r.json()
    if not data:
        return None
    c = data[0]
    lon, lat = (c.get("centre") or {}).get("coordinates", [None, None])
    cps = c.get("codesPostaux") or [""]
    return Location(
        kind="commune", name=c.get("nom", ""), insee=c.get("code", ""),
        postcode=query.get("codePostal") or cps[0], departement=c.get("codeDepartement", ""),
        lat=lat, lon=lon,
    )


async def _departement_by_code(client: httpx.AsyncClient, code: str) -> Optional[Location]:
    r = await client.get(f"{GEO_API}/departements/{code}", timeout=10)
    if r.status_code == 404:
        return None
    r.raise_for_status()
    d = r.json()
    return Location(kind="departement", name=d.get("nom", code), departement=d.get("code", code))


async def _departement_by_name(client: httpx.AsyncClient, name: str) -> Optional[Location]:
    r = await client.get(f"{GEO_API}/departements", params={"nom": name, "limit": 1}, timeout=10)
    r.raise_for_status()
    data = r.json()
    if not data or _plain(data[0].get("nom", "")) != _plain(name):
        return None
    d = data[0]
    return Location(kind="departement", name=d["nom"], departement=d["code"])


async def _adresse(client: httpx.AsyncClient, q: str) -> Optional[Location]:
    r = await client.get(ADRESSE_API, params={"q": q, "type": "municipality", "limit": 1}, timeout=10)
    r.raise_for_status()
    feats = r.json().get("features") or []
    if not feats:
        return None
    p = feats[0]["properties"]
    lon, lat = feats[0]["geometry"]["coordinates"]
    return Location(
        kind="commune", name=p.get("city") or p.get("name", q), insee=p.get("citycode", ""),
        postcode=p.get("postcode", ""), departement=p.get("depcode", "") or p.get("citycode", "")[:2],
        lat=lat, lon=lon,
    )
