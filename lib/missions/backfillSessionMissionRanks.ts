import { getCatalogMissionsByIds } from "@/db/queries/catalogMissions";
import { applyCatalogRanksToSessionMissions } from "@/lib/missions/applyCatalogRanksToSessionMissions";
import { normalizeMissionRank } from "@/lib/missions/missionRank";
import type { SessionChecklistModel } from "@/lib/missions/mockSession";

/** Load catalog ranks for linked missions and stamp them onto the session. */
export async function backfillSessionMissionRanksFromCatalog(
  session: SessionChecklistModel,
): Promise<{ session: SessionChecklistModel; changed: boolean }> {
  const missions = session.missions ?? [];
  const ids = [
    ...new Set(
      missions
        .filter((mission) => !normalizeMissionRank(mission.rank))
        .map((mission) => mission.catalogMissionId?.trim())
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (ids.length === 0) {
    return { session, changed: false };
  }

  const catalogs = await getCatalogMissionsByIds(ids);
  const catalogsById = new Map(catalogs.map((row) => [row.id, row]));
  const { missions: nextMissions, changed } = applyCatalogRanksToSessionMissions(
    missions,
    catalogsById,
  );
  if (!changed) return { session, changed: false };
  return {
    changed: true,
    session: { ...session, missions: nextMissions },
  };
}
