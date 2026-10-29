import asyncio
import json
from pathlib import Path
from typing import Any, Dict
from jinja2 import Environment, FileSystemLoader
from playwright.async_api import async_playwright
from .config import CVS_DIR, TEMPLATES_DIR
from .database import log_activity

env = Environment(loader=FileSystemLoader(str(TEMPLATES_DIR)))

class CVRenderer:
    def __init__(self):
        self.template = env.get_template("cv_modern.html")

    async def render_cv_html(self, profile: Dict[str, Any], tailored_data: Dict[str, Any], job_title: str, company: str) -> str:
        """Renders the HTML string for the tailored CV."""
        # Normalize fields
        skills = tailored_data.get("highlighted_skills")
        if not skills:
            skills = profile.get("skills", [])
            if isinstance(skills, str):
                try:
                    skills = json.loads(skills)
                except Exception:
                    skills = []

        experiences = tailored_data.get("adapted_experiences")
        if not experiences:
            experiences = profile.get("experiences", [])
            if isinstance(experiences, str):
                try:
                    experiences = json.loads(experiences)
                except Exception:
                    experiences = []

        education = profile.get("education", [])
        if isinstance(education, str):
            try:
                education = json.loads(education)
            except Exception:
                education = []

        languages = profile.get("languages", [])
        if isinstance(languages, str):
            try:
                languages = json.loads(languages)
            except Exception:
                languages = []

        preferences = profile.get("preferences", {})
        if isinstance(preferences, str):
            try:
                preferences = json.loads(preferences)
            except Exception:
                preferences = {}

        normalized_profile = dict(profile)
        normalized_profile["skills"] = skills
        normalized_profile["experiences"] = experiences
        normalized_profile["education"] = education
        normalized_profile["languages"] = languages
        normalized_profile["preferences"] = preferences

        return self.template.render(
            profile=normalized_profile,
            tailored_headline=tailored_data.get("tailored_headline", profile.get("headline", job_title)),
            tailored_summary=tailored_data.get("tailored_summary", profile.get("summary", "")),
            highlighted_skills=skills,
            adapted_experiences=experiences,
            job_title=job_title,
            company=company
        )

    async def generate_pdf(self, job_id: int, profile: Dict[str, Any], tailored_data: Dict[str, Any], job_title: str, company: str) -> str:
        """Compiles the tailored CV into an ATS-friendly A4 PDF file using Playwright."""
        html_content = await self.render_cv_html(profile, tailored_data, job_title, company)
        output_filename = f"CV_{profile.get('full_name', 'Candidat').replace(' ', '_')}_{job_id}.pdf"
        output_path = CVS_DIR / output_filename

        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                page = await browser.new_page()
                await page.set_content(html_content, wait_until="networkidle")
                await page.pdf(
                    path=str(output_path),
                    format="A4",
                    print_background=True,
                    margin={"top": "14mm", "bottom": "14mm", "left": "16mm", "right": "16mm"}
                )
                await browser.close()

            await log_activity("SUCCESS", f"Génération du CV PDF terminée pour l'offre {job_title} ({company})", job_id)
            return str(output_path)
        except Exception as e:
            await log_activity("ERROR", f"Erreur lors de la génération PDF du CV: {e}", job_id)
            raise e

    async def generate_base_cv_pdf(self, profile: Dict[str, Any]) -> str:
        """Compiles the master base CV into an A4 PDF file using Playwright."""
        tailored_data = {
            "tailored_headline": profile.get("headline", "Profil Candidat"),
            "tailored_summary": profile.get("summary", ""),
            "highlighted_skills": profile.get("skills", []),
            "adapted_experiences": profile.get("experiences", [])
        }
        html_content = await self.render_cv_html(profile, tailored_data, "Candidature Globale", "Entreprises Ciblées")
        output_filename = f"CV_Master_{profile.get('full_name', 'Candidat').replace(' ', '_')}.pdf"
        output_path = CVS_DIR / output_filename

        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                page = await browser.new_page()
                await page.set_content(html_content, wait_until="networkidle")
                await page.pdf(
                    path=str(output_path),
                    format="A4",
                    print_background=True,
                    margin={"top": "14mm", "bottom": "14mm", "left": "16mm", "right": "16mm"}
                )
                await browser.close()
            return str(output_path)
        except Exception as e:
            await log_activity("ERROR", f"Erreur lors de la génération du CV Maître: {e}")
            raise e

    async def generate_translated_cv_pdf(self, profile: Dict[str, Any], translated_data: Dict[str, Any], target_language: str = "en") -> str:
        """Compiles a translated (English / French) CV into an A4 PDF."""
        is_en = target_language.lower() == "en"
        labels = {
            "profile_summary": "PROFESSIONAL PROFILE & OBJECTIVES" if is_en else "PROFIL & OBJECTIFS",
            "key_skills": "CORE COMPETENCIES & TECHNICAL SKILLS" if is_en else "COMPÉTENCES CLÉS",
            "experience": "PROFESSIONAL EXPERIENCE" if is_en else "EXPÉRIENCES PROFESSIONNELLES",
            "education": "EDUCATION & CERTIFICATIONS" if is_en else "FORMATIONS & DIPLÔMES",
            "languages": "LANGUAGES" if is_en else "LANGUES"
        }

        # Build custom styled HTML with localized labels
        html = f"""<!DOCTYPE html>
<html lang="{target_language}">
<head>
  <meta charset="UTF-8">
  <title>{profile.get('full_name')} — {translated_data.get('headline')}</title>
  <style>
    @page {{ size: A4; margin: 12mm 16mm; }}
    body {{
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #18181b; background: #ffffff; line-height: 1.4; font-size: 10pt;
    }}
    .header {{ border-bottom: 2px solid #18181b; padding-bottom: 10px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-end; }}
    .name {{ font-size: 22pt; font-weight: 800; color: #18181b; }}
    .title {{ font-size: 11.5pt; font-weight: 600; color: #5f7a48; margin-top: 3px; text-transform: uppercase; letter-spacing: 0.5px; }}
    .contact {{ text-align: right; font-size: 8.5pt; color: #52525b; line-height: 1.4; font-family: monospace; }}
    .section-title {{ font-size: 10pt; font-weight: 800; text-transform: uppercase; color: #18181b; border-bottom: 1px solid #d4d4d8; padding-bottom: 2px; margin-top: 12px; margin-bottom: 6px; letter-spacing: 0.8px; }}
    .summary {{ font-size: 9.5pt; color: #3f3f46; text-align: justify; line-height: 1.45; }}
    .badge {{ display: inline-block; background: #f4f4f5; border: 1px solid #e4e4e7; padding: 2px 7px; margin: 2px; font-size: 8.5pt; font-weight: 600; color: #18181b; }}
    .exp-item {{ margin-bottom: 9px; }}
    .exp-head {{ display: flex; justify-content: space-between; font-weight: 700; font-size: 9.5pt; color: #18181b; }}
    .exp-sub {{ font-size: 8.8pt; color: #5f7a48; font-weight: 600; margin-bottom: 2px; }}
    .bullet {{ font-size: 9pt; color: #3f3f46; margin-left: 14px; margin-bottom: 2px; }}
    .footer {{ margin-top: 15px; border-top: 1px dashed #e4e4e7; padding-top: 4px; text-align: center; font-size: 7.5pt; color: #a1a1aa; font-family: monospace; }}
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="name">{profile.get('full_name')}</div>
      <div class="title">{translated_data.get('headline')}</div>
    </div>
    <div class="contact">
      <div>📍 {profile.get('city')}</div>
      <div>✉️ {profile.get('email')}</div>
      <div>📞 {profile.get('phone')}</div>
    </div>
  </div>

  <div class="section-title">{labels['profile_summary']}</div>
  <div class="summary">{translated_data.get('summary')}</div>

  <div class="section-title">{labels['key_skills']}</div>
  <div>
    {"".join(f'<span class="badge">{s}</span>' for s in translated_data.get('skills', []))}
  </div>

  <div class="section-title">{labels['experience']}</div>
  {"".join(f'''
  <div class="exp-item">
    <div class="exp-head"><span>{exp.get('role')}</span><span>{exp.get('period')}</span></div>
    <div class="exp-sub">{exp.get('company')} — {exp.get('location', '')}</div>
    {"".join(f'<div class="bullet">• {d}</div>' for d in exp.get('details', []))}
  </div>
  ''' for exp in translated_data.get('experiences', []))}

  <div class="section-title">{labels['education']}</div>
  {"".join(f'''
  <div class="exp-item">
    <div class="exp-head"><span>{edu.get('degree')}</span><span>{edu.get('year')}</span></div>
    <div class="exp-sub">{edu.get('school')}</div>
    {f'<div class="bullet">• {edu.get("details")}</div>' if edu.get("details") else ''}
  </div>
  ''' for edu in translated_data.get('education', []))}

  <div class="footer">
    Generated by JOBTOMATIC — {"English ATS Edition" if is_en else "Édition Française"}
  </div>
</body>
</html>"""

        output_filename = f"CV_{profile.get('full_name', 'Candidat').replace(' ', '_')}_{target_language.upper()}.pdf"
        output_path = CVS_DIR / output_filename

        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                page = await browser.new_page()
                await page.set_content(html, wait_until="networkidle")
                await page.pdf(
                    path=str(output_path),
                    format="A4",
                    print_background=True,
                    margin={"top": "12mm", "bottom": "12mm", "left": "16mm", "right": "16mm"}
                )
                await browser.close()
            return str(output_path)
        except Exception as e:
            await log_activity("ERROR", f"Erreur génération CV traduit {target_language}: {e}")
            raise e

    async def generate_variant_proposal_pdf(self, profile: Dict[str, Any], variant_title: str, variant_content: str, metric_id: str) -> str:
        """Generates a visual PDF document proposal representing the improved resume with the selected variant."""
        html = f"""<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Proposition d'Amélioration Visuelle — {variant_title}</title>
  <style>
    @page {{ size: A4; margin: 12mm 16mm; }}
    body {{
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #18181b; background: #ffffff; line-height: 1.45; font-size: 10pt;
    }}
    .banner {{ background: #5f7a48; color: #ffffff; padding: 10px 14px; font-weight: 800; font-family: monospace; font-size: 10pt; text-transform: uppercase; margin-bottom: 14px; display: flex; justify-content: space-between; }}
    .header {{ border-bottom: 2px solid #18181b; padding-bottom: 10px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: flex-end; }}
    .name {{ font-size: 22pt; font-weight: 900; color: #18181b; }}
    .headline {{ font-size: 11pt; font-weight: 700; color: #5f7a48; margin-top: 2px; }}
    .contact {{ text-align: right; font-size: 8.5pt; color: #52525b; line-height: 1.4; font-family: monospace; }}
    .highlight-box {{ background: #f7f9f5; border: 2px solid #5f7a48; padding: 14px; margin-bottom: 14px; }}
    .highlight-title {{ font-weight: 800; font-size: 10.5pt; color: #5f7a48; font-family: monospace; text-transform: uppercase; margin-bottom: 6px; display: flex; align-items: center; justify-content: space-between; }}
    .highlight-text {{ font-size: 9.5pt; color: #18181b; white-space: pre-line; line-height: 1.5; }}
    .section-title {{ font-size: 10pt; font-weight: 800; text-transform: uppercase; border-bottom: 1px solid #d4d4d8; padding-bottom: 2px; margin-top: 12px; margin-bottom: 6px; letter-spacing: 0.5px; }}
    .badge {{ display: inline-block; background: #f4f4f5; border: 1px solid #e4e4e7; padding: 2px 7px; margin: 2px; font-size: 8.5pt; font-weight: 600; color: #18181b; }}
  </style>
</head>
<body>
  <div class="banner">
    <span>⚡ JOBTOMATIC PROPOSITION VISUELLE IA — SCORE PROJETÉ : 98%</span>
    <span>{metric_id.upper()}</span>
  </div>

  <div class="header">
    <div>
      <div class="name">{profile.get('full_name')}</div>
      <div class="headline">{profile.get('headline')}</div>
    </div>
    <div class="contact">
      <div>📍 {profile.get('city')}</div>
      <div>✉️ {profile.get('email')}</div>
      <div>📞 {profile.get('phone')}</div>
    </div>
  </div>

  <div class="highlight-box">
    <div class="highlight-title">
      <span>✨ {variant_title}</span>
      <span style="font-size: 8.5pt; background: #5f7a48; color: #ffffff; padding: 1px 6px;">OPTIMISÉ ATS & RECRUTEUR</span>
    </div>
    <div class="highlight-text">{variant_content}</div>
  </div>

  <div class="section-title">COMPÉTENCES CLÉS VALIDÉES</div>
  <div>
    {"".join(f'<span class="badge">{s}</span>' for s in profile.get('skills', []))}
  </div>

  <div class="section-title">RÉSUMÉ PROFESSIONNEL</div>
  <div style="font-size: 9pt; color: #3f3f46; line-height: 1.45;">{profile.get('summary')}</div>
</body>
</html>"""

        clean_metric = metric_id.replace(" ", "_")
        output_filename = f"Proposal_Variant_{clean_metric}_{int(asyncio.get_event_loop().time())}.pdf"
        output_path = CVS_DIR / output_filename

        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                page = await browser.new_page()
                await page.set_content(html, wait_until="networkidle")
                await page.pdf(
                    path=str(output_path),
                    format="A4",
                    print_background=True,
                    margin={"top": "12mm", "bottom": "12mm", "left": "16mm", "right": "16mm"}
                )
                await browser.close()
            return str(output_path)
        except Exception as e:
            await log_activity("ERROR", f"Erreur génération proposition PDF visuelle: {e}")
            raise e

cv_renderer = CVRenderer()
