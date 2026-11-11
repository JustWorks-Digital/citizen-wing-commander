/**
 * Session-scoped Manual bay layout presets (browser localStorage).
 * Poses override auto-pack origins; 2D edit and 3D share the same boxes.
 */

import type { CargoGridCoord } from "@/lib/ships/cargoGridCoords";
import type { PlacedCargoBox } from "@/lib/ships/cargoGridPlacement";

export type ManualBayBoxPose = {
  boxId: string;
  origin: CargoGridCoord;
};

export type ManualBayLayoutPreset = {
  id: string;
  name: string;
  stopId: string;
  poses: ManualBayBoxPose[];
  updatedAt: string;
};

export type ManualBayLayoutStopState = {
  activePresetId: string | null;
  presets: ManualBayLayoutPreset[];
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
  return { activePresetId: null, presets: [] };
}

function normalizePose(raw: unknown): ManualBayBoxPose | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const boxId = typeof record.boxId === "string" ? record.boxId.trim() : "";
  const origin = record.origin;
  if (!boxId || !origin || typeof origin !== "object") return null;
  const o = origin as Record<string, unknown>;
  const x = Number(o.x);
  const y = Number(o.y);
  const z = Number(o.z);
  if (![x, y, z].every((n) => Number.isInteger(n))) return null;
  return { boxId, origin: { x, y, z } };
}

function normalizePreset(raw: unknown): ManualBayLayoutPreset | null {
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
  return {
    id,
    name,
    stopId,
    poses,
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
    const presets = Array.isArray(stop.presets)
      ? stop.presets
          .map(normalizePreset)
          .filter((preset): preset is ManualBayLayoutPreset => preset != null)
      : [];
    const activePresetId =
      typeof stop.activePresetId === "string" ? stop.activePresetId : null;
    byStop[stopId] = {
      presets,
      activePresetId:
        activePresetId && presets.some((preset) => preset.id === activePresetId)
          ? activePresetId
          : (presets[0]?.id ?? null),
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

export function newManualBayPresetId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `manual-${Date.now().toString(36)}`;
}

export function nextManualPresetName(existing: ManualBayLayoutPreset[]): string {
  let max = 0;
  for (const preset of existing) {
    const match = /^Manual\s+(\d+)$/i.exec(preset.name.trim());
    if (match?.[1]) max = Math.max(max, Number(match[1]) || 0);
  }
  return `Manual ${max + 1}`;
}

function cellsForOrigin(
  origin: CargoGridCoord,
  footprint: PlacedCargoBox["footprint"],
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

/** Apply saved poses onto auto-planned boxes (matched by id). */
export function applyManualBayPoses(
  boxes: PlacedCargoBox[],
  poses: ManualBayBoxPose[] | null | undefined,
): PlacedCargoBox[] {
  if (!poses || poses.length === 0) return boxes;
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
