"""SQLite storage. One small helper layer; JSON columns are decoded on read."""
from __future__ import annotations

import json
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional

import aiosqlite

from .config import DB_PATH, DEFAULT_CANDIDATE_EMAIL, LEGACY_DB_PATH

JSON_COLUMNS = {
    "jobs": {"match_reasons", "strengths", "gaps", "tailor", "extra"},
    "searches": {"locations", "contract_types", "sources", "exclude_keywords", "include_keywords", "last_report"},
    "profile": {"skills", "experiences", "education", "languages", "preferences", "target_roles"},
    "cv_versions": {"edits", "audit", "units_cache"},
    "ai_accounts": {"env"},
    "ai_tasks": {"payload", "result"},
}

SCHEMA = """
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

CREATE TABLE IF NOT EXISTS profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    full_name TEXT DEFAULT '',
    email TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    city TEXT DEFAULT '',
    headline TEXT DEFAULT '',
    summary TEXT DEFAULT '',
    skills TEXT DEFAULT '[]',
    experiences TEXT DEFAULT '[]',
    education TEXT DEFAULT '[]',
    languages TEXT DEFAULT '[]',
    preferences TEXT DEFAULT '{}',
    target_roles TEXT DEFAULT '[]',
    updated_at TEXT
);

CREATE TABLE IF NOT EXISTS cv_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL,
    kind TEXT NOT NULL,                 -- original | optimized
    source_pdf TEXT NOT NULL,           -- the uploaded original PDF (design source)
    edits TEXT DEFAULT '{}',            -- unit id -> rich text, relative to source_pdf
    pdf_path TEXT,                      -- rendered PDF for this version
    text TEXT DEFAULT '',
    audit TEXT,
    units_cache TEXT,
    is_master INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS searches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT DEFAULT '',
    query TEXT NOT NULL,
    locations TEXT DEFAULT '[]',
    radius_km INTEGER DEFAULT 30,
    contract_types TEXT DEFAULT '[]',
    remote TEXT DEFAULT 'any',
    max_age_days INTEGER DEFAULT 14,
    sources TEXT DEFAULT '[]',          -- empty = all configured sources
    exclude_keywords TEXT DEFAULT '[]',
    include_keywords TEXT DEFAULT '[]',
    active INTEGER DEFAULT 1,
    interval_mins INTEGER,              -- NULL = global setting
    last_run_at TEXT,
    next_run_at TEXT,
    last_report TEXT,
    total_found INTEGER DEFAULT 0,
    new_last_run INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    external_id TEXT UNIQUE,
    fingerprint TEXT,
    source TEXT,
    source_label TEXT,
    title TEXT NOT NULL,
    company TEXT DEFAULT '',
    location TEXT DEFAULT '',
    contract_type TEXT DEFAULT '',
    description TEXT DEFAULT '',
    url TEXT DEFAULT '',
    apply_url TEXT DEFAULT '',
    contact_email TEXT DEFAULT '',
    salary TEXT DEFAULT '',
    posted_at TEXT,
    remote INTEGER,
    search_id INTEGER,
    status TEXT DEFAULT 'new',          -- new | ready | applied | answered | interview | archived
    archived_reason TEXT,
    match_score INTEGER,                -- NULL until the AI scored it
    match_reasons TEXT,
    strengths TEXT,
    gaps TEXT,
    ai_summary TEXT,
    is_school_ad INTEGER DEFAULT 0,
    school_reason TEXT,
    ats_before INTEGER,
    ats_after INTEGER,
    tailor TEXT,                        -- {edits, result, notes, keywords, ...}
    tailored_cv_path TEXT,
    cover_letter TEXT,
    email_subject TEXT,
    apply_method TEXT,                  -- email | link
    applied_at TEXT,
    sent_message_id TEXT,
    answer_at TEXT,
    answer_snippet TEXT,
    answer_class TEXT,
    notes TEXT DEFAULT '',
    starred INTEGER DEFAULT 0,
    extra TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_fp ON jobs(fingerprint);

CREATE TABLE IF NOT EXISTS followups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER NOT NULL,
    seq INTEGER NOT NULL,
    due_at TEXT NOT NULL,
    status TEXT DEFAULT 'scheduled',    -- scheduled | sent | manual | cancelled | failed
    channel TEXT DEFAULT 'email',       -- email | manual
    subject TEXT,
    body TEXT,
    sent_at TEXT,
    message_id TEXT,
    error TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_followups_due ON followups(status, due_at);

CREATE TABLE IF NOT EXISTS ai_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL,             -- claude | codex | agy | anthropic_api
    label TEXT NOT NULL,
    auth TEXT DEFAULT 'default',        -- default | config_dir | token | api_key
    config_dir TEXT,
    secret TEXT,
    model TEXT,
    env TEXT DEFAULT '{}',
    priority INTEGER DEFAULT 100,
    enabled INTEGER DEFAULT 1,
    status TEXT DEFAULT 'unknown',      -- ok | limited | needs_login | error | unknown
    limited_until TEXT,
    last_error TEXT,
    last_ok_at TEXT,
    last_used_at TEXT,
    calls_day TEXT,
    calls_today INTEGER DEFAULT 0,
    calls_total INTEGER DEFAULT 0,
    consecutive_errors INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    job_id INTEGER,
    payload TEXT DEFAULT '{}',
    priority INTEGER DEFAULT 50,        -- lower runs first; user actions use 10
    status TEXT DEFAULT 'queued',       -- queued | running | done | failed | cancelled
    attempts INTEGER DEFAULT 0,
    run_after TEXT,
    last_error TEXT,
    result TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON ai_tasks(status, priority, id);

CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    level TEXT,
    message TEXT,
    job_id INTEGER,
    timestamp TEXT
);
"""

DEFAULT_SETTINGS: Dict[str, Any] = {
    "autopilot_enabled": False,
    "paused": False,
    "match_threshold": 70,
    "daily_application_limit": 15,
    "require_validation": True,          # tailored applications wait in "CV prêts" for a click
    "search_interval_mins": 180,
    "auto_search": True,                 # refresh saved searches on their own
    "auto_score": True,                  # let the AI score new offers as they arrive
    "hide_school_ads": True,
    "gmail_address": DEFAULT_CANDIDATE_EMAIL,
    "gmail_app_password": "",
    "sender_name": "",
    "imap_enabled": True,
    "followups_enabled": True,
    "followup_delays_days": [7, 14],
    "followup_auto_send": True,
    "followup_window": [9, 11],          # local hours to send relances
    "followup_skip_weekends": True,
    "source_credentials": {},
    "ai_provider_order": ["claude", "anthropic_api", "codex", "agy"],
    "ai_default_cooldown_mins": 60,
    "applications_day": "",
    "applications_today": 0,
}


@asynccontextmanager
async def connect():
    db = await aiosqlite.connect(DB_PATH, timeout=30)
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA journal_mode=WAL")
    await db.execute("PRAGMA foreign_keys=ON")
    try:
        yield db
    finally:
        await db.close()


def now_iso() -> str:
    return datetime.now().isoformat(timespec="seconds")


def decode_row(table: str, row: Optional[aiosqlite.Row]) -> Optional[Dict[str, Any]]:
    if row is None:
        return None
    d = dict(row)
    for col in JSON_COLUMNS.get(table, ()):
        v = d.get(col)
        if isinstance(v, str) and v:
            try:
                d[col] = json.loads(v)
            except Exception:
                pass
    return d


def encode(table: str, values: Dict[str, Any]) -> Dict[str, Any]:
    out = {}
    for k, v in values.items():
        if k in JSON_COLUMNS.get(table, ()) and not isinstance(v, str) and v is not None:
            out[k] = json.dumps(v, ensure_ascii=False)
        elif isinstance(v, bool):
            out[k] = int(v)
        else:
            out[k] = v
    return out


async def fetch_all(table: str, sql: str, params: Iterable[Any] = ()) -> List[Dict[str, Any]]:
    async with connect() as db:
        cur = await db.execute(sql, tuple(params))
        return [decode_row(table, r) for r in await cur.fetchall()]


async def fetch_one(table: str, sql: str, params: Iterable[Any] = ()) -> Optional[Dict[str, Any]]:
    async with connect() as db:
        cur = await db.execute(sql, tuple(params))
        return decode_row(table, await cur.fetchone())


async def execute(sql: str, params: Iterable[Any] = ()) -> int:
    async with connect() as db:
        cur = await db.execute(sql, tuple(params))
        await db.commit()
        return cur.lastrowid


async def update(table: str, row_id: int, values: Dict[str, Any], touch: bool = True) -> None:
    if not values:
        return
    vals = encode(table, values)
    if touch and table == "jobs":
        vals["updated_at"] = now_iso()
    cols = ", ".join(f"{k} = ?" for k in vals)
    await execute(f"UPDATE {table} SET {cols} WHERE id = ?", [*vals.values(), row_id])


async def insert(table: str, values: Dict[str, Any], or_ignore: bool = False) -> Optional[int]:
    vals = encode(table, values)
    cols = ", ".join(vals)
    qs = ", ".join("?" for _ in vals)
    verb = "INSERT OR IGNORE" if or_ignore else "INSERT"
    async with connect() as db:
        cur = await db.execute(f"{verb} INTO {table} ({cols}) VALUES ({qs})", list(vals.values()))
        await db.commit()
        return cur.lastrowid if cur.rowcount else None


# ----------------------------------------------------------------- settings

async def get_settings() -> Dict[str, Any]:
    out = dict(DEFAULT_SETTINGS)
    async with connect() as db:
        cur = await db.execute("SELECT key, value FROM settings")
        for r in await cur.fetchall():
            try:
                out[r["key"]] = json.loads(r["value"])
            except Exception:
                out[r["key"]] = r["value"]
    return out


async def set_settings(values: Dict[str, Any]) -> None:
    async with connect() as db:
        for k, v in values.items():
            await db.execute(
                "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                (k, json.dumps(v, ensure_ascii=False)),
            )
        await db.commit()


# ----------------------------------------------------------------- profile

async def get_profile() -> Dict[str, Any]:
    p = await fetch_one("profile", "SELECT * FROM profile WHERE id = 1")
    return p or {}


async def get_master_cv() -> Optional[Dict[str, Any]]:
    return await fetch_one("cv_versions", "SELECT * FROM cv_versions WHERE is_master = 1 ORDER BY id DESC LIMIT 1")


# ----------------------------------------------------------------- logs

async def log_activity(level: str, message: str, job_id: Optional[int] = None) -> None:
    try:
        await execute("INSERT INTO logs (level, message, job_id, timestamp) VALUES (?, ?, ?, ?)",
                      (level, message, job_id, now_iso()))
        from .events import publish
        publish("log", {"level": level, "message": message, "job_id": job_id, "timestamp": now_iso()})
    except Exception as e:  # logging must never break a workflow
        print(f"log failed: {e}")


# ----------------------------------------------------------------- init

async def init_db() -> None:
    async with connect() as db:
        await db.executescript(SCHEMA)
        await db.execute(
            "INSERT OR IGNORE INTO profile (id, email, city, updated_at) VALUES (1, ?, '', ?)",
            (DEFAULT_CANDIDATE_EMAIL, now_iso()),
        )
        # Default AI accounts: the CLIs already logged in on this machine.
        cur = await db.execute("SELECT COUNT(*) FROM ai_accounts")
        if (await cur.fetchone())[0] == 0:
            for prio, (prov, label) in enumerate([("claude", "Claude (session locale)"),
                                                  ("codex", "Codex (session locale)"),
                                                  ("agy", "Antigravity (session locale)")]):
                await db.execute(
                    "INSERT INTO ai_accounts (provider, label, auth, priority) VALUES (?, ?, 'default', ?)",
                    (prov, label, (prio + 1) * 10),
                )
        await db.commit()
    await _import_legacy_cv()


async def _import_legacy_cv() -> None:
    """Carry over the CV uploaded in the old JobHunter/JOBTOMATIC database."""
    import os
    if not LEGACY_DB_PATH.exists() or LEGACY_DB_PATH == DB_PATH:
        return
    if await fetch_one("cv_versions", "SELECT id FROM cv_versions LIMIT 1"):
        return
    try:
        async with aiosqlite.connect(LEGACY_DB_PATH) as old:
            old.row_factory = aiosqlite.Row
            cur = await old.execute("SELECT original_cv_path, original_cv_filename, original_cv_text FROM profile WHERE id = 1")
            row = await cur.fetchone()
    except Exception:
        return
    if not row or not row["original_cv_path"] or not os.path.exists(row["original_cv_path"]):
        return
    await insert("cv_versions", {
        "label": row["original_cv_filename"] or "CV original",
        "kind": "original",
        "source_pdf": row["original_cv_path"],
        "edits": {},
        "pdf_path": row["original_cv_path"],
        "text": row["original_cv_text"] or "",
        "is_master": 1,
    })
