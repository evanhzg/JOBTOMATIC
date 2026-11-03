"""Prompts and parsing for each AI job. No fallbacks with invented results:
if the AI is unavailable, the caller gets AIUnavailable and the work waits."""
from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from .pool import AIBadOutput, ask_json

TRUTH_RULES = """RÈGLES DE VÉRITÉ (impératives) :
- N'invente JAMAIS d'expérience, d'employeur, de diplôme, de date, de chiffre ou d'outil absent du CV.
- Tu peux reformuler, réordonner les idées, mettre en avant ce qui est pertinent, utiliser le vocabulaire de l'offre
  quand il décrit fidèlement ce que le candidat a réellement fait.
- Un chiffre ne peut apparaître que s'il figure déjà dans le CV.
- Ne change JAMAIS les faits personnels : disponibilités et horaires possibles, permis, véhicule, niveaux de
  langue, âge, diplômes. Tu peux les mettre en avant, pas les modifier ni les étendre."""


def _clip(s: Optional[str], n: int) -> str:
    s = s or ""
    return s if len(s) <= n else s[:n] + "…"


def _require(data: Any, keys: List[str]) -> Dict[str, Any]:
    if not isinstance(data, dict):
        raise AIBadOutput("objet JSON attendu")
    missing = [k for k in keys if k not in data]
    if missing:
        raise AIBadOutput(f"clés manquantes : {missing}")
    return data


# ---------------------------------------------------------------- profile

async def extract_profile(cv_text: str) -> Dict[str, Any]:
    prompt = f"""Extrais le profil structuré de ce CV (texte brut extrait d'un PDF, l'ordre peut être mélangé).

CV :
\"\"\"{_clip(cv_text, 9000)}\"\"\"

JSON attendu :
{{
  "full_name": "Prénom Nom",
  "email": "", "phone": "", "city": "ville de résidence si indiquée, sinon ''",
  "headline": "titre court qui résume le profil",
  "summary": "2-3 phrases fidèles au CV",
  "skills": ["compétences réelles citées ou clairement démontrées"],
  "experiences": [{{"role": "", "company": "", "period": "", "location": "", "details": ["puces du CV"]}}],
  "education": [{{"degree": "", "school": "", "year": "", "details": ""}}],
  "languages": ["Anglais (C1)"],
  "preferences": {{"driver_license": "", "availability": "", "work_types": ["CDI", "Intérim", ...]}},
  "target_roles": ["3 à 6 intitulés de postes que ce candidat peut viser de façon réaliste, d'après le CV"]
}}
{TRUTH_RULES}"""
    return await ask_json(prompt, lambda d: _require(d, ["full_name", "experiences"]))


# ---------------------------------------------------------------- scoring

async def score_job(job: Dict[str, Any], profile: Dict[str, Any], cv_text: str) -> Dict[str, Any]:
    prompt = f"""Tu es recruteur en France. Évalue l'adéquation entre ce candidat et cette offre.

OFFRE
- Titre : {job.get('title')}
- Entreprise : {job.get('company') or 'non précisée'}
- Lieu : {job.get('location')}
- Contrat : {job.get('contract_type') or 'non précisé'}
- Source : {job.get('source_label')}
- Description :
{_clip(job.get('description'), 5000)}

CANDIDAT
- Ville : {profile.get('city')}
- Postes visés : {', '.join(profile.get('target_roles') or [])}
- Préférences : {json.dumps(profile.get('preferences') or {}, ensure_ascii=False)}
- CV (texte) :
{_clip(cv_text, 5000)}

Barème : 85-100 = profil quasi idéal ; 70-84 = bon candidat crédible ; 50-69 = possible avec effort ;
< 50 = peu pertinent. Sois honnête : ne gonfle pas le score. Pénalise fortement si un diplôme, permis
ou certification OBLIGATOIRE manque, ou si le lieu est incompatible.

Détecte aussi les fausses offres : publicités d'écoles/CFA/organismes de formation qui recrutent des
élèves sous couvert d'alternance, ou annonces sans vrai employeur.

JSON attendu :
{{
  "score": 0-100,
  "summary": "une phrase : pourquoi ce score",
  "reasons": ["3 points max qui justifient le score"],
  "strengths": ["atouts du candidat pour CE poste"],
  "gaps": ["manques réels par rapport à l'offre"],
  "keywords": ["10 à 18 mots-clés/compétences clés de l'offre, tels qu'écrits dans l'offre"],
  "is_school_ad": false,
  "school_reason": "",
  "contact_email": "email de candidature publié dans l'offre, sinon ''"
}}"""

    def check(d):
        d = _require(d, ["score", "summary"])
        d["score"] = max(0, min(100, int(d["score"])))
        return d

    return await ask_json(prompt, check)


# ---------------------------------------------------------------- tailoring

def _units_for_prompt(units: List[Dict[str, Any]]) -> str:
    lines = []
    for u in units:
        if u["locked"]:
            flag = "VERROUILLÉ"
        elif u.get("min_chars"):
            flag = f"entre {u['min_chars']} et {u['max_chars']} car."
        else:
            flag = f"max {u['max_chars']} car."
        lines.append(f"[{u['id']}] ({u['kind']}, {flag}) {u['rich']}")
    return "\n".join(lines)


async def tailor_cv(job: Dict[str, Any], units: List[Dict[str, Any]], profile: Dict[str, Any],
                    keywords: List[str]) -> Dict[str, Any]:
    prompt = f"""Tu adaptes un CV existant à une offre précise. Le CV garde exactement son design :
tu ne peux que réécrire le texte de certains blocs, chacun dans sa limite de caractères.

OFFRE : {job.get('title')} — {job.get('company') or 'entreprise non précisée'} ({job.get('location')}, {job.get('contract_type') or 'contrat non précisé'})
{_clip(job.get('description'), 4500)}

Mots-clés de l'offre : {', '.join(keywords) if keywords else '(à déduire de la description)'}

BLOCS DU CV (id, type, contrainte, texte actuel ; **gras** = passage en gras dans le design) :
{_units_for_prompt(units)}

CONSIGNES
1. Réécris uniquement les blocs utiles pour que le recruteur de cette offre voie immédiatement l'adéquation
   (4 à 12 blocs en général). Les blocs « tagline » (accroches en majuscules en haut du CV) sont lus en
   premier : adapte-les au métier de l'offre en restant vrai.
2. Ne touche jamais aux blocs VERROUILLÉS (nom, intitulés de section, postes, employeurs, dates, contact).
3. Respecte la plage de caractères de chaque bloc (un bloc sur plusieurs lignes doit garder sa hauteur). Garde le même style : une puce commence par « - »,
   une tagline en MAJUSCULES reste en majuscules, garde les **gras** existants si le bloc en avait.
4. Reprends les mots-clés de l'offre quand ils décrivent fidèlement le parcours réel.
5. Pour vider un bloc non pertinent (ex : une puce sans rapport), renvoie "".
{TRUTH_RULES}

Rédige aussi une lettre de motivation courte (150-220 mots, vouvoiement, sans formules creuses, qui
cite 2 éléments concrets du parcours en lien avec l'offre, signée du nom du candidat : {profile.get('full_name')})
et un objet d'email de candidature.

JSON attendu :
{{
  "edits": [{{"id": "p0-u12", "text": "nouveau texte", "why": "raison courte"}}],
  "cover_letter": "...",
  "email_subject": "...",
  "notes": "1-2 phrases : ce qui a été mis en avant"
}}"""

    def check(d):
        d = _require(d, ["edits", "cover_letter", "email_subject"])
        if not isinstance(d["edits"], list):
            raise AIBadOutput("edits doit être une liste")
        return d

    return await ask_json(prompt, check, timeout=300)


async def shorten_edits(items: List[Dict[str, Any]]) -> Dict[str, str]:
    """Second chance for texts that did not fit their block (too long, or too short for a multi-line block)."""
    listing = "\n".join(f"[{i['id']}] (entre {i.get('min_chars', 0)} et {i['max_chars']} car., actuel {len(i['text'])}) {i['text']}" for i in items)
    prompt = f"""Ces textes de CV n'ont pas la bonne longueur pour leur emplacement. Ajuste chacun dans sa plage
(raccourcir s'il est trop long, compléter avec un détail VRAI déjà présent dans le texte s'il est trop court),
en gardant le sens, les mots-clés et le style (« - » en début de puce, **gras**). N'invente rien.

{listing}

JSON attendu : {{"edits": [{{"id": "...", "text": "..."}}]}}"""
    d = await ask_json(prompt, lambda d: _require(d, ["edits"]))
    return {e["id"]: e["text"] for e in d["edits"] if isinstance(e, dict) and "id" in e and "text" in e}


# ---------------------------------------------------------------- optimizer

async def audit_cv(units: List[Dict[str, Any]], profile: Dict[str, Any], target: str,
                   measured: Dict[str, Any]) -> Dict[str, Any]:
    prompt = f"""Tu es un expert du recrutement en France. Fais l'audit de ce CV pour la cible : « {target} ».

BLOCS DU CV (id, type, contrainte, texte ; **gras** = gras dans le design) :
{_units_for_prompt(units)}

MESURES AUTOMATIQUES (déjà calculées, ne les recalcule pas) :
{json.dumps(measured, ensure_ascii=False)}

Évalue 5 axes de 0 à 100 avec une justification d'une phrase qui cite le CV :
- "pertinence" : le CV parle-t-il à un recruteur de la cible ?
- "impact" : résultats concrets, verbes d'action, précision (vs tâches vagues)
- "mots_cles" : vocabulaire attendu par les logiciels de tri pour la cible
- "lisibilite" : clarté, phrases courtes, hiérarchie en 10 secondes
- "accroche" : la tagline et le profil donnent-ils envie de lire la suite ?

Puis propose des réécritures CONCRÈTES de blocs (pas des conseils généraux) : 6 à 15 suggestions,
classées de la plus utile à la moins utile. Respecte la limite de caractères et le style du bloc.
Ne touche pas aux blocs VERROUILLÉS.
{TRUTH_RULES}
Si une amélioration demande une information que tu n'as pas (un chiffre, un outil), mets-la dans
"questions" au lieu de l'inventer.

JSON attendu :
{{
  "scores": {{"pertinence": {{"score": 0, "why": ""}}, "impact": {{...}}, "mots_cles": {{...}}, "lisibilite": {{...}}, "accroche": {{...}}}},
  "verdict": "2 phrases franches",
  "target_keywords": ["12 à 20 mots-clés attendus pour la cible"],
  "suggestions": [{{"id": "p0-u14", "text": "nouveau texte", "axis": "impact", "why": "en quoi c'est mieux", "gain": "faible|moyen|fort"}}],
  "questions": ["question au candidat pour aller plus loin"]
}}"""

    def check(d):
        d = _require(d, ["scores", "suggestions"])
        return d

    return await ask_json(prompt, check, timeout=300)


# ---------------------------------------------------------------- follow-ups & replies

async def draft_followup(job: Dict[str, Any], profile: Dict[str, Any], seq: int, days_since: int) -> Dict[str, str]:
    tone = "première relance, courte et cordiale" if seq == 1 else "dernière relance, très brève, qui laisse la porte ouverte"
    prompt = f"""Rédige un email de relance ({tone}) pour une candidature envoyée il y a {days_since} jours.
Poste : {job.get('title')} chez {job.get('company') or "l'entreprise"}.
Candidat : {profile.get('full_name')} ({profile.get('phone') or ''}).
Contexte de la candidature (objet initial) : {job.get('email_subject') or ''}
Règles : 60 à 110 mots, vouvoiement, pas de reproche, rappeler en une phrase l'intérêt pour le poste et
un atout concret du parcours, proposer un échange, signature avec nom et téléphone.
JSON attendu : {{"subject": "Re: ...", "body": "..."}}"""
    return await ask_json(prompt, lambda d: _require(d, ["subject", "body"]))


async def classify_reply(subject: str, body: str, job_title: str) -> Dict[str, str]:
    prompt = f"""Classe cet email reçu en réponse à une candidature pour « {job_title} ».
Objet : {subject}
Message : {_clip(body, 2500)}
Catégories : INTERVIEW (proposition d'entretien/appel), INFO_REQUEST (demande d'infos/documents/test),
ACKNOWLEDGMENT (accusé de réception automatique), REJECTION (refus), OTHER.
JSON attendu : {{"classification": "...", "summary": "une phrase en français", "action_required": true}}"""
    return await ask_json(prompt, lambda d: _require(d, ["classification", "summary"]))


async def parse_offer_text(text: str, url: str = "") -> Dict[str, Any]:
    prompt = f"""Extrais l'offre d'emploi de ce texte copié depuis un site ({url or 'source inconnue'}).
Texte :
\"\"\"{_clip(text, 9000)}\"\"\"
JSON attendu : {{"title": "", "company": "", "location": "", "contract_type": "CDI|CDD|Intérim|Alternance|Stage|Freelance|Saisonnier|",
"salary": "", "contact_email": "", "description": "description complète nettoyée"}}
N'invente rien : laisse vide ce qui n'est pas dans le texte."""
    return await ask_json(prompt, lambda d: _require(d, ["title", "description"]))
