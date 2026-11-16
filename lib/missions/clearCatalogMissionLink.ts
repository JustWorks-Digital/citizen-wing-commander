import type { SessionChecklist } from "@/lib/missions/sessionChecklist";


/** True when a catalog sync error means the linked row is missing. */
export function isCatalogMissionNotFoundError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /catalog mission not found/i.test(message);
}

/**
 * Drop a stale `catalogMissionId` so trip saves stop retrying a missing
 * catalog row (e.g. prod-linked trip on a local DB). Relink explicitly later.
 */
export function clearCatalogMissionLink(
  session: SessionChecklist,
  missionId: string,
): SessionChecklist {
  const missions = session.missions ?? [];
  let changed = false;
  const nextMissions = missions.map((mission) => {
    if (mission.id !== missionId) return mission;
    if (mission.catalogMissionId == null) return mission;
    changed = true;
    return { ...mission, catalogMissionId: null };
  });
  if (!changed) return session;
  return { ...session, missions: nextMissions };
}
