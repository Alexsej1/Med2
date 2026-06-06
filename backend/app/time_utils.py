"""Согласованная работа с датами визитов (datetime-local ↔ БД ↔ оповещения)."""

from datetime import datetime, timedelta, timezone


def schedule_now_utc() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def schedule_now_local() -> datetime:
    return datetime.now()


def naive_local_to_utc_naive(dt: datetime) -> datetime:
    """Naive datetime из datetime-local → UTC naive для хранения в БД."""
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return datetime.fromtimestamp(dt.timestamp(), tz=timezone.utc).replace(tzinfo=None)


def normalize_visit_datetime(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return naive_local_to_utc_naive(dt)


def is_within_upcoming_window(
    visit_at: datetime,
    *,
    window_minutes: int = 20,
) -> bool:
    """
    Визит в ближайшие N минут.
    Поддерживает и UTC-записи, и старые naive local (без конвертации при сохранении).
    """
    end_utc = schedule_now_utc() + timedelta(minutes=window_minutes)
    end_local = schedule_now_local() + timedelta(minutes=window_minutes)
    now_utc = schedule_now_utc()
    now_local = schedule_now_local()
    return (now_utc < visit_at <= end_utc) or (now_local < visit_at <= end_local)


def minutes_until_visit(visit_at: datetime) -> int:
    """Минут до визита по ближайшей оценке (UTC или local)."""
    now_utc = schedule_now_utc()
    now_local = schedule_now_local()
    delta_utc = (visit_at - now_utc).total_seconds()
    delta_local = (visit_at - now_local).total_seconds()
    candidates = [d for d in (delta_utc, delta_local) if d > 0]
    if not candidates:
        return 1
    return max(1, int(min(candidates) // 60) or 1)
