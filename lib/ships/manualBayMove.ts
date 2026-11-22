/**
 * Validate / apply XY moves for Manual 2D bay editing.
 * Z and footprint stay fixed; 3D reads the same placed boxes.
 */

/** Drag payload MIME for Manual tray → 2D grid drops. */
export const MANUAL_BAY_TRAY_MIME = "application/x-cwc-manual-bay-box";

import {
  cargoGridZoneAtXY,
  type CargoGridCoord,
} from "@/lib/ships/cargoGridCoords";
import {
  cargoBoxOrientations,
  type CargoBoxScu,
} from "@/lib/ships/cargoBoxSizes";
import type { PlacedCargoBox } from "@/lib/ships/cargoGridPlacement";
import type { ShipCargoGridSketch } from "@/lib/ships/cargoGrids";
import { applyManualBayPoses } from "@/lib/sessions/manualBayLayoutPrefs";

function footprintCells(
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

function occupiesCargoCell(
  sketch: ShipCargoGridSketch,
  coord: CargoGridCoord,
): boolean {
  if (coord.z < 0 || coord.z >= sketch.heightCells) return false;
  const zone = cargoGridZoneAtXY(sketch, coord.x, coord.y);
  return (
    zone != null && (zone.kind === "cargo" || zone.kind === "overflow")
  );
}

function cellsClear(
  sketch: ShipCargoGridSketch,
  boxes: PlacedCargoBox[],
  cells: CargoGridCoord[],
  ignoreBoxId?: string,
): boolean {
  for (const cell of cells) {
    if (!occupiesCargoCell(sketch, cell)) return false;
  }
  const occupied = new Set<string>();
  for (const box of boxes) {
    if (ignoreBoxId && box.id === ignoreBoxId) continue;
    for (const cell of box.cells) {
      occupied.add(`${cell.x},${cell.y},${cell.z}`);
    }
  }
  for (const cell of cells) {
    if (occupied.has(`${cell.x},${cell.y},${cell.z}`)) return false;
  }
  return true;
}

/** True when every footprint cell is in a cargo zone and clear of others. */
export function canPlaceManualBayBox(
  sketch: ShipCargoGridSketch,
  boxes: PlacedCargoBox[],
  boxId: string,
  origin: CargoGridCoord,
): boolean {
  const moving = boxes.find((box) => box.id === boxId);
  if (!moving) return false;
  const nextCells = footprintCells(origin, moving.footprint);
  return cellsClear(sketch, boxes, nextCells, boxId);
}

/**
 * Move one box by integer cell deltas (XY). Returns updated list or null if
 * the move is illegal.
 */
export function tryMoveManualBayBox(
  sketch: ShipCargoGridSketch,
  boxes: PlacedCargoBox[],
  boxId: string,
  deltaX: number,
  deltaY: number,
): PlacedCargoBox[] | null {
  const moving = boxes.find((box) => box.id === boxId);
  if (!moving) return null;
  const origin: CargoGridCoord = {
    x: moving.origin.x + deltaX,
    y: moving.origin.y + deltaY,
    z: moving.origin.z,
  };
  if (!canPlaceManualBayBox(sketch, boxes, boxId, origin)) return null;
  return applyManualBayPoses(boxes, [{ boxId, origin }]);
}

export type ManualBayAddBoxSpec = {
  size: CargoBoxScu;
  commoditySlug: string;
  commodityName: string;
  color: string | null;
  color2: string | null;
  missionId?: string | null;
  action?: PlacedCargoBox["action"];
  deliveryLocationSlug?: string;
  deliveryLocationName?: string;
};

/** Remove one crate from the bay (returns to Manual tray demand). */
export function tryRemoveManualBayBox(
  boxes: PlacedCargoBox[],
  boxId: string,
): PlacedCargoBox[] | null {
  if (!boxes.some((box) => box.id === boxId)) return null;
  return boxes.filter((box) => box.id !== boxId);
}

/**
 * Place a new crate from the Manual tray at `origin` (active Z from UI).
 * Tries each orientation until one fits.
 */
export function tryAddManualBayBox(
  sketch: ShipCargoGridSketch,
  boxes: PlacedCargoBox[],
  spec: ManualBayAddBoxSpec,
  origin: CargoGridCoord,
): PlacedCargoBox[] | null {
  const orientations = cargoBoxOrientations(spec.size);
  for (const footprint of orientations) {
    const cells = footprintCells(origin, footprint);
    if (!cellsClear(sketch, boxes, cells)) continue;
    const id = `manual-${spec.commoditySlug}-${spec.size}-${origin.x}-${origin.y}-${origin.z}-${Date.now()}`;
    const next: PlacedCargoBox = {
      id,
      size: spec.size,
      origin: { ...origin },
      footprint,
      commoditySlug: spec.commoditySlug,
      commodityName: spec.commodityName,
      color: spec.color,
      color2: spec.color2,
      cells,
      action: spec.action ?? "pickup",
      missionId: spec.missionId ?? null,
      deliveryLocationSlug: spec.deliveryLocationSlug,
      deliveryLocationName: spec.deliveryLocationName,
    };
    return [...boxes, next];
  }
  return null;
}
