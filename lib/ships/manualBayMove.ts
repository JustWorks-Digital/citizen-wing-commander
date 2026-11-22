/**
 * Validate / apply XY moves for Manual 2D bay editing.
 * Z and footprint stay fixed; 3D reads the same placed boxes.
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

/** Origin for a drop under the pointer, preserving grab offset in the footprint. */
export function manualBayDropOrigin(
  moving: PlacedCargoBox,
  dropCell: CargoGridCoord,
  grabOffset: { dx: number; dy: number },
): CargoGridCoord {
  return {
    x: dropCell.x - grabOffset.dx,
    y: dropCell.y - grabOffset.dy,
    z: moving.origin.z,
  };
}

/**
 * Live footprint highlight while dragging a placed crate.
 * `fits` is false on gaps, collisions, or out-of-bay cells.
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
  const origin = manualBayDropOrigin(moving, dropCell, grabOffset);
  const cells = footprintCells(origin, moving.footprint);
  return {
    cells,
    origin,
    fits: canPlaceManualBayBox(sketch, boxes, boxId, origin),
  };
}

/**
 * Drop a dragged crate onto a pointer cell, preserving grab offset within the
 * footprint. Returns null when the cell is a gap / out of bay / collision —
 * caller should keep the pre-drag layout.
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
  const origin = manualBayDropOrigin(moving, dropCell, grabOffset);
  if (
    origin.x === moving.origin.x &&
    origin.y === moving.origin.y &&
    origin.z === moving.origin.z
  ) {
    return boxes;
  }
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

/** Cycle tray / place orientation (R shortcut). */
export function nextManualBayOrientationIndex(
  size: CargoBoxScu,
  orientationIndex: number,
): number {
  const count = cargoBoxOrientations(size).length;
  if (count <= 1) return 0;
  return ((orientationIndex % count) + count + 1) % count;
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
 * Uses `orientationIndex` (R cycles). Marks fits when the footprint is clear.
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
  const cells = footprintCells(origin, footprint);
  return { cells, fits: cellsClear(sketch, boxes, cells) };
}

/**
 * Place a new crate from the Manual tray at `origin` (active Z from UI)
 * using the chosen orientation index.
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
  const cells = footprintCells(origin, footprint);
  if (!cellsClear(sketch, boxes, cells)) return null;
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
