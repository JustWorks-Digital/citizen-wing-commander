/** Default ship-layout panel height (`26rem`). */
export const DEFAULT_CARGO_BAY_LAYOUT_HEIGHT_PX = 26 * 16;
export const MIN_CARGO_BAY_LAYOUT_HEIGHT_PX = 16 * 16;
export const MAX_CARGO_BAY_LAYOUT_HEIGHT_PX = 48 * 16;

const STORAGE_PREFIX = "cwc:session:";
const STORAGE_SUFFIX = ":cargoBayLayoutHeightPx";

function storageKey(sessionId: string): string {
  return `${STORAGE_PREFIX}${sessionId}${STORAGE_SUFFIX}`;
}

export function clampCargoBayLayoutHeightPx(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_CARGO_BAY_LAYOUT_HEIGHT_PX;
  return Math.min(
    MAX_CARGO_BAY_LAYOUT_HEIGHT_PX,
    Math.max(MIN_CARGO_BAY_LAYOUT_HEIGHT_PX, Math.round(value)),
  );
}

/** Read per-session layout height from `localStorage` (browser only). */
export function readCargoBayLayoutHeightPx(
  sessionId: string | null | undefined,
): number {
  if (!sessionId || typeof window === "undefined") {
    return DEFAULT_CARGO_BAY_LAYOUT_HEIGHT_PX;
  }
  try {
    const raw = window.localStorage.getItem(storageKey(sessionId));
    if (raw == null) return DEFAULT_CARGO_BAY_LAYOUT_HEIGHT_PX;
    return clampCargoBayLayoutHeightPx(Number(raw));
  } catch {
    return DEFAULT_CARGO_BAY_LAYOUT_HEIGHT_PX;
  }
}

/** Persist per-session layout height in `localStorage` (browser only). */
export function writeCargoBayLayoutHeightPx(
  sessionId: string | null | undefined,
  heightPx: number,
): void {
  if (!sessionId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      storageKey(sessionId),
      String(clampCargoBayLayoutHeightPx(heightPx)),
    );
  } catch {
    // Quota / private mode — ignore.
  }
}
