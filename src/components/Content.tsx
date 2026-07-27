import { useState, useCallback } from "react";
import { MenuView } from "../types";
import { MenuPage } from "./MenuPage";
import { ActiveGamesPage } from "./ActiveGamesPage";
import { EventsPage } from "./EventsPage";
import { SettingsPage } from "./SettingsPage";

// Opening a modal (e.g. EventDetailModal) unmounts Content -- confirmed
// live: closing the modal previously always landed back on the root menu
// even if you'd drilled into a sub-page first. Persisting the current view
// here (same module-level-variable idiom as playcountBadgeEnabled/
// tileBadgeEnabled) survives that remount, so Content picks back up
// wherever the user left off instead of resetting.
let lastMenuView: MenuView = "menu";

export function Content() {
  const [view, setViewState] = useState<MenuView>(lastMenuView);
  const setView = useCallback((next: MenuView) => {
    lastMenuView = next;
    setViewState(next);
  }, []);

  if (view === "activeGames") {
    return <ActiveGamesPage onBack={() => setView("menu")} />;
  }

  if (view === "events") {
    return <EventsPage onBack={() => setView("menu")} />;
  }

  if (view === "settings") {
    return <SettingsPage onBack={() => setView("menu")} />;
  }

  return (
    <MenuPage
      onNavigateActiveGames={() => setView("activeGames")}
      onNavigateEvents={() => setView("events")}
      onNavigateSettings={() => setView("settings")}
    />
  );
}
