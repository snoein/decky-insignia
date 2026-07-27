import { getXboxRomAppIds } from "./api";

export let xboxRomAppIdSet: Set<string> | null = null;

export async function loadXboxRomAppIds() {
  try {
    const ids = await getXboxRomAppIds();
    xboxRomAppIdSet = new Set(ids.map(String));
  } catch (e) {
    console.error("Insignia: failed to load Xbox rom appid list", e);
  }
}
