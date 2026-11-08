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

/**
 * Drop a mission and rebuild route legs from the remaining set,
 * ordered from the session start location when set.
 */
export function removeMissionAndRebuildRoute(
  session: SessionChecklistModel,
  missionId: string,
): { ok: true; session: SessionChecklistModel } | { ok: false; error: string } {
  const missions = (session.missions ?? []).filter(
    (mission) => mission.id !== missionId,
  );
  const missionsCompleted = missions.filter((m) => m.isCompleted).length;

  if (missions.length === 0) {
    return {
      ok: true,
      session: applySessionCompletionTiming({
        ...session,
        missions: [],
        missionCount: 0,
        missionsCompleted: 0,
        rows: [],
      }),
    };
  }

  const built = buildRouteFromIntake(
    {
      kind: "hauling_contracts_intake",
      version: 1,
      sessionName: session.sessionName,
      contracts: missions.map(intakeContractFromSessionMission),
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
      missionCount: missions.length,
      missionsCompleted,
      rows,
    }),
  };
}

export type { SessionMission };
