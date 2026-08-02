import { afterPatch, useParams } from "@decky/ui";
import { useEffect, useState, useRef } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import { InsigniaIcon } from "../components/InsigniaIcon";
import { getGameOnlineCount } from "../api";
import { xboxRomAppIdSet, loadXboxRomAppIds } from "../state/xboxRomIds";
import { findMatchingInsigniaGame } from "../game-data/gameMatching";
import { playcountBadgeEnabled } from "../state/settingsState";
import { useIsOnline } from "../hooks/useIsOnline";

// Position/size/color matched to the "X Online" player-count badge another
// installed plugin renders in the same top-right spot on this page, so
// Insignia's badge reads as part of the same family of pills rather than a
// one-off.
const LIBRARY_BADGE_WRAPPER_STYLE: CSSProperties = {
  position: "absolute",
  top: "50px",
  right: "20px",
  zIndex: 1000,
};

const LIBRARY_BADGE_PILL_STYLE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  // The reference badge's width comes from its "0 Online" text; ours only
  // shows a bare count, so it needs an explicit min-width to actually match
  // that badge's footprint instead of shrink-wrapping to its shorter content.
  minWidth: "84px",
  padding: "4px 8px",
  backgroundColor: "rgb(75, 158, 234)",
  borderRadius: "12px",
  fontSize: "12px",
  color: "rgb(255, 255, 255)",
  boxShadow: "rgba(0, 0, 0, 0.2) 0px 2px 4px",
  border: "none",
  pointerEvents: "none",
};

const LIBRARY_BADGE_ICON_STYLE: CSSProperties = {
  display: "flex",
  alignItems: "center",
  marginRight: "6px",
  fontSize: "14px",
  color: "#4CAF50",
  filter: "drop-shadow(rgba(76, 175, 80, 0.5) 0px 0px 2px)",
};

// patchLibraryApp wraps the page's own rendered root in a position:relative
// div spanning the full (non-scrolling) viewport -- the page's hero banner
// and details actually live inside an internal scroll container nested
// somewhere below that root, so a badge positioned absolute against the
// outer wrapper stays pinned to the screen instead of scrolling away with the
// hero underneath it. This walks the page root's descendants for the element
// Steam is actually scrolling (has more content than fits, per its computed
// overflow-y), so the badge can be anchored inside *that* instead.
function findLibraryScrollContainer(root: HTMLElement): HTMLElement | null {
  // This route patch's closure is defined in decky's own injected JS context,
  // not the Steam window the patched route actually renders into -- bare
  // `getComputedStyle` here would resolve to that wrong window's version and
  // silently return empty/useless styles for a foreign-document element, so
  // this goes through the element's own view instead (same reasoning as
  // scanAndBadgeTiles's use of findSP()'s window rather than the bare global).
  const view = root.ownerDocument.defaultView;
  if (!view) return null;
  const candidates = root.querySelectorAll<HTMLElement>("*");
  for (const el of Array.from(candidates)) {
    const style = view.getComputedStyle(el);
    if (/(auto|scroll|overlay)/.test(style.overflowY) && el.scrollHeight - el.clientHeight > 10) {
      return el;
    }
  }
  return null;
}

// Being an Xbox ROM shortcut is necessary but not sufficient: Insignia only
// serves stats for a subset of Xbox Live-enabled titles (INSIGNIA_GAMES), so
// the badge also requires the app's actual display name to fuzzy-match one of
// those. xboxRomAppIdSet is normally populated by visiting the home page
// first (see loadXboxRomAppIds), but a user can land here directly via
// search/collections/back-navigation, so this also kicks off its own load and
// re-renders once that resolves.
function LibraryPlaycountBadge() {
  const { appid } = useParams<{ appid: string }>();
  const [xboxEligible, setXboxEligible] = useState(() => !!appid && !!xboxRomAppIdSet?.has(appid));

  useEffect(() => {
    if (xboxRomAppIdSet) {
      setXboxEligible(!!appid && xboxRomAppIdSet.has(appid));
      return;
    }
    let cancelled = false;
    loadXboxRomAppIds().then(() => {
      if (!cancelled) setXboxEligible(!!appid && !!xboxRomAppIdSet?.has(appid));
    });
    return () => {
      cancelled = true;
    };
  }, [appid]);

  // The app's overview (and thus its display name) is expected to already be
  // loaded here, since this component only renders while that app's own
  // library page is on screen -- unlike home page tiles, which are frequently
  // unvisited and so come back null (see getXboxRomAppIds' comment above).
  const displayName = appid ? window.appStore.GetAppOverviewByAppID(Number(appid))?.display_name : undefined;
  const insigniaGame = findMatchingInsigniaGame(displayName);

  const [onlineCount, setOnlineCount] = useState<number | null>(null);
  const isOnline = useIsOnline();

  useEffect(() => {
    if (!insigniaGame) {
      setOnlineCount(null);
      return;
    }
    let cancelled = false;
    const fetchCount = () => {
      // Re-checked on every call (not just once per effect run) since the
      // interval below lives for as long as this game's library page stays
      // open, and playcountBadgeEnabled can flip mid-session via
      // SettingsPage's toggle -- no point spending a request (and a 10s
      // backend timeout on a dead connection) on a badge that's hidden or
      // can't reach the network anyway.
      if (!playcountBadgeEnabled || !isOnline) return;
      getGameOnlineCount(insigniaGame.id)
        .then((count) => {
          if (!cancelled) setOnlineCount(count);
        })
        .catch((e) => {
          console.error("Insignia: failed to load online count", e);
        });
    };
    fetchCount();
    // Matches the backend's own 60s cache TTL for this data, so this mostly
    // just picks up whatever the next natural cache refresh produced rather
    // than forcing extra fetches of its own.
    const interval = setInterval(fetchCount, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [insigniaGame?.id, isOnline]);

  // patchLibraryApp's wrapper (see below) contains the page's own rendered
  // content alongside this component -- used below to locate the page's
  // actual scroll container rather than that non-scrolling wrapper itself.
  // Note the page's own render output isn't guaranteed to be a single DOM
  // node (confirmed live it can render as a multi-node fragment), so this
  // walks up to the shared parent rather than assuming a specific sibling.
  const markerRef = useRef<HTMLDivElement>(null);
  const [heroAnchor, setHeroAnchor] = useState<HTMLElement | null>(null);
  const createdAnchorRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let retryTimeout: ReturnType<typeof setTimeout>;
    let attempts = 0;
    const attach = () => {
      if (cancelled) return;
      const pageRoot = markerRef.current?.parentElement as HTMLElement | null;
      const scrollContainer = pageRoot && findLibraryScrollContainer(pageRoot);
      if (!scrollContainer) {
        // The page's own content (and thus its scroll container) may still
        // be mounting right after navigation; Steam-side pages this large
        // and complex don't appear instantly. Give up after a few seconds
        // rather than retrying forever on a page that genuinely never
        // scrolls (its content fits without overflow).
        if (attempts++ < 15) retryTimeout = setTimeout(attach, 200);
        return;
      }
      // Zero-height so it doesn't add visible space to the page; sits at
      // the very top of the scrolled content (i.e. the hero) since it's a
      // normal-flow first child, so an absolutely-positioned badge inside it
      // scrolls away together with the hero instead of staying pinned to
      // the screen.
      const anchor = scrollContainer.ownerDocument.createElement("div");
      anchor.style.position = "relative";
      anchor.style.height = "0px";
      scrollContainer.insertBefore(anchor, scrollContainer.firstChild);
      createdAnchorRef.current = anchor;
      setHeroAnchor(anchor);
    };
    attach();
    return () => {
      cancelled = true;
      clearTimeout(retryTimeout);
      createdAnchorRef.current?.remove();
      createdAnchorRef.current = null;
    };
  }, []);

  const showBadge = playcountBadgeEnabled && xboxEligible && !!insigniaGame;

  return (
    <>
      <div ref={markerRef} style={{ display: "none" }} />
      {showBadge &&
        heroAnchor &&
        createPortal(
          <div style={LIBRARY_BADGE_WRAPPER_STYLE}>
            <div style={LIBRARY_BADGE_PILL_STYLE}>
              <span style={LIBRARY_BADGE_ICON_STYLE}>
                <InsigniaIcon />
              </span>
              <span>{onlineCount ?? 0} Online</span>
            </div>
          </div>,
          heroAnchor
        )}
    </>
  );
}

// Route patch proving out badge placement on a game's library page.
// LibraryPlaycountBadge finds its own DOM anchor by walking up from itself
// to this wrapper (its parent) and searching the page content rendered
// alongside it, so it doesn't matter that this wrapper itself isn't part of
// the page's internal scroll flow -- it only needs to contain that content.
export function patchLibraryApp(route: any) {
  afterPatch(route.children, "type", (_: unknown[], ret: any) => (
    <div style={{ position: "relative", height: "100%" }}>
      {ret}
      <LibraryPlaycountBadge />
    </div>
  ));
  return route;
}
