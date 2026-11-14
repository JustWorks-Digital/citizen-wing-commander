import type { CatalogMission } from "@/db/schema";
import { normalizeMissionRank } from "@/lib/missions/missionRank";
import type { SessionMission } from "@/lib/missions/sessionMissions";

function catalogRank(catalog: CatalogMission) {
  const payload = catalog.payload as { rank?: string | null } | null;
  return (
    normalizeMissionRank(catalog.rank) ??
    normalizeMissionRank(payload?.rank ?? null)
  );
}

/**
 * Copy missing session mission ranks from linked catalog rows.
 * Catalog titles are stored without “X Rank”, so sessions built from catalog
 * need the separate `rank` field or pickup/drop cards show “—”.
 */
export function applyCatalogRanksToSessionMissions(
  missions: SessionMission[],
  catalogsById: Map<string, CatalogMission>,
): { missions: SessionMission[]; changed: boolean } {
  let changed = false;
  const next = missions.map((mission) => {
    if (normalizeMissionRank(mission.rank)) return mission;
    const catalogId = mission.catalogMissionId?.trim();
    if (!catalogId) return mission;
    const catalog = catalogsById.get(catalogId);
    if (!catalog) return mission;
    const rank = catalogRank(catalog);
    if (!rank) return mission;
    changed = true;
    return { ...mission, rank };
  });
  return { missions: next, changed };
}
