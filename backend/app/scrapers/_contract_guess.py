"""Map free-form contract labels (API fields, schema.org employmentType, titles)
to the normalized CONTRACT_TYPES. Returns "" when nothing reliable is found:
an unknown contract stays unknown rather than being guessed.
"""
from __future__ import annotations

import html
import re
import unicodedata
from typing import Iterable, Optional

from bs4 import BeautifulSoup


def _fold(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "")
    return "".join(c for c in s if not unicodedata.combining(c)).lower()


# Ordered: the most specific labels first (an "alternance en CDI" is an alternance).
_KEYWORDS = [
    ("Alternance", r"\b(alternance|alternant|alternante|apprenti|apprentie|apprentissage|"
                   r"contrat pro|contrat de professionnalisation|work[- ]?study)\b"),
    ("Stage", r"\b(stage|stagiaire|internship|intern)\b"),
    ("Intérim", r"\b(interim|interimaire|mission d'interim|temporary)\b"),
    ("Saisonnier", r"\b(saisonnier|saisonniere|saison|seasonal)\b"),
    ("Freelance", r"\b(freelance|free-lance|independant|portage salarial|contractor)\b"),
    ("CDD", r"\b(cdd|duree determinee|fixed[- ]term)\b"),
    ("CDI", r"\b(cdi|duree indeterminee|permanent)\b"),
]

# schema.org JobPosting.employmentType values.
_SCHEMA_ORG = {
    "INTERN": "Stage",
    "INTERNSHIP": "Stage",
    "TEMPORARY": "CDD",
    "CONTRACTOR": "Freelance",
    "CONTRACT": "CDD",
    "PERMANENT": "CDI",
    "APPRENTICESHIP": "Alternance",
    "SEASONAL": "Saisonnier",
}


def guess_contract(*texts: Optional[str]) -> str:
    """First normalized label found in the given texts, in priority order of `texts`."""
    for text in texts:
        if not text:
            continue
        folded = _fold(text)
        for label, pattern in _KEYWORDS:
            if re.search(pattern, folded):
                return label
    return ""


def from_schema_org(values: Iterable[str] | str | None) -> str:
    if not values:
        return ""
    if isinstance(values, str):
        values = [values]
    for v in values:
        key = re.sub(r"[\s-]+", "_", str(v).strip()).upper()
        if key in _SCHEMA_ORG:
            return _SCHEMA_ORG[key]
    # Some sites put French labels ("CDI", "Contrat à durée déterminée") there.
    return guess_contract(*[str(v) for v in values])


_BLOCK_TAGS = ["p", "div", "li", "br", "h1", "h2", "h3", "h4", "h5", "h6", "tr", "section", "ul", "ol"]


def html_to_text(fragment: str) -> str:
    """HTML fragment -> plain text with line breaks between blocks."""
    if not fragment:
        return ""
    if "<" not in fragment and "&lt;" in fragment:
        fragment = html.unescape(fragment)  # escaped HTML, seen in some JSON-LD
    soup = BeautifulSoup(fragment, "html.parser")
    for tag in soup.find_all(["script", "style"]):
        tag.decompose()
    for tag in soup.find_all("li"):
        tag.insert_before("\n• ")
    for tag in soup.find_all(_BLOCK_TAGS):
        tag.insert_after("\n")
    text = soup.get_text()
    text = text.replace("\xa0", " ")
    text = re.sub(r"[ \t\r\f\v]+", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()
