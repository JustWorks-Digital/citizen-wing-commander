const STORAGE_KEY = "cwc.hideHistory";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

/** Default off — completed stop tabs stay visible. */
export function readHideHistory(): boolean {
  if (!canUseStorage()) return false;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw == null) return false;
    return raw === "1" || raw === "true";
  } catch {
    return false;
  }
}

export function writeHideHistory(hide: boolean): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, hide ? "1" : "0");
  } catch {
    // ignore quota / private mode
  }
}
