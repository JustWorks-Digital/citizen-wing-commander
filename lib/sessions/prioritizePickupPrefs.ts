const STORAGE_KEY = "cwc.prioritizePickup";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

/** Default on — Pick up tab left, Drop off right. */
export function readPrioritizePickup(): boolean {
  if (!canUseStorage()) return true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw == null) return true;
    return raw === "1" || raw === "true";
  } catch {
    return true;
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
