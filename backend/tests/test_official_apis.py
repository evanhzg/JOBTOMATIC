"""Offline tests for the official-API sources (Adzuna, Jooble) and the URL importer.

Responses follow the documented shapes (Adzuna swagger JobSearchResults / Job,
Jooble REST API doc). Everything goes through httpx.MockTransport: no network.
"""
import json
from datetime import datetime, timedelta, timezone

import httpx
import pytest

from app.importer import (
    extract_jobposting,
    fetch_offer_page,
    parse_offer_html,
    posting_from_jsonld,
)
from app.scrapers.adzuna import AdzunaScraper, build_query
from app.scrapers.base import ScraperError, SearchParams
from app.scrapers.jooble import JoobleScraper, build_body, snap_radius

RECENT = (datetime.now(timezone.utc) - timedelta(days=2)).strftime("%Y-%m-%dT%H:%M:%SZ")
RECENT_JOOBLE = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:%S") + ".0000000"


def client_for(handler):
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


# --------------------------------------------------------------------- Adzuna

ADZUNA_RESPONSE = {
    "__CLASS__": "Adzuna::API::Response::JobSearchResults",
    "count": 2,
    "mean": 38000,
    "results": [
        {
            "__CLASS__": "Adzuna::API::Response::Job",
            "id": "4321987654",
            "adref": "eyJhbGciOi",
            "title": "Développeur <strong>Python</strong> H/F",
            "description": "Nous recherchons un développeur Python pour notre équipe à Rouen&hellip;",
            "created": RECENT,
            "redirect_url": "https://www.adzuna.fr/land/ad/4321987654?se=abc",
            "company": {"__CLASS__": "Adzuna::API::Response::Company", "display_name": "Acme SAS"},
            "location": {
                "__CLASS__": "Adzuna::API::Response::Location",
                "display_name": "Rouen, Seine-Maritime",
                "area": ["France", "Normandie", "Seine-Maritime", "Rouen"],
            },
            "salary_min": 35000,
            "salary_max": 42000,
            "salary_is_predicted": "0",
            "contract_type": "permanent",
            "contract_time": "full_time",
            "category": {"__CLASS__": "Adzuna::API::Response::Category", "label": "Emplois Informatique", "tag": "it-jobs"},
            "latitude": 49.44,
            "longitude": 1.09,
        },
        {
            "id": "4321987655",
            "title": "Alternance - Développeur web",
            "description": "Contrat d'apprentissage 24 mois.",
            "created": RECENT,
            "redirect_url": "https://www.adzuna.fr/land/ad/4321987655",
            "company": {"display_name": "Beta"},
            "location": {"display_name": "Le Havre", "area": ["France", "Normandie", "Le Havre"]},
            "salary_min": 14000,
            "salary_max": 14000,
            "salary_is_predicted": "1",
            "contract_type": "contract",
        },
        {"id": "broken-no-url", "title": "Sans lien"},
    ],
}


async def test_adzuna_parses_documented_response():
    seen = {}

    def handler(request: httpx.Request):
        seen["url"] = request.url
        return httpx.Response(200, json=ADZUNA_RESPONSE)

    s = AdzunaScraper({"app_id": "ID", "app_key": "KEY"})
    async with client_for(handler) as c:
        out = await s.search(SearchParams(query="développeur python", location="Rouen", radius_km=20,
                                          contract_types=["CDI"], max_age_days=7, limit=20), c)

    q = seen["url"].params
    assert seen["url"].path == "/v1/api/jobs/fr/search/1"
    assert q["app_id"] == "ID" and q["app_key"] == "KEY"
    assert q["what"] == "développeur python" and q["where"] == "Rouen"
    assert q["distance"] == "20" and q["max_days_old"] == "7" and q["results_per_page"] == "20"
    assert q["permanent"] == "1" and "contract" not in q
    assert q["content-type"] == "application/json"

    assert len(out) == 2  # the entry without redirect_url is dropped, not patched up
    a, b = out
    assert a.external_id == "adzuna_4321987654"
    assert a.source == "adzuna" and a.source_label == "Adzuna"
    assert a.title == "Développeur Python H/F"
    assert a.company == "Acme SAS" and a.location == "Rouen, Seine-Maritime"
    assert a.contract_type == "CDI"
    assert a.url == "https://www.adzuna.fr/land/ad/4321987654?se=abc"
    assert a.posted_at == RECENT
    assert a.salary == "35 000 – 42 000 € / an"
    assert "…" in a.description
    assert a.extra["category"] == "Emplois Informatique"

    assert b.contract_type == "Alternance"   # title wins over the API's "contract"
    assert b.salary == "14 000 € / an (estimation Adzuna)"


def test_adzuna_query_variants():
    remote = build_query(SearchParams(query="data analyst", location="Télétravail"), 30)
    assert "where" not in remote and "distance" not in remote
    assert "télétravail" in remote["what"]
    cdd = build_query(SearchParams(query="x", contract_types=["CDD", "Intérim"]), 30)
    assert cdd["contract"] == "1" and "permanent" not in cdd
    alt = build_query(SearchParams(query="développeur", contract_types=["Alternance"]), 30)
    assert alt["what"] == "développeur alternance"
    mixed = build_query(SearchParams(query="x", contract_types=["CDI", "CDD"]), 30)
    assert "permanent" not in mixed and "contract" not in mixed


async def test_adzuna_pages_until_limit():
    calls = []

    def handler(request):
        page = int(request.url.path.rsplit("/", 1)[1])
        calls.append(page)
        results = [{"id": f"{page}-{i}", "title": f"Job {page}-{i}", "redirect_url": f"https://a/{page}/{i}"}
                   for i in range(50)]
        return httpx.Response(200, json={"count": 500, "results": results})

    async with client_for(handler) as c:
        out = await AdzunaScraper({"app_id": "a", "app_key": "b"}).search(SearchParams(query="x", limit=80), c)
    assert calls == [1, 2] and len(out) == 80


@pytest.mark.parametrize("status,body,needle", [
    (401, {"__CLASS__": "Adzuna::API::Response::Exception", "exception": "AUTH_FAIL",
           "display": "Authorisation failed"}, "identifiants"),
    (429, {}, "quota"),
    (500, {"exception": "SERVER", "display": "Boom"}, "HTTP 500"),
])
async def test_adzuna_errors(status, body, needle):
    async with client_for(lambda r: httpx.Response(status, json=body)) as c:
        with pytest.raises(ScraperError, match=needle):
            await AdzunaScraper({"app_id": "a", "app_key": "b"}).search(SearchParams(query="x"), c)


async def test_adzuna_network_error():
    def handler(request):
        raise httpx.ConnectError("down", request=request)

    async with client_for(handler) as c:
        with pytest.raises(ScraperError, match="injoignable"):
            await AdzunaScraper({"app_id": "a", "app_key": "b"}).search(SearchParams(query="x"), c)


# --------------------------------------------------------------------- Jooble

JOOBLE_RESPONSE = {
    "totalCount": 2,
    "jobs": [
        {
            "title": "Technicien de maintenance H/F",
            "location": "Rouen",
            "snippet": "&nbsp;...Nous recrutons un <b>technicien</b> de maintenance en CDI...&nbsp;",
            "salary": "2 200 € - 2 600 € par mois",
            "source": "hellowork.com",
            "type": "CDI",
            "link": "https://jooble.org/desc/-1234567890123456789?ckey=technicien",
            "company": "Maintenance Plus",
            "updated": RECENT_JOOBLE,
            "id": -1234567890123456789,
        },
        {
            "title": "Stagiaire RH",
            "location": "Paris",
            "snippet": "Stage de 6 mois",
            "salary": "",
            "source": "indeed",
            "type": "",
            "link": "https://jooble.org/desc/42",
            "company": "",
            "updated": "2019-01-01T00:00:00.0000000",   # outside the age window
            "id": 42,
        },
    ],
}


async def test_jooble_parses_documented_response():
    seen = {}

    def handler(request: httpx.Request):
        seen["url"] = str(request.url)
        seen["method"] = request.method
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json=JOOBLE_RESPONSE)

    s = JoobleScraper({"api_key": "SECRET"})
    async with client_for(handler) as c:
        out = await s.search(SearchParams(query="technicien maintenance", location="Rouen", radius_km=30,
                                          max_age_days=14, limit=20), c)

    assert seen["method"] == "POST" and seen["url"] == "https://jooble.org/api/SECRET"
    assert seen["body"]["keywords"] == "technicien maintenance"
    assert seen["body"]["location"] == "Rouen"
    assert seen["body"]["radius"] == "40"   # snapped to the documented allowed values
    assert seen["body"]["page"] == "1"

    assert len(out) == 1   # the 2019 posting is outside max_age_days
    p = out[0]
    assert p.external_id == "jooble_-1234567890123456789"
    assert p.source == "jooble" and p.source_label == "Jooble"
    assert p.company == "Maintenance Plus" and p.location == "Rouen"
    assert p.contract_type == "CDI"
    assert p.url.startswith("https://jooble.org/desc/")
    assert p.salary == "2 200 € - 2 600 € par mois"
    assert "<b>" not in p.description and "technicien de maintenance" in p.description
    assert p.posted_at and p.posted_at.startswith(RECENT_JOOBLE[:19])
    assert p.extra["via"] == "hellowork.com"


def test_jooble_body_variants():
    assert snap_radius(0) == 0 and snap_radius(10) == 16 and snap_radius(200) == 80
    remote = build_body(SearchParams(query="dev", location="Télétravail"), 1, 20)
    assert remote["location"] == "France" and "télétravail" in remote["keywords"]
    assert "radius" not in remote
    whole = build_body(SearchParams(query="dev", contract_types=["Alternance"]), 2, 20)
    assert whole["location"] == "France" and whole["keywords"] == "dev Alternance"
    assert whole["page"] == "2"


@pytest.mark.parametrize("status,needle", [(403, "clé API refusée"), (404, "HTTP 404"), (429, "quota")])
async def test_jooble_errors(status, needle):
    async with client_for(lambda r: httpx.Response(status, text="nope")) as c:
        with pytest.raises(ScraperError, match=needle):
            await JoobleScraper({"api_key": "k"}).search(SearchParams(query="x"), c)


async def test_jooble_non_json():
    async with client_for(lambda r: httpx.Response(200, text="<html>oops</html>")) as c:
        with pytest.raises(ScraperError, match="illisible"):
            await JoobleScraper({"api_key": "k"}).search(SearchParams(query="x"), c)


# --------------------------------------------------------------- credentials

@pytest.mark.parametrize("cls,creds", [
    (AdzunaScraper, {}),
    (AdzunaScraper, {"app_id": "only-id"}),
    (JoobleScraper, {}),
    (JoobleScraper, {"api_key": ""}),
])
async def test_missing_credentials(cls, creds):
    def handler(request):  # pragma: no cover - must not be reached
        raise AssertionError("no request without credentials")

    s = cls(creds)
    assert not s.is_configured()
    assert s.help and "http" in s.help
    async with client_for(handler) as c:
        with pytest.raises(ScraperError, match="manquant"):
            await s.search(SearchParams(query="x"), c)


def test_registry_metadata():
    assert AdzunaScraper.key == "adzuna" and AdzunaScraper.required_credentials == ["app_id", "app_key"]
    assert JoobleScraper.key == "jooble" and JoobleScraper.required_credentials == ["api_key"]


# --------------------------------------------------------------------- import

JSONLD_PAGE = """<!doctype html><html><head><title>Offre - Site</title>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Site"}</script>
<script type="application/ld+json">
{"@context": "https://schema.org", "@graph": [{"@type": "WebPage", "name": "x"}, {
  "@type": "JobPosting",
  "title": "Chargé de recrutement (H/F)",
  "datePosted": "2026-10-28",
  "validThrough": "2026-12-01T00:00:00+01:00",
  "employmentType": ["FULL_TIME", "TEMPORARY"],
  "identifier": {"@type": "PropertyValue", "name": "Acme", "value": "REF-77"},
  "hiringOrganization": {"@type": "Organization", "name": "Acme Conseil"},
  "jobLocation": [{"@type": "Place", "address": {"@type": "PostalAddress",
      "addressLocality": "Rouen", "postalCode": "76000", "addressCountry": "FR"}}],
  "baseSalary": {"@type": "MonetaryAmount", "currency": "EUR",
      "value": {"@type": "QuantitativeValue", "minValue": 2400, "maxValue": 2800, "unitText": "MONTH"}},
  "description": "<p>Au sein de notre cabinet, vous <strong>pilotez</strong> les recrutements.</p><ul><li>Sourcing</li><li>Entretiens</li></ul><p>CDD de 6 mois, poste basé à Rouen avec deux jours de télétravail.</p>",
  "qualifications": "Bac+3 RH"
}]}
</script></head>
<body><nav>Menu Accueil Offres</nav><main><h1>Chargé de recrutement</h1><p>Texte de la page</p></main>
<footer>Mentions légales</footer><script>var tracking = 1;</script></body></html>"""


def test_extract_jobposting_from_jsonld_graph():
    j = extract_jobposting(JSONLD_PAGE)
    assert j["schema_format"] == "json-ld"
    assert j["title"] == "Chargé de recrutement (H/F)"
    assert j["company"] == "Acme Conseil"
    assert j["location"] == "Rouen (76000)"
    assert j["employment_type"] == "FULL_TIME, TEMPORARY"
    assert j["contract_type"] == "CDD"
    assert j["date_posted"] == "2026-10-28"
    assert j["salary"] == "2 400 – 2 800 € / mois"
    assert j["identifier"] == "REF-77"
    assert "pilotez les recrutements" in j["description"]
    assert "• Sourcing" in j["description"] and "<" not in j["description"]
    assert "Profil :\nBac+3 RH" in j["description"]


def test_parse_offer_html_prefers_jsonld_and_builds_posting():
    r = parse_offer_html(JSONLD_PAGE, "https://ex.fr/offre/77?utm_source=x")
    assert r["title"] == "Chargé de recrutement (H/F)"
    assert r["text"].startswith("Poste : Chargé de recrutement (H/F)\nEntreprise : Acme Conseil")
    assert "Contrat : CDD, temps plein, temporaire" in r["text"]
    assert "tracking" not in r["text"] and "Menu" not in r["text"]

    p = posting_from_jsonld(r["url"], r["jsonld"])
    assert p.source == "import" and p.source_label == "Import manuel"
    assert p.external_id.startswith("import_")
    assert p.title == "Chargé de recrutement (H/F)" and p.company == "Acme Conseil"
    assert p.contract_type == "CDD" and p.posted_at == "2026-10-28"
    assert p.url == "https://ex.fr/offre/77?utm_source=x"
    # same offer, different tracking params -> same id (identifier-based)
    p2 = posting_from_jsonld("https://ex.fr/offre/77", r["jsonld"])
    assert p2.external_id == p.external_id


def test_posting_from_raw_schema_and_incomplete():
    raw = {"@type": "JobPosting", "title": "Serveur", "hiringOrganization": {"name": "Bistrot"},
           "description": "<p>" + "Service en salle midi et soir, travail en équipe. " * 3 + "</p>"}
    p = posting_from_jsonld("https://b.fr/j/1", raw)
    assert p and p.company == "Bistrot" and p.location == ""
    assert posting_from_jsonld("https://b.fr/j/1", {"@type": "JobPosting", "title": "Serveur"}) is None
    assert posting_from_jsonld("https://b.fr/j/1", {}) is None


MICRODATA_PAGE = """<html><body><div itemscope itemtype="http://schema.org/JobPosting">
<h1 itemprop="title">Technicien support (F/H)</h1>
<span itemprop="hiringOrganization" itemscope itemtype="http://schema.org/Organization">
  <meta itemprop="name" content="Ubi Corp"></span>
<div itemprop="jobLocation" itemscope itemtype="http://schema.org/Place">
  <div itemprop="address" itemscope itemtype="http://schema.org/PostalAddress">
    <span itemprop="addressLocality">Annecy</span><span itemprop="addressRegion">Auvergne-Rhône-Alpes</span>
  </div></div>
<meta itemprop="datePosted" content="2026-10-30"><meta itemprop="employmentType" content="Full-time">
<div itemprop="description"><p>Vous assurez le support niveau 2 auprès des équipes internes et des clients.</p></div>
<div itemprop="qualifications"><ul><li>BTS informatique</li></ul></div>
</div></body></html>"""


def test_extract_jobposting_from_microdata():
    j = extract_jobposting(MICRODATA_PAGE)
    assert j["schema_format"] == "microdata"
    assert j["title"] == "Technicien support (F/H)"
    assert j["company"] == "Ubi Corp"
    assert j["location"] == "Annecy (Auvergne-Rhône-Alpes)"
    assert j["date_posted"] == "2026-10-30"
    assert "support niveau 2" in j["description"] and "BTS informatique" in j["description"]


async def test_fetch_offer_page_success_and_browser_ua():
    seen = {}

    def handler(request):
        seen["ua"] = request.headers["user-agent"]
        return httpx.Response(200, html=JSONLD_PAGE)

    async with client_for(handler) as c:
        r = await fetch_offer_page("https://ex.fr/offre/77", client=c)
    assert "Mozilla/5.0" in seen["ua"]
    assert set(r) >= {"url", "title", "text", "jsonld"}
    assert r["jsonld"]["company"] == "Acme Conseil"


async def test_fetch_offer_page_without_jsonld_uses_main_text():
    body = "<html><head><title>Offre X</title></head><body><nav>Menu</nav><main>" \
           + "<p>Mission : développer des API internes pour la logistique.</p>" * 12 \
           + "</main><div class='similar-offers'>Autre offre très différente</div></body></html>"
    async with client_for(lambda r: httpx.Response(200, html=body)) as c:
        r = await fetch_offer_page("https://ex.fr/x", client=c)
    assert r["jsonld"] is None and r["title"] == "Offre X"
    assert r["text"].startswith("Mission : développer") and "Menu" not in r["text"]
    assert "Autre offre" not in r["text"]


@pytest.mark.parametrize("response,needle", [
    (httpx.Response(403, html="<html>Forbidden</html>"), "collez"),
    (httpx.Response(200, html="<html><head><title>Just a moment...</title></head>"
                              "<body><script src='/cdn-cgi/challenge-platform/x'></script></body></html>"), "collez"),
    (httpx.Response(200, html="<html><body><div id='app'></div></body></html>"), "presque vide"),
    (httpx.Response(404, html="<html>Not found</html>"), "introuvable"),
    (httpx.Response(200, content=b"%PDF-1.7", headers={"content-type": "application/pdf"}), "pas une page web"),
])
async def test_fetch_offer_page_refusals(response, needle):
    async with client_for(lambda r: response) as c:
        with pytest.raises(ValueError, match=needle):
            await fetch_offer_page("https://ex.fr/x", client=c)


async def test_fetch_offer_page_rejects_bad_url():
    with pytest.raises(ValueError, match="Adresse invalide"):
        await fetch_offer_page("javascript:alert(1)")
