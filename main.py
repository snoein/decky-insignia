from __future__ import annotations

import os
import sys

# The decky plugin module is located at decky-loader/plugin
# For easy intellisense checkout the decky-loader code repo
# and add the `decky-loader/plugin/imports` path to `python.analysis.extraPaths` in `.vscode/settings.json`
import decky
import asyncio

# decky-loader execs this file via importlib.spec_from_file_location rather
# than running it as a normal script, so unlike a normal `python main.py`
# invocation, this file's own directory is never added to sys.path -- it
# only appends py_modules itself. Both inserts must run before importing
# python_backend: the directory one so the package is importable at all, and
# the py_modules one before xbox_shortcuts, which imports vdf from
# py_modules at module scope.
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "py_modules"))

# Package-qualified import, not `import settings` etc. directly: decky-loader
# aliases its own already-imported decky_loader.* submodules to bare names in
# sys.modules before exec'ing this file (see sandboxed_plugin.py upstream),
# including decky_loader.settings -> settings. A bare `import settings` here
# would silently bind to decky-loader's own SettingsManager module instead of
# ours, since sys.modules is consulted before sys.path.
from python_backend import events, settings, stats, xbox_shortcuts


class Plugin:
    async def get_active_games(self, force_refresh: bool = False) -> dict:
        return stats.get_active_games(force_refresh)

    async def get_upcoming_events(self, force_refresh: bool = False) -> dict:
        return events.get_upcoming_events(force_refresh)

    async def get_game_online_count(self, title_id: str) -> int:
        return stats.get_game_online_count(title_id)

    async def get_xbox_rom_appids(self) -> list[int]:
        return xbox_shortcuts.get_xbox_rom_appids()

    async def get_playcount_badge_enabled(self) -> bool:
        return bool(settings.load_settings().get("playcountBadgeEnabled", True))

    async def set_playcount_badge_enabled(self, enabled: bool) -> None:
        current = settings.load_settings()
        current["playcountBadgeEnabled"] = bool(enabled)
        settings.save_settings(current)

    async def get_tile_badge_enabled(self) -> bool:
        return bool(settings.load_settings().get("tileBadgeEnabled", True))

    async def set_tile_badge_enabled(self, enabled: bool) -> None:
        current = settings.load_settings()
        current["tileBadgeEnabled"] = bool(enabled)
        settings.save_settings(current)

    # Asyncio-compatible long-running code, executed in a task when the plugin is loaded
    async def _main(self):
        self.loop = asyncio.get_event_loop()
        decky.logger.info("Insignia started!")

    # Function called first during the unload process, utilize this to handle your plugin being stopped, but not
    # completely removed
    async def _unload(self):
        decky.logger.info("Goodnight World!")
        pass

    # Function called after `_unload` during uninstall, utilize this to clean up processes and other remnants of your
    # plugin that may remain on the system
    async def _uninstall(self):
        decky.logger.info("Goodbye World!")
        pass

    # Called once, before `_main()`, on every plugin start. Optional -- decky-loader
    # only invokes it if defined, so an empty body is a safe no-op.
    #
    # Not needed for renaming settings keys or app-side data formats -- that's
    # just a plain code change in python_backend/settings.py. It's for moving
    # whole files/directories when their *path* changes, since decky.migrate_*
    # works by path existence, not by comparing versions (decky.DECKY_PLUGIN_VERSION
    # is the current version only; there's no "previous version" passed in here).
    #
    # The one concrete case where this repo would need it: if the plugin is ever
    # renamed from "Insignia", since DECKY_PLUGIN_SETTINGS_DIR/RUNTIME_DIR/LOG_DIR
    # are all derived from the plugin name. Old settings would otherwise appear
    # to vanish under the new name. Example:
    #
    #   decky.migrate_settings(os.path.join(decky.DECKY_HOME, "settings", "Insignia"))
    #   decky.migrate_runtime(os.path.join(decky.DECKY_HOME, "data", "Insignia"))
    #   decky.migrate_logs(os.path.join(decky.DECKY_HOME, "logs", "Insignia"))
    async def _migration(self):
        pass

