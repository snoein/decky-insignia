from __future__ import annotations

import json
import os

import decky

SETTINGS_PATH = os.path.join(decky.DECKY_PLUGIN_SETTINGS_DIR, "settings.json")
DEFAULT_SETTINGS = {"playcountBadgeEnabled": True, "tileBadgeEnabled": False}


def load_settings() -> dict:
    try:
        with open(SETTINGS_PATH, "r") as f:
            settings = json.load(f)
    except (FileNotFoundError, ValueError):
        return dict(DEFAULT_SETTINGS)
    return {**DEFAULT_SETTINGS, **settings}


def save_settings(settings: dict) -> None:
    os.makedirs(os.path.dirname(SETTINGS_PATH), exist_ok=True)
    with open(SETTINGS_PATH, "w") as f:
        json.dump(settings, f)
