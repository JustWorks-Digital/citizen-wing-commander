const STORAGE_KEY = "cwc.collapseMissionCards";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

/** Default off — mission cards show full cargo tiles. */
export function readCollapseMissionCards(): boolean {
  if (!canUseStorage()) return false;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw == null) return false;
    return raw === "1" || raw === "true";
  } catch {
    return false;
  }
}

export function writeCollapseMissionCards(collapse: boolean): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, collapse ? "1" : "0");
  } catch {
    // ignore quota / private mode
  }
}
