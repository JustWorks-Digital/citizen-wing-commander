import {
  listCatalogMissions,
  updateCatalogMissionRouteFlags,
} from "@/db/queries/catalogMissions";
import { isMissionPayloadHauling } from "@/lib/missions/catalogMission";
import { catalogRouteFlagsFromLocationSplits } from "@/lib/missions/catalogRouteFlags";

/** Derive `isDirect` / `isOnePickup` / `isOneDelivery` from location splits. */
export async function backfillCatalogRouteFlags(): Promise<{
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
      const payload = isMissionPayloadHauling(mission.payload)
        ? mission.payload
        : null;
      const flags = catalogRouteFlagsFromLocationSplits(
        mission.scuLocationSplits ?? payload?.scuLocationSplits,
        {
          fromSlugs: payload?.fromLocationSlugs,
          toSlugs: payload?.toLocationSlugs,
        },
      );

      const unchanged =
        mission.isDirect === flags.isDirect &&
        mission.isOnePickup === flags.isOnePickup &&
        mission.isOneDelivery === flags.isOneDelivery;

      if (unchanged) {
        skipped += 1;
        continue;
      }

      await updateCatalogMissionRouteFlags({
        missionId: mission.id,
        ...flags,
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
