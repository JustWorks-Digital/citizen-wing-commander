import { getCommodityBySlug } from "@/lib/fixtures";
import {
  cargoBoxOrientations,
  decomposeScuIntoBoxes,
  type CargoBoxFootprint,
  type CargoBoxScu,
} from "@/lib/ships/cargoBoxSizes";
import {
  cargoGridCoordKey,
  cargoGridZoneStorageLocation,
  type CargoGridCoord,
} from "@/lib/ships/cargoGridCoords";
import {
  cargoGridMaxWidth,
  cargoGridZoneWidth,
  type CargoGridStorageLocation,
  type ShipCargoGridSketch,
} from "@/lib/ships/cargoGrids";
import {
  forEachPlacementOrigin,
  resolvePlacementSlotOrder,
  scorePlacementSlot,
} from "@/lib/ships/cargoGridPlacementRules";
import type {
  CargoDelivery,
  HaulingChecklistRow,
  LegKind,
  ShipStorageLocation,
} from "@/lib/missions/mockSession";

export type CargoPlacementSegment = {
  /** Explicit crates; when set, skips greedy decompose. */
  boxSizes?: CargoBoxScu[];
  commoditySlug: string;
  commodityName: string;
  scu: number;
  color: string | null;
  color2: string | null;
};

export type CargoGridBoxAction = "pickup" | "delivery";

export type PlacedCargoBox = {
  id: string;
  /** SCU volume of this crate (may be a partial split from a larger crate). */
  size: number;
  /** Origin cell (min X/Y/Z corner of the box). */
  origin: CargoGridCoord;
  footprint: CargoBoxFootprint;
  commoditySlug: string;
  commodityName: string;
  color: string | null;
  color2: string | null;
  /** Every 1 SCU cell occupied by this crate. */
  cells: CargoGridCoord[];
  /** Set when this box is shown for a stop: load vs unload. */
  action?: CargoGridBoxAction;
};

export type CargoGridPlacementPlan = {
  zone: CargoGridStorageLocation;
  boxes: PlacedCargoBox[];
  /** Cells that could not be placed (overflow). */
  unplaced: Array<{
    size: CargoBoxScu;
    commoditySlug: string;
    commodityName: string;
  }>;
};

type ZoneBounds = {
  xStart: number;
  xEnd: number;
  yStart: number;
  yEnd: number;
  zEnd: number;
};

function boundsForZoneEntry(
  sketch: ShipCargoGridSketch,
  targetId: string,
): ZoneBounds | null {
  const maxWidth = cargoGridMaxWidth(sketch);
  let x = 0;
  for (const entry of sketch.zones) {
    const width = cargoGridZoneWidth(sketch, entry);
    const yStart = Math.floor((maxWidth - width) / 2);
    if (entry.id === targetId && entry.kind === "cargo") {
      return {
        xStart: x,
        xEnd: x + entry.lengthCells,
        yStart,
        yEnd: yStart + width,
        zEnd: sketch.heightCells,
      };
    }
    x += entry.lengthCells;
  }
  return null;
}

/**
 * Resolve bay bounds for a coarse storage location.
 * Ships without that bay (e.g. C2 has no `middle`) fall back to another cargo
 * zone so crates still pack instead of all going to "no free space".
 */
function zoneBoundsForStorage(
  sketch: ShipCargoGridSketch,
  zone: CargoGridStorageLocation,
): ZoneBounds | null {
  const maxWidth = cargoGridMaxWidth(sketch);
  let x = 0;
  for (const entry of sketch.zones) {
    const width = cargoGridZoneWidth(sketch, entry);
    const yStart = Math.floor((maxWidth - width) / 2);
    if (
      entry.kind === "cargo" &&
      cargoGridZoneStorageLocation(entry) === zone
    ) {
      return {
        xStart: x,
        xEnd: x + entry.lengthCells,
        yStart,
        yEnd: yStart + width,
        zEnd: sketch.heightCells,
      };
    }
    x += entry.lengthCells;
  }

  // Fallback order when the requested bay isn't on this ship's grid.
  const cargoZones = sketch.zones.filter((entry) => entry.kind === "cargo");
  if (cargoZones.length === 0) return null;

  const fallbackId = (() => {
    if (zone === "middle") {
      // Prefer a dedicated hold, else the largest bay (C2 → rear).
      const hold = cargoZones.find((entry) => entry.id === "hold");
      if (hold) return hold.id;
      return [...cargoZones].sort(
        (a, b) =>
          cargoGridZoneWidth(sketch, b) * b.lengthCells -
          cargoGridZoneWidth(sketch, a) * a.lengthCells,
      )[0]!.id;
    }
    if (zone === "front") {
      return (
        cargoZones.find((entry) => entry.id === "forward" || entry.id === "hold")
          ?.id ?? cargoZones[0]!.id
      );
    }
    // rear
    return (
      cargoZones.find((entry) => entry.id === "rear" || entry.id === "hold")
        ?.id ?? cargoZones[cargoZones.length - 1]!.id
    );
  })();

  return boundsForZoneEntry(sketch, fallbackId);
}

function cellsForBox(
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

function fits(
  bounds: ZoneBounds,
  origin: CargoGridCoord,
  footprint: CargoBoxFootprint,
  occupied: Set<string>,
): boolean {
  if (origin.x + footprint.dx > bounds.xEnd) return false;
  if (origin.y + footprint.dy > bounds.yEnd) return false;
  if (origin.z + footprint.dz > bounds.zEnd) return false;
  if (origin.x < bounds.xStart || origin.y < bounds.yStart || origin.z < 0) {
    return false;
  }
  for (const cell of cellsForBox(origin, footprint)) {
    if (occupied.has(cargoGridCoordKey(cell))) return false;
  }
  return true;
}

/**
 * Pick a slot using `cargoGridPlacementRules` scan order + preference scores
 * (flat layers first, smaller-on-larger, full-height toward the back, …).
 */
function findSlot(
  bounds: ZoneBounds,
  footprint: CargoBoxFootprint,
  occupied: Set<string>,
  occupiedSizes: ReadonlyMap<string, number>,
  zone: CargoGridStorageLocation,
): CargoGridCoord | null {
  const boxScu = footprint.dx * footprint.dy * footprint.dz;
  const ctx = {
    bounds,
    footprint,
    boxScu,
    zone,
    occupiedSizes,
  };
  const order = resolvePlacementSlotOrder(ctx);
  let best: CargoGridCoord | null = null;
  let bestScore = -Infinity;
  forEachPlacementOrigin(order, (origin) => {
    if (!fits(bounds, origin, footprint, occupied)) return;
    const score = scorePlacementSlot(ctx, origin);
    if (score > bestScore) {
      bestScore = score;
      best = origin;
    }
  });
  return best;
}

export type PlaceCargoInZoneOptions = {
  /**
   * Cells already taken (must stay unique). Later pickups skip these until a
   * matching delivery frees them on the route.
   */
  occupied?: Iterable<CargoGridCoord>;
};

/**
 * Place crates for one bay zone: decompose each segment with 8/4/2/1,
 * largest crates first, fill lower layers before stacking, prefer smaller
 * crates on larger ones. Never reuses a cell listed in `occupied` or claimed
 * earlier in this call.
 */
export function placeCargoInZone(
  sketch: ShipCargoGridSketch,
  zone: CargoGridStorageLocation,
  segments: CargoPlacementSegment[],
  options?: PlaceCargoInZoneOptions,
): CargoGridPlacementPlan {
  const bounds = zoneBoundsForStorage(sketch, zone);
  const boxes: PlacedCargoBox[] = [];
  const unplaced: CargoGridPlacementPlan["unplaced"] = [];
  const occupied = new Set<string>(
    [...(options?.occupied ?? [])].map(cargoGridCoordKey),
  );
  /** Cell → owning crate SCU (unknown prior occupancy treated as large support). */
  const occupiedSizes = new Map<string, number>();
  for (const key of occupied) {
    occupiedSizes.set(key, Number.POSITIVE_INFINITY);
  }

  const sizesForSegment = (segment: CargoPlacementSegment): CargoBoxScu[] => {
    if (segment.boxSizes && segment.boxSizes.length > 0) {
      return segment.boxSizes;
    }
    return decomposeScuIntoBoxes(segment.scu);
  };

  if (!bounds) {
    for (const segment of segments) {
      for (const size of sizesForSegment(segment)) {
        unplaced.push({
          size,
          commoditySlug: segment.commoditySlug,
          commodityName: segment.commodityName,
        });
      }
    }
    return { zone, boxes, unplaced };
  }

  type Pending = {
    size: CargoBoxScu;
    commoditySlug: string;
    commodityName: string;
    color: string | null;
    color2: string | null;
  };

  const pending: Pending[] = [];
  for (const segment of segments) {
    for (const size of sizesForSegment(segment)) {
      pending.push({
        size,
        commoditySlug: segment.commoditySlug,
        commodityName: segment.commodityName,
        color: segment.color,
        color2: segment.color2,
      });
    }
  }

  // Larger crates first (already mostly ordered per segment; re-sort globally).
  pending.sort((a, b) => b.size - a.size);

  let index = 0;
  for (const item of pending) {
    let placed = false;
    for (const footprint of cargoBoxOrientations(item.size)) {
      const origin = findSlot(
        bounds,
        footprint,
        occupied,
        occupiedSizes,
        zone,
      );
      if (!origin) continue;
      const cells = cellsForBox(origin, footprint);
      for (const cell of cells) {
        const key = cargoGridCoordKey(cell);
        occupied.add(key);
        occupiedSizes.set(key, item.size);
      }
      boxes.push({
        id: `${zone}-${index}-${item.size}-${item.commoditySlug}`,
        size: item.size,
        origin,
        footprint,
        commoditySlug: item.commoditySlug,
        commodityName: item.commodityName,
        color: item.color,
        color2: item.color2,
        cells,
      });
      index += 1;
      placed = true;
      break;
    }
    if (!placed) {
      unplaced.push({
        size: item.size,
        commoditySlug: item.commoditySlug,
        commodityName: item.commodityName,
      });
    }
  }

  return { zone, boxes, unplaced };
}

function resolveCargoRole(
  legKind: LegKind,
  role: CargoDelivery["role"],
): "pickup" | "delivery" | null {
  if (role) return role;
  if (legKind === "pickup" || legKind === "delivery") return legKind;
  return null;
}

function lotKey(
  zone: CargoGridStorageLocation,
  commoditySlug: string,
): string {
  return `${zone}:${commoditySlug}`;
}

type OnboardLot = {
  zone: CargoGridStorageLocation;
  commoditySlug: string;
  commodityName: string;
  color: string | null;
  color2: string | null;
  boxes: PlacedCargoBox[];
  cells: CargoGridCoord[];
};

function syncLotCells(lot: OnboardLot) {
  lot.cells = lot.boxes.flatMap((box) => box.cells);
}

type LotCellRef = {
  lot: OnboardLot;
  box: PlacedCargoBox;
  cell: CargoGridCoord;
};

type GapXRange = { xStart: number; xEnd: number };

/** Nose→ramp X spans of gap / walkway zones (e.g. C2 mid-gap). */
function gapXRangesForSketch(sketch: ShipCargoGridSketch): GapXRange[] {
  const ranges: GapXRange[] = [];
  let x = 0;
  for (const zone of sketch.zones) {
    if (zone.kind === "gap") {
      ranges.push({ xStart: x, xEnd: x + zone.lengthCells });
    }
    x += zone.lengthCells;
  }
  return ranges;
}

/** Distance along X to the nearest gap block (larger = farther from walkway). */
function distanceFromGaps(cell: CargoGridCoord, gaps: GapXRange[]): number {
  if (gaps.length === 0) return 0;
  let min = Infinity;
  for (const gap of gaps) {
    if (cell.x < gap.xStart) {
      min = Math.min(min, gap.xStart - cell.x);
    } else if (cell.x >= gap.xEnd) {
      min = Math.min(min, cell.x - (gap.xEnd - 1));
    } else {
      min = 0;
    }
  }
  return min === Infinity ? 0 : min;
}

/**
 * Highest Z first (don't dig under stacks), then farther from gap blocks
 * (C2: nose-side of front bay / ramp-side of rear bay before cells by the gap).
 */
function compareCellsUnloadPriority(
  a: CargoGridCoord,
  b: CargoGridCoord,
  gaps: GapXRange[],
): number {
  if (b.z !== a.z) return b.z - a.z;
  const distDelta = distanceFromGaps(b, gaps) - distanceFromGaps(a, gaps);
  if (distDelta !== 0) return distDelta;
  if (a.x !== b.x) return a.x - b.x;
  return a.y - b.y;
}

function listLotCellsUnloadPriority(
  queue: OnboardLot[],
  gaps: GapXRange[],
): LotCellRef[] {
  const refs: LotCellRef[] = [];
  for (const lot of queue) {
    for (const box of lot.boxes) {
      for (const cell of box.cells) {
        refs.push({ lot, box, cell });
      }
    }
  }
  refs.sort((a, b) => compareCellsUnloadPriority(a.cell, b.cell, gaps));
  return refs;
}

function removeEmptyBoxes(queue: OnboardLot[]) {
  for (let i = queue.length - 1; i >= 0; i -= 1) {
    const lot = queue[i]!;
    lot.boxes = lot.boxes.filter((box) => box.cells.length > 0);
    for (const box of lot.boxes) {
      box.size = box.cells.length;
      box.origin = box.cells[0] ?? box.origin;
    }
    syncLotCells(lot);
    if (lot.boxes.length === 0) queue.splice(i, 1);
  }
}

/**
 * Peek which cells a delivery of `scu` would unload. Prefers higher Z (top of
 * stack) and splits larger crates when the delivery is smaller than a crate.
 */
function peekScuFromLots(
  queue: OnboardLot[],
  scu: number,
  idPrefix: string,
  gaps: GapXRange[],
): PlacedCargoBox[] {
  const selected = listLotCellsUnloadPriority(queue, gaps).slice(
    0,
    Math.max(0, scu),
  );
  if (selected.length === 0) return [];

  // Group contiguous selections back into per-box view crates when possible.
  const byBox = new Map<PlacedCargoBox, CargoGridCoord[]>();
  for (const ref of selected) {
    const list = byBox.get(ref.box) ?? [];
    list.push({ ...ref.cell });
    byBox.set(ref.box, list);
  }

  const taken: PlacedCargoBox[] = [];
  let splitIndex = 0;
  for (const [box, cells] of byBox) {
    cells.sort((a, b) => compareCellsUnloadPriority(a, b, gaps));
    if (cells.length === box.cells.length) {
      taken.push({
        ...box,
        cells: cells.map((cell) => ({ ...cell })),
        origin: { ...box.origin },
        footprint: { ...box.footprint },
      });
      continue;
    }
    taken.push({
      id: `${idPrefix}-${box.id}-${splitIndex}`,
      size: cells.length,
      origin: { ...cells[0]! },
      footprint: { dx: 1, dy: 1, dz: 1 },
      commoditySlug: box.commoditySlug,
      commodityName: box.commodityName,
      color: box.color,
      color2: box.color2,
      cells,
    });
    splitIndex += 1;
  }
  return taken;
}

/** Unload `scu` preferring high Z then far-from-gap; frees occupied / splits. */
function consumeScuFromLots(
  queue: OnboardLot[],
  scu: number,
  occupied: Set<string>,
  gaps: GapXRange[],
): void {
  const selected = listLotCellsUnloadPriority(queue, gaps).slice(
    0,
    Math.max(0, scu),
  );
  if (selected.length === 0) return;

  const removeKeys = new Set(
    selected.map((ref) => cargoGridCoordKey(ref.cell)),
  );

  for (const key of removeKeys) {
    occupied.delete(key);
  }

  for (const lot of queue) {
    for (const box of lot.boxes) {
      box.cells = box.cells.filter(
        (cell) => !removeKeys.has(cargoGridCoordKey(cell)),
      );
    }
  }

  removeEmptyBoxes(queue);
}

function segmentFromCargo(cargo: CargoDelivery): CargoPlacementSegment {
  const commodity = getCommodityBySlug(cargo.commoditySlug);
  return {
    commoditySlug: cargo.commoditySlug,
    commodityName: commodity?.name ?? cargo.commoditySlug,
    scu: cargo.scu,
    color: commodity?.color ?? null,
    color2: commodity?.color2 ?? null,
    boxSizes: cargo.boxSizes,
  };
}

function splitRowCargo(row: HaulingChecklistRow): {
  deliveries: Array<{ cargo: CargoDelivery; storage: ShipStorageLocation }>;
  pickups: Array<{ cargo: CargoDelivery; storage: ShipStorageLocation }>;
} {
  const deliveries: Array<{
    cargo: CargoDelivery;
    storage: ShipStorageLocation;
  }> = [];
  const pickups: Array<{
    cargo: CargoDelivery;
    storage: ShipStorageLocation;
  }> = [];
  for (const cargo of row.cargoDeliveries) {
    const role = resolveCargoRole(row.legKind, cargo.role);
    const storage = cargo.shipStorageLocation ?? row.shipStorageLocation;
    if (role === "delivery") deliveries.push({ cargo, storage });
    else if (role === "pickup") pickups.push({ cargo, storage });
  }
  return { deliveries, pickups };
}

/**
 * Walk the checklist in order. Pickups claim unique cells; deliveries free
 * matching FIFO lots so later pickups can reuse those coordinates.
 * At `both` stops, deliveries run before pickups.
 *
 * View plan for `rowId`: cargo delivered / picked up at this stop.
 * Pass `zone` to limit to one bay; omit for the whole location (all bays).
 */
export function planZoneOccupancyAtStop(
  sketch: ShipCargoGridSketch,
  rows: HaulingChecklistRow[],
  rowId: string,
  zone?: CargoGridStorageLocation | null,
): CargoGridPlacementPlan {
  const occupied = new Set<string>();
  const lotsByKey = new Map<string, OnboardLot[]>();
  const gapRanges = gapXRangesForSketch(sketch);

  const occupiedCoords = (): CargoGridCoord[] =>
    [...occupied].map((key) => {
      const [x, y, z] = key.split(",").map(Number);
      return { x: x!, y: y!, z: z! };
    });

  /** Prefer the tagged bay; if empty, fall back to any bay holding this commodity. */
  const lotsForDelivery = (
    cargo: CargoDelivery,
    storage: ShipStorageLocation,
  ): { key: string; queue: OnboardLot[] } => {
    const preferredKey = lotKey(storage, cargo.commoditySlug);
    const preferred = lotsByKey.get(preferredKey) ?? [];
    const preferredScu = preferred.reduce(
      (sum, lot) => sum + lot.boxes.reduce((n, box) => n + box.cells.length, 0),
      0,
    );
    if (preferredScu > 0) {
      return { key: preferredKey, queue: preferred };
    }
    for (const [key, queue] of lotsByKey) {
      if (!key.endsWith(`:${cargo.commoditySlug}`)) continue;
      const scu = queue.reduce(
        (sum, lot) =>
          sum + lot.boxes.reduce((n, box) => n + box.cells.length, 0),
        0,
      );
      if (scu > 0) return { key, queue };
    }
    return { key: preferredKey, queue: preferred };
  };

  const peekDeliverBoxes = (
    cargo: CargoDelivery,
    storage: ShipStorageLocation,
  ): PlacedCargoBox[] => {
    const { queue } = lotsForDelivery(cargo, storage);
    return peekScuFromLots(
      queue,
      cargo.scu,
      `deliver-${cargo.commoditySlug}`,
      gapRanges,
    );
  };

  const deliver = (
    cargo: CargoDelivery,
    storage: ShipStorageLocation,
  ) => {
    const { key, queue } = lotsForDelivery(cargo, storage);
    consumeScuFromLots(queue, cargo.scu, occupied, gapRanges);
    lotsByKey.set(key, queue);
  };

  const pickup = (
    cargo: CargoDelivery,
    storage: ShipStorageLocation,
  ): CargoGridPlacementPlan => {
    const segment = segmentFromCargo(cargo);
    const plan = placeCargoInZone(sketch, storage, [segment], {
      occupied: occupiedCoords(),
    });
    for (const box of plan.boxes) {
      for (const cell of box.cells) occupied.add(cargoGridCoordKey(cell));
    }
    if (plan.boxes.length > 0) {
      const lot: OnboardLot = {
        zone: storage,
        commoditySlug: cargo.commoditySlug,
        commodityName: segment.commodityName,
        color: segment.color,
        color2: segment.color2,
        boxes: [...plan.boxes],
        cells: plan.boxes.flatMap((box) => box.cells),
      };
      const key = lotKey(storage, cargo.commoditySlug);
      const queue = lotsByKey.get(key) ?? [];
      queue.push(lot);
      lotsByKey.set(key, queue);
    }
    return plan;
  };

  const viewBoxes: PlacedCargoBox[] = [];
  const viewUnplaced: CargoGridPlacementPlan["unplaced"] = [];
  const seenBoxIds = new Set<string>();

  const pushUniqueBoxes = (
    boxes: PlacedCargoBox[],
    action: CargoGridBoxAction,
  ) => {
    for (const box of boxes) {
      if (seenBoxIds.has(box.id)) continue;
      seenBoxIds.add(box.id);
      viewBoxes.push({ ...box, action });
    }
  };

  const inViewZone = (storage: ShipStorageLocation) =>
    zone == null || storage === zone;

  for (const row of rows) {
    const { deliveries, pickups } = splitRowCargo(row);
    const isTarget = row.id === rowId;

    if (isTarget) {
      // Show crates leaving the bay(s) (find them before freeing cells).
      for (const { cargo, storage } of deliveries) {
        if (!inViewZone(storage)) continue;
        pushUniqueBoxes(peekDeliverBoxes(cargo, storage), "delivery");
      }
    }

    for (const { cargo, storage } of deliveries) {
      deliver(cargo, storage);
    }

    for (const { cargo, storage } of pickups) {
      const plan = pickup(cargo, storage);
      if (isTarget && inViewZone(storage)) {
        pushUniqueBoxes(plan.boxes, "pickup");
        viewUnplaced.push(...plan.unplaced);
      }
    }

    if (isTarget) {
      return {
        zone: zone ?? "front",
        boxes: viewBoxes,
        unplaced: viewUnplaced,
      };
    }
  }

  return {
    zone: zone ?? "front",
    boxes: viewBoxes,
    unplaced: viewUnplaced,
  };
}

/** Whole-stop bay plan (all front/middle/rear cargo at `rowId`). */
export function planStopOccupancyAtStop(
  sketch: ShipCargoGridSketch,
  rows: HaulingChecklistRow[],
  rowId: string,
): CargoGridPlacementPlan {
  return planZoneOccupancyAtStop(sketch, rows, rowId, null);
}

/** Flat set of all occupied cells in a plan (for view highlighting). */
export function placementPlanCells(
  plan: CargoGridPlacementPlan,
): CargoGridCoord[] {
  return plan.boxes.flatMap((box) => box.cells);
}

/** Per-cell commodity tint data for color-coded grid views. */
export type CargoGridPlacementTint = {
  coord: CargoGridCoord;
  commoditySlug: string;
  commodityName: string;
  color: string | null;
  color2: string | null;
  action?: CargoGridBoxAction;
};

export function placementPlanTints(
  plan: CargoGridPlacementPlan,
): CargoGridPlacementTint[] {
  return plan.boxes.flatMap((box) =>
    box.cells.map((coord) => ({
      coord,
      commoditySlug: box.commoditySlug,
      commodityName: box.commodityName,
      color: box.color,
      color2: box.color2,
      action: box.action,
    })),
  );
}

export type CargoBoxCountBySize = {
  size: number;
  count: number;
};

/** Unique commodities in placement order (for legends), with crate breakdown. */
export function placementPlanLegend(
  plan: CargoGridPlacementPlan,
): Array<{
  commoditySlug: string;
  commodityName: string;
  color: string | null;
  color2: string | null;
  scu: number;
  /** Counts of each physical crate size (8 / 4 / 2 / 1), largest first. */
  boxCounts: CargoBoxCountBySize[];
}> {
  const map = new Map<
    string,
    {
      commoditySlug: string;
      commodityName: string;
      color: string | null;
      color2: string | null;
      scu: number;
      sizeTallies: Map<number, number>;
    }
  >();
  for (const box of plan.boxes) {
    const existing = map.get(box.commoditySlug);
    if (existing) {
      existing.scu += box.size;
      existing.sizeTallies.set(
        box.size,
        (existing.sizeTallies.get(box.size) ?? 0) + 1,
      );
      continue;
    }
    map.set(box.commoditySlug, {
      commoditySlug: box.commoditySlug,
      commodityName: box.commodityName,
      color: box.color,
      color2: box.color2,
      scu: box.size,
      sizeTallies: new Map([[box.size, 1]]),
    });
  }
  return [...map.values()].map((entry) => ({
    commoditySlug: entry.commoditySlug,
    commodityName: entry.commodityName,
    color: entry.color,
    color2: entry.color2,
    scu: entry.scu,
    boxCounts: [...entry.sizeTallies.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([size, count]) => ({ size, count })),
  }));
}

/** e.g. "12×8" or "2×8 1×4 1×1". */
export function formatCargoBoxCounts(
  boxCounts: CargoBoxCountBySize[],
): string {
  if (boxCounts.length === 0) return "";
  return boxCounts.map(({ count, size }) => `${count}×${size}`).join(" ");
}
