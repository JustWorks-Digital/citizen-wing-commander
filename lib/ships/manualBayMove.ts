/**
 * Validate / apply XY moves for Manual 2D bay editing.
 * Footprint stays fixed; drop snaps Z to deck or onto a flat stack top.
 * 3D reads the same placed boxes.
 */

/** @deprecated HTML5 MIME kept for any external callers; tray uses pointer place. */
export const MANUAL_BAY_TRAY_MIME = "application/x-cwc-manual-bay-box";

import {
  cargoGridCoordKey,
  cargoGridZoneAtXY,
  cargoGridZoneStorageLocation,
  type CargoGridCoord,
} from "@/lib/ships/cargoGridCoords";
import {
  cargoBoxOrientations,
  type CargoBoxScu,
} from "@/lib/ships/cargoBoxSizes";
import { compileCargoTypePackProgram } from "@/lib/ships/cargoBayPackProgram";
import {
  placeCargoItemsInZone,
  type CargoPlacementItem,
  type PlacedCargoBox,
} from "@/lib/ships/cargoGridPlacement";
import { type ShipCargoGridSketch } from "@/lib/ships/cargoGrids";
import { packBaysFromSketch } from "@/lib/ships/packBaysFromSketch";
import { derivePackSlotPolicy } from "@/lib/ships/packSlotPolicy";
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

function ignoreIdSet(
  ignoreBoxIds?: string | ReadonlySet<string>,
): ReadonlySet<string> {
  if (ignoreBoxIds == null) return new Set();
  if (typeof ignoreBoxIds === "string") return new Set([ignoreBoxIds]);
  return ignoreBoxIds;
}

function cellsClear(
  sketch: ShipCargoGridSketch,
  boxes: PlacedCargoBox[],
  cells: CargoGridCoord[],
  ignoreBoxIds?: string | ReadonlySet<string>,
): boolean {
  const ignore = ignoreIdSet(ignoreBoxIds);
  for (const cell of cells) {
    if (!occupiesCargoCell(sketch, cell)) return false;
  }
  const occupied = new Set<string>();
  for (const box of boxes) {
    if (ignore.has(box.id)) continue;
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
  ignoreBoxIds?: ReadonlySet<string>,
): boolean {
  const moving = boxes.find((box) => box.id === boxId);
  if (!moving) return false;
  const nextCells = footprintCells(origin, moving.footprint);
  const ignore = new Set(ignoreBoxIds ?? []);
  ignore.add(boxId);
  return cellsClear(sketch, boxes, nextCells, ignore);
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

/**
 * Per-column stack height (next free Z) under the footprint XY, ignoring
 * `ignoreBoxId`. Empty column → 0.
 */
function columnStackTops(
  boxes: readonly PlacedCargoBox[],
  originX: number,
  originY: number,
  footprint: PlacedCargoBox["footprint"],
  ignoreBoxIds: string | ReadonlySet<string>,
): number[] {
  const ignore = ignoreIdSet(ignoreBoxIds);
  const tops: number[] = [];
  for (let dx = 0; dx < footprint.dx; dx += 1) {
    for (let dy = 0; dy < footprint.dy; dy += 1) {
      const x = originX + dx;
      const y = originY + dy;
      let top = 0;
      for (const box of boxes) {
        if (ignore.has(box.id)) continue;
        for (const cell of box.cells) {
          if (cell.x !== x || cell.y !== y) continue;
          top = Math.max(top, cell.z + 1);
        }
      }
      tops.push(top);
    }
  }
  return tops;
}

/**
 * Support cell SCU sizes directly under `origin` (z-1). Null entries mean a
 * hole — not a flat compatible stack.
 */
function supportSizesUnder(
  boxes: readonly PlacedCargoBox[],
  origin: CargoGridCoord,
  footprint: PlacedCargoBox["footprint"],
  ignoreBoxIds: string | ReadonlySet<string>,
): Array<number | null> {
  const ignore = ignoreIdSet(ignoreBoxIds);
  if (origin.z <= 0) return [];
  const sizes: Array<number | null> = [];
  for (let dx = 0; dx < footprint.dx; dx += 1) {
    for (let dy = 0; dy < footprint.dy; dy += 1) {
      const x = origin.x + dx;
      const y = origin.y + dy;
      const z = origin.z - 1;
      let found: number | null = null;
      for (const box of boxes) {
        if (ignore.has(box.id)) continue;
        for (const cell of box.cells) {
          if (cell.x === x && cell.y === y && cell.z === z) {
            found = box.size;
            break;
          }
        }
        if (found != null) break;
      }
      sizes.push(found);
    }
  }
  return sizes;
}

/**
 * True when every footprint XY cell has support and each support crate’s SCU
 * is at least the moving crate’s SCU (no overhang; no larger-on-smaller).
 */
function isCompatibleStackSupport(
  movingSize: number,
  supportSizes: ReadonlyArray<number | null>,
): boolean {
  if (supportSizes.length === 0) return false;
  for (const size of supportSizes) {
    if (size == null || size < movingSize) return false;
  }
  return true;
}

/**
 * Snap Z for a footprint at XY: deck (0) when empty and flat, else onto a
 * full-support stack top. Null when uneven, overhanging, oversized-on-small,
 * colliding, or out of bay height.
 */
function resolveManualBayStackZ(
  sketch: ShipCargoGridSketch,
  boxes: readonly PlacedCargoBox[],
  footprint: PlacedCargoBox["footprint"],
  size: number,
  originX: number,
  originY: number,
  ignoreBoxIds: ReadonlySet<string>,
): number | null {
  const tops = columnStackTops(
    boxes,
    originX,
    originY,
    footprint,
    ignoreBoxIds,
  );
  if (tops.length === 0) return null;
  const first = tops[0]!;
  // Uneven tops = hole / step under the footprint (partial stack).
  if (!tops.every((top) => top === first)) return null;

  const candidateZ = first;
  if (candidateZ + footprint.dz > sketch.heightCells) return null;

  const origin: CargoGridCoord = { x: originX, y: originY, z: candidateZ };
  const cells = footprintCells(origin, footprint);
  if (!cellsClear(sketch, boxes, cells, ignoreBoxIds)) return null;
  if (candidateZ === 0) return 0;

  const support = supportSizesUnder(boxes, origin, footprint, ignoreBoxIds);
  if (!isCompatibleStackSupport(size, support)) return null;
  return candidateZ;
}

/**
 * Snap drop Z: empty footprint → deck (0); flat compatible stack → on top.
 * Returns null when the XY cannot host the crate (uneven stack / no fit).
 */
export function resolveManualBayDropZ(
  sketch: ShipCargoGridSketch,
  boxes: readonly PlacedCargoBox[],
  moving: PlacedCargoBox,
  originX: number,
  originY: number,
  ignoreBoxIds?: ReadonlySet<string>,
): number | null {
  const ignore = new Set(ignoreBoxIds ?? []);
  ignore.add(moving.id);
  return resolveManualBayStackZ(
    sketch,
    boxes,
    moving.footprint,
    moving.size,
    originX,
    originY,
    ignore,
  );
}

/** Origin for a drop under the pointer; XY from grab offset, Z auto-snapped. */
export function manualBayDropOrigin(
  sketch: ShipCargoGridSketch,
  boxes: readonly PlacedCargoBox[],
  moving: PlacedCargoBox,
  dropCell: CargoGridCoord,
  grabOffset: { dx: number; dy: number },
): CargoGridCoord | null {
  const x = dropCell.x - grabOffset.dx;
  const y = dropCell.y - grabOffset.dy;
  const z = resolveManualBayDropZ(sketch, boxes, moving, x, y);
  if (z == null) return null;
  return { x, y, z };
}

/**
 * Live footprint highlight while dragging a placed crate.
 * `fits` is false on gaps, collisions, uneven stacks, or out-of-bay cells.
 */
export function previewManualBayDrop(
  sketch: ShipCargoGridSketch,
  boxes: PlacedCargoBox[],
  boxId: string,
  dropCell: CargoGridCoord,
  grabOffset: { dx: number; dy: number },
): { cells: CargoGridCoord[]; origin: CargoGridCoord; fits: boolean } | null {
  const moving = boxes.find((box) => box.id === boxId);
  if (!moving) return null;
  const origin = manualBayDropOrigin(
    sketch,
    boxes,
    moving,
    dropCell,
    grabOffset,
  );
  if (!origin) {
    const fallback: CargoGridCoord = {
      x: dropCell.x - grabOffset.dx,
      y: dropCell.y - grabOffset.dy,
      z: moving.origin.z,
    };
    return {
      cells: footprintCells(fallback, moving.footprint),
      origin: fallback,
      fits: false,
    };
  }
  return {
    cells: footprintCells(origin, moving.footprint),
    origin,
    fits: true,
  };
}

/**
 * Drop a dragged crate onto a pointer cell, preserving grab offset within the
 * footprint and snapping Z to deck or a compatible stack top. Returns null when
 * illegal — caller should keep the pre-drag layout.
 */
export function tryDropManualBayBox(
  sketch: ShipCargoGridSketch,
  boxes: PlacedCargoBox[],
  boxId: string,
  dropCell: CargoGridCoord,
  grabOffset: { dx: number; dy: number },
): PlacedCargoBox[] | null {
  const moving = boxes.find((box) => box.id === boxId);
  if (!moving) return null;
  const origin = manualBayDropOrigin(
    sketch,
    boxes,
    moving,
    dropCell,
    grabOffset,
  );
  if (!origin) return null;
  if (
    origin.x === moving.origin.x &&
    origin.y === moving.origin.y &&
    origin.z === moving.origin.z
  ) {
    return boxes;
  }
  return boxes.map((box) =>
    box.id === boxId
      ? {
          ...box,
          origin: { ...origin },
          cells: footprintCells(origin, moving.footprint),
        }
      : box,
  );
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

/** Cycle tray / place orientation (R shortcut). */
export function nextManualBayOrientationIndex(
  size: CargoBoxScu,
  orientationIndex: number,
): number {
  const count = cargoBoxOrientations(size).length;
  if (count <= 1) return 0;
  return ((orientationIndex % count) + count + 1) % count;
}

/**
 * Next footprint for selected-crate R rotate.
 * Cycles official orientations; falls back to dx↔dy when elongated.
 */
export function nextManualBayDragFootprint(
  box: Pick<PlacedCargoBox, "size" | "footprint">,
): PlacedCargoBox["footprint"] | null {
  const { footprint } = box;
  const size = box.size;
  if (
    size === 1 ||
    size === 2 ||
    size === 4 ||
    size === 8 ||
    size === 16 ||
    size === 32
  ) {
    const orientations = cargoBoxOrientations(size);
    if (orientations.length > 1) {
      const currentIndex = orientations.findIndex(
        (entry) =>
          entry.dx === footprint.dx &&
          entry.dy === footprint.dy &&
          entry.dz === footprint.dz,
      );
      const start = currentIndex >= 0 ? currentIndex : 0;
      for (let step = 1; step < orientations.length; step += 1) {
        const next = orientations[(start + step) % orientations.length];
        if (
          next &&
          (next.dx !== footprint.dx ||
            next.dy !== footprint.dy ||
            next.dz !== footprint.dz)
        ) {
          return { ...next };
        }
      }
    }
  }
  if (footprint.dx !== footprint.dy) {
    return { dx: footprint.dy, dy: footprint.dx, dz: footprint.dz };
  }
  return null;
}

/** True when this crate has an alternate Manual orientation. */
export function manualBayBoxCanRotate(box: PlacedCargoBox): boolean {
  return nextManualBayDragFootprint(box) != null;
}

/**
 * Cycle the selected crate’s footprint at the same origin. Also rotates every
 * crate stacked on it (same upward sub-stack as the stack badge).
 * Returns null when nothing changes or the new poses do not fit.
 */
export function tryRotateManualBayBox(
  sketch: ShipCargoGridSketch,
  boxes: PlacedCargoBox[],
  boxId: string,
): PlacedCargoBox[] | null {
  const moving = boxes.find((box) => box.id === boxId);
  if (!moving) return null;
  const stack = manualBayBoxStackColumn(moving, boxes);
  const column = stack.length > 0 ? stack : [moving];
  const columnIds = new Set(column.map((box) => box.id));

  const rotated = new Map<string, PlacedCargoBox>();
  for (const member of column) {
    const nextFootprint = nextManualBayDragFootprint(member);
    if (!nextFootprint) continue;
    if (member.origin.z + nextFootprint.dz > sketch.heightCells) return null;
    const nextCells = footprintCells(member.origin, nextFootprint);
    if (!cellsClear(sketch, boxes, nextCells, columnIds)) return null;
    rotated.set(member.id, {
      ...member,
      footprint: { ...nextFootprint },
      cells: nextCells,
    });
  }
  if (rotated.size === 0) return null;

  // Column members must not occupy the same cells after rotate.
  const proposedCells = new Set<string>();
  for (const member of column) {
    const pose = rotated.get(member.id) ?? member;
    for (const cell of pose.cells) {
      const key = `${cell.x},${cell.y},${cell.z}`;
      if (proposedCells.has(key)) return null;
      proposedCells.add(key);
    }
  }

  // After rotate, every elevated crate still needs full support (no overhang).
  const proposedBoxes = boxes.map((box) => rotated.get(box.id) ?? box);
  for (const member of column) {
    const pose = rotated.get(member.id) ?? member;
    if (pose.origin.z <= 0) continue;
    const support = supportSizesUnder(
      proposedBoxes,
      pose.origin,
      pose.footprint,
      new Set([pose.id]),
    );
    if (!isCompatibleStackSupport(pose.size, support)) return null;
  }

  return proposedBoxes;
}

function footprintsOverlapXY(
  a: PlacedCargoBox,
  b: PlacedCargoBox,
): boolean {
  return !(
    a.origin.x + a.footprint.dx <= b.origin.x ||
    b.origin.x + b.footprint.dx <= a.origin.x ||
    a.origin.y + a.footprint.dy <= b.origin.y ||
    b.origin.y + b.footprint.dy <= a.origin.y
  );
}

/**
 * True when another crate rests on this box’s top face (same XY overlap,
 * origin at or above this box’s top Z). Buried crates must not drag until
 * the stack above is cleared — unless dragging via the stack badge.
 */
export function manualBayBoxIsBuried(
  box: PlacedCargoBox,
  boxes: readonly PlacedCargoBox[],
): boolean {
  const topZ = box.origin.z + box.footprint.dz;
  for (const other of boxes) {
    if (other.id === box.id) continue;
    if (other.origin.z < topZ) continue;
    if (footprintsOverlapXY(box, other)) return true;
  }
  return false;
}

/** True when `upper` rests directly on `lower` (XY overlap, Z touching). */
function restsDirectlyOn(
  upper: PlacedCargoBox,
  lower: PlacedCargoBox,
): boolean {
  if (upper.origin.z !== lower.origin.z + lower.footprint.dz) return false;
  return footprintsOverlapXY(upper, lower);
}

/**
 * Sub-stack from `seed` upward — seed plus every crate resting on it
 * (directly or transitively). Does **not** include crates under the seed,
 * so a mid-stack badge can peel nested crates off a larger base.
 * Ordered bottom → top (seed first).
 */
export function manualBayBoxStackColumn(
  seed: PlacedCargoBox,
  boxes: readonly PlacedCargoBox[],
): PlacedCargoBox[] {
  const byId = new Map(boxes.map((box) => [box.id, box]));
  if (!byId.has(seed.id)) return [];
  const stackIds = new Set<string>([seed.id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const box of boxes) {
      if (stackIds.has(box.id)) continue;
      for (const id of stackIds) {
        const member = byId.get(id);
        if (!member) continue;
        // Grow upward only — never pull in supports under the seed.
        if (restsDirectlyOn(box, member)) {
          stackIds.add(box.id);
          grew = true;
          break;
        }
      }
    }
  }
  return boxes
    .filter((box) => stackIds.has(box.id))
    .sort((a, b) => a.origin.z - b.origin.z || a.id.localeCompare(b.id));
}

/**
 * Drop the sub-stack from the stacked-crate badge (seed + crates above).
 * Preserves relative XY/Z; snaps the sub-stack bottom like a normal drop.
 */
export function tryDropManualBayStack(
  sketch: ShipCargoGridSketch,
  boxes: PlacedCargoBox[],
  seedBoxId: string,
  dropCell: CargoGridCoord,
  grabOffset: { dx: number; dy: number },
): PlacedCargoBox[] | null {
  const seed = boxes.find((box) => box.id === seedBoxId);
  if (!seed) return null;
  const stack = manualBayBoxStackColumn(seed, boxes);
  if (stack.length <= 1) {
    return tryDropManualBayBox(sketch, boxes, seedBoxId, dropCell, grabOffset);
  }
  const bottom = stack[0]!;
  const ignore = new Set(stack.map((box) => box.id));
  const seedOriginX = dropCell.x - grabOffset.dx;
  const seedOriginY = dropCell.y - grabOffset.dy;
  const deltaX = seedOriginX - seed.origin.x;
  const deltaY = seedOriginY - seed.origin.y;
  const bottomX = bottom.origin.x + deltaX;
  const bottomY = bottom.origin.y + deltaY;
  const stackTopSpan = Math.max(
    ...stack.map(
      (box) => box.origin.z + box.footprint.dz - bottom.origin.z,
    ),
  );
  const bottomZ = resolveManualBayDropZ(
    sketch,
    boxes,
    bottom,
    bottomX,
    bottomY,
    ignore,
  );
  if (bottomZ == null) return null;
  if (bottomZ + stackTopSpan > sketch.heightCells) return null;
  const deltaZ = bottomZ - bottom.origin.z;

  const poses = stack.map((box) => ({
    boxId: box.id,
    origin: {
      x: box.origin.x + deltaX,
      y: box.origin.y + deltaY,
      z: box.origin.z + deltaZ,
    },
  }));

  for (const pose of poses) {
    const box = stack.find((entry) => entry.id === pose.boxId);
    if (!box) return null;
    if (
      !canPlaceManualBayBox(sketch, boxes, box.id, pose.origin, ignore)
    ) {
      return null;
    }
  }

  const unchanged = poses.every((pose) => {
    const box = stack.find((entry) => entry.id === pose.boxId);
    return (
      box != null &&
      pose.origin.x === box.origin.x &&
      pose.origin.y === box.origin.y &&
      pose.origin.z === box.origin.z
    );
  });
  if (unchanged) return boxes;
  return applyManualBayPoses(boxes, poses);
}

/**
 * Live footprint highlight while dragging a stack via the stacked badge.
 * Cells are the union of every stack member at the previewed pose.
 */
export function previewManualBayStackDrop(
  sketch: ShipCargoGridSketch,
  boxes: PlacedCargoBox[],
  seedBoxId: string,
  dropCell: CargoGridCoord,
  grabOffset: { dx: number; dy: number },
): { cells: CargoGridCoord[]; origin: CargoGridCoord; fits: boolean } | null {
  const seed = boxes.find((box) => box.id === seedBoxId);
  if (!seed) return null;
  const stack = manualBayBoxStackColumn(seed, boxes);
  if (stack.length <= 1) {
    return previewManualBayDrop(
      sketch,
      boxes,
      seedBoxId,
      dropCell,
      grabOffset,
    );
  }
  const bottom = stack[0]!;
  const ignore = new Set(stack.map((box) => box.id));
  const deltaX = dropCell.x - grabOffset.dx - seed.origin.x;
  const deltaY = dropCell.y - grabOffset.dy - seed.origin.y;
  const stackTopSpan = Math.max(
    ...stack.map(
      (box) => box.origin.z + box.footprint.dz - bottom.origin.z,
    ),
  );
  const bottomZ = resolveManualBayDropZ(
    sketch,
    boxes,
    bottom,
    bottom.origin.x + deltaX,
    bottom.origin.y + deltaY,
    ignore,
  );
  let fits =
    bottomZ != null && bottomZ + stackTopSpan <= sketch.heightCells;
  const deltaZ = fits && bottomZ != null ? bottomZ - bottom.origin.z : 0;
  const cells: CargoGridCoord[] = [];
  for (const box of stack) {
    const origin: CargoGridCoord = {
      x: box.origin.x + deltaX,
      y: box.origin.y + deltaY,
      z: box.origin.z + deltaZ,
    };
    cells.push(...footprintCells(origin, box.footprint));
    if (
      fits &&
      !canPlaceManualBayBox(sketch, boxes, box.id, origin, ignore)
    ) {
      fits = false;
    }
  }
  return {
    cells,
    origin: {
      x: seed.origin.x + deltaX,
      y: seed.origin.y + deltaY,
      z: seed.origin.z + deltaZ,
    },
    fits,
  };
}

/** 2D Z layer that shows this crate’s top face (Split 3D→2D focus). */
export function manualBayBoxFocusLayer(box: PlacedCargoBox): number {
  return Math.max(0, box.origin.z + box.footprint.dz - 1);
}

/** Resolve a 2D bay cell under the pointer (`data-cargo-cell` buttons). */
export function cargoCellCoordFromPoint(
  clientX: number,
  clientY: number,
): CargoGridCoord | null {
  if (typeof document === "undefined") return null;
  // Walk the stack — placed crates sit above cells and would otherwise hide them.
  const stack =
    typeof document.elementsFromPoint === "function"
      ? document.elementsFromPoint(clientX, clientY)
      : [document.elementFromPoint(clientX, clientY)].filter(Boolean);
  for (const el of stack) {
    if (!(el instanceof Element)) continue;
    const cell = el.closest("[data-cargo-cell='1']");
    if (!(cell instanceof HTMLElement)) continue;
    const x = Number(cell.dataset.cargoX);
    const y = Number(cell.dataset.cargoY);
    const z = Number(cell.dataset.cargoZ);
    if (![x, y, z].every((value) => Number.isFinite(value))) continue;
    return { x, y, z };
  }
  return null;
}

function footprintAtOrientation(
  size: CargoBoxScu,
  orientationIndex: number,
): PlacedCargoBox["footprint"] | null {
  const orientations = cargoBoxOrientations(size);
  if (orientations.length === 0) return null;
  const index =
    ((orientationIndex % orientations.length) + orientations.length) %
    orientations.length;
  return orientations[index] ?? null;
}

/** Remove one crate from the bay (returns to Manual tray demand). */
export function tryRemoveManualBayBox(
  boxes: PlacedCargoBox[],
  boxId: string,
): PlacedCargoBox[] | null {
  if (!boxes.some((box) => box.id === boxId)) return null;
  return boxes.filter((box) => box.id !== boxId);
}

/**
 * Ghost footprint for Manual tray place / drag.
 * Uses `orientationIndex` (R cycles). Z snaps like crate drops (deck or
 * full-support stack) — UI active layer is only the hover XY hint.
 */
export function previewManualBayPlacement(
  sketch: ShipCargoGridSketch,
  boxes: PlacedCargoBox[],
  spec: ManualBayAddBoxSpec,
  origin: CargoGridCoord,
  orientationIndex = 0,
): { cells: CargoGridCoord[]; fits: boolean } | null {
  const footprint = footprintAtOrientation(spec.size, orientationIndex);
  if (!footprint) return null;
  const z = resolveManualBayStackZ(
    sketch,
    boxes,
    footprint,
    spec.size,
    origin.x,
    origin.y,
    new Set(),
  );
  if (z == null) {
    const fallbackCells = footprintCells(
      { x: origin.x, y: origin.y, z: origin.z },
      footprint,
    );
    return { cells: fallbackCells, fits: false };
  }
  const placedOrigin: CargoGridCoord = { x: origin.x, y: origin.y, z };
  return {
    cells: footprintCells(placedOrigin, footprint),
    fits: true,
  };
}

/**
 * Place a new crate from the Manual tray at `origin` XY.
 * Z snaps to deck or a full-support stack (same rules as crate drag).
 */
export function tryAddManualBayBox(
  sketch: ShipCargoGridSketch,
  boxes: PlacedCargoBox[],
  spec: ManualBayAddBoxSpec,
  origin: CargoGridCoord,
  orientationIndex = 0,
): PlacedCargoBox[] | null {
  const footprint = footprintAtOrientation(spec.size, orientationIndex);
  if (!footprint) return null;
  const z = resolveManualBayStackZ(
    sketch,
    boxes,
    footprint,
    spec.size,
    origin.x,
    origin.y,
    new Set(),
  );
  if (z == null) return null;
  const placedOrigin: CargoGridCoord = { x: origin.x, y: origin.y, z };
  const cells = footprintCells(placedOrigin, footprint);
  const id = `manual-${spec.commoditySlug}-${spec.size}-${placedOrigin.x}-${placedOrigin.y}-${placedOrigin.z}-${Date.now()}`;
  const next: PlacedCargoBox = {
    id,
    size: spec.size,
    origin: { ...placedOrigin },
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

/** Drag the full remaining amount of one cargo type onto a bay section. */
export type ManualBayBulkFillSpec = {
  missionId: string | null;
  commoditySlug: string;
  commodityName: string;
  color: string | null;
  color2: string | null;
  /** Remaining crates by size — packer places largest first. */
  crates: Array<{ size: CargoBoxScu; count: number }>;
};

/**
 * Drag a whole mission onto a bay section — packs every remaining cargo type
 * as one logical block (types by total SCU desc; crates largest first).
 */
export type ManualBayMissionFillSpec = {
  missionId: string | null;
  missionTitle: string;
  commodities: ManualBayBulkFillSpec[];
};

export type ManualBayBulkFillResult = {
  boxes: PlacedCargoBox[];
  /** Crates added into the target section. */
  placedCount: number;
  /** Crates that still did not fit (stay in tray). */
  unplacedCount: number;
  zoneId: string;
};

function crateLineScu(
  crates: Array<{ size: CargoBoxScu; count: number }>,
): number {
  return crates.reduce((sum, line) => sum + line.size * line.count, 0);
}

/** Flatten Fill crates into placement items (largest sizes first within type). */
function itemsFromFillCrates(
  fill: Pick<
    ManualBayBulkFillSpec,
    | "missionId"
    | "commoditySlug"
    | "commodityName"
    | "color"
    | "color2"
    | "crates"
  >,
  options?: { regionKey?: string },
): CargoPlacementItem[] {
  const crates = [...fill.crates]
    .filter((line) => line.count > 0)
    .sort((a, b) => b.size - a.size);
  const items: CargoPlacementItem[] = [];
  for (const line of crates) {
    for (let i = 0; i < line.count; i += 1) {
      items.push({
        size: line.size,
        commoditySlug: fill.commoditySlug,
        commodityName: fill.commodityName,
        color: fill.color,
        color2: fill.color2,
        missionId: fill.missionId,
        action: "pickup",
        regionKey: options?.regionKey,
      });
    }
  }
  return items;
}

function occupiedMapsFromBoxes(boxes: PlacedCargoBox[]): {
  occupied: CargoGridCoord[];
  occupiedClusters: Map<string, string>;
} {
  const occupied: CargoGridCoord[] = [];
  const occupiedClusters = new Map<string, string>();
  for (const box of boxes) {
    occupied.push(...box.cells);
    for (const cell of box.cells) {
      occupiedClusters.set(cargoGridCoordKey(cell), box.commoditySlug);
    }
  }
  return { occupied, occupiedClusters };
}

/**
 * Deck footprint (cells) needed to hold `crates` when stacked up to
 * `zoneHeightCells`. Largest boxes first; returns a compact width×length.
 */
export function estimateManualBayBulkFillFootprint(
  crates: Array<{ size: CargoBoxScu; count: number }>,
  zoneHeightCells: number,
): { dx: number; dy: number; deckCells: number; totalScu: number } {
  const height = Math.max(1, zoneHeightCells);
  let totalScu = 0;
  let deckCells = 0;
  const sorted = [...crates]
    .filter((line) => line.count > 0)
    .sort((a, b) => b.size - a.size);
  for (const line of sorted) {
    totalScu += line.size * line.count;
    const footprint = cargoBoxOrientations(line.size)[0];
    if (!footprint) continue;
    const stacksPerColumn = Math.max(1, Math.floor(height / footprint.dz));
    const columns = Math.ceil(line.count / stacksPerColumn);
    deckCells += columns * footprint.dx * footprint.dy;
  }
  if (deckCells <= 0) {
    return { dx: 1, dy: 1, deckCells: 0, totalScu };
  }
  // Compact rectangle (prefer slightly longer along X / bay length).
  const dy = Math.max(1, Math.round(Math.sqrt(deckCells)));
  const dx = Math.max(1, Math.ceil(deckCells / dy));
  return { dx, dy, deckCells, totalScu };
}

/**
 * Lay out a bulk-fill preview rectangle so the hovered zone holds as much of
 * the highlight as possible (matches drop: fill this bay first). Overflow
 * only extends past the zone when deck demand exceeds that bay’s floor.
 */
export function layoutManualBayBulkFillPreview(
  span: { xStart: number; xEnd: number; yStart: number; yEnd: number },
  dropCell: CargoGridCoord,
  deckCells: number,
): { dx: number; dy: number; origin: CargoGridCoord } {
  const zoneDx = Math.max(1, span.xEnd - span.xStart);
  const zoneDy = Math.max(1, span.yEnd - span.yStart);
  const zoneArea = zoneDx * zoneDy;
  const need = Math.max(1, deckCells);
  const z = dropCell.z;

  if (need <= zoneArea) {
    // Compact rect that fits entirely inside the hovered bay.
    let dy = Math.min(zoneDy, Math.max(1, Math.round(Math.sqrt(need))));
    let dx = Math.min(zoneDx, Math.max(1, Math.ceil(need / dy)));
    while (dx * dy < need && (dx < zoneDx || dy < zoneDy)) {
      if (dx <= dy && dx < zoneDx) dx += 1;
      else if (dy < zoneDy) dy += 1;
      else dx += 1;
    }
    const originX = Math.min(
      Math.max(dropCell.x, span.xStart),
      span.xEnd - dx,
    );
    const originY = Math.min(
      Math.max(dropCell.y, span.yStart),
      span.yEnd - dy,
    );
    return {
      dx,
      dy,
      origin: { x: originX, y: originY, z },
    };
  }

  // Larger than this bay: cover the whole zone first, then spill along +X.
  const dy = zoneDy;
  const dx = Math.max(zoneDx, Math.ceil(need / dy));
  return {
    dx,
    dy,
    origin: { x: span.xStart, y: span.yStart, z },
  };
}

function previewFromFillResult(
  dry: ManualBayBulkFillResult | null,
  occupiedBoxes: PlacedCargoBox[],
): {
  zoneId: string;
  cells: CargoGridCoord[];
  fits: boolean;
  footprint: { dx: number; dy: number; origin: CargoGridCoord };
} | null {
  if (!dry || dry.placedCount === 0) return null;
  const existingIds = new Set(occupiedBoxes.map((box) => box.id));
  const placed = dry.boxes.filter((box) => !existingIds.has(box.id));
  const cells: CargoGridCoord[] = [];
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  for (const box of placed) {
    for (const cell of box.cells) {
      cells.push(cell);
      minX = Math.min(minX, cell.x);
      maxX = Math.max(maxX, cell.x);
      minY = Math.min(minY, cell.y);
      maxY = Math.max(maxY, cell.y);
      minZ = Math.min(minZ, cell.z);
    }
  }
  if (cells.length === 0) return null;
  return {
    zoneId: dry.zoneId,
    cells,
    fits: dry.unplacedCount === 0,
    footprint: {
      dx: maxX - minX + 1,
      dy: maxY - minY + 1,
      origin: { x: minX, y: minY, z: minZ },
    },
  };
}

/**
 * Highlight for Fill drag: dry-run the same zone packer as drop (incl. Z
 * stacking) so width/length match what lands, not a flat deck estimate.
 */
export function previewManualBayZoneFill(
  sketch: ShipCargoGridSketch,
  dropCell: CargoGridCoord,
  fill?: Pick<ManualBayBulkFillSpec, "crates"> | null,
  occupiedBoxes: PlacedCargoBox[] = [],
): {
  zoneId: string;
  cells: CargoGridCoord[];
  fits: boolean;
  footprint: { dx: number; dy: number; origin: CargoGridCoord };
} | null {
  const dry = tryFillManualBayZoneWithCargoType(
    sketch,
    occupiedBoxes,
    dropCell,
    {
      missionId: null,
      commoditySlug: "preview",
      commodityName: "Preview",
      color: null,
      color2: null,
      crates: fill?.crates ?? [{ size: 8, count: 1 }],
    },
  );
  return previewFromFillResult(dry, occupiedBoxes);
}

/** Highlight for mission-parent Fill drag (same packer as drop). */
export function previewManualBayZoneMissionFill(
  sketch: ShipCargoGridSketch,
  dropCell: CargoGridCoord,
  fill: ManualBayMissionFillSpec,
  occupiedBoxes: PlacedCargoBox[] = [],
): {
  zoneId: string;
  cells: CargoGridCoord[];
  fits: boolean;
  footprint: { dx: number; dy: number; origin: CargoGridCoord };
} | null {
  return previewFromFillResult(
    tryFillManualBayZoneWithMission(sketch, occupiedBoxes, dropCell, fill),
    occupiedBoxes,
  );
}

function placeFillItemsInZone(
  sketch: ShipCargoGridSketch,
  boxes: PlacedCargoBox[],
  dropCell: CargoGridCoord,
  items: CargoPlacementItem[],
  idNamespace: string,
  options?: {
    preferRegionStacking?: boolean;
  },
): ManualBayBulkFillResult | null {
  if (items.length === 0) return null;
  const zone = cargoGridZoneAtXY(sketch, dropCell.x, dropCell.y);
  if (!zone || (zone.kind !== "cargo" && zone.kind !== "overflow")) {
    return null;
  }
  const { occupied, occupiedClusters } = occupiedMapsFromBoxes(boxes);
  const storage = cargoGridZoneStorageLocation(zone) ?? "front";
  // Cargo-type slot policy + clustering so Galaxy Lift L/R pack outer-wall
  // first and leave open cells toward the aisle (middle), not the wall.
  // preferNearCoord: Hercules-sized zones seed the pile at the drop cell.
  const program = compileCargoTypePackProgram({
    bays: packBaysFromSketch(sketch),
  });
  const packSlotPolicy = derivePackSlotPolicy(program);
  const plan = placeCargoItemsInZone(sketch, storage, items, {
    occupied,
    occupiedClusters,
    restrictZoneIds: [zone.id],
    preferNearCoord: dropCell,
    itemsPreordered: true,
    clusterByKey: true,
    preferRegionStacking: options?.preferRegionStacking,
    packSlotPolicy,
    idNamespace: `${idNamespace}-${zone.id}`,
  });
  return {
    boxes: [...boxes, ...plan.boxes],
    placedCount: plan.boxes.length,
    unplacedCount: plan.unplaced.length,
    zoneId: zone.id,
  };
}

/**
 * Pack as much of one cargo type as fits into the section under `dropCell`.
 * Largest SCU crates first; leftovers remain for one-at-a-time tray place.
 */
export function tryFillManualBayZoneWithCargoType(
  sketch: ShipCargoGridSketch,
  boxes: PlacedCargoBox[],
  dropCell: CargoGridCoord,
  fill: ManualBayBulkFillSpec,
): ManualBayBulkFillResult | null {
  return placeFillItemsInZone(
    sketch,
    boxes,
    dropCell,
    itemsFromFillCrates(fill),
    `manual-fill-${fill.commoditySlug}`,
  );
}

/**
 * Pack all remaining cargo for one mission into the section under `dropCell`.
 * Cargo types by total SCU (desc); within each type, largest crates first.
 * Types share a mission region so they land as one logical block.
 */
export function tryFillManualBayZoneWithMission(
  sketch: ShipCargoGridSketch,
  boxes: PlacedCargoBox[],
  dropCell: CargoGridCoord,
  fill: ManualBayMissionFillSpec,
): ManualBayBulkFillResult | null {
  const regionKey = `mission:${fill.missionId ?? "_"}`;
  const sorted = [...fill.commodities]
    .filter((commodity) => crateLineScu(commodity.crates) > 0)
    .sort((a, b) => {
      const scu = crateLineScu(b.crates) - crateLineScu(a.crates);
      if (scu !== 0) return scu;
      return a.commodityName.localeCompare(b.commodityName);
    });
  if (sorted.length === 0) return null;
  const items: CargoPlacementItem[] = [];
  for (const commodity of sorted) {
    items.push(...itemsFromFillCrates(commodity, { regionKey }));
  }
  return placeFillItemsInZone(
    sketch,
    boxes,
    dropCell,
    items,
    `manual-fill-mission-${fill.missionId ?? "none"}`,
    { preferRegionStacking: true },
  );
}
