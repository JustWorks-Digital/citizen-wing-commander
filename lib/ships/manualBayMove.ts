/**
 * Validate / apply XY moves for Manual 2D bay editing.
 * Z and footprint stay fixed; 3D reads the same placed boxes.
 */

import {
  cargoGridZoneAtXY,
  type CargoGridCoord,
} from "@/lib/ships/cargoGridCoords";
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
  return zone != null && zone.kind === "cargo";
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
  for (const cell of nextCells) {
    if (!occupiesCargoCell(sketch, cell)) return false;
  }
  const occupied = new Set<string>();
  for (const box of boxes) {
    if (box.id === boxId) continue;
    for (const cell of box.cells) {
      occupied.add(`${cell.x},${cell.y},${cell.z}`);
    }
  }
  for (const cell of nextCells) {
    if (occupied.has(`${cell.x},${cell.y},${cell.z}`)) return false;
  }
  return true;
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
