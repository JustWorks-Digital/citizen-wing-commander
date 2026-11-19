const STORAGE_KEY = "cwc.prioritizePickup";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

/** Default off — Drop off tab first. */
export function readPrioritizePickup(): boolean {
  if (!canUseStorage()) return false;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw == null) return false;
    return raw === "1" || raw === "true";
  } catch {
    return false;
  }
}

export function writePrioritizePickup(prioritize: boolean): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, prioritize ? "1" : "0");
  } catch {
    // ignore quota / private mode
  }
}
