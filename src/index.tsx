import { staticClasses } from "@decky/ui";
import { definePlugin, routerHook } from "@decky/api";
import { InsigniaIcon } from "./InsigniaIcon";
import { initUse24HourClock } from "./hooks/useIs24HourClock";
import { getPlaycountBadgeEnabled, getTileBadgeEnabled } from "./api";
import { setPlaycountBadgeEnabled, setTileBadgeEnabled } from "./settingsState";
import { loadXboxRomAppIds } from "./xboxRomIds";
import { patchLibraryApp } from "./libraryBadge";
import { patchLibraryHome, stopTileBadging } from "./tileBadge";
import { Content } from "./components/Content";

export default definePlugin(() => {
  getPlaycountBadgeEnabled().then(setPlaycountBadgeEnabled);
  getTileBadgeEnabled().then(setTileBadgeEnabled);
  loadXboxRomAppIds();
  initUse24HourClock();

  const libraryAppPatch = routerHook.addPatch("/library/app/:appid", patchLibraryApp);
  const libraryHomePatch = routerHook.addPatch("/library/home", patchLibraryHome);

  return {
    // The name shown in various decky menus
    name: "Insignia",
    // The element displayed at the top of your plugin's menu
    titleView: <div className={staticClasses.Title}>Insignia</div>,
    // The content of your plugin's menu
    content: <Content />,
    // The icon displayed in the plugin list
    icon: <InsigniaIcon />,
    // The function triggered when your plugin unloads
    onDismount() {
      routerHook.removePatch("/library/app/:appid", libraryAppPatch);
      routerHook.removePatch("/library/home", libraryHomePatch);
      stopTileBadging();
      console.log("Unloading Insignia")
    },
  };
});
