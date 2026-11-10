import { upsertCatalogMission } from "@/db/queries/catalogMissions";
import { normalizeHaulingCategory } from "@/lib/missions/haulingCategory";
import {
  resolveCommoditySlug,
  resolveContractorSlug,
  resolveLocationSlug,
} from "@/lib/sessions/resolveRefs";
import { getCommodityBySlug } from "@/lib/fixtures";
import type { SessionMission } from "@/lib/missions/sessionMissions";

/**
 * Upsert a session mission into `catalog_missions` and return it with
 * `catalogMissionId` set. Used when applying intake so the UI can reference
 * durable catalog rows.
 */
export async function linkSessionMissionToCatalog(
  mission: SessionMission,
  offerLocation?: string | null,
): Promise<SessionMission> {
  const fromLocationSlugs: string[] = [];
  for (const loc of mission.from) {
    const slug = resolveLocationSlug(loc) ?? loc;
    if (!fromLocationSlugs.includes(slug)) fromLocationSlugs.push(slug);
  }
  const toLocationSlugs: string[] = [];
  for (const loc of mission.to) {
    const slug = resolveLocationSlug(loc) ?? loc;
    if (!toLocationSlugs.includes(slug)) toLocationSlugs.push(slug);
  }

  const cargo = mission.cargo.map((line) => {
    const commoditySlug =
      resolveCommoditySlug(line.commodity) ?? line.commodity;
    return {
      commoditySlug,
      commodityName: getCommodityBySlug(commoditySlug)?.name ?? line.commodity,
      scu: line.scu,
    };
  });

  const offerLocationSlug = offerLocation?.trim()
    ? (resolveLocationSlug(offerLocation) ?? null)
    : null;

  const extras: Record<string, unknown> = {};
  if (mission.deliverySplits?.length) {
    extras.deliverySplits = mission.deliverySplits;
  }

  const row = await upsertCatalogMission({
    type: "hauling",
    payload: {
      title: mission.title,
      category: normalizeHaulingCategory(mission.mobiglas.category),
      contractorSlug: resolveContractorSlug(mission.contractor),
      rewards:
        mission.rewardAuec > 0
          ? [{ kind: "auec" as const, amount: mission.rewardAuec }]
          : [],
      offerLocationSlug,
      fromLocationSlugs,
      toLocationSlugs,
      cargo,
      scuMaxContainerSize: mission.maxContainerScu ?? null,
      latestScreenshotPath: mission.screenshots[0] ?? null,
      extras: Object.keys(extras).length > 0 ? extras : undefined,
    },
  });

  return { ...mission, catalogMissionId: row.id };
}

export async function linkSessionMissionsToCatalog(
  missions: SessionMission[],
  offerLocation?: string | null,
): Promise<SessionMission[]> {
  const linked: SessionMission[] = [];
  for (const mission of missions) {
    linked.push(await linkSessionMissionToCatalog(mission, offerLocation));
  }
  return linked;
}
