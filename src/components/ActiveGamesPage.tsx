import { PanelSection, PanelSectionRow } from "@decky/ui";
import { useEffect, useState, useCallback } from "react";
import { Header } from "./Header";
import { StatRow } from "./StatRow";
import { getActiveGames } from "../api";
import { ActiveGamesResponse, EConnectivityTestResult } from "../types";

// Matches the backend's ACTIVE_GAMES_CACHE_TTL_SECONDS, so the panel's
// background poll lands right as the server-side cache entry expires instead
// of hammering a still-cached response.
const ACTIVE_GAMES_POLL_INTERVAL_MS = 60_000;

export function ActiveGamesPage({ onBack }: { onBack: () => void }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<ActiveGamesResponse | null>(null);
  const [connectivity, setConnectivity] = useState(EConnectivityTestResult.Unknown);

  useEffect(() => {
    const registration = SteamClient.System.Network.RegisterForConnectivityTestChanges(
      (test) => setConnectivity(test.eConnectivityTestResult)
    );
    SteamClient.System.Network.ForceTestConnectivity();
    return () => registration.unregister();
  }, []);

  // `background` polls skip the loading/refreshing indicators so the
  // periodic auto-refresh below doesn't flash the "Loading..." state or spin
  // the refresh icon while the panel is just sitting open.
  const fetchStats = useCallback((isRefresh: boolean, background = false) => {
    if (!background) {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
    }
    return getActiveGames(isRefresh)
      .then((result) => {
        setStats(result);
      })
      .finally(() => {
        if (!background) {
          setLoading(false);
          setRefreshing(false);
        }
      });
  }, []);

  useEffect(() => {
    fetchStats(false);
  }, [fetchStats]);

  // Keeps the panel's numbers current while it's left open, rather than only
  // refreshing on mount (i.e. reopening the QAM sidemenu).
  useEffect(() => {
    const interval = setInterval(() => {
      fetchStats(false, true);
    }, ACTIVE_GAMES_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const handleRefresh = useCallback(() => {
    fetchStats(true);
  }, [fetchStats]);

  if (loading) {
    return (
      <PanelSection>
        <Header title="Active Games" onBack={onBack} refreshing={refreshing} onRefresh={handleRefresh} />
        <PanelSectionRow>
          <div>Loading Insignia stats...</div>
        </PanelSectionRow>
      </PanelSection>
    );
  }

  if (!stats || stats.error) {
    const offline =
      connectivity !== EConnectivityTestResult.Unknown &&
      connectivity !== EConnectivityTestResult.Connected;
    const message = offline
      ? "No internet connection. Check your wifi."
      : "Could not load stats. Insignia service may be unreachable.";

    return (
      <PanelSection>
        <Header title="Active Games" onBack={onBack} refreshing={refreshing} onRefresh={handleRefresh} />
        <PanelSectionRow>
          <div>{message}</div>
        </PanelSectionRow>
      </PanelSection>
    );
  }

  const games = stats.games ?? [];
  const total = stats.total ?? 0;

  if (games.length === 0 && total === 0) {
    return (
      <PanelSection>
        <Header title="Active Games" onBack={onBack} refreshing={refreshing} onRefresh={handleRefresh} />
        <PanelSectionRow>
          <div>No active lobbies right now.</div>
        </PanelSectionRow>
      </PanelSection>
    );
  }

  return (
    <PanelSection>
      <Header title="Active Games" onBack={onBack} refreshing={refreshing} onRefresh={handleRefresh} />
      {games.length > 0 ? (
        games.map((game) => (
          <StatRow key={game.name} label={game.name} value={game.players} />
        ))
      ) : (
        <StatRow label="Total Active Players" value={total} />
      )}
    </PanelSection>
  );
}
