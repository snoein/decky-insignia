from __future__ import annotations

import time

import decky
import requests

INSIGNIA_STATS_URL = "https://insigniastats.live/api/online-users"

# Backs get_game_online_count: the library-page playcount badge polls this
# every 60s per open game page, so its own request is cached separately from
# get_active_games below rather than paying for a fresh fetch on every poll.
STATS_CACHE_TTL_SECONDS = 60

_stats_cache: object | None = None
_stats_cache_time: float = 0.0


def _fetch_stats(force_refresh: bool = False) -> object | None:
    global _stats_cache, _stats_cache_time

    now = time.monotonic()
    if not force_refresh and _stats_cache is not None and (now - _stats_cache_time) < STATS_CACHE_TTL_SECONDS:
        return _stats_cache

    try:
        response = requests.get(INSIGNIA_STATS_URL, timeout=10)
        response.raise_for_status()
        raw = response.json()
    except requests.exceptions.RequestException as e:
        decky.logger.error(f"Insignia: request to stats service failed: {e}")
        return None
    except ValueError as e:
        decky.logger.error(f"Insignia: could not parse JSON response: {e}")
        return None

    _stats_cache = raw
    _stats_cache_time = now
    return raw


def _find_online_count(raw: object, title_id: str) -> int:
    if not isinstance(raw, dict):
        return 0

    title_id = title_id.upper()
    for entry in raw.values():
        if not isinstance(entry, dict):
            continue
        if str(entry.get("titleId", "")).upper() == title_id:
            try:
                return int(entry.get("online", 0))
            except (TypeError, ValueError):
                return 0
    return 0


# Reopening the Active Games panel (or navigating back into it) shouldn't
# re-hit the stats service every time -- only an explicit refresh-button
# click should. Kept separate from _stats_cache (used by
# get_game_online_count) since the two are polled independently and on
# different schedules.
ACTIVE_GAMES_CACHE_TTL_SECONDS = 60

_active_games_cache: dict | None = None
_active_games_cache_time: float = 0.0


def _normalize_games(entries: list) -> list[dict]:
    games = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        name = entry.get("name") or entry.get("game") or entry.get("title") or entry.get("map") or "Unknown"
        players = (
            entry.get("players")
            if entry.get("players") is not None
            else entry.get("playerCount", entry.get("player_count", entry.get("count", entry.get("online", 0))))
        )
        try:
            players = int(players)
        except (TypeError, ValueError):
            players = 0
        if players > 0:
            games.append({"name": str(name), "players": players})
    games.sort(key=lambda g: g["players"], reverse=True)
    return games


def _parse_stats_response(raw) -> dict:
    # Shape A: a bare list of per-game entries
    if isinstance(raw, list):
        games = _normalize_games(raw)
        return {"error": False, "games": games, "total": sum(g["players"] for g in games)}

    if isinstance(raw, dict):
        # Shape B: a dict wrapping a list of per-game entries
        for key in ("games", "servers", "lobbies", "data", "results"):
            value = raw.get(key)
            if isinstance(value, list):
                games = _normalize_games(value)
                return {"error": False, "games": games, "total": sum(g["players"] for g in games)}

        # Shape C: a single flat online-user total, no per-game breakdown
        for key in ("total", "online", "count", "players", "online_users", "onlineUsers"):
            value = raw.get(key)
            if isinstance(value, (int, float)):
                return {"error": False, "games": [], "total": int(value)}

        # Shape D: a dict keyed by game title, each value a per-game entry dict
        if raw and all(isinstance(v, dict) for v in raw.values()):
            games = _normalize_games(raw.values())
            return {"error": False, "games": games, "total": sum(g["players"] for g in games)}

    decky.logger.warning(f"Insignia: unrecognized response shape: {raw!r}")
    return {"error": True, "message": "Unrecognized response from Insignia stats service."}


def get_active_games(force_refresh: bool = False) -> dict:
    global _active_games_cache, _active_games_cache_time

    now = time.monotonic()
    if (
        not force_refresh
        and _active_games_cache is not None
        and (now - _active_games_cache_time) < ACTIVE_GAMES_CACHE_TTL_SECONDS
    ):
        return _active_games_cache

    try:
        response = requests.get(INSIGNIA_STATS_URL, timeout=10)
        response.raise_for_status()
        raw = response.json()
    except requests.exceptions.RequestException as e:
        decky.logger.error(f"Insignia: request to stats service failed: {e}")
        return {"error": True, "message": "Could not reach Insignia stats service."}
    except ValueError as e:
        decky.logger.error(f"Insignia: could not parse JSON response: {e}")
        return {"error": True, "message": "Received an invalid response from the stats service."}

    result = _parse_stats_response(raw)
    if not result.get("error"):
        _active_games_cache = result
        _active_games_cache_time = now
    return result


def get_game_online_count(title_id: str) -> int:
    raw = _fetch_stats()
    if raw is None:
        return 0
    return _find_online_count(raw, title_id)
