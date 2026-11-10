import { getCommodityBySlug } from "@/lib/fixtures";
import type { HaulingChecklistRow } from "@/lib/missions/mockSession";
import {
  decomposeScuIntoBoxes,
  type CargoBoxFootprint,
  type CargoBoxScu,
} from "@/lib/ships/cargoBoxSizes";
import type { CargoGridCoord } from "@/lib/ships/cargoGridCoords";
import type {
  CargoBoxCountBySize,
  CargoGridBoxAction,
  CargoGridPlacementTint,
  PlacedCargoBox,
} from "@/lib/ships/cargoGridPlacement";

export type StopCargoBoxGroup = {
  /** Stable stack id — mission + commodity (same cargo from different missions stays separate). */
  id: string;
  missionId: string | null;
  commoditySlug: string;
  commodityName: string;
  color: string | null;
  color2: string | null;
  scu: number;
  sizes: CargoBoxScu[];
  boxCounts: CargoBoxCountBySize[];
  /** Same commodity also appears in another mission stack at this stop. */
  isSplitMission: boolean;
};

/** @deprecated Use StopCargoBoxGroup */
export type StopDeliveryBoxGroup = StopCargoBoxGroup;

/** Empty cells between mission/commodity stacks on the reference pad. */
const STACK_GAP_CELLS = 2;
/** Pack each stack into a 2-wide column (fits 8 / 4 SCU crates). */
const STACK_WIDTH_CELLS = 2;

function tallyBoxSizes(sizes: CargoBoxScu[]): CargoBoxCountBySize[] {
  const tallies = new Map<number, number>();
  for (const size of sizes) {
    tallies.set(size, (tallies.get(size) ?? 0) + 1);
  }
  return [...tallies.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([size, count]) => ({ size, count }));
}

function matchesCargoRole(
  row: HaulingChecklistRow,
  role: CargoGridBoxAction,
  cargoRole: "pickup" | "delivery" | null | undefined,
): boolean {
  if (cargoRole === "pickup" || cargoRole === "delivery") {
    return cargoRole === role;
  }
  // Unlabeled: pickup-only legs → pickup; delivery or both → delivery.
  // On `both`, pickup lines must set role explicitly.
  if (role === "pickup") return row.legKind === "pickup";
  return row.legKind === "delivery" || row.legKind === "both";
}

function groupKey(
  action: CargoGridBoxAction,
  missionId: string | null | undefined,
  commoditySlug: string,
) {
  return `${action}:${missionId ?? "_"}:${commoditySlug}`;
}

/** Prefer flat footprints — grow against gravity (Z) only when needed. */
function flatFootprint(size: CargoBoxScu): CargoBoxFootprint {
  switch (size) {
    case 1:
      return { dx: 1, dy: 1, dz: 1 };
    case 2:
      return { dx: 2, dy: 1, dz: 1 };
    case 4:
      return { dx: 2, dy: 2, dz: 1 };
    case 8:
      return { dx: 2, dy: 2, dz: 2 };
    default: {
      const _exhaustive: never = size;
      return _exhaustive;
    }
  }
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

/**
 * Crates for a checklist stop role — one stack per mission + commodity.
 * Same commodity on two missions stays as two groups.
 */
export function stopCargoBoxGroups(
  row: HaulingChecklistRow,
  action: CargoGridBoxAction,
): StopCargoBoxGroup[] {
  const map = new Map<
    string,
    {
      id: string;
      missionId: string | null;
      commoditySlug: string;
      commodityName: string;
      color: string | null;
      color2: string | null;
      scu: number;
      sizes: CargoBoxScu[];
    }
  >();

  for (const cargo of row.cargoDeliveries) {
    if (!matchesCargoRole(row, action, cargo.role)) continue;

    const commodity = getCommodityBySlug(cargo.commoditySlug);
    const missionId = cargo.missionId ?? null;
    const id = groupKey(action, missionId, cargo.commoditySlug);
    const sizes: CargoBoxScu[] =
      cargo.boxSizes && cargo.boxSizes.length > 0
        ? [...cargo.boxSizes]
        : decomposeScuIntoBoxes(cargo.scu);

    const existing = map.get(id);
    if (existing) {
      existing.scu += cargo.scu;
      existing.sizes.push(...sizes);
      continue;
    }
    map.set(id, {
      id,
      missionId,
      commoditySlug: cargo.commoditySlug,
      commodityName: commodity?.name ?? cargo.commoditySlug,
      color: commodity?.color ?? null,
      color2: commodity?.color2 ?? null,
      scu: cargo.scu,
      sizes,
    });
  }

  const commodityHits = new Map<string, number>();
  for (const entry of map.values()) {
    commodityHits.set(
      entry.commoditySlug,
      (commodityHits.get(entry.commoditySlug) ?? 0) + 1,
    );
  }

  return [...map.values()].map((entry) => ({
    id: entry.id,
    missionId: entry.missionId,
    commoditySlug: entry.commoditySlug,
    commodityName: entry.commodityName,
    color: entry.color,
    color2: entry.color2,
    scu: entry.scu,
    sizes: entry.sizes,
    boxCounts: tallyBoxSizes(entry.sizes),
    isSplitMission: (commodityHits.get(entry.commoditySlug) ?? 0) > 1,
  }));
}

/** @deprecated Use stopCargoBoxGroups(row, "delivery") */
export function stopDeliveryBoxGroups(
  row: HaulingChecklistRow,
): StopCargoBoxGroup[] {
  return stopCargoBoxGroups(row, "delivery");
}

export type StopCargoStackLabel = {
  id: string;
  /** Stack origin X on the pad. */
  x: number;
  commoditySlug: string;
  commodityName: string;
  /** Short label drawn under the stack. */
  abbrev: string;
  /** Total SCU in this stack (shown above the column). */
  scu: number;
  /** Stack height in cells — anchors the top SCU label. */
  heightCells: number;
};

export type StopCargoStacksPlan = {
  action: CargoGridBoxAction;
  lengthCells: number;
  widthCells: number;
  heightCells: number;
  boxes: PlacedCargoBox[];
  tints: CargoGridPlacementTint[];
  stackLabels: StopCargoStackLabel[];
  legendItems: Array<{
    id: string;
    commoditySlug: string;
    commodityName: string;
    color: string | null;
    color2: string | null;
    scu: number;
    boxCounts: CargoBoxCountBySize[];
    isSplitMission: boolean;
  }>;
};

/** Abbreviate a commodity name for stack footers (e.g. Medical Supplies → MS). */
export function abbreviateCommodityName(name: string): string {
  const words = name
    .trim()
    .split(/[\s/_-]+/)
    .map((word) => word.replace(/[^a-zA-Z0-9]/g, ""))
    .filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) {
    const word = words[0]!;
    return word.slice(0, Math.min(5, word.length)).toUpperCase();
  }
  return words
    .slice(0, 4)
    .map((word) => word[0]!.toUpperCase())
    .join("");
}

/** @deprecated Use StopCargoStacksPlan */
export type StopDeliveryStacksPlan = StopCargoStacksPlan;

/**
 * Generic pad (not a ship bay): one vertical stack per mission+commodity,
 * with gaps between stacks. Boxes sit flat and stack against gravity.
 */
export function planStopCargoStacks(
  row: HaulingChecklistRow,
  action: CargoGridBoxAction,
): StopCargoStacksPlan | null {
  const groups = stopCargoBoxGroups(row, action);
  if (groups.length === 0) return null;

  const boxes: PlacedCargoBox[] = [];
  const stackLabels: StopCargoStackLabel[] = [];
  let cursorX = 0;
  let maxY = STACK_WIDTH_CELLS;
  let maxZ = 1;
  let boxIndex = 0;

  for (const group of groups) {
    const sizes = [...group.sizes].sort((a, b) => b - a);
    let z = 0;

    for (const size of sizes) {
      const footprint = flatFootprint(size);
      const origin: CargoGridCoord = {
        x: cursorX,
        y: 0,
        z,
      };
      const cells = cellsForBox(origin, footprint);
      boxes.push({
        id: `${group.id}-box-${boxIndex}`,
        size,
        origin,
        footprint,
        commoditySlug: group.commoditySlug,
        commodityName: group.commodityName,
        color: group.color,
        color2: group.color2,
        cells,
        action,
      });
      boxIndex += 1;
      z += footprint.dz;
      maxY = Math.max(maxY, footprint.dy);
      maxZ = Math.max(maxZ, z);
    }

    stackLabels.push({
      id: group.id,
      x: cursorX,
      commoditySlug: group.commoditySlug,
      commodityName: group.commodityName,
      abbrev: abbreviateCommodityName(group.commodityName),
      scu: group.scu,
      heightCells: Math.max(1, z),
    });

    cursorX += STACK_WIDTH_CELLS + STACK_GAP_CELLS;
  }

  const lengthCells = Math.max(1, cursorX - STACK_GAP_CELLS);

  const tints: CargoGridPlacementTint[] = boxes.flatMap((box) =>
    box.cells.map((coord) => ({
      coord,
      commoditySlug: box.commoditySlug,
      commodityName: box.commodityName,
      color: box.color,
      color2: box.color2,
      action: box.action,
    })),
  );

  const legendItems = groups.map((group) => ({
    id: group.id,
    commoditySlug: group.commoditySlug,
    commodityName: group.commodityName,
    color: group.color,
    color2: group.color2,
    scu: group.scu,
    boxCounts: group.boxCounts,
    isSplitMission: group.isSplitMission,
  }));

  return {
    action,
    lengthCells,
    widthCells: maxY,
    heightCells: Math.max(1, maxZ),
    boxes,
    tints,
    stackLabels,
    legendItems,
  };
}

/** @deprecated Use planStopCargoStacks(row, "delivery") */
export function planStopDeliveryStacks(
  row: HaulingChecklistRow,
): StopCargoStacksPlan | null {
  return planStopCargoStacks(row, "delivery");
}
