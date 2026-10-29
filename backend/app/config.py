from pathlib import Path
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
STORAGE_DIR = BASE_DIR / "storage"
CVS_DIR = STORAGE_DIR / "cvs"
SCREENSHOTS_DIR = STORAGE_DIR / "screenshots"
TEMPLATES_DIR = BASE_DIR / "templates"
DB_PATH = DATA_DIR / "jobhunter.db"

DATA_DIR.mkdir(parents=True, exist_ok=True)
CVS_DIR.mkdir(parents=True, exist_ok=True)
SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)
TEMPLATES_DIR.mkdir(parents=True, exist_ok=True)

class SettingsSchema(BaseModel):
    is_autopilot_enabled: bool = False
    is_paused: bool = False
    match_score_threshold: int = 75
    daily_application_limit: int = 20
    applications_sent_today: int = 0
    gmail_address: str = ""
    gmail_app_password: str = ""
    imap_poll_interval_mins: int = 3
    search_interval_mins: int = 15
