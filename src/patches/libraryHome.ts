import { findSP } from "@decky/ui";
import { xboxRomAppIdSet, loadXboxRomAppIds } from "../state/xboxRomIds";
import { findMatchingInsigniaGame } from "../game-data/gameMatching";
import { tileBadgeEnabled } from "../state/settingsState";

const TILE_BADGE_CLASS = "insignia-tile-badge";
const TILE_BADGE_STYLE_TAG_ID = "insignia-tile-badge-styles";

// A poster's rendered width varies enormously between contexts sharing this
// same scan (a home-shelf hero tile measured live at ~442px vs. a narrower
// tile elsewhere at ~134px), so a single fixed badge size reads fine in one
// and comically large in the other. Scaling as a fraction of the poster's
// own width (see computeBadgeSize), clamped to this range, keeps it looking
// like the same badge everywhere on the biggest tiles, without shrinking
// below legibility on the smallest.
const TILE_BADGE_MIN_SIZE = 21;
const TILE_BADGE_MAX_SIZE = 42;
const TILE_BADGE_SIZE_RATIO = 0.195;

function computeBadgeSize(posterWidth: number): number {
  return Math.round(Math.min(TILE_BADGE_MAX_SIZE, Math.max(TILE_BADGE_MIN_SIZE, posterWidth * TILE_BADGE_SIZE_RATIO)));
}

// The badge's circular fill color -- no separate border ring on top of it;
// the icon's own artwork already leaves whitespace around its silhouette,
// so that fill alone reads as a clean circle without needing an outline.
// rgb(14, 20, 27), fully opaque, is the exact fill Steam's own tile
// status-icon pill uses (measured live via devtools) -- it isn't a tinted
// semi-transparent color there, so matching it needs full opacity too.
const TILE_BADGE_COLOR = "rgb(14, 20, 27)";

const TILE_BADGE_STYLE = {
  position: "absolute",
  // Matches decky-nonsteam-badges' own bottom-left placement (4px inset) on
  // the same tiles, so both badges read as the same family of corner pills.
  // Width/height aren't set here -- they're computed per-tile at creation
  // time from the poster's own rendered size (see computeBadgeSize above).
  bottom: "4px",
  left: "4px",
  borderRadius: "50%",
  backgroundColor: TILE_BADGE_COLOR,
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 50,
  pointerEvents: "none",
} as const;

// Hidden by default and only faded in while its tile is hovered/focused.
// This has to live in a real stylesheet rather than the badge's inline style
// (TILE_BADGE_STYLE above) since inline styles can't express a :hover/
// :focus-within rule -- and it's keyed off the tile ancestor, not the badge
// itself, so pointer-events: none on the badge doesn't stop it from
// matching. `.gpfocuswithin` is the class Steam's own UI toggles on a tile
// while it has gamepad focus (confirmed live in devtools); :focus-within
// alone also happens to work since Steam moves real DOM focus along with
// it, but keeping both means a badge doesn't just depend on that overlap.
function ensureTileBadgeStyles(doc: Document) {
  if (doc.getElementById(TILE_BADGE_STYLE_TAG_ID)) return;
  const style = doc.createElement("style");
  style.id = TILE_BADGE_STYLE_TAG_ID;
  style.textContent = `
    .${TILE_BADGE_CLASS} {
      opacity: 0;
      transition: opacity 0.15s ease;
    }
    div[role="listitem"]:hover .${TILE_BADGE_CLASS},
    div[role="listitem"]:focus-within .${TILE_BADGE_CLASS},
    div[role="listitem"].gpfocuswithin .${TILE_BADGE_CLASS},
    div[role="gridcell"]:hover .${TILE_BADGE_CLASS},
    div[role="gridcell"]:focus-within .${TILE_BADGE_CLASS},
    div[role="gridcell"].gpfocuswithin .${TILE_BADGE_CLASS} {
      opacity: 1;
    }
  `;
  doc.head.appendChild(style);
}

// The official Insignia logo (https://insignia.live/img/logo.svg), inlined
// as a markup string rather than rendered via React: tile badges are
// stamped directly onto raw DOM nodes found by scanAndBadgeTiles, outside
// the plugin's React tree. Unlike InsigniaIcon (the monochrome mark kept for
// the QAM entry itself), this is full-color and self-contained, so it's
// used wherever the badge needs to read as "the Insignia logo" rather than
// a single-color glyph matching surrounding text.
function tileBadgeIconMarkup(size: number): string {
  return `<svg viewBox="0 0 612 792" width="${size}" height="${size}">
    <path fill="#98C8FF" d="M307.395 693.432a45.12 45.12 0 0 1-22.301-5.909L65.683 562.482c-15.106-8.607-24.492-24.758-24.492-42.148V274.249c0-17.329 9.336-33.452 24.363-42.075l218.123-127.576a45.17 45.17 0 0 1 22.51-6.028 45.085 45.085 0 0 1 22.444 5.991L546.473 229.79c15.01 8.63 24.333 24.743 24.333 42.061v248.606c0 17.286-9.303 33.392-24.278 42.025L329.892 687.41a45.074 45.074 0 0 1-22.497 6.022z" />
    <path fill="#0A0E13" d="M540.324 551.723 323.69 676.651a32.618 32.618 0 0 1-32.444.083L71.833 551.693a36.09 36.09 0 0 1-18.223-31.359V274.249a36.087 36.087 0 0 1 18.127-31.304l218.209-127.627a32.619 32.619 0 0 1 32.493.013l217.842 125.23a36.095 36.095 0 0 1 18.106 31.291V520.46a36.085 36.085 0 0 1-18.063 31.263z" />
    <g fill="#11171F">
      <path d="M558.389 368.111V344.65H53.612v23.461h80.147v71.392H53.612v23.461h175.001v144.214H169.2l41.166 23.462h29.973c3.088 0 6.111-1.252 8.296-3.438s3.437-5.205 3.437-8.296V451.233c0-3.091-1.252-6.11-3.437-8.296a11.806 11.806 0 0 0-8.296-3.436H157.22V368.11h305.599v71.392h-81.687a11.806 11.806 0 0 0-8.296 3.436 11.805 11.805 0 0 0-3.438 8.296V618.91c0 3.088 1.252 6.111 3.438 8.296a11.804 11.804 0 0 0 8.296 3.438h22.341l40.683-23.461h-51.295V462.967H558.393v-23.461h-72.109v-71.392h72.106l-.001-.003zM213.661 270.041h190.753c3.089 0 6.111-1.251 8.297-3.436a11.81 11.81 0 0 0 3.437-8.296v-89.113l-23.461-13.488v90.872H225.391v-93.504l-23.462 13.721v91.514c0 3.088 1.252 6.109 3.438 8.296a11.808 11.808 0 0 0 8.294 3.434z" />
    </g>
    <path fill="#2A71C9" d="M281.924 170.05h49.898v459.876h-49.898z" />
  </svg>`;
}

function extractAppIdFromImageSrc(src: string | null): string | null {
  if (!src) return null;

  let match = src.match(/\/assets\/(\d+)\//);
  if (match) return match[1];

  match = src.match(/\/customimages\/(\d+)p?\.(jpg|jpeg|png|webp)/i);
  if (match) return match[1];

  match = src.match(/rungameid\/(\d+)/i);
  if (match) return match[1];

  match = src.match(/\/(\d{6,})([p._-]?[a-z]*\.(jpg|png|webp))?/i);
  if (match) return match[1];

  return null;
}

// Home page tiles are a virtualized carousel with no per-tile route to patch
// (unlike patchLibraryApp), so there's no component prop we're handed
// directly. Tile DOM nodes also get recycled between different games as the
// carousel scrolls, so the appid has to be re-derived from live DOM state on
// every scan rather than cached once per node. This mirrors the fallback
// chain other decky library-badge plugins (e.g. decky-nonsteam-badges) use
// in production: a data attribute, then image URL patterns, then an anchor
// href, then React fiber props as a last resort, since chasing this Steam
// version's internal carousel component props directly is far more brittle.
function getTileAppId(tile: Element): string | null {
  const dataId = tile.getAttribute("data-id");
  if (dataId && !dataId.startsWith("placeholder")) return dataId;

  const imageAppId = extractAppIdFromImageSrc(tile.querySelector("img")?.getAttribute("src") ?? null);
  if (imageAppId) return imageAppId;

  const anchor = tile.tagName.toLowerCase() === "a" ? tile : tile.querySelector("a");
  const href = anchor?.getAttribute("href");
  if (href) {
    const match =
      href.match(/\/app\/(\d+)/i) || href.match(/\/details\/(\d+)/i) || href.match(/run\/(\d+)/i);
    if (match) return match[1];
  }

  try {
    for (const el of [tile, ...Array.from(tile.children)]) {
      const fiberKey = Object.keys(el).find(
        (key) => key.startsWith("__reactFiber$") || key.startsWith("__reactInternalInstance$")
      );
      if (!fiberKey) continue;

      let fiber = (el as any)[fiberKey];
      for (let depth = 0; fiber && depth < 5; depth++, fiber = fiber.return) {
        const props = fiber.memoizedProps || fiber.return?.memoizedProps;
        const id =
          props?.appid ??
          props?.appId ??
          props?.unAppID ??
          props?.nAppID ??
          props?.m_unAppID ??
          props?.overview?.appid ??
          props?.appOverview?.appid ??
          props?.app?.appid ??
          props?.game?.appid ??
          props?.item?.appid;
        if (id) return String(id);
      }
    }
  } catch {
    // React internals aren't a stable API; fall through to "unknown" below.
  }

  return null;
}

// Both view roles wrap the poster <img> in its own container that tightly
// bounds the artwork -- confirmed live across many tiles and focus states
// that this wrapper's rendered rect is always identical to the <img>'s own,
// pixel for pixel. (An earlier version of this walked further up looking
// for an ancestor with an inline `position: relative` style, matching how
// decky-nonsteam-badges anchors its own badge -- but that inline style
// never actually appears on this Steam version, so it always fell through
// to the tile/gridcell element instead. That element is considerably
// bigger than the poster itself -- it also covers the title-text row below
// the art in list view -- so a corner inset like "bottom: 4px; left: 4px"
// against it lands below the visible poster rather than in its corner.)
// The wrapper already has its own position: absolute (from a CSS class, not
// an inline style), which works just as well as position: relative as a
// positioning context for our absolutely-positioned badge.
function getBadgeTargetElement(tile: HTMLElement): HTMLElement {
  const img = tile.querySelector("img") as HTMLElement | null;
  if (img?.parentElement) return img.parentElement;
  if (tile.getAttribute("role") === "gridcell") {
    return (tile.firstElementChild as HTMLElement) ?? tile;
  }
  return tile;
}

let tileObserver: MutationObserver | null = null;
let tileScanInterval: ReturnType<typeof setInterval> | null = null;

// This Steam version renders home/library tiles as role="listitem" in
// shelf/carousel views and role="gridcell" in grid views, with no shared
// wrapper class to scope the query to (the ReactVirtualized classes this
// selector used to require no longer exist in either view).
const TILE_SELECTOR = 'div[role="listitem"], div[role="gridcell"]';

// node.nodeType === 1 (Node.ELEMENT_NODE) rather than `instanceof
// HTMLElement`: mutation records come from win's document, a different
// window context than this closure's, and instanceof against the wrong
// window's HTMLElement silently returns false for its elements.
function collectTiles(node: Node): HTMLElement[] {
  if (node.nodeType !== 1) return [];
  const el = node as HTMLElement;
  const tiles = Array.from(el.querySelectorAll<HTMLElement>(TILE_SELECTOR));
  if (el.matches(TILE_SELECTOR)) tiles.push(el);
  return tiles;
}

// Scans `tiles` if given, otherwise every tile in the document. Callers that
// already know which tiles changed (the MutationObserver below) pass that
// narrower set so a scan doesn't cost a full-document requery plus per-tile
// work (getComputedStyle, fiber walk, fuzzy name match) for every tile on
// screen -- see startTileBadging for why that matters while scrolling.
export function scanAndBadgeTiles(tiles?: Iterable<HTMLElement>) {
  const win = findSP() as any;
  if (!win) return;

  ensureTileBadgeStyles(win.document);

  let tileList: HTMLElement[];
  if (tiles) {
    tileList = Array.from(tiles);
  } else {
    const allTiles: NodeListOf<HTMLElement> = win.document.querySelectorAll(TILE_SELECTOR);
    tileList = Array.from(allTiles);
  }
  tileList.forEach((tile) => {
    const target = getBadgeTargetElement(tile);
    // Scoped to the whole tile, not just the current target: getBadgeTargetElement
    // falls back to the tile itself when a tile's <img> hasn't mounted yet, so an
    // early scan can badge that fallback before a later scan finds the real image
    // wrapper. Scoping the lookup to `target` alone would miss a badge left behind
    // on that earlier, wrong target, producing a duplicate badge per tile.
    const existingBadge = tile.querySelector(`.${TILE_BADGE_CLASS}`);
    const appId = getTileAppId(tile);
    // Being an Xbox ROM shortcut is necessary but not sufficient (see
    // LibraryPlaycountBadge above) -- Insignia only serves stats for titles in
    // INSIGNIA_GAMES. xboxRomAppIdSet.has() is a cheap Set lookup, so it's
    // checked first via && short-circuiting to skip the display-name lookup
    // and O(INSIGNIA_GAMES.length) fuzzy match entirely for the vast majority
    // of tiles that aren't Xbox shortcuts at all. Uses the global window's
    // appStore, not win's (findSP()'s window doesn't have one -- confirmed
    // live it's undefined there, which would throw and abort this whole
    // forEach); the global one has full overviews (incl. display_name) for
    // every shortcut regardless of whether it's been individually visited.
    const eligible =
      tileBadgeEnabled &&
      !!appId &&
      !!xboxRomAppIdSet?.has(appId) &&
      !!findMatchingInsigniaGame(window.appStore.GetAppOverviewByAppID(Number(appId))?.display_name);

    // Tiles are recycled by the virtualized carousel, so a badge left over
    // from a previous (Xbox-compatible) game shown in this same DOM node
    // must be cleared once the node is reused for a non-matching game.
    if (!eligible) {
      existingBadge?.remove();
      return;
    }
    if (existingBadge) {
      if (existingBadge.parentElement !== target) {
        existingBadge.remove();
      } else {
        return;
      }
    }

    if (win.getComputedStyle(target).position === "static") {
      target.style.position = "relative";
    }
    const badgeSize = computeBadgeSize(target.getBoundingClientRect().width);
    const badge = win.document.createElement("div");
    badge.className = TILE_BADGE_CLASS;
    Object.assign(badge.style, TILE_BADGE_STYLE, { width: `${badgeSize}px`, height: `${badgeSize}px` });
    // No border to leave room for anymore -- the logo's own artwork already
    // has whitespace around its silhouette within its viewBox, so filling
    // the whole circle with it still reads as a badge with breathing room.
    badge.innerHTML = tileBadgeIconMarkup(badgeSize);
    target.appendChild(badge);
  });
}

function startTileBadging() {
  const win = findSP();
  if (!win) {
    setTimeout(startTileBadging, 1000);
    return;
  }

  // patchLibraryHome fires this on every navigation to /library/home, not
  // just the first. Without disconnecting/clearing whatever's already
  // running first, each re-entry orphans another MutationObserver + interval
  // that keeps firing forever -- they stack silently and each one adds more
  // scanAndBadgeTiles work on every DOM mutation, which is enough duplicated
  // load to peg the UI thread.
  tileObserver?.disconnect();
  if (tileScanInterval) {
    clearInterval(tileScanInterval);
  }

  loadXboxRomAppIds().then(() => scanAndBadgeTiles());
  scanAndBadgeTiles();
  // Scoped to just the tiles added in these mutations, not a full-document
  // rescan: Steam's home page is a virtualized carousel/grid, so scrolling
  // constantly adds/removes tile DOM nodes elsewhere on the page, each of
  // which used to retrigger scanAndBadgeTiles' full querySelectorAll +
  // per-tile work (getComputedStyle, fiber walk, fuzzy name match) right as
  // the browser was trying to lay out and paint the scroll -- enough main
  // thread work to visibly jank scrolling. A tile recycled in place (same
  // node, new game, only its attributes/text changed) doesn't fire a
  // childList mutation on the tile itself, so it isn't caught here; the
  // interval below is what still picks those up.
  tileObserver = new MutationObserver((mutations) => {
    const addedTiles = new Set<HTMLElement>();
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        collectTiles(node).forEach((tile) => addedTiles.add(tile));
      });
    }
    if (addedTiles.size > 0) scanAndBadgeTiles(addedTiles);
  });
  tileObserver.observe(win.document.body, { childList: true, subtree: true });
  tileScanInterval = setInterval(() => scanAndBadgeTiles(), 2000);
}

export function stopTileBadging() {
  tileObserver?.disconnect();
  tileObserver = null;
  if (tileScanInterval) {
    clearInterval(tileScanInterval);
    tileScanInterval = null;
  }
  const win = findSP();
  win?.document.querySelectorAll(`.${TILE_BADGE_CLASS}`).forEach((el: Element) => el.remove());
  win?.document.getElementById(TILE_BADGE_STYLE_TAG_ID)?.remove();
}

// Signal-only patch: the route firing just tells us the home page mounted,
// the actual badge placement happens in the DOM scan above.
export function patchLibraryHome(route: any) {
  setTimeout(startTileBadging, 50);
  return route;
}
