import { PanelSectionRow, Focusable, DialogButton, staticClasses } from "@decky/ui";
import { FaSyncAlt, FaArrowLeft } from "react-icons/fa";
import type { CSSProperties } from "react";

export const ICON_BUTTON_STYLE: CSSProperties = {
  height: "28px",
  width: "28px",
  padding: "0",
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

export function Header({
  title,
  onBack,
  refreshing,
  onRefresh,
}: {
  title: string;
  onBack?: () => void;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  return (
    <PanelSectionRow>
      <style>{"@keyframes insignia-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }"}</style>
      <Focusable style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
          {onBack && (
            <DialogButton onClick={onBack} style={ICON_BUTTON_STYLE}>
              <FaArrowLeft />
            </DialogButton>
          )}
          <span className={staticClasses.PanelSectionTitle} style={{ padding: 0 }}>{title}</span>
        </div>
        {onRefresh && (
          <DialogButton onClick={onRefresh} disabled={refreshing} style={ICON_BUTTON_STYLE}>
            <FaSyncAlt style={refreshing ? { animation: "insignia-spin 1s linear infinite" } : undefined} />
          </DialogButton>
        )}
      </Focusable>
    </PanelSectionRow>
  );
}
