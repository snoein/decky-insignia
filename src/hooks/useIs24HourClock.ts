import { useEffect, useState } from "react";

// There's no separate "system clock format" SteamClient API -- confirmed
// live via CDP against a real Deck's internal settingsStore that the only
// 24-hour-clock flag anywhere is FriendSettings' b24HourClock (Steam stores
// it as a chat-timestamp setting, but reuses the same preference for its own
// clock displays elsewhere, and it's already populated with the live value
// by the time that store reads it -- confirming RegisterForSettingsChanges
// fires immediately on registration, not just on later changes).
//
// Exposed as a tiny external store (rather than each component registering
// its own SteamClient listener) because FriendSettings.RegisterForSettingsChanges
// has no unregister handle -- registering more than once per session would
// leak a listener every time a component using it mounts (e.g. every time
// EventDetailModal opens). initUse24HourClock registers the single,
// session-lifetime SteamClient listener once from definePlugin's setup;
// components read the value reactively via the useIs24HourClock hook below.
let current24HourClockValue: boolean | null = null;
const use24HourClockListeners = new Set<(value: boolean | null) => void>();

function setUse24HourClockValue(value: boolean | null) {
  current24HourClockValue = value;
  use24HourClockListeners.forEach((listener) => listener(value));
}

// Call once from definePlugin's setup, not from a component -- see the
// module-level comment above for why this must stay a single, session-lifetime
// registration rather than something each hook instance sets up itself.
export function initUse24HourClock() {
  SteamClient.FriendSettings.RegisterForSettingsChanges((settingsJson: string) => {
    try {
      setUse24HourClockValue(JSON.parse(settingsJson).b24HourClock === 1);
    } catch (e) {
      console.error("Insignia: failed to parse friend settings", e);
    }
  });
}

// Returns null until the first SteamClient callback resolves (see above),
// in which case callers should treat 12h/24h as unknown and fall back to
// locale-based auto-detection instead.
export function useIs24HourClock(): boolean | null {
  const [value, setValue] = useState(current24HourClockValue);

  useEffect(() => {
    // Covers the (rare) case where the SteamClient callback resolved between
    // this component's render and this effect committing.
    setValue(current24HourClockValue);
    use24HourClockListeners.add(setValue);
    return () => {
      use24HourClockListeners.delete(setValue);
    };
  }, []);

  return value;
}
