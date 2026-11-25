const STORAGE_KEY = "cwc.collapseMissionCards";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

/** Default on — compact cargo lines until the user expands. */
export function readCollapseMissionCards(): boolean {
  if (!canUseStorage()) return true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw == null) return true;
    return raw === "1" || raw === "true";
  } catch {
    return true;
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
