import { buildRouteFromIntake } from "@/lib/sessions/buildRouteFromIntake";
import { resolveIncomingLeg } from "@/lib/sessions/resolveRefs";
import {
  intakeContractFromSessionMission,
  type SessionMission,
} from "@/lib/missions/sessionMissions";
import type {
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

  return {
    ok: true,
    session: applySessionCompletionTiming({
      ...session,
      missions,
      missionCount,
      missionsCompleted,
      rows,
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

export type { SessionMission };
