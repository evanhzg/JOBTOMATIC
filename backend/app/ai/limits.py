"""Detect "usage limit reached" messages from the AI CLIs and when they reset."""
from __future__ import annotations

import re
from datetime import datetime, timedelta
from typing import Optional

LIMIT_PATTERNS = [
    r"usage limit", r"rate.?limit", r"limit reached", r"hit your (usage )?limit", r"you've hit your",
    r"quota", r"resource.?exhausted", r"too many requests", r"\b429\b", r"overloaded",
    r"try again (in|at|later)", r"resets? (at|in)?\s*\d", r"credit balance is too low",
    r"out of (extra )?usage", r"weekly limit", r"5-hour limit", r"session limit",
]
AUTH_PATTERNS = [
    r"not logged in", r"please (run )?/?login", r"invalid api key", r"authentication", r"unauthori[sz]ed",
    r"\b401\b", r"oauth token (has )?expired", r"login required", r"invalid x-api-key", r"no credentials",
]

_LIMIT_RE = re.compile("|".join(LIMIT_PATTERNS), re.I)
_AUTH_RE = re.compile("|".join(AUTH_PATTERNS), re.I)


def is_limit(text: str) -> bool:
    return bool(text and _LIMIT_RE.search(text))


def is_auth_error(text: str) -> bool:
    return bool(text and _AUTH_RE.search(text))


def parse_reset(text: str, now: Optional[datetime] = None) -> Optional[datetime]:
    """Best-effort reset time from messages such as:
    - "Claude AI usage limit reached|1761998400"           (epoch seconds)
    - "5-hour limit reached ∙ resets 3pm" / "resets at 15:30" / "resets Nov 4, 9am"
    - "try again in 2 hours 13 minutes" / "in 4 days 3 hours" / "in 45s"
    - "try again at 3:05 PM"
    - "Retry-After: 120"
    """
    if not text:
        return None
    now = now or datetime.now()

    m = re.search(r"\|\s*(\d{10})\b", text)
    if m:
        return datetime.fromtimestamp(int(m.group(1)))

    m = re.search(r"retry-after:?\s*(\d+)", text, re.I)
    if m:
        return now + timedelta(seconds=int(m.group(1)))

    m = re.search(r"(?:try again|resets?|available again)\s+in\s+((?:\d+\s*(?:days?|d|hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)\b[\s,]*(?:and\s+)?)+)", text, re.I)
    if m:
        delta = timedelta()
        for num, unit in re.findall(r"(\d+)\s*(days?|d|hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)\b", m.group(1), re.I):
            n, u = int(num), unit.lower()
            if u.startswith("d"):
                delta += timedelta(days=n)
            elif u.startswith("h"):
                delta += timedelta(hours=n)
            elif u.startswith("m"):
                delta += timedelta(minutes=n)
            else:
                delta += timedelta(seconds=n)
        if delta:
            return now + delta

    # "resets 3pm", "try again at 3:05 PM", "resets at 15:30", "resets Nov 4, 9am"
    m = re.search(r"(?:resets?|try again|available)\s*(?:at|on)?\s*(?:([A-Z][a-z]{2,8})\s+(\d{1,2}),?\s*)?(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?", text, re.I)
    if m and (m.group(5) or m.group(4)):
        hour = int(m.group(3))
        minute = int(m.group(4) or 0)
        ampm = (m.group(5) or "").lower()
        if ampm == "pm" and hour < 12:
            hour += 12
        if ampm == "am" and hour == 12:
            hour = 0
        if hour < 24 and minute < 60:
            target = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
            if m.group(1) and m.group(2):
                try:
                    month = datetime.strptime(m.group(1)[:3], "%b").month
                    target = target.replace(month=month, day=int(m.group(2)))
                    if target < now - timedelta(days=1):
                        target = target.replace(year=target.year + 1)
                except ValueError:
                    pass
            elif target <= now:
                target += timedelta(days=1)
            return target
    return None
