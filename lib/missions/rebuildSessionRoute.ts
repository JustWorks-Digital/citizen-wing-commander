import { buildRouteFromIntake } from "@/lib/sessions/buildRouteFromIntake";
import {
  resolveCommoditySlug,
  resolveIncomingLeg,
  resolveLocationSlug,
} from "@/lib/sessions/resolveRefs";
import { partitionBoxSizesAcrossScuAmounts } from "@/lib/missions/boxBreakdownOptions";
import { cargoBoxSplits } from "@/lib/missions/cargoBoxSplits";
import type { ScuBoxSplits } from "@/lib/missions/catalogMission";
import {
  intakeContractFromSessionMission,
  type SessionMission,
} from "@/lib/missions/sessionMissions";
import type {
  CargoDelivery,
  HaulingChecklistRow,
  RouteAction,
  SessionChecklistModel,
} from "@/lib/missions/mockSession";
import { applySessionCompletionTiming } from "@/lib/missions/mockSession";
import { mergePreservedQuantumRows } from "@/lib/missions/quantumTravel";
import type { CargoBoxScu } from "@/lib/ships/cargoBoxSizes";

function resolveCargoRole(
  routeAction: RouteAction,
  role: CargoDelivery["role"],
): "pickup" | "delivery" | null {
  if (role === "pickup" || role === "delivery") return role;
  if (routeAction === "pickup") return "pickup";
  if (routeAction === "delivery") return "delivery";
  return null;
}

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

/** Unlabeled cargo is claimed only at this mission’s from (pickup) / to (delivery). */
function cargoBelongsToMissionAtStop(
  cargo: CargoDelivery,
  commoditySlug: string,
  row: HaulingChecklistRow,
  role: "pickup" | "delivery",
  mission: SessionMission,
): boolean {
  if (cargo.commoditySlug !== commoditySlug) return false;
  if (cargo.missionId) return cargo.missionId === mission.id;
  const sites = role === "pickup" ? mission.from : mission.to;
  return sites.some((loc) => locationMatchesRow(loc, row.locationSlug));
}

/** Still counted in N/M (unless hidden). */
function countedMissions(missions: SessionMission[]): SessionMission[] {
  return missions.filter((mission) => !mission.isHidden);
}

/** Cargo that still belongs on the route table. */
function routeMissions(missions: SessionMission[]): SessionMission[] {
  return missions.filter(
    (mission) => !mission.isHidden && !mission.isCompleted,
  );
}

/**
 * Append missions (skipping duplicates by id / catalogMissionId) and rebuild legs.
 */
export function addMissionsAndRebuildRoute(
  session: SessionChecklistModel,
  incoming: SessionMission[],
): { ok: true; session: SessionChecklistModel; added: number; skipped: number } | { ok: false; error: string } {
  const existing = session.missions ?? [];
  const known = new Set<string>();
  for (const mission of existing) {
    known.add(mission.id);
    if (mission.catalogMissionId) known.add(mission.catalogMissionId);
  }

  const toAdd: SessionMission[] = [];
  let skipped = 0;
  for (const mission of incoming) {
    if (known.has(mission.id) || (mission.catalogMissionId && known.has(mission.catalogMissionId))) {
      skipped += 1;
      continue;
    }
    known.add(mission.id);
    if (mission.catalogMissionId) known.add(mission.catalogMissionId);
    toAdd.push(mission);
  }

  const rebuilt = rebuildRowsFromMissions(session, [...existing, ...toAdd]);
  if (!rebuilt.ok) return rebuilt;
  return { ok: true, session: rebuilt.session, added: toAdd.length, skipped };
}

function rebuildRowsFromMissions(
  session: SessionChecklistModel,
  missions: SessionMission[],
): { ok: true; session: SessionChecklistModel } | { ok: false; error: string } {
  const nextMissions = missions.map(withMissionBoxSplitDefaults);
  const counted = countedMissions(nextMissions);
  const active = routeMissions(nextMissions);
  const missionCount = counted.length;
  const missionsCompleted = counted.filter((m) => m.isCompleted).length;

  if (active.length === 0) {
    return {
      ok: true,
      session: applySessionCompletionTiming({
        ...session,
        missions: nextMissions,
        missionCount,
        missionsCompleted,
        rows: mergePreservedQuantumRows(session.rows, []),
      }),
    };
  }

  const built = buildRouteFromIntake(
    {
      kind: "hauling_contracts_intake",
      version: 1,
      sessionName: session.sessionName,
      contracts: active.map(intakeContractFromSessionMission),
    },
    { startLocation: session.startLocationSlug },
  );
  if (!built.ok) {
    return built;
  }

  const rows: HaulingChecklistRow[] = [];
  for (const [index, leg] of built.legs.entries()) {
    const resolved = resolveIncomingLeg(leg, index);
    if (!resolved.ok) {
      return { ok: false, error: resolved.error };
    }
    rows.push(resolved.row);
  }

  let nextRows = rows;
  for (const mission of nextMissions) {
    if (!effectiveMissionScuBoxSplits(mission)) continue;
    nextRows = stampMissionBoxSizesOntoRows(nextRows, mission);
  }
  nextRows = mergePreservedQuantumRows(session.rows, nextRows);

  return {
    ok: true,
    session: applySessionCompletionTiming({
      ...session,
      missions: nextMissions,
      missionCount,
      missionsCompleted,
      rows: nextRows,
    }),
  };
}

/** Hide/show a mission; hidden ones drop out of N/M and the route table. */
export function setMissionHiddenAndRebuildRoute(
  session: SessionChecklistModel,
  missionId: string,
  isHidden: boolean,
): { ok: true; session: SessionChecklistModel } | { ok: false; error: string } {
  const missions = (session.missions ?? []).map((mission) =>
    mission.id === missionId ? { ...mission, isHidden } : mission,
  );
  return rebuildRowsFromMissions(session, missions);
}

/** Complete/reopen a mission; completed cargo is removed from the route table. */
export function setMissionCompletedAndRebuildRoute(
  session: SessionChecklistModel,
  missionId: string,
  isCompleted: boolean,
): { ok: true; session: SessionChecklistModel } | { ok: false; error: string } {
  const missions = (session.missions ?? []).map((mission) =>
    mission.id === missionId ? { ...mission, isCompleted } : mission,
  );
  return rebuildRowsFromMissions(session, missions);
}

/**
 * Permanently drop a mission and rebuild route legs from the remaining set,
 * ordered from the session start location when set.
 */
export function removeMissionAndRebuildRoute(
  session: SessionChecklistModel,
  missionId: string,
): { ok: true; session: SessionChecklistModel } | { ok: false; error: string } {
  const missions = (session.missions ?? []).filter(
    (mission) => mission.id !== missionId,
  );
  return rebuildRowsFromMissions(session, missions);
}

/** Aggregate auto mix for icons / legacy callers. */
export function autoSelectedMissionScuBoxSplits(
  mission: SessionMission,
): ScuBoxSplits | null {
  const map = cargoBoxSplits.autoSelectedForMission(mission);
  if (Object.keys(map).length === 0) return null;
  return cargoBoxSplits.aggregate(map);
}

/** Aggregate selected (or auto) mix for icons / legacy callers. */
export function effectiveMissionScuBoxSplits(
  mission: SessionMission,
): ScuBoxSplits | null {
  const withDefaults = cargoBoxSplits.withDefaults(mission);
  if (!withDefaults.scuBoxSplits) return null;
  const total =
    withDefaults.scuBoxSplits.scuOne +
    withDefaults.scuBoxSplits.scuTwo +
    withDefaults.scuBoxSplits.scuFour +
    withDefaults.scuBoxSplits.scuEight +
    withDefaults.scuBoxSplits.scuSixteen +
    withDefaults.scuBoxSplits.scuThirtyTwo;
  return total > 0 ? withDefaults.scuBoxSplits : null;
}

/** Ensure per-cargo maps + aggregates exist. */
export function withMissionBoxSplitDefaults(
  mission: SessionMission,
): SessionMission {
  return cargoBoxSplits.withDefaults(mission);
}

/**
 * Stamp per-commodity crate sizes onto route cargo lines for this mission.
 * Pickup lines get that commodity’s mix; deliveries partition across unload amounts.
 */
function stampMissionBoxSizesOntoRows(
  rows: HaulingChecklistRow[],
  mission: SessionMission,
): HaulingChecklistRow[] {
  const ready = cargoBoxSplits.withDefaults(mission);
  const lines = cargoBoxSplits.commodityLines(ready);
  const missionCommoditySlugs = new Set(
    lines.map((line) => line.commoditySlug),
  );

  const cleared: HaulingChecklistRow[] = rows.map((row) => ({
    ...row,
    cargoDeliveries: row.cargoDeliveries.map((cargo) => {
      if (!missionCommoditySlugs.has(cargo.commoditySlug)) return cargo;
      const role = resolveCargoRole(row.routeAction, cargo.role);
      if (!role) {
        if (cargo.missionId !== mission.id) return cargo;
      } else if (
        !cargoBelongsToMissionAtStop(
          cargo,
          cargo.commoditySlug,
          row,
          role,
          mission,
        )
      ) {
        return cargo;
      }
      const { boxSizes: _removed, ...rest } = cargo;
      return rest as CargoDelivery;
    }),
  }));

  if (lines.length === 0) return cleared;

  const nextRows: HaulingChecklistRow[] = cleared.map((row) => ({
    ...row,
    cargoDeliveries: row.cargoDeliveries.map((cargo) => ({ ...cargo })),
  }));

  for (const line of lines) {
    type Hit = {
      rowIndex: number;
      cargoIndex: number;
      scu: number;
      role: "pickup" | "delivery";
    };
    const pickups: Hit[] = [];
    const deliveries: Hit[] = [];

    for (const [rowIndex, row] of nextRows.entries()) {
      for (const [cargoIndex, cargo] of row.cargoDeliveries.entries()) {
        const role = resolveCargoRole(row.routeAction, cargo.role);
        if (role !== "pickup" && role !== "delivery") continue;
        if (
          !cargoBelongsToMissionAtStop(
            cargo,
            line.commoditySlug,
            row,
            role,
            mission,
          )
        ) {
          continue;
        }
        const hit = {
          rowIndex,
          cargoIndex,
          scu: cargo.scu,
          role,
        };
        if (role === "pickup") pickups.push(hit);
        else deliveries.push(hit);
      }
    }

    const boxSizes = cargoBoxSplits.boxSizesForLine(
      ready,
      line.commoditySlug,
      line.scu,
    );

    const stamp = (hit: Hit, sizes: CargoBoxScu[]) => {
      const cargo = nextRows[hit.rowIndex]!.cargoDeliveries[hit.cargoIndex]!;
      nextRows[hit.rowIndex]!.cargoDeliveries[hit.cargoIndex] = {
        ...cargo,
        missionId: mission.id,
        boxSizes: [...sizes],
      };
    };

    const stampGreedy = (hits: Hit[]) => {
      for (const hit of hits) {
        stamp(
          hit,
          cargoBoxSplits.boxSizesForLine(
            ready,
            line.commoditySlug,
            hit.scu,
          ),
        );
      }
    };

    if (boxSizes.length === 0) {
      stampGreedy([...pickups, ...deliveries]);
      continue;
    }

    if (pickups.length === 1 && pickups[0]!.scu === line.scu) {
      stamp(pickups[0]!, boxSizes);
    } else if (pickups.length > 0) {
      const taken = partitionBoxSizesAcrossScuAmounts(
        boxSizes,
        pickups.map((entry) => entry.scu),
      );
      if (taken) {
        for (const [index, pickup] of pickups.entries()) {
          stamp(pickup, taken[index] ?? []);
        }
      } else {
        stampGreedy(pickups);
      }
    }

    let remainingScu = line.scu;
    const deliveryHits: Hit[] = [];
    for (const hit of deliveries) {
      if (remainingScu <= 0) break;
      if (hit.scu <= 0) continue;
      deliveryHits.push(hit);
      remainingScu -= hit.scu;
    }
    if (deliveryHits.length === 0) continue;

    const partitioned = partitionBoxSizesAcrossScuAmounts(
      boxSizes,
      deliveryHits.map((hit) => hit.scu),
    );
    if (partitioned) {
      for (const [index, hit] of deliveryHits.entries()) {
        stamp(hit, partitioned[index] ?? []);
      }
    } else {
      stampGreedy(deliveryHits);
    }
  }

  return nextRows;
}

/** Re-apply every mission's crate mix onto route cargo (pickup + deliveries). */
export function restampAllMissionBoxSizes(
  session: SessionChecklistModel,
): SessionChecklistModel {
  const missions = (session.missions ?? []).map(withMissionBoxSplitDefaults);
  let rows = session.rows;
  for (const mission of missions) {
    if (!effectiveMissionScuBoxSplits(mission)) continue;
    rows = stampMissionBoxSizesOntoRows(rows, mission);
  }
  return { ...session, missions, rows };
}

/**
 * Persist a per-commodity crate-mix choice and restamp bay packing sizes.
 * When `commoditySlug` is omitted and the mission has exactly one cargo type,
 * that commodity is inferred.
 */
export type SetMissionScuBoxSplitsOptions = {
  /**
   * After saving this commodity’s mix, re-greedy other cargo lines with the
   * same preferred max crate size (Simple mode uses this).
   */
  applyPreferredMaxToRemaining?: boolean;
  /**
   * When propagating, skip lines the user already corrected (default true).
   * Simple mode passes false so one pick restyles every cargo type.
   */
  onlyUncorrected?: boolean;
};

export function setMissionScuBoxSplits(
  session: SessionChecklistModel,
  missionId: string,
  scuBoxSplits: ScuBoxSplits,
  commoditySlug?: string | null,
  options?: SetMissionScuBoxSplitsOptions,
): { ok: true; session: SessionChecklistModel } | { ok: false; error: string } {
  const existing = (session.missions ?? []).find(
    (entry) => entry.id === missionId,
  );
  if (!existing) {
    return { ok: false, error: `Unknown mission: ${missionId}` };
  }

  const withAuto = cargoBoxSplits.withDefaults(existing);
  const lines = cargoBoxSplits.commodityLines(withAuto);
  let slug = commoditySlug?.trim() || null;
  if (!slug) {
    if (lines.length === 1) {
      slug = lines[0]!.commoditySlug;
    } else if (lines.length === 0) {
      return { ok: false, error: `Mission ${missionId} has no cargo lines` };
    } else {
      return {
        ok: false,
        error: `Mission ${missionId} has multiple cargo types; pass commodity (slug or name). Known: ${lines
          .map((line) => line.commoditySlug)
          .join(", ")}.`,
      };
    }
  }

  const resolvedSlug =
    resolveCommoditySlug(slug) ?? slug.trim().toLowerCase();
  if (!lines.some((line) => line.commoditySlug === resolvedSlug)) {
    return {
      ok: false,
      error: `Unknown commodity for mission ${missionId}: ${slug}`,
    };
  }

  let nextMission = cargoBoxSplits.setCommodity(
    withAuto,
    resolvedSlug,
    scuBoxSplits,
  );
  if (options?.applyPreferredMaxToRemaining) {
    nextMission = cargoBoxSplits.propagatePreferredMax(
      nextMission,
      resolvedSlug,
      { onlyUncorrected: options.onlyUncorrected !== false },
    );
  }
  const missions = (session.missions ?? []).map((mission) =>
    mission.id === missionId ? nextMission : mission,
  );
  const rows = stampMissionBoxSizesOntoRows(session.rows, nextMission);
  return {
    ok: true,
    session: {
      ...session,
      missions,
      rows,
    },
  };
}

export type { SessionMission };
