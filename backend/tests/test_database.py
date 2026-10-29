import pytest
import aiosqlite
from app.database import init_db, log_activity
from app.config import DB_PATH

@pytest.mark.asyncio
async def test_init_db_and_defaults():
    await init_db()
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute("SELECT * FROM settings WHERE id = 1")
        settings = dict(await cur.fetchone())
        assert settings["match_score_threshold"] == 75
        assert settings["daily_application_limit"] == 20

        cur = await db.execute("SELECT * FROM profile WHERE id = 1")
        profile = dict(await cur.fetchone())
        assert "Rouen" in profile["city"]
        assert "Evan" in profile["full_name"]

@pytest.mark.asyncio
async def test_logging():
    await log_activity("SUCCESS", "Test message in pytest")
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute("SELECT * FROM logs ORDER BY id DESC LIMIT 1")
        log = dict(await cur.fetchone())
        assert log["level"] == "SUCCESS"
        assert "Test message in pytest" in log["message"]
