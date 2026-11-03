import os
from pathlib import Path

APP_NAME = "Plonge"

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
STORAGE_DIR = BASE_DIR / "storage"
CVS_DIR = STORAGE_DIR / "cvs"
SCREENSHOTS_DIR = STORAGE_DIR / "screenshots"
IMPORTED_CV_DIR = STORAGE_DIR / "imported_cv"
FONTS_DIR = STORAGE_DIR / "fonts"
ACCOUNTS_DIR = DATA_DIR / "accounts"        # per-account CLI config dirs (CLAUDE_CONFIG_DIR, CODEX_HOME...)
TEMPLATES_DIR = BASE_DIR / "templates"
DB_PATH = Path(os.getenv("PLONGE_DB", DATA_DIR / "plonge.db"))
LEGACY_DB_PATH = DATA_DIR / "jobhunter.db"

for d in (DATA_DIR, CVS_DIR, SCREENSHOTS_DIR, IMPORTED_CV_DIR, FONTS_DIR, ACCOUNTS_DIR, TEMPLATES_DIR):
    d.mkdir(parents=True, exist_ok=True)

# The candidate's address: used on tailored CVs, as reply-to and as default sender.
DEFAULT_CANDIDATE_EMAIL = "evhoizey@gmail.com"
