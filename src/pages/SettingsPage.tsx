import { PanelSection, PanelSectionRow, ToggleField } from "@decky/ui";
import { useState, useCallback } from "react";
import { Header } from "../components/Header";
import { playcountBadgeEnabled, tileBadgeEnabled, setPlaycountBadgeEnabled, setTileBadgeEnabled } from "../settingsState";
import { setPlaycountBadgeEnabledBackend, setTileBadgeEnabledBackend } from "../api";
import { scanAndBadgeTiles } from "../patches/libraryHome";

export function SettingsPage({ onBack }: { onBack: () => void }) {
  const [enabled, setEnabled] = useState(playcountBadgeEnabled);
  const [tileEnabled, setTileEnabled] = useState(tileBadgeEnabled);

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
  );
}
