import pytest
import aiosqlite
from app.config import DB_PATH
from app.database import init_db
from app.inbox_tracker import inbox_tracker

@pytest.mark.asyncio
async def test_simulate_mock_reply():
    await init_db()
    async with aiosqlite.connect(DB_PATH) as db:
        # Create a test applied job
        cur = await db.execute("""
            INSERT INTO jobs (external_id, title, company, location, contract_type, description, url, status)
            VALUES ('test_reply_1', 'Alternance Test', 'Rouen Tech SAS', 'Rouen', 'Alternance', 'Description', 'http://test', 'applied')
        """)
        job_id = cur.lastrowid
        await db.commit()

    # Simulate recruiter answer
    success = await inbox_tracker.simulate_mock_reply(job_id)
    assert success is True

    # Verify status changed to 'answer_received'
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute("SELECT status, answer_at, answer_snippet, answer_classification FROM jobs WHERE id = ?", (job_id,))
        job = dict(await cur.fetchone())
        assert job["status"] == "answer_received"
        assert job["answer_at"] is not None
        assert "Rouen Tech SAS" in job["answer_snippet"] or "entretien" in job["answer_snippet"].lower()
