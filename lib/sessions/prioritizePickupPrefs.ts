const STORAGE_KEY = "cwc.prioritizePickup";

/** Default: Drop off before Pick up (unload then load). */
const DEFAULT_PRIORITIZE_PICKUP = false;

function canUseStorage(): boolean {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

/** Read Prefer pickup-first section order (browser only). */
export function readPrioritizePickup(): boolean {
  if (!canUseStorage()) return DEFAULT_PRIORITIZE_PICKUP;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return DEFAULT_PRIORITIZE_PICKUP;
    return raw === "1";
  } catch {
    return DEFAULT_PRIORITIZE_PICKUP;
  }
}

/** Persist Prefer pickup-first section order (browser only). */
export function writePrioritizePickup(prioritize: boolean): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, prioritize ? "1" : "0");
  } catch {
    // ignore quota / private mode
  }
}
