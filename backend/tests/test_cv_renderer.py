import os
import pytest
from app.cv_renderer import cv_renderer

@pytest.mark.asyncio
async def test_cv_pdf_generation():
    profile = {
        "full_name": "Evan Testeur",
        "city": "Rouen (76000)",
        "email": "evan@test.fr",
        "phone": "0612345678",
        "headline": "Développeur Fullstack",
        "summary": "Développeur passionné par l'automatisation logicielle.",
        "skills": ["Python", "TypeScript", "React"],
        "experiences": [
            {
                "role": "Développeur",
                "company": "Entreprise Normandie",
                "period": "2023 - 2024",
                "details": ["Automatisation de flux", "Déploiement d'APIs"]
            }
        ],
        "education": [
            {
                "degree": "Bac+3 Informatique",
                "school": "Université de Rouen",
                "year": "2023"
            }
        ],
        "languages": ["Français", "Anglais"],
        "preferences": {"driver_license": "Permis B"}
    }

    tailored = {
        "tailored_headline": "Développeur Python & Automatisation",
        "tailored_summary": "Spécialiste de l'automatisation adapté aux besoins de l'entreprise.",
        "highlighted_skills": ["Python", "TypeScript", "FastAPI"]
    }

    pdf_path = await cv_renderer.generate_pdf(
        job_id=888,
        profile=profile,
        tailored_data=tailored,
        job_title="Développeur Python",
        company="Tech Rouen"
    )

    assert os.path.exists(pdf_path)
    assert os.path.getsize(pdf_path) > 1000
