"""Offline tests for app.scrapers.filters (no network)."""
from datetime import datetime, timedelta, timezone

import pytest

from app.scrapers.base import CONTRACT_TYPES, JobPosting, SearchParams
from app.scrapers.filters import (
    apply_filters,
    contains_word,
    dedupe,
    detect_school_ad,
    find_email,
    fingerprint,
    normalize_contract,
)

NOW = datetime(2026, 11, 3, 12, 0, tzinfo=timezone.utc)


def P(**kw) -> JobPosting:
    base = dict(source="test", source_label="Test", external_id=kw.pop("eid", "test_1"),
                title="Développeur web (H/F)", url="https://example.org/1")
    base.update(kw)
    return JobPosting(**base)


# ------------------------------------------------------------- normalize_contract

@pytest.mark.parametrize("raw,expected", [
    ("CDI", "CDI"), ("cdi", "CDI"), ("CDD", "CDD"), ("CDD 6 mois", "CDD"),
    ("MIS", "Intérim"), ("Intérim", "Intérim"), ("Interim - 1 Mois", "Intérim"), ("Travail temporaire", "Intérim"),
    ("SAI", "Saisonnier"), ("Contrat saisonnier", "Saisonnier"),
    ("E2", "Alternance"), ("FS", "Alternance"), ("Contrat d'apprentissage", "Alternance"),
    ("Contrat de professionnalisation", "Alternance"), ("Alternance", "Alternance"),
    ("CDD - 24 Mois - Contrat apprentissage", "Alternance"),
    ("stage", "Stage"), ("Stage de fin d'études", "Stage"), ("Internship", "Stage"),
    ("Freelance", "Freelance"), ("Indépendant", "Freelance"), ("LIB", "Freelance"),
    ("Contrat à durée indéterminée", "CDI"), ("Contrat à durée déterminée", "CDD"),
    ("", ""), ("Temps plein", ""), ("Profession commerciale", ""),
])
def test_normalize_contract(raw, expected):
    assert normalize_contract(raw) == expected
    assert expected == "" or expected in CONTRACT_TYPES


# -------------------------------------------------------------------- fingerprint

def test_fingerprint_ignores_accents_case_punctuation_and_gender_marks():
    a = P(title="Développeur Web (H/F)", company="ACME SAS", location="76 - ROUEN")
    b = P(title="developpeur web h/f", company="Acme", location="Rouen (76000)")
    assert fingerprint(a) == fingerprint(b)


def test_fingerprint_lyon_arrondissements_collapse():
    a = P(title="Serveur", company="Chez Paul", location="69001 Lyon")
    b = P(title="Serveur", company="Chez Paul", location="69 - LYON 01")
    assert fingerprint(a) == fingerprint(b)


def test_fingerprint_distinguishes_cities_and_titles():
    a = P(title="Serveur", company="X", location="Lyon")
    assert fingerprint(a) != fingerprint(P(title="Serveur", company="X", location="Rouen"))
    assert fingerprint(a) != fingerprint(P(title="Barman", company="X", location="Lyon"))


# -------------------------------------------------------------------------- dedupe

def test_dedupe_keeps_richest_and_merges_fields():
    poor = P(eid="a_1", source="a", source_label="A", company="ACME", location="Rouen",
             description="court", url="https://a/1", salary="2000 €")
    rich = P(eid="b_9", source="b", source_label="B", company="Acme", location="76 - Rouen",
             description="x" * 900, url="https://b/9")
    other = P(eid="c_1", title="Comptable", company="Acme", location="Rouen", url="https://c/1")
    out = dedupe([poor, rich, other])
    assert len(out) == 2
    kept = out[0]
    assert kept.external_id == "b_9"
    assert kept.salary == "2000 €"            # filled from the duplicate
    assert kept.extra["also_on"][0]["url"] == "https://a/1"
    assert out[1].external_id == "c_1"


def test_dedupe_prefers_contact_email():
    a = P(eid="a_1", description="y" * 2000, company="Z", location="Lyon")
    b = P(eid="b_1", description="court", contact_email="rh@z.fr", company="Z", location="Lyon", url="https://b")
    assert dedupe([a, b])[0].external_id == "b_1"


def test_dedupe_same_external_id():
    a = P(eid="a_1", title="Serveur", location="Lyon")
    b = P(eid="a_1", title="Serveur / Serveuse", location="Lyon", description="long" * 50)
    assert len(dedupe([a, b])) == 1


# --------------------------------------------------------------- detect_school_ad

def test_school_ad_by_training_org_name():
    p = P(title="Alternance - Développeur IA (H/F)", company="THE BRIDGE ECOLE ENTREPRISES",
          contract_type="Alternance", description="Missions variées en marketing digital.")
    flagged, reason = detect_school_ad(p)
    assert flagged and "THE BRIDGE" in reason


def test_school_ad_by_wording():
    p = P(title="Bachelor développeur web en alternance", company="Groupe Horizon",
          contract_type="Alternance",
          description="Rejoignez notre bachelor ! Nous vous aidons à trouver votre entreprise d'accueil. "
                      "Admission sur dossier, rentrée de septembre, titre RNCP niveau 6.")
    flagged, reason = detect_school_ad(p)
    assert flagged
    assert reason.startswith("Annonce d'école")


def test_school_ad_by_sector_and_company_description():
    p = P(title="Assistant commercial en alternance", company="SKILLUP", contract_type="Alternance",
          extra={"sector": "Formation continue d'adultes",
                 "company_description": "Notre école forme des experts du digital en 10 mois."})
    assert detect_school_ad(p)[0]


def test_real_employer_mentioning_school_rhythm_is_not_flagged():
    p = P(title="Apprenti boulanger (H/F)", company="Boulangerie Martin", contract_type="Alternance",
          description="Rythme : 2 jours à l'école, 3 jours en entreprise. Vous préparez un CAP boulanger "
                      "au CFA de Rouen. Poste à pourvoir à la rentrée de septembre.")
    flagged, reason = detect_school_ad(p)
    assert not flagged, reason


def test_real_employer_with_rncp_mention_not_flagged():
    p = P(title="Alternance Développeur Full Stack", company="Capgemini", contract_type="Alternance",
          description="Vous préparez un titre RNCP de niveau 7 en informatique. Au sein de nos équipes...")
    assert not detect_school_ad(p)[0]


def test_school_hiring_staff_on_cdi_not_flagged():
    p = P(title="Chargé de communication (H/F)", company="École de commerce de Lyon", contract_type="CDI",
          description="Au sein du service communication, vous gérez nos réseaux sociaux.")
    assert not detect_school_ad(p)[0]


# ------------------------------------------------------------------ apply_filters

def _params(**kw):
    return SearchParams(query="x", **kw)


def test_contract_filter_unknown_passes():
    ps = [P(eid="1", contract_type="CDI"), P(eid="2", contract_type="CDD"), P(eid="3", contract_type="")]
    out = apply_filters(ps, _params(contract_types=["CDI"]), now=NOW)
    assert [p.external_id for p in out] == ["1", "3"]
    assert len(apply_filters(ps, _params(), now=NOW)) == 3


def test_age_filter_missing_date_passes():
    recent = (NOW - timedelta(days=2)).isoformat()
    old = (NOW - timedelta(days=40)).date().isoformat()
    ps = [P(eid="new", posted_at=recent), P(eid="old", posted_at=old), P(eid="none"),
          P(eid="z", posted_at="2026-11-01T09:00:16.535Z"), P(eid="junk", posted_at="hier")]
    out = {p.external_id for p in apply_filters(ps, _params(max_age_days=14), now=NOW)}
    assert out == {"new", "none", "z", "junk"}
    assert len(apply_filters(ps, _params(max_age_days=0), now=NOW)) == 5


def test_remote_modes():
    remote = P(eid="r", remote=True)
    text_remote = P(eid="t", description="Poste en full remote, 100% télétravail")
    hybrid = P(eid="h", description="Télétravail 2 jours par semaine")
    onsite = P(eid="o", remote=False)
    unknown = P(eid="u")
    ps = [remote, text_remote, hybrid, onsite, unknown]
    ids = lambda mode: {p.external_id for p in apply_filters(ps, _params(remote=mode), now=NOW)}
    assert ids("any") == {"r", "t", "h", "o", "u"}
    assert ids("remote_only") == {"r", "t"}
    assert ids("onsite") == {"h", "o", "u"}
    assert ids("hybrid_ok") == {"r", "t", "h", "u"}


def test_exclude_keywords_accent_insensitive_on_title_company_description():
    ps = [P(eid="1", title="Vendeur"), P(eid="2", company="Intérim Plus"),
          P(eid="3", description="Travail de NUIT obligatoire"), P(eid="4", title="Développeur")]
    out = apply_filters(ps, _params(), exclude_keywords=["vendeur", "interim", "nuit"], now=NOW)
    assert [p.external_id for p in out] == ["4"]


def test_exclude_is_whole_word():
    ps = [P(eid="1", title="Serveur"), P(eid="2", title="Développeur Java")]
    out = apply_filters(ps, _params(), exclude_keywords=["java"], now=NOW)
    assert [p.external_id for p in out] == ["1"]
    # "art" must not drop "Startup"
    assert len(apply_filters([P(title="Startup")], _params(), exclude_keywords=["art"], now=NOW)) == 1


def test_include_keywords_any_must_match_title_or_description():
    ps = [P(eid="1", title="Développeur React"), P(eid="2", title="Dev", description="Stack: Vue.js"),
          P(eid="3", title="Comptable", company="React Corp")]
    out = apply_filters(ps, _params(), include_keywords=["react", "vue js"], now=NOW)
    assert [p.external_id for p in out] == ["1", "2"]


def test_helpers():
    assert contains_word("Développeur Front-End", "front end")
    assert not contains_word("Startup", "art")
    assert find_email("Envoyez votre CV à recrutement@boulangerie-martin.fr.") == "recrutement@boulangerie-martin.fr"
    assert find_email("pas d'email ici", "logo@2x.png") == ""
