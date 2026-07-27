import { findSP } from "@decky/ui";
import { xboxRomAppIdSet, loadXboxRomAppIds } from "../xboxRomIds";
import { findMatchingInsigniaGame } from "../gameMatching";
import { tileBadgeEnabled } from "../settingsState";

const TILE_BADGE_CLASS = "insignia-tile-badge";

const TILE_BADGE_STYLE = {
  position: "absolute",
  // Matches decky-nonsteam-badges' own 4px inset for its bottom-right badge
  // on the same tiles, so both badges read as the same family of corner
  // pills instead of one hugging the edge tighter than the other.
  top: "4px",
  right: "4px",
  width: "16px",
  height: "16px",
  borderRadius: "50%",
  backgroundColor: "#1a9fff",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 50,
  pointerEvents: "none",
} as const;

// Same artwork as InsigniaIcon, inlined as a markup string rather than
// rendered via React: tile badges are stamped directly onto raw DOM nodes
// found by scanAndBadgeTiles, outside the plugin's React tree. The mask id
// is parameterized so each tile's badge gets a unique one -- reusing one id
// across many badges in the same document would make later <mask> elements
// unreachable by reference.
function tileBadgeIconMarkup(maskId: string): string {
  return `<svg viewBox="20 80 572 632" width="10" height="10" fill="currentColor">
    <mask id="${maskId}" maskUnits="userSpaceOnUse">
      <rect x="0" y="0" width="612" height="792" fill="white" />
      <path fill="black" transform="translate(306 396) scale(0.91) translate(-306 -396)" d="M540.324 551.723 323.69 676.651a32.618 32.618 0 0 1-32.444.083L71.833 551.693a36.09 36.09 0 0 1-18.223-31.359V274.249a36.087 36.087 0 0 1 18.127-31.304l218.209-127.627a32.619 32.619 0 0 1 32.493.013l217.842 125.23a36.095 36.095 0 0 1 18.106 31.291V520.46a36.085 36.085 0 0 1-18.063 31.263z" />
    </mask>
    <path mask="url(#${maskId})" d="M307.395 693.432a45.12 45.12 0 0 1-22.301-5.909L65.683 562.482c-15.106-8.607-24.492-24.758-24.492-42.148V274.249c0-17.329 9.336-33.452 24.363-42.075l218.123-127.576a45.17 45.17 0 0 1 22.51-6.028 45.085 45.085 0 0 1 22.444 5.991L546.473 229.79c15.01 8.63 24.333 24.743 24.333 42.061v248.606c0 17.286-9.303 33.392-24.278 42.025L329.892 687.41a45.074 45.074 0 0 1-22.497 6.022z" />
    <path d="M272 195h68v410h-68z" />
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

// Both view roles wrap the poster <img> in a Steam-authored container with
// an inline `position: relative` style that tightly bounds the artwork
// itself -- decky-nonsteam-badges anchors its own tile badge to the same
// container (confirmed live via its shipped source). The tile/gridcell
// element is considerably bigger than that (it also covers the title-text
// row below the art in list view, and hover-scale headroom), so anchoring
// to it instead -- as this used to -- puts percentage-based insets like
// "top: 2px; right: 2px" outside the visible poster rather than in its
// corner. Walk up from the image to find that tight container first, and
// only fall back to the coarser tile-level heuristics if no image (or no
// such ancestor) is found.
function findPosterContainer(tile: HTMLElement, img: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = img.parentElement;
  while (node && node !== tile) {
    if (node.style.position === "relative") return node;
    node = node.parentElement;
  }
  return null;
}

function getBadgeTargetElement(tile: HTMLElement): HTMLElement {
  const img = tile.querySelector("img") as HTMLElement | null;
  if (img) {
    const posterContainer = findPosterContainer(tile, img);
    if (posterContainer) return posterContainer;
  }
  if (tile.getAttribute("role") === "gridcell") {
    return (tile.firstElementChild as HTMLElement) ?? tile;
  }
  return tile;
}

let tileBadgeIdCounter = 0;
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

  let tileList: HTMLElement[];
  if (tiles) {
    tileList = Array.from(tiles);
  } else {
    const allTiles: NodeListOf<HTMLElement> = win.document.querySelectorAll(TILE_SELECTOR);
    tileList = Array.from(allTiles);
  }
  tileList.forEach((tile) => {
    const target = getBadgeTargetElement(tile);
    // Scoped to the whole tile, not just the current target: which element
    // findPosterContainer picks for a given tile can change across scans (the
    // tight poster container only gets its inline `position: relative` once
    // Steam finishes laying out the artwork, so an early scan can fall back
    // to the coarser tile-level target before a later scan finds the right
    // one). Scoping the lookup to `target` alone missed a badge left behind
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
    const badge = win.document.createElement("div");
    badge.className = TILE_BADGE_CLASS;
    Object.assign(badge.style, TILE_BADGE_STYLE);
    badge.innerHTML = tileBadgeIconMarkup(`insignia-tile-badge-ring-${tileBadgeIdCounter++}`);
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
}

// Signal-only patch: the route firing just tells us the home page mounted,
// the actual badge placement happens in the DOM scan above.
export function patchLibraryHome(route: any) {
  setTimeout(startTileBadging, 50);
  return route;
}
