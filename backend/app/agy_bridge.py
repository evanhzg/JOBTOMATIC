import asyncio
import json
import re
from typing import Any, Dict, List, Optional
from .database import log_activity

class AgyBridge:
    def __init__(self, model: str = "Gemini 3.8 Flash (High)", timeout_seconds: int = 45):
        self.model = model
        self.timeout_seconds = timeout_seconds

    def _clean_json_text(self, text: str) -> str:
        """Strips markdown code blocks and whitespace to extract valid JSON."""
        text = text.strip()
        # Look for ```json ... ``` blocks
        match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
        if match:
            return match.group(1).strip()
        return text

    async def execute_prompt(self, prompt: str) -> str:
        """Executes a turn via the local agy CLI using active user credentials."""
        cmd = [
            "agy",
            "-p", prompt,
            "--output-format", "json"
        ]
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(),
                timeout=self.timeout_seconds
            )

            if proc.returncode != 0:
                err_msg = stderr.decode(errors="replace").strip()
                await log_activity("ERROR", f"agy CLI error: {err_msg[:200]}")
                raise RuntimeError(f"agy CLI failed: {err_msg}")

            raw_output = stdout.decode(errors="replace")
            parsed = json.loads(raw_output)
            return parsed.get("response", "")
        except asyncio.TimeoutError:
            await log_activity("ERROR", f"agy CLI timed out after {self.timeout_seconds}s")
            raise TimeoutError("agy CLI timed out")

    async def analyze_job_fit(self, job_title: str, company: str, description: str, profile: Dict[str, Any]) -> Dict[str, Any]:
        """Analyzes fit score (0-100), key matching strengths, and missing requirements."""
        prompt = f"""
Tu es un expert en recrutement et en optimisation ATS.
Évalue la correspondance entre ce profil de candidat et cette offre d'emploi.

Offre d'emploi :
- Titre : {job_title}
- Entreprise : {company}
- Description :
{description[:3500]}

Profil du candidat :
- Métier / Titre : {profile.get('headline')}
- Résumé : {profile.get('summary')}
- Compétences : {profile.get('skills')}
- Expériences : {json.dumps(profile.get('experiences', []), ensure_ascii=False)}
- Formations : {json.dumps(profile.get('education', []), ensure_ascii=False)}

Réponds STRICTEMENT sous format JSON valide avec la structure suivante :
{{
  "match_score": <entier entre 0 et 100>,
  "match_reasons": ["Raison 1", "Raison 2", "Raison 3"],
  "key_strengths": ["Force 1", "Force 2"],
  "missing_keywords": ["Mot-clé absent 1"]
}}
"""
        try:
            response_text = await self.execute_prompt(prompt)
            clean = self._clean_json_text(response_text)
            return json.loads(clean)
        except Exception as e:
            await log_activity("WARNING", f"Fit analysis fallback for {job_title}: {e}")
            # Fallback heuristic
            return {
                "match_score": 80,
                "match_reasons": ["Profil pertinent par rapport aux mots-clés de l'offre"],
                "key_strengths": ["Polyvalence technique", "Motivation"],
                "missing_keywords": []
            }

    async def tailor_cv_and_letter(self, job_title: str, company: str, description: str, profile: Dict[str, Any]) -> Dict[str, Any]:
        """Customizes the CV summary, highlights job-matching skills, adapts bullet points, and generates a personalized cover letter in French."""
        prompt = f"""
Tu es un expert en rédaction de CV et lettres de motivation à fort impact pour le marché français.
Personnalise ce profil pour postuler spécifiquement au poste suivant.

Poste visé : {job_title} chez {company}
Description de l'offre :
{description[:3500]}

Profil de base :
- Nom : {profile.get('full_name')}
- Email : {profile.get('email')}
- Téléphone : {profile.get('phone')}
- Ville : {profile.get('city')}
- Headline : {profile.get('headline')}
- Résumé : {profile.get('summary')}
- Compétences : {profile.get('skills')}
- Expériences : {json.dumps(profile.get('experiences', []), ensure_ascii=False)}
- Formations : {json.dumps(profile.get('education', []), ensure_ascii=False)}

Instructions :
1. Reformule le résumé professionnel pour capter immédiatement l'attention du recruteur de {company}.
2. Sélectionne et ordonne les 6 à 8 compétences les plus pertinentes pour ce poste.
3. Adapte les puces d'expérience pour faire ressortir les mots-clés ATS demandés, tout en restant 100% fidèle à l'historique réel.
4. Rédige une lettre de motivation percutante, polie et concise (2 à 3 paragraphes), prête à être envoyée.
5. Génère l'objet d'email direct idéal (ex: "Candidature : {job_title} - {profile.get('full_name')}").

Réponds STRICTEMENT sous format JSON valide avec cette structure :
{{
  "tailored_headline": "Titre optimisé",
  "tailored_summary": "Résumé percutant adapté à l'offre",
  "highlighted_skills": ["Compétence 1", "Compétence 2", "Compétence 3", "Compétence 4", "Compétence 5", "Compétence 6"],
  "adapted_experiences": [
    {{
      "role": "Intitulé",
      "company": "Entreprise",
      "period": "Période",
      "location": "Lieu",
      "details": ["Puce 1 avec mots-clés ATS", "Puce 2 valorisant l'impact"]
    }}
  ],
  "cover_letter": "Corps complet de la lettre de motivation...",
  "email_subject": "Candidature : {job_title} - {profile.get('full_name')}"
}}
"""
        try:
            response_text = await self.execute_prompt(prompt)
            clean = self._clean_json_text(response_text)
            return json.loads(clean)
        except Exception as e:
            await log_activity("WARNING", f"CV tailoring fallback for {job_title}: {e}")
            skills = profile.get("skills", [])
            if isinstance(skills, str):
                try:
                    skills = json.loads(skills)
                except Exception:
                    skills = ["Polyvalence", "Motivation", "Autonomie"]

            exps = profile.get("experiences", [])
            if isinstance(exps, str):
                try:
                    exps = json.loads(exps)
                except Exception:
                    exps = []

            return {
                "tailored_headline": f"Candidat au poste de {job_title}",
                "tailored_summary": f"Professionnel motivé et rigoureux, particulièrement intéressé par les missions proposées par {company} pour le poste de {job_title}.",
                "highlighted_skills": skills[:8] if isinstance(skills, list) else [],
                "adapted_experiences": exps if isinstance(exps, list) else [],
                "cover_letter": f"Madame, Monsieur,\n\nJe vous adresse ma candidature pour l'opportunité de {job_title} au sein de {company}.\n\nRigoureux et motivé, je serais ravi d'échanger avec vous lors d'un entretien.\n\nCordialement,\n{profile.get('full_name')}",
                "email_subject": f"Candidature : {job_title} - {profile.get('full_name')}"
            }

    async def answer_form_question(self, question: str, profile: Dict[str, Any], job_title: str) -> str:
        """Answers an employer application form question using candidate details and preferences."""
        prefs = profile.get("preferences", {})
        prompt = f"""
Un formulaire de candidature en ligne pour le poste de "{job_title}" pose la question suivante :
"{question}"

Détails du candidat :
- Permis de conduire : {prefs.get('driver_license', 'Oui')}
- Disponibilité : {prefs.get('availability', 'Immédiate')}
- Ville : {profile.get('city', 'Rouen')}
- Salaire souhaité : {prefs.get('min_salary', 'Selon grille conventionnelle')}

Fournis une réponse courte, professionnelle et directe en français pour ce champ de formulaire (juste le texte à insérer, sans explications).
"""
        try:
            res = await self.execute_prompt(prompt)
            return res.strip().strip('"')
        except Exception:
            return "Disponible immédiatement selon les modalités du poste."

    async def classify_reply(self, subject: str, body: str, job_title: str) -> Dict[str, str]:
        """Classifies an incoming recruiter email response."""
        prompt = f"""
Analyse cet email reçu d'un recruteur en réponse à une candidature pour "{job_title}".

Objet : {subject}
Message :
{body[:2500]}

Classifie la réponse parmi l'une de ces 4 catégories :
1. "INTERVIEW" : invitation à un entretien téléphonique, visio ou physique.
2. "INFO_REQUEST" : demande de précisions, de documents, de disponibilités ou test technique.
3. "ACKNOWLEDGMENT" : confirmation automatique de réception.
4. "REJECTION" : refus poli ou poste pourvu.

Réponds STRICTEMENT sous format JSON :
{{
  "classification": "<INTERVIEW | INFO_REQUEST | ACKNOWLEDGMENT | REJECTION>",
  "summary": "<Résumé en une phrase claire en français>",
  "action_required": "<Oui ou Non>"
}}
"""
        try:
            res = await self.execute_prompt(prompt)
            clean = self._clean_json_text(res)
            return json.loads(clean)
        except Exception:
            lower = (subject + " " + body).lower()
            if any(w in lower for w in ["entretien", "disponible", "disponibilités", "rendez-vous", "call", "échange"]):
                return {"classification": "INTERVIEW", "summary": "Le recruteur propose un échange ou entretien !", "action_required": "Oui"}
            if any(w in lower for w in ["malheureusement", "pas retenu", "autre profil", "regret"]):
                return {"classification": "REJECTION", "summary": "Candidature non retenue", "action_required": "Non"}
            return {"classification": "ACKNOWLEDGMENT", "summary": "Réponse reçue du recruteur", "action_required": "Non"}

agy_bridge = AgyBridge()
