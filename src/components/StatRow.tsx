import { PanelSectionRow, Focusable } from "@decky/ui";

// Number of trailing characters kept fully visible so that names differing only
// by a suffix (year, sequel numeral, edition) don't collapse into identical text
// once truncated, e.g. "...Snooker 2003" vs "...Snooker 2004".
const NAME_TAIL_LENGTH = 8;

export function StatRow({ label, value }: { label: string; value: number | string }) {
  const splitAt = Math.max(0, label.length - NAME_TAIL_LENGTH);
  const head = label.slice(0, splitAt);
  const tail = label.slice(splitAt);

  return (
    <PanelSectionRow>
      <Focusable style={{ display: "flex", justifyContent: "space-between", width: "100%", gap: "8px" }}>
        <div title={label} style={{ display: "flex", minWidth: 0, overflow: "hidden" }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
            {head}
          </span>
          <span style={{ whiteSpace: "nowrap", flexShrink: 0 }}>{tail}</span>
        </div>
        <span style={{ fontWeight: "bold", flexShrink: 0 }}>{value}</span>
      </Focusable>
    </PanelSectionRow>
  );
}
