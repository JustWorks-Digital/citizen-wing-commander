const STORAGE_KEY = "cwc.sessionTripNav.open";

/** Default open so trip chrome stays discoverable on first visit. */
const DEFAULT_OPEN = true;

function canUseStorage(): boolean {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

/** Read trip side-nav open state (browser only). */
export function readSessionTripNavOpen(): boolean {
  if (!canUseStorage()) return DEFAULT_OPEN;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return DEFAULT_OPEN;
    return raw === "1";
  } catch {
    return DEFAULT_OPEN;
  }
}

/** Persist trip side-nav open state (browser only). */
export function writeSessionTripNavOpen(open: boolean): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, open ? "1" : "0");
  } catch {
    // ignore quota / private mode
  }
}
