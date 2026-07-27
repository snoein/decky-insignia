import { PanelSection, PanelSectionRow, DialogButton, ModalRoot, showModal } from "@decky/ui";
import { useCallback } from "react";
import { FaTimes } from "react-icons/fa";
import { Header, ICON_BUTTON_STYLE } from "./Header";
import { getUpcomingEvents } from "../api";
import { InsigniaEvent } from "../types";
import { useIs24HourClock } from "../hooks/useIs24HourClock";
import { useIsOnline } from "../hooks/useIsOnline";
import { useRefreshableData } from "../hooks/useRefreshableData";

// `new Date(iso)` plus Intl.DateTimeFormat with no explicit locale/timeZone
// both default to the system's -- this is what actually satisfies "translate
// to system timezone", no manual offset math needed.
function formatEventDateTime(iso: string, is24Hour: boolean | null): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: is24Hour === null ? undefined : !is24Hour,
  }).format(new Date(iso));
}

// Built on ModalRoot rather than ConfirmModal: ConfirmModal always renders
// its own OK/Cancel button row at the bottom with no prop to remove it, but
// we want a single close affordance top-right instead. ModalRoot is the
// lower-level primitive ConfirmModal itself is built on (confirmed live: its
// runtime lookup is keyed off "Either closeModal or onCancel should be
// passed to GenericDialog"), giving full control over the button while
// keeping the standard dialog box/backdrop chrome.
function EventDetailModal({ event, closeModal }: { event: InsigniaEvent; closeModal?: () => void }) {
  const is24Hour = useIs24HourClock();
  const start = formatEventDateTime(event.startUtc, is24Hour);
  const end = event.endUtc ? formatEventDateTime(event.endUtc, is24Hour) : null;

  return (
    <ModalRoot onCancel={closeModal} bHideCloseIcon>
      <div style={{ position: "relative" }}>
        <DialogButton
          onClick={closeModal}
          style={{ ...ICON_BUTTON_STYLE, position: "absolute", top: 0, right: 0 }}
        >
          <FaTimes />
        </DialogButton>
        <div style={{ fontWeight: "bold", fontSize: "1.2em", paddingRight: "36px", marginBottom: "12px" }}>
          {event.title}
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
          {event.image && (
            <img
              src={event.image}
              style={{
                width: "35%",
                maxHeight: "80vh",
                objectFit: "contain",
                borderRadius: "8px",
                flexShrink: 0,
              }}
            />
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", minWidth: 0 }}>
            <div style={{ fontWeight: "bold" }}>{event.game}</div>
            <div>{end ? `${start} – ${end}` : start}</div>
            {event.description && <div style={{ whiteSpace: "pre-wrap" }}>{event.description}</div>}
            {event.hasPrize && (
              <div>Prize{event.prizeAmount != null ? `: ${event.prizeAmount}` : ""}</div>
            )}
            {event.isPaidEvent && event.entryFeeSats != null && (
              <div>Entry fee: {event.entryFeeSats} sats</div>
            )}
            {event.tournamentStatus && (
              <div>
                Tournament status: {event.tournamentStatus}
                {typeof event.signupCount === "number" ? ` (${event.signupCount} signed up)` : ""}
              </div>
            )}
          </div>
        </div>
      </div>
    </ModalRoot>
  );
}

function EventRow({ event }: { event: InsigniaEvent }) {
  const is24Hour = useIs24HourClock();
  const handleOpen = useCallback(() => {
    showModal(<EventDetailModal event={event} />);
  }, [event]);

  return (
    <PanelSectionRow>
      <DialogButton
        onClick={handleOpen}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: "2px",
          width: "100%",
          textAlign: "left",
        }}
      >
        <span style={{ fontWeight: "bold", width: "100%", textAlign: "left" }}>{event.game}</span>
        <span style={{ width: "100%", textAlign: "left" }}>{event.title}</span>
        <span style={{ opacity: 0.7, fontSize: "12px", width: "100%", textAlign: "left" }}>
          {formatEventDateTime(event.startUtc, is24Hour)}
        </span>
      </DialogButton>
    </PanelSectionRow>
  );
}

export function EventsPage({ onBack }: { onBack: () => void }) {
  // Events don't change minute-to-minute like live player counts, so unlike
  // ActiveGamesPage this only fetches on mount plus an explicit refresh --
  // no background polling interval.
  const { data: eventsResponse, loading, refreshing, refresh } = useRefreshableData(getUpcomingEvents);
  const isOnline = useIsOnline();

  if (loading) {
    return (
      <PanelSection>
        <Header title="Events" onBack={onBack} refreshing={refreshing} onRefresh={refresh} />
        <PanelSectionRow>
          <div>Loading Insignia events...</div>
        </PanelSectionRow>
      </PanelSection>
    );
  }

  if (!eventsResponse || eventsResponse.error) {
    const message = isOnline
      ? "Could not load events. Insignia service may be unreachable."
      : "No internet connection. Check your wifi.";

    return (
      <PanelSection>
        <Header title="Events" onBack={onBack} refreshing={refreshing} onRefresh={refresh} />
        <PanelSectionRow>
          <div>{message}</div>
        </PanelSectionRow>
      </PanelSection>
    );
  }

  const events = eventsResponse.events ?? [];

  if (events.length === 0) {
    return (
      <PanelSection>
        <Header title="Events" onBack={onBack} refreshing={refreshing} onRefresh={refresh} />
        <PanelSectionRow>
          <div>No events in the next 14 days.</div>
        </PanelSectionRow>
      </PanelSection>
    );
  }

  return (
    <PanelSection>
      <Header title="Events" onBack={onBack} refreshing={refreshing} onRefresh={refresh} />
      {events.map((event) => (
        <EventRow key={event.id} event={event} />
      ))}
    </PanelSection>
  );
}
