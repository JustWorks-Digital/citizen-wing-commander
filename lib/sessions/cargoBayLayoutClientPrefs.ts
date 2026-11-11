/** Default ship-layout panel height (`26rem`). */
export const DEFAULT_CARGO_BAY_LAYOUT_HEIGHT_PX = 26 * 16;
export const MIN_CARGO_BAY_LAYOUT_HEIGHT_PX = 16 * 16;
export const MAX_CARGO_BAY_LAYOUT_HEIGHT_PX = 48 * 16;

/**
 * New sessions start with Legend + Sorting collapsed.
 * After the user toggles, prefs persist per session in `localStorage`.
 */
export type CargoBayChromePrefs = {
  legendHidden: boolean;
  sortingHidden: boolean;
};

export const DEFAULT_CARGO_BAY_CHROME_PREFS: CargoBayChromePrefs = {
  legendHidden: true,
  sortingHidden: true,
};

const STORAGE_PREFIX = "cwc:session:";
const STORAGE_SUFFIX = ":cargoBayLayoutHeightPx";
const CHROME_SUFFIX = ":cargoBayChrome";

function storageKey(sessionId: string): string {
  return `${STORAGE_PREFIX}${sessionId}${STORAGE_SUFFIX}`;
}

function chromeStorageKey(sessionId: string): string {
  return `${STORAGE_PREFIX}${sessionId}${CHROME_SUFFIX}`;
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

function normalizeChromePrefs(value: unknown): CargoBayChromePrefs {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_CARGO_BAY_CHROME_PREFS };
  }
  const record = value as Record<string, unknown>;
  return {
    legendHidden:
      typeof record.legendHidden === "boolean"
        ? record.legendHidden
        : DEFAULT_CARGO_BAY_CHROME_PREFS.legendHidden,
    sortingHidden:
      typeof record.sortingHidden === "boolean"
        ? record.sortingHidden
        : DEFAULT_CARGO_BAY_CHROME_PREFS.sortingHidden,
  };
}

/** Read Legend/Sorting visibility for a session (defaults: both hidden). */
export function readCargoBayChromePrefs(
  sessionId: string | null | undefined,
): CargoBayChromePrefs {
  if (!sessionId || typeof window === "undefined") {
    return { ...DEFAULT_CARGO_BAY_CHROME_PREFS };
  }
  try {
    const raw = window.localStorage.getItem(chromeStorageKey(sessionId));
    if (raw == null) return { ...DEFAULT_CARGO_BAY_CHROME_PREFS };
    return normalizeChromePrefs(JSON.parse(raw) as unknown);
  } catch {
    return { ...DEFAULT_CARGO_BAY_CHROME_PREFS };
  }
}

/** Persist Legend/Sorting visibility for a session. */
export function writeCargoBayChromePrefs(
  sessionId: string | null | undefined,
  prefs: CargoBayChromePrefs,
): void {
  if (!sessionId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      chromeStorageKey(sessionId),
      JSON.stringify(normalizeChromePrefs(prefs)),
    );
  } catch {
    // Quota / private mode — ignore.
  }
}
