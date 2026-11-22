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
import type {
  ManualBayBulkFillSpec,
  ManualBayMissionFillSpec,
} from "@/lib/ships/manualBayMove";

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

/** One commodity within a mission (Fill row — stays visible after placing). */
export type ManualBayInventoryCommodityGroup = {
  key: string;
  missionId: string | null;
  missionTitle: string;
  commoditySlug: string;
  commodityName: string;
  color: string | null;
  color2: string | null;
  /** Remaining crate count (all sizes). */
  remainingCrates: number;
  /** Remaining SCU still in Cargo. */
  remainingScu: number;
  /** SCU already on the bay for this commodity. */
  placedScu: number;
  /** Size lines with remaining > 0, largest first (Fill / chips). */
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

/**
 * Collapse mission inventory lines into per-commodity groups (largest sizes
 * first) for Manual Fill rows. Keeps rows after everything is placed so Reset
 * can pull that commodity back off the bay.
 */
export function commodityGroupsFromMission(
  group: ManualBayInventoryMissionGroup,
): ManualBayInventoryCommodityGroup[] {
  const bySlug = new Map<string, ManualBayInventoryLine[]>();
  for (const line of group.lines) {
    const list = bySlug.get(line.commoditySlug) ?? [];
    list.push(line);
    bySlug.set(line.commoditySlug, list);
  }
  const out: ManualBayInventoryCommodityGroup[] = [];
  for (const [commoditySlug, lines] of bySlug) {
    const demanded = lines
      .filter((line) => line.demanded > 0)
      .sort((a, b) => b.size - a.size);
    if (demanded.length === 0) continue;
    const withRemaining = demanded.filter((line) => line.remaining > 0);
    const head = demanded[0]!;
    let remainingCrates = 0;
    let remainingScu = 0;
    let placedScu = 0;
    for (const line of demanded) {
      remainingCrates += line.remaining;
      remainingScu += line.remaining * line.size;
      placedScu += line.placed * line.size;
    }
    out.push({
      key: `${group.missionId ?? "_"}:${commoditySlug}:bulk`,
      missionId: group.missionId,
      missionTitle: group.missionTitle,
      commoditySlug,
      commodityName: head.commodityName,
      color: head.color,
      color2: head.color2,
      remainingCrates,
      remainingScu,
      placedScu,
      lines: withRemaining,
    });
  }
  return out.sort((a, b) => a.commodityName.localeCompare(b.commodityName));
}

/** Remove one mission’s commodity crates from the bay (Reset Fill). */
export function removeCommodityFromManualBay(
  boxes: readonly PlacedCargoBox[],
  missionId: string | null,
  commoditySlug: string,
): PlacedCargoBox[] {
  return boxes.filter(
    (box) =>
      !(
        (box.missionId ?? null) === missionId &&
        box.commoditySlug === commoditySlug
      ),
  );
}

/** Pull every crate for one mission off the bay into Cargo. */
export function removeMissionFromManualBay(
  boxes: readonly PlacedCargoBox[],
  missionId: string | null,
): PlacedCargoBox[] {
  return boxes.filter((box) => (box.missionId ?? null) !== missionId);
}

/** Bulk Fill spec for one commodity row (remaining crates only). */
export function bulkFillSpecFromCommodity(
  commodity: ManualBayInventoryCommodityGroup,
): ManualBayBulkFillSpec {
  return {
    missionId: commodity.missionId,
    commoditySlug: commodity.commoditySlug,
    commodityName: commodity.commodityName,
    color: commodity.color,
    color2: commodity.color2,
    crates: commodity.lines.map((line) => ({
      size: line.size,
      count: line.remaining,
    })),
  };
}

/**
 * Mission-parent Fill: every commodity still in Cargo, ready to pack as one
 * block sorted by cargo type.
 */
export function missionFillSpecFromGroup(
  group: ManualBayInventoryMissionGroup,
): ManualBayMissionFillSpec | null {
  const commodities = commodityGroupsFromMission(group)
    .filter((commodity) => commodity.remainingScu > 0)
    .map(bulkFillSpecFromCommodity);
  if (commodities.length === 0) return null;
  return {
    missionId: group.missionId,
    missionTitle: group.missionTitle,
    commodities,
  };
}

export function missionRemainingScu(
  group: ManualBayInventoryMissionGroup,
): number {
  return commodityGroupsFromMission(group).reduce(
    (sum, commodity) => sum + commodity.remainingScu,
    0,
  );
}

export function missionPlacedScu(
  group: ManualBayInventoryMissionGroup,
): number {
  return commodityGroupsFromMission(group).reduce(
    (sum, commodity) => sum + commodity.placedScu,
    0,
  );
}

export const manualBayInventory = {
  demandLines: demandManualBayInventoryLines,
  commodityGroupsFromMission,
  bulkFillSpecFromCommodity,
  missionFillSpecFromGroup,
  missionRemainingScu,
  missionPlacedScu,
  removeCommodityFromBay: removeCommodityFromManualBay,
  removeMissionFromBay: removeMissionFromManualBay,

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
