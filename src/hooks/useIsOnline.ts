import { useEffect, useState } from "react";
import { EConnectivityTestResult } from "../types";

// navigator.onLine only reflects whether the OS has *some* network interface
// up -- it stays true on a Wi-Fi with no real internet (captive portal, dead
// upstream). SteamClient's own connectivity test is what Steam itself uses to
// know if it's really reachable, so this uses that instead.
//
// Treated as online unless a test has actually come back bad: Unknown is the
// state before the first ForceTestConnectivity result lands, and defaulting
// it to "offline" would skip callers' very first fetch just because that
// result hasn't arrived yet.
export function useIsOnline(): boolean {
  const [connectivity, setConnectivity] = useState(EConnectivityTestResult.Unknown);

  useEffect(() => {
    const registration = SteamClient.System.Network.RegisterForConnectivityTestChanges(
      (test) => setConnectivity(test.eConnectivityTestResult)
    );
    SteamClient.System.Network.ForceTestConnectivity();
    return () => registration.unregister();
  }, []);

  return connectivity === EConnectivityTestResult.Unknown || connectivity === EConnectivityTestResult.Connected;
}
