import {
  listCatalogMissions,
  updateCatalogMissionOfferStarSystem,
} from "@/db/queries/catalogMissions";
import { getLocationBySlug } from "@/lib/fixtures";
import {
  buildHaulingCatalogMissionPayload,
  type HaulingCatalogMissionPayload,
} from "@/lib/missions/catalogMission";
import { normalizeStarSystemSlug } from "@/lib/missions/starSystem";

const BACKFILL_DEFAULT_SLUG = "stanton";

function isHaulingPayload(
  payload: unknown,
): payload is HaulingCatalogMissionPayload {
  return (
    typeof payload === "object" &&
    payload != null &&
    (payload as { kind?: string }).kind === "hauling"
  );
}

function resolveOfferStarSystemSlug(mission: {
  offerStarSystemSlug?: string | null;
  offerLocationSlug?: string | null;
  payload: unknown;
}): string {
  const payload = isHaulingPayload(mission.payload) ? mission.payload : null;
  const fromColumn = normalizeStarSystemSlug(mission.offerStarSystemSlug);
  if (fromColumn) return fromColumn;
  const fromPayload = normalizeStarSystemSlug(payload?.offerStarSystemSlug);
  if (fromPayload) return fromPayload;

  const offerSlug =
    mission.offerLocationSlug ?? payload?.offerLocationSlug ?? null;
  if (offerSlug) {
    const loc = getLocationBySlug(offerSlug);
    const fromLocation = normalizeStarSystemSlug(loc?.system);
    if (fromLocation) return fromLocation;
  }

  return BACKFILL_DEFAULT_SLUG;
}

/**
 * Fill `offerStarSystemSlug` on catalog missions (column + payload).
 * Prefers existing value → location.system → stanton.
 * Safe to re-run.
 */
export async function backfillCatalogOfferStarSystem(): Promise<{
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

      const offerStarSystemSlug = resolveOfferStarSystemSlug(mission);
      const nextPayload = buildHaulingCatalogMissionPayload({
        ...mission.payload,
        offerStarSystemSlug,
      });

      const unchanged =
        (mission.offerStarSystemSlug ?? null) === offerStarSystemSlug &&
        (mission.payload.offerStarSystemSlug ?? null) === offerStarSystemSlug;

      if (unchanged) {
        skipped += 1;
        continue;
      }

      await updateCatalogMissionOfferStarSystem({
        missionId: mission.id,
        offerStarSystemSlug,
        payload: nextPayload,
      });
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
