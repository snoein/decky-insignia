import { callable } from "@decky/api";
import { ActiveGamesResponse, EventsResponse } from "./types";

// Calls the python function "get_active_games", which fetches the current
// Insignia network stats and returns them in a normalized shape. The backend
// caches successful responses for 60s; pass forceRefresh=true (wired to the
// panel's refresh button) to bypass that cache.
export const getActiveGames = callable<[forceRefresh?: boolean], ActiveGamesResponse>("get_active_games");

// Calls the python function "get_upcoming_events", which fetches Insignia
// network events/tournaments and returns only those starting in the next 14
// days, sorted soonest-first. The backend caches successful responses for 5
// minutes; pass forceRefresh=true (wired to the panel's refresh button) to
// bypass that cache.
export const getUpcomingEvents = callable<[forceRefresh?: boolean], EventsResponse>("get_upcoming_events");

// Looks up a single title's current online count by its Insignia title ID,
// sharing get_active_games' 60s cache on the backend rather than triggering
// its own fetch.
export const getGameOnlineCount = callable<[titleId: string], number>("get_game_online_count");

export const getPlaycountBadgeEnabled = callable<[], boolean>("get_playcount_badge_enabled");
export const setPlaycountBadgeEnabledBackend = callable<[boolean], void>("set_playcount_badge_enabled");

export const getTileBadgeEnabled = callable<[], boolean>("get_tile_badge_enabled");
export const setTileBadgeEnabledBackend = callable<[boolean], void>("set_tile_badge_enabled");

// appDetailsStore.GetAppDetails()/appStore.GetAppOverviewByAppID() -- the
// obvious frontend APIs for a shortcut's Target path -- return null for any
// app Steam hasn't individually loaded, which in practice is nearly every
// home page tile (confirmed live: every unvisited shortcut came back null).
// So instead the backend reads shortcuts.vdf directly and hands back the set
// of appids whose Target points at an original-Xbox rom.
export const getXboxRomAppIds = callable<[], number[]>("get_xbox_rom_appids");
