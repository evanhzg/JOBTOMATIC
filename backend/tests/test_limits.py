from datetime import datetime

from app.ai.limits import is_auth_error, is_limit, parse_reset

NOW = datetime(2026, 11, 3, 10, 0)


def test_detects_limits_and_reset_times():
    cases = {
        "5-hour limit reached ∙ resets 3pm": datetime(2026, 11, 3, 15, 0),
        "You've hit your usage limit. Try again at 3:05 PM.": datetime(2026, 11, 3, 15, 5),
        "You've hit your usage limit. Upgrade to Pro or try again in 4 days 3 hours 2 minutes.": datetime(2026, 11, 7, 13, 2),
        "resets at 15:30 (Europe/Paris)": datetime(2026, 11, 3, 15, 30),
        "You've hit your limit · resets Nov 5, 9am": datetime(2026, 11, 5, 9, 0),
    }
    for text, expected in cases.items():
        assert is_limit(text), text
        assert parse_reset(text, NOW) == expected, text


def test_reset_earlier_in_day_means_tomorrow():
    assert parse_reset("limit reached, resets 9am", NOW) == datetime(2026, 11, 4, 9, 0)


def test_unknown_reset_and_auth():
    assert is_limit("RESOURCE_EXHAUSTED: quota") and parse_reset("RESOURCE_EXHAUSTED: quota", NOW) is None
    assert is_auth_error("Invalid API key · Please run /login")
    assert not is_limit("Here is your JSON")
