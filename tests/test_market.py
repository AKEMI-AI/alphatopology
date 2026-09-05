from datetime import datetime, timezone

from alphatopology.market import _history_time


def test_daily_history_uses_business_day_string() -> None:
    observed = datetime(2026, 9, 5, 13, 30, tzinfo=timezone.utc)
    assert _history_time(observed, "1d") == "2026-09-05"


def test_intraday_history_preserves_unique_seconds() -> None:
    first = datetime(2026, 9, 5, 13, 30, tzinfo=timezone.utc)
    second = datetime(2026, 9, 5, 14, 30, tzinfo=timezone.utc)
    assert _history_time(first, "1h") != _history_time(second, "1h")
    assert isinstance(_history_time(first, "1h"), int)
