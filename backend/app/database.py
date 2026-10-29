import json
import aiosqlite
from datetime import datetime
from typing import Any, Dict, List, Optional
from .config import DB_PATH

async def get_db():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        yield db

async def init_db():
    """Initializes tables and seeds default profile/settings if empty."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS jobs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                external_id TEXT UNIQUE,
                title TEXT NOT NULL,
                company TEXT NOT NULL,
                location TEXT,
                contract_type TEXT,
                description TEXT,
                url TEXT,
                contact_email TEXT,
                salary TEXT,
                source TEXT,
                match_score INTEGER DEFAULT 0,
                match_reasons TEXT,
                status TEXT DEFAULT 'discovered',
                tailored_title TEXT,
                tailored_summary TEXT,
                tailored_skills TEXT,
                tailored_cv_path TEXT,
                cover_letter TEXT,
                apply_method TEXT,
                applied_at TEXT,
                submission_screenshot TEXT,
                sent_message_id TEXT,
                answer_at TEXT,
                answer_snippet TEXT,
                answer_classification TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)

        await db.execute("""
            CREATE TABLE IF NOT EXISTS search_queries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                query_text TEXT NOT NULL,
                location TEXT NOT NULL,
                radius_km INTEGER DEFAULT 25,
                contract_types TEXT,
                platforms TEXT,
                is_active INTEGER DEFAULT 1,
                last_run_at TEXT,
                total_found INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)

        await db.execute("""
            CREATE TABLE IF NOT EXISTS profile (
                id INTEGER PRIMARY KEY,
                full_name TEXT,
                email TEXT,
                phone TEXT,
                city TEXT,
                headline TEXT,
                summary TEXT,
                skills TEXT,
                experiences TEXT,
                education TEXT,
                languages TEXT,
                preferences TEXT,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)

        await db.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY,
                is_autopilot_enabled INTEGER DEFAULT 0,
                is_paused INTEGER DEFAULT 0,
                match_score_threshold INTEGER DEFAULT 75,
                daily_application_limit INTEGER DEFAULT 20,
                applications_sent_today INTEGER DEFAULT 0,
                last_reset_date TEXT,
                gmail_address TEXT DEFAULT '',
                gmail_app_password TEXT DEFAULT '',
                imap_poll_interval_mins INTEGER DEFAULT 3,
                search_interval_mins INTEGER DEFAULT 15,
                ai_provider TEXT DEFAULT 'agy',
                wait_for_batch_validation INTEGER DEFAULT 0,
                anthropic_api_key TEXT DEFAULT ''
            )
        """)

        # Migration columns if table already exists
        columns_to_add = [
            ("settings", "ai_provider", "TEXT DEFAULT 'agy'"),
            ("settings", "wait_for_batch_validation", "INTEGER DEFAULT 0"),
            ("settings", "anthropic_api_key", "TEXT DEFAULT ''"),
            ("jobs", "cv_improvement_suggestions", "TEXT"),
            ("profile", "original_cv_path", "TEXT"),
            ("profile", "original_cv_filename", "TEXT"),
            ("profile", "original_cv_text", "TEXT"),
            ("profile", "efficiency_metrics", "TEXT")
        ]
        for tbl, col, col_type in columns_to_add:
            try:
                await db.execute(f"ALTER TABLE {tbl} ADD COLUMN {col} {col_type}")
            except Exception:
                pass # Already added

        await db.execute("""
            CREATE TABLE IF NOT EXISTS logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                level TEXT,
                message TEXT,
                job_id INTEGER,
                timestamp TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Seed default settings if empty
        cursor = await db.execute("SELECT COUNT(*) FROM settings")
        count = (await cursor.fetchone())[0]
        if count == 0:
            today = datetime.now().strftime("%Y-%m-%d")
            await db.execute("""
                INSERT INTO settings (id, is_autopilot_enabled, is_paused, match_score_threshold, daily_application_limit, applications_sent_today, last_reset_date)
                VALUES (1, 0, 0, 75, 20, 0, ?)
            """, (today,))

        # Seed initial default profile if empty
        cursor = await db.execute("SELECT COUNT(*) FROM profile")
        count = (await cursor.fetchone())[0]
        if count == 0:
            default_skills = ["Python", "TypeScript", "React", "Docker", "Git", "Gestion de projet", "Résolution de problèmes"]
            default_experiences = [
                {
                    "role": "Développeur / Concepteur Logiciel",
                    "company": "Projets & Ingénierie",
                    "period": "2023 - Présent",
                    "location": "Rouen & Distanciel",
                    "details": [
                        "Conception et développement d'applications full-stack et d'automatisations intelligentes",
                        "Intégration d'APIs REST, WebSockets et de modèles IA",
                        "Optimisation des processus et déploiement continu"
                    ]
                }
            ]
            default_education = [
                {
                    "degree": "Formation Informatique & Systèmes Numériques",
                    "school": "Rouen",
                    "year": "2023",
                    "details": "Spécialisation développement web, automatisation et cloud"
                }
            ]
            default_preferences = {
                "driver_license": "Permis B",
                "availability": "Immédiate",
                "min_salary": "Selon grille conventionnelle",
                "work_types": ["Alternance", "Intérim", "CDI", "CDD"]
            }

            await db.execute("""
                INSERT INTO profile (id, full_name, email, phone, city, headline, summary, skills, experiences, education, languages, preferences)
                VALUES (1, 'Evan Candidate', 'evan@example.com', '06 12 34 56 78', 'Rouen (76000)',
                        'Développeur Polyvalent & Rigoureux',
                        'Passionné par les technologies modernes et l''automatisation, autonome et rigoureux avec une forte capacité d''adaptation rapide en entreprise.',
                        ?, ?, ?, ?, ?)
            """, (
                json.dumps(default_skills),
                json.dumps(default_experiences),
                json.dumps(default_education),
                json.dumps(["Français (Natif)", "Anglais (Technique/Professionnel)"]),
                json.dumps(default_preferences)
            ))

        # Seed sample search queries for Rouen if empty
        cursor = await db.execute("SELECT COUNT(*) FROM search_queries")
        count = (await cursor.fetchone())[0]
        if count == 0:
            sample_queries = [
                ("Alternance Développeur", "Rouen", 30, ["Alternance", "Apprentissage"], ["France Travail", "Indeed", "HelloWork"]),
                ("Intérim Logistique / Technique", "Rouen", 25, ["Intérim"], ["France Travail", "Indeed", "HelloWork", "Adecco", "Manpower"])
            ]
            for q_text, loc, radius, c_types, plats in sample_queries:
                await db.execute("""
                    INSERT INTO search_queries (query_text, location, radius_km, contract_types, platforms, is_active)
                    VALUES (?, ?, ?, ?, ?, 1)
                """, (q_text, loc, radius, json.dumps(c_types), json.dumps(plats)))

        await db.commit()

async def log_activity(level: str, message: str, job_id: Optional[int] = None):
    """Appends an event to the activity log."""
    try:
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute(
                "INSERT INTO logs (level, message, job_id, timestamp) VALUES (?, ?, ?, ?)",
                (level, message, job_id, datetime.now().isoformat())
            )
            await db.commit()
    except Exception as e:
        print(f"Failed to write log: {e}")
