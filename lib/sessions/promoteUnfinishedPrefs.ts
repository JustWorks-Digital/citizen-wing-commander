const STORAGE_KEY = "cwc.promoteUnfinished";

/**
 * Default on: after Drop off or Pick up is marked done, move the unfinished
 * section to the top so the next action is visible without scrolling.
 */
const DEFAULT_PROMOTE_UNFINISHED = true;

function canUseStorage(): boolean {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

/** Read promote-unfinished section order (browser only). */
export function readPromoteUnfinished(): boolean {
  if (!canUseStorage()) return DEFAULT_PROMOTE_UNFINISHED;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return DEFAULT_PROMOTE_UNFINISHED;
    return raw === "1";
  } catch {
    return DEFAULT_PROMOTE_UNFINISHED;
  }
}

/** Persist promote-unfinished section order (browser only). */
export function writePromoteUnfinished(promote: boolean): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, promote ? "1" : "0");
  } catch {
    // ignore quota / private mode
  }
}
