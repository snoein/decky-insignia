from __future__ import annotations

import time
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import decky
import requests

INSIGNIA_EVENTS_URL = "https://insigniastats.live/api/events"
UPCOMING_EVENTS_WINDOW_DAYS = 14

# Every event entry observed with timezone info uses this; tournament entries
# (item_kind == "tournament") carry no timezone field at all, so this is the
# best-effort default used only for those.
DEFAULT_EVENT_TIMEZONE = "America/New_York"

# Events change far less often than live player counts, so a longer TTL than
# ACTIVE_GAMES_CACHE_TTL_SECONDS is fine here.
EVENTS_CACHE_TTL_SECONDS = 300

_events_cache: dict | None = None
_events_cache_time: float = 0.0


def _local_datetime_to_utc(date_str: str | None, time_str: str | None, tz_name: str | None) -> datetime | None:
    if not date_str or not time_str:
        return None
    try:
        naive = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")
        zone = ZoneInfo(tz_name or DEFAULT_EVENT_TIMEZONE)
        return naive.replace(tzinfo=zone).astimezone(timezone.utc)
    except (ValueError, ZoneInfoNotFoundError) as e:
        decky.logger.warning(f"Insignia: could not localize event time {date_str} {time_str} ({tz_name}): {e}")
        return None


def _event_instant_utc(date_utc: str | None, time_utc: str | None,
                        local_date: str | None, local_time: str | None, tz_name: str | None) -> datetime | None:
    # Regular ("rss") events carry a precomputed, already-DST-corrected UTC
    # instant; tournament entries don't, so fall back to localizing the naive
    # local date/time using the entry's timezone (or DEFAULT_EVENT_TIMEZONE).
    if date_utc and time_utc:
        try:
            return datetime.fromisoformat(f"{date_utc}T{time_utc}:00+00:00")
        except ValueError:
            pass
    return _local_datetime_to_utc(local_date, local_time, tz_name)


def _normalize_events(entries: list) -> list[dict]:
    events = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        game = entry.get("game_name")
        title = entry.get("title")
        if not game or not title:
            continue

        start_utc = _event_instant_utc(
            entry.get("start_date_utc"), entry.get("start_datetime_utc"),
            entry.get("event_date"), entry.get("start_time"), entry.get("event_timezone"),
        )
        if start_utc is None:
            continue

        end_utc = _event_instant_utc(
            entry.get("end_date_utc"), entry.get("end_datetime_utc"),
            entry.get("event_date"), entry.get("end_time"), entry.get("event_timezone"),
        )

        events.append({
            "id": entry.get("id"),
            "game": str(game),
            "title": str(title),
            "description": entry.get("description"),
            "image": entry.get("game_image") or entry.get("banner_url"),
            "startUtc": start_utc.isoformat(),
            "endUtc": end_utc.isoformat() if end_utc else None,
            "hasPrize": bool(entry.get("has_prize")),
            "prizeAmount": entry.get("prize_amount"),
            "isPaidEvent": bool(entry.get("is_paid_event")),
            "entryFeeSats": entry.get("entry_fee_sats"),
            "tournamentStatus": entry.get("tournament_status"),
            "signupCount": entry.get("signup_count"),
        })
    return events


def _parse_events_response(raw) -> dict:
    # Shape A: a bare list of event entries (the observed live shape)
    if isinstance(raw, list):
        return {"error": False, "events": _normalize_events(raw)}

    if isinstance(raw, dict):
        # Shape B: a dict wrapping a list of event entries
        for key in ("events", "data", "results"):
            value = raw.get(key)
            if isinstance(value, list):
                return {"error": False, "events": _normalize_events(value)}

    decky.logger.warning(f"Insignia: unrecognized events response shape: {raw!r}")
    return {"error": True, "message": "Unrecognized response from Insignia events service."}


def get_upcoming_events(force_refresh: bool = False) -> dict:
    global _events_cache, _events_cache_time

    now_mono = time.monotonic()
    if (
        not force_refresh
        and _events_cache is not None
        and (now_mono - _events_cache_time) < EVENTS_CACHE_TTL_SECONDS
    ):
        return _events_cache

    try:
        response = requests.get(INSIGNIA_EVENTS_URL, timeout=10)
        response.raise_for_status()
        raw = response.json()
    except requests.exceptions.RequestException as e:
        decky.logger.error(f"Insignia: request to events service failed: {e}")
        return {"error": True, "message": "Could not reach Insignia events service."}
    except ValueError as e:
        decky.logger.error(f"Insignia: could not parse events JSON response: {e}")
        return {"error": True, "message": "Received an invalid response from the events service."}

    result = _parse_events_response(raw)
    if result.get("error"):
        return result

    now_utc = datetime.now(timezone.utc)
    window_end = now_utc + timedelta(days=UPCOMING_EVENTS_WINDOW_DAYS)
    events = [
        e for e in result["events"]
        if now_utc <= datetime.fromisoformat(e["startUtc"]) <= window_end
    ]
    events.sort(key=lambda e: e["startUtc"])

    result = {"error": False, "events": events}
    _events_cache = result
    _events_cache_time = now_mono
    return result
