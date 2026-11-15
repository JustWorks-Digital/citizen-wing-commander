/** Default ship-layout panel height (`26rem`). */
export const DEFAULT_CARGO_BAY_LAYOUT_HEIGHT_PX = 26 * 16;
export const MIN_CARGO_BAY_LAYOUT_HEIGHT_PX = 16 * 16;
export const MAX_CARGO_BAY_LAYOUT_HEIGHT_PX = 48 * 16;

/** Matches cargo-bays modal shell: `max-h-[min(85vh,52rem)]`. */
export const CARGO_BAY_MODAL_MAX_HEIGHT_VH = 0.85;
export const CARGO_BAY_MODAL_MAX_HEIGHT_PX = 52 * 16;

/** Absolute max height for the modal shell in the current viewport. */
export function cargoBayModalShellMaxHeightPx(): number {
  if (typeof window === "undefined") return CARGO_BAY_MODAL_MAX_HEIGHT_PX;
  return Math.min(
    window.innerHeight * CARGO_BAY_MODAL_MAX_HEIGHT_VH,
    CARGO_BAY_MODAL_MAX_HEIGHT_PX,
  );
}

/** Default cargo-base modal width (`72rem`). */
export const DEFAULT_CARGO_BAY_LAYOUT_WIDTH_PX = 72 * 16;
export const MIN_CARGO_BAY_LAYOUT_WIDTH_PX = 36 * 16;
export const MAX_CARGO_BAY_LAYOUT_WIDTH_PX = 96 * 16;

/** 2D / Split / 3D projection for the cargo layout modal. */
export type CargoBayViewTab = "top" | "iso" | "split";

/** Packing preset (or manual) — mirrors CargoBayLayout Sorting controls. */
export type CargoBaySortingMode =
  | "suggested"
  | "by-cargo-type"
  | "by-mission-location"
  | "manual";

export type CargoBayAutoPackMode = Exclude<CargoBaySortingMode, "manual">;

/**
 * New sessions start with Legend + Sorting collapsed and Split view.
 * After the user toggles, prefs persist per session in `localStorage`.
 */
export type CargoBayChromePrefs = {
  legendHidden: boolean;
  sortingHidden: boolean;
  /** Cargo layout projection — default Split; survives modal close/reopen. */
  viewTab: CargoBayViewTab;
  /** Packing type (Suggested / Cargo type / Contract based / Manual). */
  sortingMode: CargoBaySortingMode;
  /** Last non-manual packing mode (restored when leaving Manual with no presets). */
  lastAutoPackMode: CargoBayAutoPackMode;
  /** Prioritized packing toggle (Cargo type + ships that support it). */
  prioritized: boolean;
};

export const DEFAULT_CARGO_BAY_CHROME_PREFS: CargoBayChromePrefs = {
  legendHidden: true,
  sortingHidden: true,
  viewTab: "split",
  sortingMode: "suggested",
  lastAutoPackMode: "suggested",
  prioritized: false,
};

function isCargoBayViewTab(value: unknown): value is CargoBayViewTab {
  return value === "top" || value === "iso" || value === "split";
}

function isCargoBaySortingMode(value: unknown): value is CargoBaySortingMode {
  return (
    value === "suggested" ||
    value === "by-cargo-type" ||
    value === "by-mission-location" ||
    value === "manual"
  );
}

function isCargoBayAutoPackMode(value: unknown): value is CargoBayAutoPackMode {
  return (
    value === "suggested" ||
    value === "by-cargo-type" ||
    value === "by-mission-location"
  );
}

const STORAGE_PREFIX = "cwc:session:";
const STORAGE_SUFFIX = ":cargoBayLayoutHeightPx";
const WIDTH_SUFFIX = ":cargoBayLayoutWidthPx";
const CHROME_SUFFIX = ":cargoBayChrome";

function storageKey(sessionId: string): string {
  return `${STORAGE_PREFIX}${sessionId}${STORAGE_SUFFIX}`;
}

function widthStorageKey(sessionId: string): string {
  return `${STORAGE_PREFIX}${sessionId}${WIDTH_SUFFIX}`;
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

export function clampCargoBayLayoutWidthPx(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_CARGO_BAY_LAYOUT_WIDTH_PX;
  return Math.min(
    MAX_CARGO_BAY_LAYOUT_WIDTH_PX,
    Math.max(MIN_CARGO_BAY_LAYOUT_WIDTH_PX, Math.round(value)),
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

/** Read per-session cargo-base modal width from `localStorage` (browser only). */
export function readCargoBayLayoutWidthPx(
  sessionId: string | null | undefined,
): number {
  if (!sessionId || typeof window === "undefined") {
    return DEFAULT_CARGO_BAY_LAYOUT_WIDTH_PX;
  }
  try {
    const raw = window.localStorage.getItem(widthStorageKey(sessionId));
    if (raw == null) return DEFAULT_CARGO_BAY_LAYOUT_WIDTH_PX;
    return clampCargoBayLayoutWidthPx(Number(raw));
  } catch {
    return DEFAULT_CARGO_BAY_LAYOUT_WIDTH_PX;
  }
}

/** Persist per-session cargo-base modal width in `localStorage` (browser only). */
export function writeCargoBayLayoutWidthPx(
  sessionId: string | null | undefined,
  widthPx: number,
): void {
  if (!sessionId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      widthStorageKey(sessionId),
      String(clampCargoBayLayoutWidthPx(widthPx)),
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
  const sortingMode = isCargoBaySortingMode(record.sortingMode)
    ? record.sortingMode
    : DEFAULT_CARGO_BAY_CHROME_PREFS.sortingMode;
  const lastAutoPackMode = isCargoBayAutoPackMode(record.lastAutoPackMode)
    ? record.lastAutoPackMode
    : sortingMode !== "manual"
      ? sortingMode
      : DEFAULT_CARGO_BAY_CHROME_PREFS.lastAutoPackMode;
  return {
    legendHidden:
      typeof record.legendHidden === "boolean"
        ? record.legendHidden
        : DEFAULT_CARGO_BAY_CHROME_PREFS.legendHidden,
    sortingHidden:
      typeof record.sortingHidden === "boolean"
        ? record.sortingHidden
        : DEFAULT_CARGO_BAY_CHROME_PREFS.sortingHidden,
    viewTab: isCargoBayViewTab(record.viewTab)
      ? record.viewTab
      : DEFAULT_CARGO_BAY_CHROME_PREFS.viewTab,
    sortingMode,
    lastAutoPackMode,
    prioritized:
      typeof record.prioritized === "boolean"
        ? record.prioritized
        : DEFAULT_CARGO_BAY_CHROME_PREFS.prioritized,
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
