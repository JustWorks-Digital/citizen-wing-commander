/**
 * Manual bay tray: demanded crate counts by mission × commodity × size,
 * minus what is already placed on the grid.
 */

import { getCommodityBySlug } from "@/lib/fixtures";
import type { HaulingChecklistRow } from "@/lib/missions/sessionChecklist";
import type { SessionMission } from "@/lib/missions/sessionMissions";
import {
  decomposeScuIntoBoxes,
  maxCargoBoxScu,
  type CargoBoxScu,
} from "@/lib/ships/cargoBoxSizes";
import {
  collectSoftVisibleCargoAtStop,
  type PlacedCargoBox,
} from "@/lib/ships/cargoGridPlacement";

export type ManualBayInventoryLine = {
  key: string;
  missionId: string | null;
  missionTitle: string;
  commoditySlug: string;
  commodityName: string;
  size: CargoBoxScu;
  color: string | null;
  color2: string | null;
  demanded: number;
  placed: number;
  remaining: number;
};

export type ManualBayInventoryMissionGroup = {
  missionId: string | null;
  missionTitle: string;
  lines: ManualBayInventoryLine[];
};

function inventoryLineKey(
  missionId: string | null,
  commoditySlug: string,
  size: CargoBoxScu,
): string {
  return `${missionId ?? "_"}:${commoditySlug}:${size}`;
}

function missionTitleForId(
  missionId: string | null,
  missions: SessionMission[] | undefined,
): string {
  if (!missionId) return "Unassigned";
  const hit = missions?.find((mission) => mission.id === missionId);
  return hit?.title?.trim() || missionId.slice(0, 8);
}

function sizesForCargo(cargo: {
  scu: number;
  boxSizes?: Array<1 | 2 | 4 | 8 | 16 | 32>;
}): CargoBoxScu[] {
  if (cargo.boxSizes && cargo.boxSizes.length > 0) {
    return cargo.boxSizes as CargoBoxScu[];
  }
  return decomposeScuIntoBoxes(cargo.scu, maxCargoBoxScu(cargo.boxSizes));
}

function countPlaced(
  boxes: readonly PlacedCargoBox[],
  missionId: string | null,
  commoditySlug: string,
  size: CargoBoxScu,
): number {
  let count = 0;
  for (const box of boxes) {
    if ((box.missionId ?? null) !== missionId) continue;
    if (box.commoditySlug !== commoditySlug) continue;
    if (box.size !== size) continue;
    count += 1;
  }
  return count;
}

/**
 * Demand crates for cargo visible in the bay at this stop (same soft inventory
 * as packing). Grouped later by mission so identical commodity/size from two
 * contracts stay separate.
 */
export function demandManualBayInventoryLines(
  stopId: string,
  stops: HaulingChecklistRow[],
  options?: {
    missions?: SessionMission[];
    /** Match All vs Transfer bay scope. Default true (All). */
    includeAboardCargo?: boolean;
  },
): Omit<ManualBayInventoryLine, "placed" | "remaining">[] {
  const visible = collectSoftVisibleCargoAtStop(stops, stopId, {
    includeAboardCargo: options?.includeAboardCargo,
  });
  if (!visible) return [];

  const counts = new Map<
    string,
    Omit<ManualBayInventoryLine, "placed" | "remaining">
  >();

  for (const { cargo } of visible) {
    const missionId = cargo.missionId ?? null;
    const commodity = getCommodityBySlug(cargo.commoditySlug);
    const commodityName = commodity?.name ?? cargo.commoditySlug;
    const color = commodity?.color ?? null;
    const color2 = commodity?.color2 ?? null;
    const missionTitle = missionTitleForId(missionId, options?.missions);

    for (const size of sizesForCargo(cargo)) {
      const key = inventoryLineKey(missionId, cargo.commoditySlug, size);
      const existing = counts.get(key);
      if (existing) {
        existing.demanded += 1;
        continue;
      }
      counts.set(key, {
        key,
        missionId,
        missionTitle,
        commoditySlug: cargo.commoditySlug,
        commodityName,
        size,
        color,
        color2,
        demanded: 1,
      });
    }
  }

  return [...counts.values()].sort((a, b) => {
    const missionCmp = a.missionTitle.localeCompare(b.missionTitle);
    if (missionCmp !== 0) return missionCmp;
    const cargoCmp = a.commodityName.localeCompare(b.commodityName);
    if (cargoCmp !== 0) return cargoCmp;
    return b.size - a.size;
  });
}

export const manualBayInventory = {
  demandLines: demandManualBayInventoryLines,

  /** Demand minus crates already on the grid, grouped by mission. */
  remainingByMission(
    stopId: string,
    stops: HaulingChecklistRow[],
    placedBoxes: readonly PlacedCargoBox[],
    options?: {
      missions?: SessionMission[];
      includeAboardCargo?: boolean;
    },
  ): ManualBayInventoryMissionGroup[] {
    const lines = demandManualBayInventoryLines(stopId, stops, options).map(
      (line) => {
        const placed = countPlaced(
          placedBoxes,
          line.missionId,
          line.commoditySlug,
          line.size,
        );
        return {
          ...line,
          placed,
          remaining: Math.max(0, line.demanded - placed),
        };
      },
    );

    const groups = new Map<string, ManualBayInventoryMissionGroup>();
    for (const line of lines) {
      const groupKey = line.missionId ?? "_";
      const existing = groups.get(groupKey);
      if (existing) {
        existing.lines.push(line);
        continue;
      }
      groups.set(groupKey, {
        missionId: line.missionId,
        missionTitle: line.missionTitle,
        lines: [line],
      });
    }
    return [...groups.values()];
  },
};
