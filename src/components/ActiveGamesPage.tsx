import { PanelSection, PanelSectionRow } from "@decky/ui";
import { Header } from "./Header";
import { StatRow } from "./StatRow";
import { getActiveGames } from "../api";
import { useIsOnline } from "../hooks/useIsOnline";
import { useRefreshableData } from "../hooks/useRefreshableData";

// Matches the backend's ACTIVE_GAMES_CACHE_TTL_SECONDS, so the panel's
// background poll lands right as the server-side cache entry expires instead
// of hammering a still-cached response. Keeps the panel's numbers current
// while it's left open, rather than only refreshing on mount (i.e.
// reopening the QAM sidemenu).
const ACTIVE_GAMES_POLL_INTERVAL_MS = 60_000;

export function ActiveGamesPage({ onBack }: { onBack: () => void }) {
  const { data: stats, loading, refreshing, refresh } = useRefreshableData(getActiveGames, ACTIVE_GAMES_POLL_INTERVAL_MS);
  const isOnline = useIsOnline();

  if (loading) {
    return (
      <PanelSection>
        <Header title="Active Games" onBack={onBack} refreshing={refreshing} onRefresh={refresh} />
        <PanelSectionRow>
          <div>Loading Insignia stats...</div>
        </PanelSectionRow>
      </PanelSection>
    );
  }

  if (!stats || stats.error) {
    const message = isOnline
      ? "Could not load stats. Insignia service may be unreachable."
      : "No internet connection. Check your wifi.";

    return (
      <PanelSection>
        <Header title="Active Games" onBack={onBack} refreshing={refreshing} onRefresh={refresh} />
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
        <Header title="Active Games" onBack={onBack} refreshing={refreshing} onRefresh={refresh} />
        <PanelSectionRow>
          <div>No active lobbies right now.</div>
        </PanelSectionRow>
      </PanelSection>
    );
  }

  return (
    <PanelSection>
      <Header title="Active Games" onBack={onBack} refreshing={refreshing} onRefresh={refresh} />
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
