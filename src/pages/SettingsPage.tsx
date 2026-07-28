import { PanelSection, PanelSectionRow, ToggleField } from "@decky/ui";
import { useState, useCallback } from "react";
import { Header } from "../components/Header";
import { playcountBadgeEnabled, tileBadgeEnabled, setPlaycountBadgeEnabled, setTileBadgeEnabled } from "../state/settingsState";
import { setPlaycountBadgeEnabledBackend, setTileBadgeEnabledBackend } from "../api";
import { scanAndBadgeTiles } from "../patches/libraryHome";
import { useIs24HourClock } from "../hooks/useIs24HourClock";

// Same "let Intl auto-detect unless we know better" approach as EventsPage's
// formatEventDateTime -- hour12 only gets forced once the real Steam clock
// setting has resolved.
function formatBuildTime(iso: string, is24Hour: boolean | null): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "short",
    timeStyle: "short",
    hour12: is24Hour === null ? undefined : !is24Hour,
  }).format(new Date(iso));
}

export function SettingsPage({ onBack }: { onBack: () => void }) {
  const [enabled, setEnabled] = useState(playcountBadgeEnabled);
  const [tileEnabled, setTileEnabled] = useState(tileBadgeEnabled);
  const is24Hour = useIs24HourClock();

  const handleChange = useCallback((checked: boolean) => {
    setEnabled(checked);
    setPlaycountBadgeEnabled(checked);
    setPlaycountBadgeEnabledBackend(checked);
  }, []);

  const handleTileChange = useCallback((checked: boolean) => {
    setTileEnabled(checked);
    setTileBadgeEnabled(checked);
    setTileBadgeEnabledBackend(checked);
    // Tile badges are stamped onto raw DOM outside React, so without this
    // the change wouldn't be visible until the next periodic scan/mutation.
    scanAndBadgeTiles();
  }, []);

  return (
    // height: 100% resolves against the QAM sidebar's tab-content wrapper,
    // which has a fixed, explicit height (confirmed live via the CDP method
    // in CLAUDE.md, against the QuickAccess_uid2 target).
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <PanelSection>
        <Header title="Settings" onBack={onBack} />
        <PanelSectionRow>
          <ToggleField
            label="Playcount Badge"
            description="Show the active player count badge on a game's library page."
            checked={enabled}
            onChange={handleChange}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <ToggleField
            label="Poster Icon"
            description="Show the Insignia icon on eligible game posters on the home and library pages."
            checked={tileEnabled}
            onChange={handleTileChange}
          />
        </PanelSectionRow>
      </PanelSection>
      {/* marginTop: auto pins this to the floor rather than trailing right
          after the toggles. PanelSection takes no style prop, so the
          margin goes on a plain wrapper div instead. */}
      <div style={{ marginTop: "auto" }}>
        <PanelSection>
          <PanelSectionRow>
            <div style={{ width: "100%", textAlign: "center", fontSize: "11px", opacity: 0.6 }}>
              v{__APP_VERSION__} · built {formatBuildTime(__BUILD_TIME__, is24Hour)}
            </div>
          </PanelSectionRow>
        </PanelSection>
      </div>
    </div>
  );
}
