/** Default ship-layout panel height (`26rem`). */
export const DEFAULT_CARGO_BAY_LAYOUT_HEIGHT_PX = 26 * 16;
export const MIN_CARGO_BAY_LAYOUT_HEIGHT_PX = 16 * 16;
export const MAX_CARGO_BAY_LAYOUT_HEIGHT_PX = 48 * 16;

/** Matches cargo-bays modal shell: `max-h-[min(85vh,52rem)]`. */
export const CARGO_BAY_MODAL_MAX_HEIGHT_VH = 0.85;
export const CARGO_BAY_MODAL_MAX_HEIGHT_PX = 52 * 16;

/** Absolute max height for the modal shell in the current viewport. */
export function cargoBayModalShellMaxHeightPx(options?: {
  fullscreen?: boolean;
}): number {
  if (typeof window === "undefined") return CARGO_BAY_MODAL_MAX_HEIGHT_PX;
  if (options?.fullscreen) return window.innerHeight;
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

/** Split pane arrangement: left/right vs top/bottom. */
export type CargoBaySplitOrientation = "horizontal" | "vertical";

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
  /**
   * When true, Packing / Legend float over the graph (absolute).
   * When false, they dock beside it and shrink the grid.
   */
  sidePanelsOverlay: boolean;
  /** Cargo layout projection — default Split; survives modal close/reopen. */
  viewTab: CargoBayViewTab;
  /** Split: side-by-side (`horizontal`) or stacked (`vertical`). */
  splitOrientation: CargoBaySplitOrientation;
  /** When true, 2D and 3D zoom stay at the same percentage. */
  syncedZoom: boolean;
  /** Disable 2D trackpad/wheel zoom only (+/- still work). Independent of 3D. */
  topZoomLocked: boolean;
  /** Disable 3D trackpad/wheel zoom only (+/- still work). Independent of 2D. */
  isoZoomLocked: boolean;
  /** Packing type: Automatic variants or Manual. */
  sortingMode: CargoBaySortingMode;
  /** Last Automatic pack mode (restored when leaving Manual with no templates). */
  lastAutoPackMode: CargoBayAutoPackMode;
  /** Prioritized packing toggle (Cargo type + ships that support it). */
  prioritized: boolean;
  /** 2D (and Split) grid zoom — survives modal close/reopen. */
  topZoom: number;
  /** 3D (and Split) grid zoom — survives modal close/reopen. */
  isoZoom: number;
};

export const DEFAULT_CARGO_BAY_CHROME_PREFS: CargoBayChromePrefs = {
  legendHidden: true,
  sortingHidden: true,
  sidePanelsOverlay: false,
  viewTab: "split",
  splitOrientation: "horizontal",
  syncedZoom: false,
  topZoomLocked: false,
  isoZoomLocked: false,
  sortingMode: "suggested",
  lastAutoPackMode: "suggested",
  prioritized: false,
  topZoom: 1,
  isoZoom: 1,
};

/** Matches CargoGridSketch zoom clamps. */
export const CARGO_BAY_GRID_ZOOM_MIN = 0.25;
export const CARGO_BAY_GRID_ZOOM_MAX = 2.5;

export function clampCargoBayGridZoom(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(
    CARGO_BAY_GRID_ZOOM_MAX,
    Math.max(CARGO_BAY_GRID_ZOOM_MIN, Math.round(value * 100) / 100),
  );
}

function isCargoBayViewTab(value: unknown): value is CargoBayViewTab {
  return value === "top" || value === "iso" || value === "split";
}

function isCargoBaySplitOrientation(
  value: unknown,
): value is CargoBaySplitOrientation {
  return value === "horizontal" || value === "vertical";
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
const FULLSCREEN_SUFFIX = ":cargoBayLayoutFullscreen";
const CHROME_SUFFIX = ":cargoBayChrome";

function storageKey(sessionId: string): string {
  return `${STORAGE_PREFIX}${sessionId}${STORAGE_SUFFIX}`;
}

function widthStorageKey(sessionId: string): string {
  return `${STORAGE_PREFIX}${sessionId}${WIDTH_SUFFIX}`;
}

function fullscreenStorageKey(sessionId: string): string {
  return `${STORAGE_PREFIX}${sessionId}${FULLSCREEN_SUFFIX}`;
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

/** Read per-session cargo-bays modal fullscreen flag (browser only). */
export function readCargoBayLayoutFullscreen(
  sessionId: string | null | undefined,
): boolean {
  if (!sessionId || typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(fullscreenStorageKey(sessionId));
    return raw === "1" || raw === "true";
  } catch {
    return false;
  }
}

/** Persist per-session cargo-bays modal fullscreen flag (browser only). */
export function writeCargoBayLayoutFullscreen(
  sessionId: string | null | undefined,
  fullscreen: boolean,
): void {
  if (!sessionId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      fullscreenStorageKey(sessionId),
      fullscreen ? "1" : "0",
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
    sidePanelsOverlay:
      typeof record.sidePanelsOverlay === "boolean"
        ? record.sidePanelsOverlay
        : DEFAULT_CARGO_BAY_CHROME_PREFS.sidePanelsOverlay,
    viewTab: isCargoBayViewTab(record.viewTab)
      ? record.viewTab
      : DEFAULT_CARGO_BAY_CHROME_PREFS.viewTab,
    splitOrientation: isCargoBaySplitOrientation(record.splitOrientation)
      ? record.splitOrientation
      : DEFAULT_CARGO_BAY_CHROME_PREFS.splitOrientation,
    syncedZoom:
      typeof record.syncedZoom === "boolean"
        ? record.syncedZoom
        : DEFAULT_CARGO_BAY_CHROME_PREFS.syncedZoom,
    topZoomLocked:
      typeof record.topZoomLocked === "boolean"
        ? record.topZoomLocked
        : typeof record.zoomLocked === "boolean"
          ? record.zoomLocked
          : DEFAULT_CARGO_BAY_CHROME_PREFS.topZoomLocked,
    isoZoomLocked:
      typeof record.isoZoomLocked === "boolean"
        ? record.isoZoomLocked
        : typeof record.zoomLocked === "boolean"
          ? record.zoomLocked
          : DEFAULT_CARGO_BAY_CHROME_PREFS.isoZoomLocked,
    sortingMode,
    lastAutoPackMode,
    prioritized:
      typeof record.prioritized === "boolean"
        ? record.prioritized
        : DEFAULT_CARGO_BAY_CHROME_PREFS.prioritized,
    topZoom:
      typeof record.topZoom === "number"
        ? clampCargoBayGridZoom(record.topZoom)
        : DEFAULT_CARGO_BAY_CHROME_PREFS.topZoom,
    isoZoom:
      typeof record.isoZoom === "number"
        ? clampCargoBayGridZoom(record.isoZoom)
        : DEFAULT_CARGO_BAY_CHROME_PREFS.isoZoom,
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
