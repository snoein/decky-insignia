import { INSIGNIA_GAMES, InsigniaGame } from "./insigniaGames";

// Drops parenthesized region/edition qualifiers (e.g. "(NTSC)", "(USA,
// Japan)"), ROM file extensions, and punctuation so names that only differ in
// that kind of formatting still compare equal. The extension strip matters
// for ROM shortcuts specifically: Steam's display name for one is literally
// its filename (e.g. "Halo 2 (USA, Europe) (En,Ja,...).xiso"), and leaving
// ".xiso" in would otherwise dilute the length-coverage ratio nameMatchScore
// uses for short titles enough to drop a real match below threshold.
function normalizeGameName(name: string): string {
  return name
    .replace(/(\.(xiso|iso|xbe))+$/i, "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function levenshteinDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let i = 0; i < rows; i++) dp[i][0] = i;
  for (let j = 0; j < cols; j++) dp[0][j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[a.length][b.length];
}

// Threshold picked to tolerate small wording/formatting drift (e.g. a
// trailing "Demo"/"Trial Version" or a missing subtitle) without matching
// unrelated titles that merely start with the same word.
const FUZZY_NAME_MATCH_THRESHOLD = 0.85;

// Returns a 0-1 similarity score, or null if either name is empty. A plain
// "does either string contain the other" check (with no regard for *how much*
// of the longer one the shorter one covers) would treat "MechAssault" as a
// match for "MechAssault 2 - Lone Wolf" -- a real prefix hit, but on an
// unrelated sequel -- so containment is scored by length-coverage ratio
// rather than auto-accepted, letting a same-length exact match always
// outrank a partial prefix/suffix hit.
function nameMatchScore(a: string, b: string): number | null {
  const normA = normalizeGameName(a);
  const normB = normalizeGameName(b);
  if (!normA || !normB) return null;
  if (normA === normB) return 1;

  if (normA.includes(normB) || normB.includes(normA)) {
    return Math.min(normA.length, normB.length) / Math.max(normA.length, normB.length);
  }

  const distance = levenshteinDistance(normA, normB);
  return 1 - distance / Math.max(normA.length, normB.length);
}

// Picks the *best*-matching entry rather than the first one to clear the
// threshold: titles that share a prefix with a sequel/edition/demo (e.g.
// "Star Wars: Battlefront" / "Star Wars: Battlefront II") would otherwise
// resolve to whichever entry happens to sort first, showing that game's
// online count under the wrong badge.
export function findMatchingInsigniaGame(name: string | null | undefined): InsigniaGame | undefined {
  if (!name) return undefined;

  let best: InsigniaGame | undefined;
  let bestScore = 0;
  for (const game of INSIGNIA_GAMES) {
    const score = nameMatchScore(name, game.name);
    if (score !== null && score >= FUZZY_NAME_MATCH_THRESHOLD && score > bestScore) {
      bestScore = score;
      best = game;
    }
  }
  return best;
}
