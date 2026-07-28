import { staticClasses } from "@decky/ui";
import { definePlugin, routerHook } from "@decky/api";
import { InsigniaIcon } from "./components/InsigniaIcon";
import { initUse24HourClock } from "./hooks/useIs24HourClock";
import { getPlaycountBadgeEnabled, getTileBadgeEnabled } from "./api";
import { setPlaycountBadgeEnabled, setTileBadgeEnabled } from "./state/settingsState";
import { loadXboxRomAppIds } from "./state/xboxRomIds";
import { patchLibraryApp } from "./patches/libraryApp";
import { patchLibraryHome, stopTileBadging } from "./patches/libraryHome";
import { ContentPage } from "./pages/ContentPage";

export default definePlugin(() => {
  getPlaycountBadgeEnabled().then(setPlaycountBadgeEnabled);
  getTileBadgeEnabled().then(setTileBadgeEnabled);
  loadXboxRomAppIds();
  initUse24HourClock();

  const libraryAppPatch = routerHook.addPatch("/library/app/:appid", patchLibraryApp);
  const libraryHomePatch = routerHook.addPatch("/library/home", patchLibraryHome);

  return {
    name: "Insignia",
    titleView: <div className={staticClasses.Title}>Insignia</div>,
    content: <ContentPage />,
    icon: <InsigniaIcon />,
    onDismount() {
      routerHook.removePatch("/library/app/:appid", libraryAppPatch);
      routerHook.removePatch("/library/home", libraryHomePatch);
      stopTileBadging();
    },
  };
});
