/**
 * Session-scoped Manual bay layout templates (browser localStorage).
 * Full box snapshots are the source of truth — poses alone cannot restore
 * Clear/Fill layouts after auto-pack regenerates crate ids.
 */

import type { CargoGridCoord } from "@/lib/ships/cargoGridCoords";
import type {
  CargoGridBoxAction,
  PlacedCargoBox,
} from "@/lib/ships/cargoGridPlacement";
import type { CargoBoxFootprint, CargoBoxScu } from "@/lib/ships/cargoBoxSizes";

export type ManualBayBoxPose = {
  boxId: string;
  origin: CargoGridCoord;
};

/** Serializable Manual bay crate (cells rebuilt on load). */
export type ManualBayStoredBox = {
  id: string;
  size: CargoBoxScu | number;
  origin: CargoGridCoord;
  footprint: CargoBoxFootprint;
  commoditySlug: string;
  commodityName: string;
  color: string | null;
  color2: string | null;
  action?: CargoGridBoxAction;
  missionId?: string | null;
  deliveryLocationSlug?: string;
  deliveryLocationName?: string;
  locationGroupIndex?: number;
  isOverflow?: boolean;
};

export type ManualBayLayoutTemplate = {
  id: string;
  name: string;
  stopId: string;
  /**
   * @deprecated Pose overrides matched by auto-pack box id. Kept for older
   * templates; prefer `boxes` when present.
   */
  poses: ManualBayBoxPose[];
  /** Full bay layout when the template was saved (Manual source of truth). */
  boxes?: ManualBayStoredBox[];
  updatedAt: string;
};

export type ManualBayLayoutStopState = {
  activeTemplateId: string | null;
  templates: ManualBayLayoutTemplate[];
};

export type ManualBayLayoutSessionState = {
  byStop: Record<string, ManualBayLayoutStopState>;
};

const STORAGE_PREFIX = "cwc:session:";
const STORAGE_SUFFIX = ":manualBayLayouts";

function storageKey(sessionId: string): string {
  return `${STORAGE_PREFIX}${sessionId}${STORAGE_SUFFIX}`;
}

function emptyStopState(): ManualBayLayoutStopState {
  return { activeTemplateId: null, templates: [] };
}

function cellsForOrigin(
  origin: CargoGridCoord,
  footprint: CargoBoxFootprint,
): CargoGridCoord[] {
  const cells: CargoGridCoord[] = [];
  for (let dx = 0; dx < footprint.dx; dx += 1) {
    for (let dy = 0; dy < footprint.dy; dy += 1) {
      for (let dz = 0; dz < footprint.dz; dz += 1) {
        cells.push({
          x: origin.x + dx,
          y: origin.y + dy,
          z: origin.z + dz,
        });
      }
    }
  }
  return cells;
}

function normalizeCoord(raw: unknown): CargoGridCoord | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const x = Number(o.x);
  const y = Number(o.y);
  const z = Number(o.z);
  if (![x, y, z].every((n) => Number.isInteger(n))) return null;
  return { x, y, z };
}

function normalizeFootprint(raw: unknown): CargoBoxFootprint | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const dx = Number(o.dx);
  const dy = Number(o.dy);
  const dz = Number(o.dz);
  if (
    ![dx, dy, dz].every((n) => Number.isInteger(n) && n > 0) ||
    dx * dy * dz <= 0
  ) {
    return null;
  }
  return { dx, dy, dz };
}

function normalizePose(raw: unknown): ManualBayBoxPose | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const boxId = typeof record.boxId === "string" ? record.boxId.trim() : "";
  const origin = normalizeCoord(record.origin);
  if (!boxId || !origin) return null;
  return { boxId, origin };
}

function normalizeStoredBox(raw: unknown): ManualBayStoredBox | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id.trim() : "";
  const commoditySlug =
    typeof record.commoditySlug === "string" ? record.commoditySlug.trim() : "";
  const commodityName =
    typeof record.commodityName === "string"
      ? record.commodityName.trim()
      : commoditySlug;
  const size = Number(record.size);
  const origin = normalizeCoord(record.origin);
  const footprint = normalizeFootprint(record.footprint);
  if (!id || !commoditySlug || !Number.isFinite(size) || size <= 0 || !origin || !footprint) {
    return null;
  }
  const action =
    record.action === "pickup" || record.action === "delivery"
      ? record.action
      : undefined;
  return {
    id,
    size,
    origin,
    footprint,
    commoditySlug,
    commodityName,
    color: typeof record.color === "string" ? record.color : null,
    color2: typeof record.color2 === "string" ? record.color2 : null,
    action,
    missionId:
      typeof record.missionId === "string" || record.missionId === null
        ? (record.missionId as string | null)
        : undefined,
    deliveryLocationSlug:
      typeof record.deliveryLocationSlug === "string"
        ? record.deliveryLocationSlug
        : undefined,
    deliveryLocationName:
      typeof record.deliveryLocationName === "string"
        ? record.deliveryLocationName
        : undefined,
    locationGroupIndex:
      typeof record.locationGroupIndex === "number"
        ? record.locationGroupIndex
        : undefined,
    isOverflow: record.isOverflow === true ? true : undefined,
  };
}

export function storedBoxesFromPlaced(
  boxes: readonly PlacedCargoBox[],
): ManualBayStoredBox[] {
  return boxes.map((box) => ({
    id: box.id,
    size: box.size,
    origin: { ...box.origin },
    footprint: { ...box.footprint },
    commoditySlug: box.commoditySlug,
    commodityName: box.commodityName,
    color: box.color,
    color2: box.color2,
    action: box.action,
    missionId: box.missionId,
    deliveryLocationSlug: box.deliveryLocationSlug,
    deliveryLocationName: box.deliveryLocationName,
    locationGroupIndex: box.locationGroupIndex,
    isOverflow: box.isOverflow,
  }));
}

export function placedBoxesFromStored(
  boxes: readonly ManualBayStoredBox[],
): PlacedCargoBox[] {
  return boxes.map((box) => ({
    id: box.id,
    size: box.size,
    origin: { ...box.origin },
    footprint: { ...box.footprint },
    commoditySlug: box.commoditySlug,
    commodityName: box.commodityName,
    color: box.color,
    color2: box.color2,
    cells: cellsForOrigin(box.origin, box.footprint),
    action: box.action,
    missionId: box.missionId,
    deliveryLocationSlug: box.deliveryLocationSlug,
    deliveryLocationName: box.deliveryLocationName,
    locationGroupIndex: box.locationGroupIndex,
    isOverflow: box.isOverflow,
  }));
}

function normalizeTemplate(raw: unknown): ManualBayLayoutTemplate | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id.trim() : "";
  const name = typeof record.name === "string" ? record.name.trim() : "";
  const stopId = typeof record.stopId === "string" ? record.stopId.trim() : "";
  if (!id || !name || !stopId) return null;
  const poses = Array.isArray(record.poses)
    ? record.poses
        .map(normalizePose)
        .filter((pose): pose is ManualBayBoxPose => pose != null)
    : [];
  const boxes = Array.isArray(record.boxes)
    ? record.boxes
        .map(normalizeStoredBox)
        .filter((box): box is ManualBayStoredBox => box != null)
    : undefined;
  return {
    id,
    name,
    stopId,
    poses,
    boxes,
    updatedAt:
      typeof record.updatedAt === "string"
        ? record.updatedAt
        : new Date().toISOString(),
  };
}

function normalizeSessionState(raw: unknown): ManualBayLayoutSessionState {
  if (!raw || typeof raw !== "object") return { byStop: {} };
  const record = raw as Record<string, unknown>;
  const byStopRaw =
    record.byStop && typeof record.byStop === "object"
      ? (record.byStop as Record<string, unknown>)
      : {};
  const byStop: Record<string, ManualBayLayoutStopState> = {};
  for (const [stopId, value] of Object.entries(byStopRaw)) {
    if (!value || typeof value !== "object") continue;
    const stop = value as Record<string, unknown>;
    // Legacy localStorage used `presets` / `activePresetId`.
    const templatesRaw = Array.isArray(stop.templates)
      ? stop.templates
      : Array.isArray(stop.presets)
        ? stop.presets
        : [];
    const templates = templatesRaw
      .map(normalizeTemplate)
      .filter(
        (template): template is ManualBayLayoutTemplate => template != null,
      );
    const activeTemplateIdRaw =
      typeof stop.activeTemplateId === "string"
        ? stop.activeTemplateId
        : typeof stop.activePresetId === "string"
          ? stop.activePresetId
          : null;
    byStop[stopId] = {
      templates,
      activeTemplateId:
        activeTemplateIdRaw &&
        templates.some((template) => template.id === activeTemplateIdRaw)
          ? activeTemplateIdRaw
          : (templates[0]?.id ?? null),
    };
  }
  return { byStop };
}

export function readManualBayLayoutSession(
  sessionId: string | null | undefined,
): ManualBayLayoutSessionState {
  if (!sessionId || typeof window === "undefined") return { byStop: {} };
  try {
    const raw = window.localStorage.getItem(storageKey(sessionId));
    if (raw == null) return { byStop: {} };
    return normalizeSessionState(JSON.parse(raw) as unknown);
  } catch {
    return { byStop: {} };
  }
}

export function writeManualBayLayoutSession(
  sessionId: string | null | undefined,
  state: ManualBayLayoutSessionState,
): void {
  if (!sessionId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      storageKey(sessionId),
      JSON.stringify(normalizeSessionState(state)),
    );
  } catch {
    // Quota / private mode — ignore.
  }
}

export function getManualBayLayoutStopState(
  session: ManualBayLayoutSessionState,
  stopId: string | null | undefined,
): ManualBayLayoutStopState {
  if (!stopId) return emptyStopState();
  return session.byStop[stopId] ?? emptyStopState();
}

export function posesFromBoxes(boxes: PlacedCargoBox[]): ManualBayBoxPose[] {
  return boxes.map((box) => ({
    boxId: box.id,
    origin: { ...box.origin },
  }));
}

/**
 * Restore a Manual template onto the live bay.
 * Prefers the saved box snapshot; falls back to pose overlays on auto-pack.
 */
export function boxesFromManualTemplate(
  template: ManualBayLayoutTemplate | null | undefined,
  autoBoxes: readonly PlacedCargoBox[],
): PlacedCargoBox[] {
  if (!template) return [...autoBoxes];
  // Empty array is a valid Clear snapshot — only fall back when missing.
  if (template.boxes != null) {
    return placedBoxesFromStored(template.boxes);
  }
  return applyManualBayPoses(autoBoxes, template.poses);
}

export type ManualBoxesBeforeStop = {
  boxes: PlacedCargoBox[];
  /** Route stop id the snapshot was saved on. */
  stopId: string;
};

/**
 * Saved Manual layout from the nearest earlier stop (route order) that has an
 * active template with a box snapshot; `null` when none.
 */
export function latestManualBoxesBeforeStop(
  session: ManualBayLayoutSessionState,
  stopIdsInRouteOrder: readonly string[],
  stopId: string,
): ManualBoxesBeforeStop | null {
  const stopIndex = stopIdsInRouteOrder.indexOf(stopId);
  for (let index = stopIndex - 1; index >= 0; index -= 1) {
    const earlierStopId = stopIdsInRouteOrder[index]!;
    const earlier = getManualBayLayoutStopState(session, earlierStopId);
    const template = earlier.templates.find(
      (entry) => entry.id === earlier.activeTemplateId,
    );
    if (template?.boxes) {
      return {
        boxes: placedBoxesFromStored(template.boxes),
        stopId: earlierStopId,
      };
    }
  }
  return null;
}

export function newManualBayTemplateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `manual-${Date.now().toString(36)}`;
}

export function nextManualTemplateName(
  existing: ManualBayLayoutTemplate[],
): string {
  let max = 0;
  for (const template of existing) {
    const match = /^Manual\s+(\d+)$/i.exec(template.name.trim());
    if (match?.[1]) max = Math.max(max, Number(match[1]) || 0);
  }
  return `Manual ${max + 1}`;
}

/** Unique display name for a new Manual template (appends ` 2`, ` 3`, … on clash). */
export function uniqueManualTemplateName(
  baseName: string,
  existing: ManualBayLayoutTemplate[],
): string {
  const trimmed = baseName.trim() || "Manual";
  const used = new Set(
    existing.map((template) => template.name.trim().toLowerCase()),
  );
  if (!used.has(trimmed.toLowerCase())) return trimmed;
  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${trimmed} ${n}`;
    if (!used.has(candidate.toLowerCase())) return candidate;
  }
  return `${trimmed} ${Date.now().toString(36)}`;
}

/** Rename a template; empty/whitespace keeps the previous name. */
export function renameManualBayTemplate(
  templates: ManualBayLayoutTemplate[],
  templateId: string,
  nextName: string,
): ManualBayLayoutTemplate[] {
  const trimmed = nextName.trim();
  return templates.map((template) =>
    template.id === templateId
      ? {
          ...template,
          name: trimmed || template.name,
          updatedAt: new Date().toISOString(),
        }
      : template,
  );
}

/** Apply saved poses onto auto-planned boxes (matched by id). */
export function applyManualBayPoses(
  boxes: readonly PlacedCargoBox[],
  poses: ManualBayBoxPose[] | null | undefined,
): PlacedCargoBox[] {
  if (!poses || poses.length === 0) return [...boxes];
  const byId = new Map(poses.map((pose) => [pose.boxId, pose.origin]));
  return boxes.map((box) => {
    const origin = byId.get(box.id);
    if (!origin) return box;
    if (
      origin.x === box.origin.x &&
      origin.y === box.origin.y &&
      origin.z === box.origin.z
    ) {
      return box;
    }
    return {
      ...box,
      origin: { ...origin },
      cells: cellsForOrigin(origin, box.footprint),
    };
  });
}
