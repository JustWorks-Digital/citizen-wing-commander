import { buildRouteFromIntake } from "@/lib/sessions/buildRouteFromIntake";
import {
  resolveCommoditySlug,
  resolveIncomingLeg,
} from "@/lib/sessions/resolveRefs";
import { assignBoxSizesFromBreakdown } from "@/lib/missions/boxBreakdownOptions";
import type { ScuBoxSplits } from "@/lib/missions/catalogMission";
import {
  intakeContractFromSessionMission,
  type SessionMission,
} from "@/lib/missions/sessionMissions";
import type {
  CargoDelivery,
  HaulingChecklistRow,
  SessionChecklistModel,
} from "@/lib/missions/mockSession";
import { applySessionCompletionTiming } from "@/lib/missions/mockSession";

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
  const counted = countedMissions(missions);
  const active = routeMissions(missions);
  const missionCount = counted.length;
  const missionsCompleted = counted.filter((m) => m.isCompleted).length;

  if (active.length === 0) {
    return {
      ok: true,
      session: applySessionCompletionTiming({
        ...session,
        missions,
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
  for (const mission of missions) {
    if (!mission.scuBoxSplits) continue;
    nextRows = stampMissionBoxSizesOntoRows(nextRows, mission);
  }

  return {
    ok: true,
    session: applySessionCompletionTiming({
      ...session,
      missions,
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

/**
 * Stamp selected crate sizes onto route cargo lines that match this mission.
 * Clears prior sizes for this missionId first, then assigns from the breakdown.
 */
function stampMissionBoxSizesOntoRows(
  rows: HaulingChecklistRow[],
  mission: SessionMission,
): HaulingChecklistRow[] {
  const breakdown = mission.scuBoxSplits;
  const cleared = rows.map((row) => ({
    ...row,
    cargoDeliveries: row.cargoDeliveries.map((cargo) => {
      if (cargo.missionId === mission.id) {
        const { boxSizes: _removed, ...rest } = cargo;
        return rest;
      }
      return cargo;
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

  const pending = assignments.map((entry) => ({
    ...entry,
    used: false,
  }));

  const matchCargo = (cargo: CargoDelivery): CargoDelivery => {
    if (cargo.missionId && cargo.missionId !== mission.id) return cargo;
    const hit = pending.find(
      (entry) =>
        !entry.used &&
        entry.commoditySlug === cargo.commoditySlug &&
        entry.scu === cargo.scu &&
        entry.boxSizes.length > 0,
    );
    if (!hit) return cargo;
    hit.used = true;
    return {
      ...cargo,
      missionId: mission.id,
      boxSizes: [...hit.boxSizes],
    };
  };

  return cleared.map((row) => ({
    ...row,
    cargoDeliveries: row.cargoDeliveries.map(matchCargo),
  }));
}

/** Persist a crate-mix choice and restamp bay packing sizes onto the route. */
export function setMissionScuBoxSplits(
  session: SessionChecklistModel,
  missionId: string,
  scuBoxSplits: ScuBoxSplits,
): { ok: true; session: SessionChecklistModel } | { ok: false; error: string } {
  const missions = (session.missions ?? []).map((mission) =>
    mission.id === missionId ? { ...mission, scuBoxSplits } : mission,
  );
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
