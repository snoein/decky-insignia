from __future__ import annotations

import os

import decky
import vdf

# The Steam "Properties" dialog's Target field for a non-Steam shortcut is
# stored as "Exe" in shortcuts.vdf. EmuDeck-style original-Xbox shortcuts
# point their target at a rom under a "roms/xbox/" folder -- the trailing
# slash matters, since "roms/xbox360/..." (a different, Insignia-incompatible
# console) would otherwise also match "roms/xbox".
XBOX_ROM_TARGET_SUBSTRING = "/Emulation/roms/xbox/"


def _find_shortcuts_vdf_path() -> str | None:
    userdata_dir = os.path.join(decky.DECKY_USER_HOME, ".steam", "steam", "userdata")
    if not os.path.isdir(userdata_dir):
        return None

    candidates = []
    for entry in os.listdir(userdata_dir):
        if not entry.isdigit():
            continue
        path = os.path.join(userdata_dir, entry, "config", "shortcuts.vdf")
        if os.path.isfile(path):
            candidates.append(path)

    if not candidates:
        return None

    # A Deck can have more than one Steam account's userdata on disk; the
    # currently logged-in account is the one Steam most recently wrote to.
    candidates.sort(key=os.path.getmtime, reverse=True)
    return candidates[0]


def get_xbox_rom_appids() -> list[int]:
    path = _find_shortcuts_vdf_path()
    if not path:
        return []

    try:
        with open(path, "rb") as f:
            data = vdf.binary_load(f)
    except Exception as e:
        decky.logger.error(f"Insignia: failed to parse {path}: {e}")
        return []

    appids = []
    for entry in data.get("shortcuts", {}).values():
        vdf_appid = entry.get("appid")
        exe = entry.get("Exe") or entry.get("exe") or ""
        if vdf_appid is None or XBOX_ROM_TARGET_SUBSTRING not in exe:
            continue
        # shortcuts.vdf stores appid as signed 32-bit; Steam's UI (and the
        # data-id/image URLs our frontend reads off home page tiles) use the
        # unsigned interpretation of the same bits.
        appids.append(vdf_appid & 0xFFFFFFFF)
    return appids
