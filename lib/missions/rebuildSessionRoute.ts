import { buildRouteFromIntake } from "@/lib/sessions/buildRouteFromIntake";
import {
  resolveCommoditySlug,
  resolveIncomingLeg,
} from "@/lib/sessions/resolveRefs";
import {
  assignBoxSizesFromBreakdown,
  partitionBoxSizesAcrossScuAmounts,
} from "@/lib/missions/boxBreakdownOptions";
import {
  scuBoxSplitsForScu,
  type ScuBoxSplits,
} from "@/lib/missions/catalogMission";
import {
  intakeContractFromSessionMission,
  type SessionMission,
} from "@/lib/missions/sessionMissions";
import type {
  CargoDelivery,
  HaulingChecklistRow,
  LegKind,
  SessionChecklistModel,
} from "@/lib/missions/mockSession";
import { applySessionCompletionTiming } from "@/lib/missions/mockSession";
import type { CargoBoxScu } from "@/lib/ships/cargoBoxSizes";

function resolveCargoRole(
  legKind: LegKind,
  role: CargoDelivery["role"],
): "pickup" | "delivery" | null {
  if (role === "pickup" || role === "delivery") return role;
  if (legKind === "pickup") return "pickup";
  if (legKind === "delivery") return "delivery";
  return null;
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
        rows: [],
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

/** Capped greedy default for a mission (picker DEFAULT / auto-selected). */
export function autoSelectedMissionScuBoxSplits(
  mission: SessionMission,
): ScuBoxSplits | null {
  if (
    typeof mission.maxContainerScu !== "number" ||
    mission.maxContainerScu <= 0
  ) {
    // Still allow uncapped greedy when total SCU is known.
    const scuTotal = mission.cargo.reduce(
      (sum, line) => sum + Math.max(0, Math.floor(line.scu)),
      0,
    );
    if (scuTotal <= 0) return null;
    return scuBoxSplitsForScu(scuTotal, null);
  }
  const scuTotal = mission.cargo.reduce(
    (sum, line) => sum + Math.max(0, Math.floor(line.scu)),
    0,
  );
  if (scuTotal <= 0) return null;
  return scuBoxSplitsForScu(scuTotal, mission.maxContainerScu);
}

/**
 * Explicit override, else auto-selected / greedy mix capped by max container
 * (matches the box-type picker's DEFAULT).
 */
export function effectiveMissionScuBoxSplits(
  mission: SessionMission,
): ScuBoxSplits | null {
  if (mission.scuBoxSplits) return mission.scuBoxSplits;
  return (
    mission.scuBoxSplitsAutoSelected ?? autoSelectedMissionScuBoxSplits(mission)
  );
}

/** Ensure auto-selected is captured; fill selected from auto when missing. */
export function withMissionBoxSplitDefaults(
  mission: SessionMission,
): SessionMission {
  const auto =
    mission.scuBoxSplitsAutoSelected ?? autoSelectedMissionScuBoxSplits(mission);
  if (!auto) return mission;
  return {
    ...mission,
    scuBoxSplitsAutoSelected: auto,
    scuBoxSplits: mission.scuBoxSplits ?? auto,
  };
}

/**
 * Stamp selected crate sizes onto route cargo lines that match this mission.
 * Pickup lines get the full mix; delivery lines get the same crates partitioned
 * across unload amounts (so per-stop pads match the bay / mission override).
 */
function stampMissionBoxSizesOntoRows(
  rows: HaulingChecklistRow[],
  mission: SessionMission,
): HaulingChecklistRow[] {
  const breakdown = effectiveMissionScuBoxSplits(mission);
  const missionCommoditySlugs = new Set(
    mission.cargo.map(
      (line) =>
        resolveCommoditySlug(line.commodity) ??
        line.commodity.trim().toLowerCase(),
    ),
  );

  const cleared: HaulingChecklistRow[] = rows.map((row) => ({
    ...row,
    cargoDeliveries: row.cargoDeliveries.map((cargo) => {
      const belongs =
        cargo.missionId === mission.id ||
        (!cargo.missionId && missionCommoditySlugs.has(cargo.commoditySlug));
      if (!belongs) return cargo;
      const { boxSizes: _removed, ...rest } = cargo;
      return rest as CargoDelivery;
    }),
  }));

  if (!breakdown) return cleared;

  const assignments = assignBoxSizesFromBreakdown(
    mission.cargo.map((line) => ({
      commoditySlug:
        resolveCommoditySlug(line.commodity) ??
        line.commodity.trim().toLowerCase(),
      scu: line.scu,
    })),
    breakdown,
  );

  const nextRows: HaulingChecklistRow[] = cleared.map((row) => ({
    ...row,
    cargoDeliveries: row.cargoDeliveries.map((cargo) => ({ ...cargo })),
  }));

  const cargoBelongs = (cargo: CargoDelivery, commoditySlug: string) => {
    if (cargo.commoditySlug !== commoditySlug) return false;
    if (cargo.missionId) return cargo.missionId === mission.id;
    return true;
  };

  for (const assignment of assignments) {
    if (assignment.boxSizes.length === 0) continue;

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
        if (!cargoBelongs(cargo, assignment.commoditySlug)) continue;
        const role = resolveCargoRole(row.legKind, cargo.role);
        if (role !== "pickup" && role !== "delivery") continue;
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

    const stamp = (
      hit: Hit,
      boxSizes: CargoBoxScu[],
    ) => {
      const cargo = nextRows[hit.rowIndex]!.cargoDeliveries[hit.cargoIndex]!;
      nextRows[hit.rowIndex]!.cargoDeliveries[hit.cargoIndex] = {
        ...cargo,
        missionId: mission.id,
        boxSizes: [...boxSizes],
      };
    };

    if (pickups.length === 1 && pickups[0]!.scu === assignment.scu) {
      stamp(pickups[0]!, assignment.boxSizes);
    } else if (pickups.length > 0) {
      const taken = partitionBoxSizesAcrossScuAmounts(
        assignment.boxSizes,
        pickups.map((entry) => entry.scu),
      );
      if (taken) {
        for (const [index, pickup] of pickups.entries()) {
          stamp(pickup, taken[index] ?? []);
        }
      }
    }

    let remainingScu = assignment.scu;
    const deliveryHits: Hit[] = [];
    for (const hit of deliveries) {
      if (remainingScu <= 0) break;
      if (hit.scu <= 0) continue;
      deliveryHits.push(hit);
      remainingScu -= hit.scu;
    }
    if (deliveryHits.length === 0) continue;

    const partitioned = partitionBoxSizesAcrossScuAmounts(
      assignment.boxSizes,
      deliveryHits.map((hit) => hit.scu),
    );
    if (!partitioned) continue;
    for (const [index, hit] of deliveryHits.entries()) {
      stamp(hit, partitioned[index] ?? []);
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

/** Persist a crate-mix choice and restamp bay packing sizes onto the route. */
export function setMissionScuBoxSplits(
  session: SessionChecklistModel,
  missionId: string,
  scuBoxSplits: ScuBoxSplits,
): { ok: true; session: SessionChecklistModel } | { ok: false; error: string } {
  const missions = (session.missions ?? []).map((mission) => {
    if (mission.id !== missionId) return mission;
    const withAuto = withMissionBoxSplitDefaults(mission);
    return { ...withAuto, scuBoxSplits };
  });
  const mission = missions.find((entry) => entry.id === missionId);
  if (!mission) {
    return { ok: false, error: `Unknown mission: ${missionId}` };
  }

  const rows = stampMissionBoxSizesOntoRows(session.rows, mission);
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
