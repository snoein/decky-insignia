import { PanelSection, PanelSectionRow, DialogButton } from "@decky/ui";
import { FaChevronRight } from "react-icons/fa";

export function MenuPage({
  onNavigateActiveGames,
  onNavigateEvents,
  onNavigateSettings,
}: {
  onNavigateActiveGames: () => void;
  onNavigateEvents: () => void;
  onNavigateSettings: () => void;
}) {
  return (
    <PanelSection>
      <PanelSectionRow>
        <DialogButton
          onClick={onNavigateActiveGames}
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <span>Active Games</span>
          <FaChevronRight />
        </DialogButton>
      </PanelSectionRow>
      <PanelSectionRow>
        <DialogButton
          onClick={onNavigateEvents}
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <span>Events</span>
          <FaChevronRight />
        </DialogButton>
      </PanelSectionRow>
      <PanelSectionRow>
        <DialogButton
          onClick={onNavigateSettings}
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <span>Settings</span>
          <FaChevronRight />
        </DialogButton>
      </PanelSectionRow>
    </PanelSection>
  );
}
