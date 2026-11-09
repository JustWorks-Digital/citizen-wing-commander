import {
  listCatalogMissions,
  updateCatalogMissionRankFields,
} from "@/db/queries/catalogMissions";
import {
  buildHaulingCatalogMissionPayload,
  catalogMissionFingerprint,
  type HaulingCatalogMissionPayload,
} from "@/lib/missions/catalogMission";
import {
  normalizeMissionRank,
  stripRankFromTitle,
} from "@/lib/missions/missionRank";

function isHaulingPayload(
  payload: unknown,
): payload is HaulingCatalogMissionPayload {
  return (
    typeof payload === "object" &&
    payload != null &&
    (payload as { kind?: string }).kind === "hauling"
  );
}

/**
 * Extract `rank` from titles, strip rank tokens, and normalize Title Case.
 * Safe to re-run — also fixes ALL-CAPS / mixed-case titles.
 */
export async function backfillCatalogRanks(): Promise<{
  total: number;
  updated: number;
  skipped: number;
  errors: Array<{ missionId: string; error: string }>;
}> {
  const missions = await listCatalogMissions({ limit: 500 });
  let updated = 0;
  let skipped = 0;
  const errors: Array<{ missionId: string; error: string }> = [];

  for (const mission of missions) {
    try {
      if (!isHaulingPayload(mission.payload)) {
        skipped += 1;
        continue;
      }

      const sourceTitle = mission.payload.title || mission.title;
      const stripped = stripRankFromTitle(sourceTitle);
      const rank =
        normalizeMissionRank(mission.rank) ??
        normalizeMissionRank(mission.payload.rank) ??
        stripped.rank;

      const nextPayload = buildHaulingCatalogMissionPayload({
        ...mission.payload,
        title: stripped.title,
        rank,
      });
      const fingerprint = catalogMissionFingerprint(nextPayload);

      const unchanged =
        nextPayload.title === mission.title &&
        (nextPayload.rank ?? null) === (mission.rank ?? null) &&
        fingerprint === mission.fingerprint &&
        nextPayload.title === mission.payload.title &&
        (nextPayload.rank ?? null) === (mission.payload.rank ?? null);

      if (unchanged) {
        skipped += 1;
        continue;
      }

      try {
        await updateCatalogMissionRankFields({
          missionId: mission.id,
          title: nextPayload.title,
          rank: nextPayload.rank ?? null,
          payload: nextPayload,
          fingerprint,
        });
      } catch (error) {
        // Fingerprint collision after stripping rank — keep existing fingerprint.
        const message = error instanceof Error ? error.message : String(error);
        if (!/unique|duplicate|fingerprint/i.test(message)) throw error;
        await updateCatalogMissionRankFields({
          missionId: mission.id,
          title: nextPayload.title,
          rank: nextPayload.rank ?? null,
          payload: nextPayload,
          fingerprint: mission.fingerprint,
        });
      }
      updated += 1;
    } catch (error) {
      errors.push({
        missionId: mission.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { total: missions.length, updated, skipped, errors };
}
