# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Insignia is a [Decky Loader](https://github.com/SteamDeckHomebrew/decky-loader) plugin for the Steam Deck's Quick Access Menu. It fetches live player/lobby stats and events from the Insignia network (`https://insigniastats.live`) and displays them in a QAM panel, and overlays playcount/poster badges on Xbox-ROM game tiles elsewhere in Steam's UI. It was bootstrapped from the decky-plugin-template, so a lot of the surrounding tooling (VSCode tasks) is template scaffolding rather than Insignia-specific code. The template's `backend/` C stub (for plugins needing a compiled native binary, built via a Dockerfile/`entrypoint.sh`) was removed. Insignia's own Python logic still can't live in a directory literally named `backend/`, though — decky's build CLI reserves that exact name and panics (`Backend directory found, but no Dockerfile or entrypoint.sh`) if it exists without one. It also can't live in any other custom-named subdirectory at the plugin root: the CLI's zip step (`zip_plugin()` in its `build.rs`) only bundles a fixed, hardcoded set of paths — `dist/`, `bin/`, `py_modules/`, `defaults/`, plus `main.py`/`plugin.json`/`LICENSE`/`README.md`/`package.json` and any loose `*.py` sitting directly at the plugin root — and it's not configurable via `plugin.json` (`PluginFile` there only deserializes `name`/`author`/`flags`). A directory with any other name is silently never zipped, even though local builds and the source tree look fine. `defaults/` is the one exception: the zip step strips that path segment, so `defaults/<name>/*` lands at the plugin's top level in the deployed package. This is also decky's own [documented](https://github.com/SteamDeckHomebrew/wiki/blob/main/plugin-dev/getting-started.md) (if, in their words, "extremely hacky") method for shipping custom Python modules split across multiple files — hence `defaults/python_backend/`, symlinked to `python_backend` at the repo root so editors/local tooling can resolve the import too (the docs recommend this symlink explicitly, for the same reason). Don't flatten this into loose top-level `.py` files instead: decky-loader aliases its own already-imported `decky_loader.*` submodules to bare names in `sys.modules` before executing `main.py` (see `sandboxed_plugin.py` in decky-loader's own source) — notably `decky_loader.settings` → `settings` (the getting-started doc's `SettingsManager` example, `from settings import SettingsManager`, depends on exactly this). A same-named top-level `settings.py` of our own would be shadowed by that alias, since `sys.modules` is checked before `sys.path`; nesting under a package sidesteps this since only the bare name collides, not `python_backend.settings`.

## Commands

- `pnpm i` — install frontend dependencies.
- `pnpm run build` — build the frontend (`rollup -c`) into `dist/index.js`. Run this after any change under `src/`.
- `pnpm run watch` — rollup in watch mode.
- There is no lint script and no real test suite (`pnpm test` is a stub that exits with an error).
- Python backend deps are vendored, not pip-installed at runtime: `pip install --target=py_modules -r requirements.txt` regenerates `py_modules/` (gitignored, tracked by `requirements.txt`).

### VSCode tasks (`.vscode/tasks.json`)

These wrap the Decky CLI and are the intended day-to-day workflow if using VSCode/VSCodium:
- `setup` — installs deps, runs `pnpm i`, updates `@decky/ui`.
- `build` — full plugin build via `.vscode/build.sh`, which runs the `decky` CLI (`cli/decky plugin build`) inside a throwaway `ubuntu:24.04` Docker container (the host glibc is too old for the CLI binary directly). Output goes to `out/`.
- `deploy` — rsyncs the built zip in `out/` to a Steam Deck over SSH and extracts it into `homebrew/plugins`.
- `builddeploy` — `build` then `deploy`.
- `restartdecky` — restarts `plugin_loader` on the target Deck over SSH.

Deploy tasks read connection info (`deckip`, `deckport`, `deckuser`, `deckdir`, etc.) from `.vscode/settings.json`, which is gitignored and user-specific; `config.sh` bootstraps it from `.vscode/defsettings.json` on first run.

### Fast iteration loop (frontend-only changes)

The `builddeploy` VSCode task rebuilds the whole plugin zip via Docker, which is slow for a quick frontend tweak. For changes confined to `src/`, once the plugin has been deployed at least once via `builddeploy`, iterate faster by pushing just the built bundle over the same SSH connection and restarting the loader:

```bash
pnpm run build
scp -i ~/.ssh/id_rsa dist/index.js dist/index.js.map <deckuser>@<deckip>:<deckdir>/homebrew/plugins/Insignia/dist/
ssh -t -i ~/.ssh/id_rsa <deckuser>@<deckip> "echo <deckpass> | sudo -S systemctl restart plugin_loader"
```

(Values for `<deckuser>`/`<deckip>`/`<deckdir>`/`<deckpass>` come from `.vscode/settings.json`.) This skips repackaging `main.py`/`plugin.json`/`py_modules/`, so use the real `builddeploy` task whenever those change.

### Debugging on-device

- Backend logs: `journalctl -u plugin_loader` on the Deck (needs `sudo`, and `-t` on the SSH command since there's no TTY otherwise) shows plugin load/unload lifecycle events and any Python exceptions. Per-plugin log files also live at `~/homebrew/logs/<PluginName>/` on the Deck.
- Frontend runtime state/errors aren't in any log — they're in the browser context decky-loader injects into. Steam's `steamwebhelper` exposes a Chrome DevTools Protocol endpoint at `127.0.0.1:8080` on the Deck; tunnel it (`ssh -L <local-port>:127.0.0.1:8080 <deckuser>@<deckip>`), then `curl http://127.0.0.1:<local-port>/json` lists CDP targets. The one named **`SharedJSContext`** is where every decky plugin's frontend code actually executes — grab its `webSocketDebuggerUrl` and send CDP `Runtime.evaluate` calls over that websocket (e.g. a short Node script using the built-in `WebSocket`) to run arbitrary JS live. Useful globals in that context: `window.__ROUTER_HOOK_INSTANCE.routerState._routePatches` is a `Map` keyed by route path (e.g. `/library/app/:appid`) — check it to confirm a `routerHook.addPatch()` call actually registered — and `appStore.allApps` for looking up a real appid to test against. You can jump the live UI to a specific route without touching the device by running `history.pushState({}, '', '/routes/library/app/<appid>'); window.dispatchEvent(new PopStateEvent('popstate'))` in that same context.

## Architecture

A Decky plugin has two independently-built halves that communicate over a Python↔JS bridge (`@decky/api`'s `callable()`):

- **Frontend** (`src/`) — a React component tree built by rollup (`@decky/rollup`) into `dist/index.js`, which is what decky-loader actually loads. `src/index.tsx` is just the `definePlugin()` wiring (icon, title, route patches, unload cleanup); everything else is split by concern:
  - **`pages/`** — route-level containers. The QAM sidebar has no built-in router, so navigation is just local `useState` in `ContentPage` swapping which child renders, based on a `MenuView` value (`types.ts`): `MenuPage` (top-level landing view), `ActiveGamesPage`, `EventsPage`, `SettingsPage`. Deeper levels follow the same pattern: add a `MenuView` variant and a page component.
  - **`components/`** — pieces reused across pages: `Header` (optional back button, title, optional spinning refresh button) and `StatRow` (a label/value row that keeps a game name's last `NAME_TAIL_LENGTH` (8) characters visible when truncating, since many Insignia titles differ only by a trailing suffix — year, sequel numeral, edition — and naive end-truncation can render two different games as identical text).
  - **`patches/`** — modules registered via `routerHook.addPatch()` in `index.tsx`, named after the route they patch: `libraryApp.tsx` injects the library-page playcount badge; `libraryHome.ts` runs the poster-icon badge scan/`MutationObserver` over home-page tiles.
  - **`hooks/`** — `useIsOnline` (wraps `SteamClient`'s connectivity test, translated to a boolean), `useRefreshableData` (the loading/refreshing/fetch state behind a page's `Header` refresh button, with an optional background poll interval), `useIs24HourClock`.
  - **`api.ts`** — every `callable()` declaration into `main.py`'s `Plugin` methods. **`types.ts`** — shared response/domain types. **`gameMatching.ts`** — fuzzy title matching against `insigniaGames.ts`'s snapshot of Insignia-supported titles. **`settingsState.ts`** / **`xboxRomIds.ts`** — plugin-lifetime mutable state read by code outside React's render cycle (route patches, DOM scans), seeded from the backend on load and kept live via setter functions since importers only get a live *read* binding to another module's `let` export.
- **Backend** (`main.py` + `defaults/python_backend/`) — `main.py`'s `Plugin` class is decky-loader's entry point; its async methods are what `callable()` on the frontend invokes by name, and just delegate to `defaults/python_backend/{stats,events,xbox_shortcuts,settings}.py`, imported as `from python_backend import ...` (see above for why it lives under `defaults/`, why it's a package rather than flat files, and the `python_backend` symlink at the repo root). `_main`, `_unload`, `_uninstall`, and `_migration` are decky lifecycle hooks called automatically by the loader (not Insignia-specific logic — mostly log/settings/runtime-dir migration boilerplate from the template). `main.py` stays at the project root since decky-loader requires it there as the plugin's fixed entry point. decky-loader execs `main.py` via `importlib.util.spec_from_file_location`/`exec_module` (`sandboxed_plugin.py` in its own source), not a normal script invocation, so — unlike `python main.py` — the plugin directory is never implicitly added to `sys.path`; the loader only ever appends `py_modules` itself. `main.py` therefore has to `sys.path.insert(0, os.path.dirname(__file__))` before importing `python_backend`, or the import silently fails at runtime on-device despite working in any local/editor context that does add the script dir automatically.
  - **`stats.get_active_games`** caches successful responses for `ACTIVE_GAMES_CACHE_TTL_SECONDS` (60s); `force_refresh=True` (wired to the frontend's refresh button) bypasses it. **`stats.get_game_online_count`** shares a separate 60s cache, since the library-page playcount badge polls per open game page independently of the Active Games panel.
  - **`stats._parse_stats_response` / `_normalize_games`** exist because the Insignia API's response shape isn't documented/guaranteed — they defensively handle several possible shapes (bare list, dict wrapping a list under various keys, a single flat total, or a dict keyed by game title) and normalize all of them into `{"error": bool, "games": [...], "total": int}`. When touching this endpoint's parsing, preserve that defensiveness rather than assuming one fixed shape.
  - **`events.get_upcoming_events`** caches for 5 minutes and filters to events starting within the next `UPCOMING_EVENTS_WINDOW_DAYS` (14) days.
  - **`xbox_shortcuts.get_xbox_rom_appids`** reads `shortcuts.vdf` directly rather than going through Steam's own app-overview APIs, which return null for any shortcut Steam hasn't individually loaded — true of most home-page tiles — to find non-Steam shortcuts pointing at an original-Xbox ROM.
- **`py_modules/`** vendors the backend's third-party Python deps (`requests`, `vdf`, plus `requests`' own transitive deps `urllib3`, `certifi`, `charset_normalizer`, `idna`) because decky plugins run in a restricted Python environment without pip access at runtime; it's gitignored and regenerated from `requirements.txt`.
- **`plugin.json`** is the decky manifest (name, flags, `api_version`); **`defaults/`** is decky's documented mechanism for injecting arbitrary extra content at the plugin's top level in the deployed zip (the build CLI strips the `defaults/` prefix when zipping its contents) — Insignia uses it to ship `python_backend/` (see above), not just static assets/themes as the name might suggest.
