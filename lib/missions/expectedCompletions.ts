import type { CargoDelivery, HaulingChecklistRow } from "@/lib/missions/mockSession";
import type { SessionMission } from "@/lib/missions/sessionMissions";
import {
  resolveCommoditySlug,
  resolveLocationSlug,
} from "@/lib/sessions/resolveRefs";

function locationMatchesRow(
  locationNameOrSlug: string,
  rowLocationSlug: string,
): boolean {
  const resolved = resolveLocationSlug(locationNameOrSlug);
  if (resolved && resolved === rowLocationSlug) return true;
  return (
    locationNameOrSlug.trim().toLowerCase() === rowLocationSlug.toLowerCase()
  );
}

function missionDeliversAt(
  mission: SessionMission,
  rowLocationSlug: string,
): boolean {
  if (mission.to.some((loc) => locationMatchesRow(loc, rowLocationSlug))) {
    return true;
  }
  return Boolean(
    mission.deliverySplits?.some((split) =>
      locationMatchesRow(split.to, rowLocationSlug),
    ),
  );
}

function rowDeliveryCargo(row: HaulingChecklistRow): CargoDelivery[] {
  if (row.routeAction === "pickup") return [];
  if (row.routeAction === "delivery") return row.cargoDeliveries;
  return row.cargoDeliveries.filter(
    (cargo) => cargo.role === "delivery" || cargo.role == null,
  );
}

function missionCommoditySlugs(mission: SessionMission): Set<string> {
  const slugs = new Set<string>();
  for (const line of mission.cargo) {
    const slug =
      resolveCommoditySlug(line.commodity) ??
      line.commodity.trim().toLowerCase();
    if (slug) slugs.add(slug);
  }
  for (const split of mission.deliverySplits ?? []) {
    const slug =
      resolveCommoditySlug(split.commodity) ??
      split.commodity.trim().toLowerCase();
    if (slug) slugs.add(slug);
  }
  return slugs;
}

/** True when this stop unloads cargo that belongs to the mission. */
export function missionHasDeliveryOnRow(
  mission: SessionMission,
  row: HaulingChecklistRow,
): boolean {
  const deliveries = rowDeliveryCargo(row);
  if (deliveries.length === 0) return false;

  if (deliveries.some((cargo) => cargo.missionId === mission.id)) {
    return true;
  }

  // Commodity fallback only for untagged lines — one tagged crate must not
  // block matching the rest of the stop's cargo to other contracts.
  const untagged = deliveries.filter((cargo) => !cargo.missionId);
  if (untagged.length === 0) return false;

  if (!missionDeliversAt(mission, row.locationSlug)) return false;

  const commodities = missionCommoditySlugs(mission);
  if (commodities.size === 0) return true;
  return untagged.some((cargo) => commodities.has(cargo.commoditySlug));
}

/**
 * Missions whose final delivery on the route is this stop — i.e. completing
 * the stop finishes those contracts. Empty → UI shows “None”.
 */
export function missionsExpectedToCompleteAtStop(
  missions: SessionMission[],
  rows: HaulingChecklistRow[],
  rowId: string,
): SessionMission[] {
  const rowIndex = rows.findIndex((row) => row.id === rowId);
  if (rowIndex < 0) return [];

  const expected: SessionMission[] = [];
  for (const mission of missions) {
    if (mission.isHidden) continue;
    let lastDeliveryIndex = -1;
    for (let index = 0; index < rows.length; index += 1) {
      if (missionHasDeliveryOnRow(mission, rows[index]!)) {
        lastDeliveryIndex = index;
      }
    }
    if (lastDeliveryIndex === rowIndex) {
      expected.push(mission);
    }
  }
  return expected;
}

/**
 * When a delivery stop is marked done/undone, mirror that onto missions whose
 * final delivery is this stop (contracts finish with the location).
 */
export function syncMissionsForStopCompletion(input: {
  missions: SessionMission[];
  rows: HaulingChecklistRow[];
  rowId: string;
  stopIsCompleted: boolean;
}): SessionMission[] {
  const expectedIds = new Set(
    missionsExpectedToCompleteAtStop(
      input.missions,
      input.rows,
      input.rowId,
    ).map((mission) => mission.id),
  );
  if (expectedIds.size === 0) return input.missions;
  return input.missions.map((mission) =>
    expectedIds.has(mission.id)
      ? { ...mission, isCompleted: input.stopIsCompleted }
      : mission,
  );
}

/**
 * Derive contract completion from the current stop checklist.
 *
 * - On-route missions: completed iff their final delivery stop is done.
 * - Off-route completed missions (dropped by rebuild): stay completed while
 *   any stop is still done; clear when every stop is open so Contracts N/M
 *   cannot stick after a full uncheck / trip reset.
 */
export function reconcileMissionCompletionFromStops(
  missions: SessionMission[],
  rows: HaulingChecklistRow[],
): SessionMission[] {
  const anyStopDone = rows.some((row) => row.isCompleted);
  return missions.map((mission) => {
    if (mission.isHidden) return mission;

    let lastDeliveryIndex = -1;
    for (let index = 0; index < rows.length; index += 1) {
      if (missionHasDeliveryOnRow(mission, rows[index]!)) {
        lastDeliveryIndex = index;
      }
    }

    if (lastDeliveryIndex >= 0) {
      const done = Boolean(rows[lastDeliveryIndex]?.isCompleted);
      return done === mission.isCompleted
        ? mission
        : { ...mission, isCompleted: done };
    }

    if (mission.isCompleted && !anyStopDone) {
      return { ...mission, isCompleted: false };
    }
    return mission;
  });
}
