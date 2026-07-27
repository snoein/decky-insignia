// Read by patchLibraryApp, which runs outside React's render cycle (it's a
// route patch, not a component) and so can't read settings via useState.
// Seeded from the backend on plugin load and kept in sync by SettingsPage's
// toggle; defaults to enabled so the badge shows up before that initial load
// resolves.
export let playcountBadgeEnabled = true;

export function setPlaycountBadgeEnabled(enabled: boolean) {
  playcountBadgeEnabled = enabled;
}

// Read by scanAndBadgeTiles, which runs on a setInterval/MutationObserver
// outside React's render cycle and so can't read settings via useState.
// Seeded from the backend on plugin load and kept in sync by SettingsPage's
// toggle. Defaults to disabled (unlike playcountBadgeEnabled) since the
// poster overlay is more visually intrusive; matches DEFAULT_SETTINGS in
// main.py, which is what actually governs first-run behavior once the
// backend value loads.
export let tileBadgeEnabled = false;

export function setTileBadgeEnabled(enabled: boolean) {
  tileBadgeEnabled = enabled;
}
