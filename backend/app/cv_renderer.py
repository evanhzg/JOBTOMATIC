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

cv_renderer = CVRenderer()
