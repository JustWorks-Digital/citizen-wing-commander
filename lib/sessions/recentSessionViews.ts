/**
 * Browser-local “recently viewed” trip ids for SessionTabs.
 * Most recent first; capped at {@link RECENT_SESSION_VIEWS_MAX}.
 */

export const RECENT_SESSION_VIEWS_MAX = 5;

const STORAGE_KEY = "cwc:recentSessionViews";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

/** Read most-recently-viewed session ids (most recent first). */
export function readRecentSessionIds(): string[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const ids = parsed
      .filter((id): id is string => typeof id === "string" && id.trim().length > 0)
      .map((id) => id.trim());
    return ids.slice(0, RECENT_SESSION_VIEWS_MAX);
  } catch {
    return [];
  }
}

function writeRecentSessionIds(ids: string[]): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(ids.slice(0, RECENT_SESSION_VIEWS_MAX)),
    );
  } catch {
    // quota / private mode
  }
}

/** Push a viewed session to the front of recent (deduped, capped). */
export function recordRecentSessionView(sessionId: string): string[] {
  const id = sessionId.trim();
  if (!id) return readRecentSessionIds();
  const next = [id, ...readRecentSessionIds().filter((existing) => existing !== id)].slice(
    0,
    RECENT_SESSION_VIEWS_MAX,
  );
  writeRecentSessionIds(next);
  return next;
}

/** Drop a session from the recent list (e.g. after close/delete). */
export function removeRecentSessionView(sessionId: string): string[] {
  const id = sessionId.trim();
  const next = readRecentSessionIds().filter((existing) => existing !== id);
  writeRecentSessionIds(next);
  return next;
}
