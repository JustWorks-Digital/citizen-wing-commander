/**
 * Manual bay layout when advancing stops: the player’s earlier arrangement is
 * the same physical crates — deplete crates that were delivered at earlier
 * stops, then refresh this stop’s delivery tags on what remains.
 */

import type { HaulingChecklistRow } from "@/lib/missions/sessionChecklist";
import type {
  CargoGridBoxAction,
  PlacedCargoBox,
} from "@/lib/ships/cargoGridPlacement";

function commodityKey(box: PlacedCargoBox): string {
  return `${box.missionId ?? "_"}:${box.commoditySlug}`;
}

function commoditySlug(box: PlacedCargoBox): string {
  return box.commoditySlug;
}

function addScu(map: Map<string, number>, key: string, size: number) {
  map.set(key, (map.get(key) ?? 0) + size);
}

/** Top face Z of a placed crate (higher = more accessible on a stack). */
function boxTopZ(box: PlacedCargoBox): number {
  return box.origin.z + box.footprint.dz;
}

/** Stack column — crates sharing a footprint origin XY sit in one pile. */
function stackColumnKey(box: PlacedCargoBox): string {
  return `${box.origin.x},${box.origin.y}`;
}

export type DeliveryRetagOptions = {
  /**
   * Ship deck width in cells. Prefer aisle / inside (nearer center Y) over
   * outer wall edges (Galaxy Lift L/R walls).
   */
  deckWidthCells?: number;
  /**
   * Route + snapshot stop — deliveries after `earlierStopId` through the stop
   * before `currentStopId` are removed from the Manual poses (same order
   * Transfer would have unloaded them).
   */
  rows?: readonly HaulingChecklistRow[];
  earlierStopId?: string | null;
  currentStopId?: string | null;
};

/**
 * Delivery pick / deplete order:
 * 1. Prefer doorward columns (high X — closer to the player) over back-of-bay.
 * 2. Prefer inside / aisle (nearer deck center Y) over wall edges.
 * 3. Clear one column top→bottom before another column’s top.
 */
function rankIndicesForDelivery(
  boxes: readonly PlacedCargoBox[],
  indices: readonly number[],
  options?: DeliveryRetagOptions,
): number[] {
  type Column = {
    key: string;
    indices: number[];
    originX: number;
    centerY: number;
    maxTopZ: number;
    minIndex: number;
  };
  const columns = new Map<string, Column>();

  for (const index of indices) {
    const box = boxes[index]!;
    const key = stackColumnKey(box);
    let column = columns.get(key);
    if (!column) {
      column = {
        key,
        indices: [],
        originX: box.origin.x,
        centerY: box.origin.y + (box.footprint.dy - 1) / 2,
        maxTopZ: 0,
        minIndex: index,
      };
      columns.set(key, column);
    }
    column.indices.push(index);
    column.maxTopZ = Math.max(column.maxTopZ, boxTopZ(box));
    column.minIndex = Math.min(column.minIndex, index);
  }

  const deckWidth = options?.deckWidthCells;
  const shipCy = deckWidth != null && deckWidth > 0 ? (deckWidth - 1) / 2 : null;

  const rankedColumns = [...columns.values()].sort((a, b) => {
    if (b.originX !== a.originX) return b.originX - a.originX;
    if (shipCy != null) {
      const distA = Math.abs(a.centerY - shipCy);
      const distB = Math.abs(b.centerY - shipCy);
      if (distA !== distB) return distA - distB;
    }
    if (b.maxTopZ !== a.maxTopZ) return b.maxTopZ - a.maxTopZ;
    return a.minIndex - b.minIndex;
  });

  const ranked: number[] = [];
  for (const column of rankedColumns) {
    column.indices.sort((a, b) => {
      const top = boxTopZ(boxes[b]!) - boxTopZ(boxes[a]!);
      if (top !== 0) return top;
      return a - b;
    });
    ranked.push(...column.indices);
  }
  return ranked;
}

function isDeliveryCargo(
  row: HaulingChecklistRow,
  cargo: HaulingChecklistRow["cargoDeliveries"][number],
): boolean {
  if (row.routeAction === "pickup" || row.routeAction === "quantum") {
    return false;
  }
  if (row.routeAction === "delivery") return true;
  return cargo.role === "delivery";
}

/** SCU unloaded at this stop, keyed by commodity slug. */
function deliveryScuBySlug(row: HaulingChecklistRow): Map<string, number> {
  const map = new Map<string, number>();
  for (const cargo of row.cargoDeliveries) {
    if (!isDeliveryCargo(row, cargo)) continue;
    if (cargo.scu <= 0) continue;
    addScu(map, cargo.commoditySlug, cargo.scu);
  }
  return map;
}

/**
 * Pull specific crates off the bay for a stop’s deliveries — same order
 * Transfer highlights (doorward / aisle / top-of-stack).
 */
export function removeDeliveredCrates(
  boxes: readonly PlacedCargoBox[],
  deliveryBySlug: ReadonlyMap<string, number>,
  options?: DeliveryRetagOptions,
): PlacedCargoBox[] {
  if (boxes.length === 0 || deliveryBySlug.size === 0) {
    return boxes.map((box) => ({
      ...box,
      origin: { ...box.origin },
      footprint: { ...box.footprint },
      cells: box.cells.map((cell) => ({ ...cell })),
    }));
  }

  const removeBudget = new Map(deliveryBySlug);
  const drop = new Set<number>();

  const bySlug = new Map<string, number[]>();
  for (let index = 0; index < boxes.length; index += 1) {
    const slug = boxes[index]!.commoditySlug;
    const list = bySlug.get(slug) ?? [];
    list.push(index);
    bySlug.set(slug, list);
  }

  for (const [slug, budget] of removeBudget) {
    if (budget <= 0) continue;
    const indices = bySlug.get(slug);
    if (!indices || indices.length === 0) continue;
    const ranked = rankIndicesForDelivery(boxes, indices, options);
    let removed = 0;
    for (const index of ranked) {
      if (removed >= budget) break;
      const box = boxes[index]!;
      if (removed + box.size > budget) continue;
      drop.add(index);
      removed += box.size;
    }
  }

  return boxes
    .filter((_, index) => !drop.has(index))
    .map((box) => ({
      ...box,
      origin: { ...box.origin },
      footprint: { ...box.footprint },
      cells: box.cells.map((cell) => ({ ...cell })),
    }));
}

/**
 * Among same-commodity crates, assign this stop’s delivery SCU so Transfer
 * highlights accessible crates: doorward / aisle columns first, and finish a
 * stack top→bottom before another column’s top. Leaves `pickup` tags alone.
 */
export function retagDeliveryPreferringTop(
  boxes: readonly PlacedCargoBox[],
  options?: DeliveryRetagOptions,
): PlacedCargoBox[] {
  if (boxes.length === 0) return [];

  const next = boxes.map((box) => ({
    ...box,
    origin: { ...box.origin },
    footprint: { ...box.footprint },
    cells: box.cells.map((cell) => ({ ...cell })),
  }));

  type Group = {
    indices: number[];
    deliveryBudget: number;
    sample: PlacedCargoBox | null;
  };
  const groups = new Map<string, Group>();

  for (let index = 0; index < next.length; index += 1) {
    const box = next[index]!;
    if (box.action === "pickup") continue;
    const key = commodityKey(box);
    let group = groups.get(key);
    if (!group) {
      group = { indices: [], deliveryBudget: 0, sample: null };
      groups.set(key, group);
    }
    group.indices.push(index);
    if (box.action === "delivery") {
      group.deliveryBudget += box.size;
      if (!group.sample) group.sample = box;
    }
  }

  for (const group of groups.values()) {
    if (group.deliveryBudget <= 0 || group.indices.length < 2) continue;

    const ranked = rankIndicesForDelivery(next, group.indices, options);

    let tagged = 0;
    for (const index of ranked) {
      const box = next[index]!;
      if (tagged + box.size <= group.deliveryBudget) {
        const sample = group.sample ?? box;
        box.action = "delivery";
        box.deliveryLocationSlug = sample.deliveryLocationSlug;
        box.deliveryLocationName = sample.deliveryLocationName;
        box.locationGroupIndex = sample.locationGroupIndex;
        tagged += box.size;
      } else {
        box.action = undefined;
        box.deliveryLocationSlug = undefined;
        box.deliveryLocationName = undefined;
        box.locationGroupIndex = undefined;
      }
    }
  }

  return next;
}

/**
 * Strip crates delivered on stops after the Manual snapshot through the stop
 * before the current one (Farnesway drop leaves those poses before Cassillo).
 */
function depleteDeliveriesSinceSnapshot(
  boxes: readonly PlacedCargoBox[],
  options?: DeliveryRetagOptions,
): PlacedCargoBox[] {
  const rows = options?.rows;
  const earlierStopId = options?.earlierStopId;
  const currentStopId = options?.currentStopId;
  if (!rows?.length || !earlierStopId || !currentStopId) {
    return [...boxes];
  }
  const earlierIndex = rows.findIndex((row) => row.id === earlierStopId);
  const currentIndex = rows.findIndex((row) => row.id === currentStopId);
  if (earlierIndex < 0 || currentIndex < 0 || currentIndex <= earlierIndex) {
    return [...boxes];
  }

  let next = [...boxes];
  for (let index = earlierIndex; index < currentIndex; index += 1) {
    // Snapshot was taken *at* earlierStop while delivery crates were still
    // aboard — remove that stop’s unload, then every stop until current.
    const row = rows[index]!;
    const deliveryBySlug = deliveryScuBySlug(row);
    if (deliveryBySlug.size === 0) continue;
    next = removeDeliveredCrates(next, deliveryBySlug, options);
  }
  return next;
}

export const manualBayCarryover = {
  retagDeliveryPreferringTop,
  removeDeliveredCrates,

  /**
   * Keep earlier Manual crate poses after stripping deliveries that already
   * happened on the route, then tag this stop’s delivery SCU on what remains.
   * Does not place fresh auto-pack poses for re-split sizes.
   */
  boxesAtStop(
    autoBoxes: readonly PlacedCargoBox[],
    earlierLayout: readonly PlacedCargoBox[],
    options?: DeliveryRetagOptions,
  ): PlacedCargoBox[] {
    if (earlierLayout.length === 0) {
      return retagDeliveryPreferringTop(autoBoxes, options);
    }

    const depleted = depleteDeliveriesSinceSnapshot(earlierLayout, options);

    const totalByKey = new Map<string, number>();
    const totalBySlug = new Map<string, number>();
    const deliveryBySlug = new Map<string, number>();
    const sampleByKey = new Map<string, PlacedCargoBox>();
    const sampleBySlug = new Map<string, PlacedCargoBox>();

    for (const box of autoBoxes) {
      const key = commodityKey(box);
      const slug = commoditySlug(box);
      addScu(totalByKey, key, box.size);
      addScu(totalBySlug, slug, box.size);
      if (box.action === "delivery") {
        addScu(deliveryBySlug, slug, box.size);
      }
      if (!sampleByKey.has(key)) sampleByKey.set(key, box);
      if (!sampleBySlug.has(slug)) sampleBySlug.set(slug, box);
    }

    const remainingTotalKey = new Map(totalByKey);
    const remainingTotalSlug = new Map(totalBySlug);
    const deliveryTaggedSlug = new Map<string, number>();
    const carried: PlacedCargoBox[] = [];

    // Doorward / aisle columns, then top→bottom within a pile.
    const rankedEarlier = rankIndicesForDelivery(
      depleted,
      depleted.map((_, index) => index),
      options,
    ).map((index) => depleted[index]!);

    for (const earlier of rankedEarlier) {
      const key = commodityKey(earlier);
      const slug = commoditySlug(earlier);
      const keyLeft = remainingTotalKey.get(key) ?? 0;
      const slugLeft = remainingTotalSlug.get(slug) ?? 0;
      // Slug pool is the hard aboard cap after prior-stop depletion.
      if (slugLeft < earlier.size) continue;
      const preferKey = keyLeft >= earlier.size;
      remainingTotalSlug.set(slug, slugLeft - earlier.size);
      if (preferKey) {
        remainingTotalKey.set(key, keyLeft - earlier.size);
      }

      const deliveryBudget = deliveryBySlug.get(slug) ?? 0;
      const alreadyTagged = deliveryTaggedSlug.get(slug) ?? 0;
      const action: CargoGridBoxAction | undefined =
        alreadyTagged + earlier.size <= deliveryBudget ? "delivery" : undefined;
      if (action === "delivery") {
        deliveryTaggedSlug.set(slug, alreadyTagged + earlier.size);
      }

      const sample =
        (preferKey ? sampleByKey.get(key) : undefined) ??
        sampleBySlug.get(slug) ??
        earlier;

      carried.push({
        ...earlier,
        origin: { ...earlier.origin },
        footprint: { ...earlier.footprint },
        cells: earlier.cells.map((cell) => ({ ...cell })),
        action,
        deliveryLocationSlug:
          action === "delivery" ? sample.deliveryLocationSlug : undefined,
        deliveryLocationName:
          action === "delivery" ? sample.deliveryLocationName : undefined,
        locationGroupIndex:
          action === "delivery" ? sample.locationGroupIndex : undefined,
        isOverflow: earlier.isOverflow,
      });
    }

    return retagDeliveryPreferringTop(carried, options);
  },
};
