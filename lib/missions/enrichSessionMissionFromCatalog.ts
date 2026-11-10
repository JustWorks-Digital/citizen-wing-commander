import type { CatalogMission } from "@/db/schema";
import {
  auecFromRewards,
  formatAuecAmount,
  type HaulingCatalogMissionPayload,
} from "@/lib/missions/catalogMission";
import { normalizeHaulingCategory } from "@/lib/missions/haulingCategory";
import { getContractorBySlug, getLocationBySlug } from "@/lib/fixtures";
import type { SessionMission } from "@/lib/missions/sessionMissions";

function isHaulingPayload(
  payload: unknown,
): payload is HaulingCatalogMissionPayload {
  return (
    typeof payload === "object" &&
    payload != null &&
    (payload as { kind?: string }).kind === "hauling"
  );
}

function locationDisplay(slug: string): string {
  return getLocationBySlug(slug)?.name ?? slug;
}

/**
 * Overlay durable catalog fields onto a session mission for the missions modal.
 * Session flags (completed / hidden) and id stay from the session row.
 */
export function enrichSessionMissionFromCatalog(
  mission: SessionMission,
  catalog: CatalogMission | null | undefined,
): SessionMission {
  if (!catalog || !isHaulingPayload(catalog.payload)) return mission;
  const payload = catalog.payload;
  const extras = payload.extras ?? {};
  const fromSplits =
    payload.scuSplits && payload.scuSplits.length > 0
      ? payload.scuSplits.map((split) => ({
          from: locationDisplay(split.fromLocationSlug),
          to: locationDisplay(split.toLocationSlug),
          commodity: split.commodityName,
          scu: split.scu,
        }))
      : null;
  const deliverySplits = fromSplits
    ? fromSplits
    : Array.isArray(extras.deliverySplits)
      ? (extras.deliverySplits as SessionMission["deliverySplits"])
      : mission.deliverySplits;

  const category =
    normalizeHaulingCategory(payload.category) ?? mission.mobiglas.category;

  return {
    ...mission,
    catalogMissionId: catalog.id,
    title: catalog.title || mission.title,
    contractor: catalog.contractorSlug
      ? (getContractorBySlug(catalog.contractorSlug)?.name ??
        catalog.contractorSlug)
      : mission.contractor,
    rewardAuec: (() => {
      const auec = auecFromRewards(catalog.rewards);
      return auec > 0 ? auec : mission.rewardAuec;
    })(),
    rewardDisplay: (() => {
      const auec = auecFromRewards(catalog.rewards);
      return auec > 0 ? formatAuecAmount(auec) : mission.rewardDisplay;
    })(),
    from: payload.fromLocationSlugs.map(locationDisplay),
    to: payload.toLocationSlugs.map(locationDisplay),
    cargo: payload.cargo.map((line) => ({
      commodity: line.commodityName,
      scu: line.scu,
    })),
    cargoSummary: payload.cargo
      .map((line) => `${line.scu} SCU ${line.commodityName}`)
      .join(" · "),
    maxContainerScu:
      catalog.scuMaxContainerSize ?? mission.maxContainerScu,
    deliverySplits,
    screenshots: payload.latestScreenshotPath
      ? [payload.latestScreenshotPath]
      : mission.screenshots,
    mobiglas: {
      ...mission.mobiglas,
      category,
      title: catalog.title || mission.mobiglas.title || mission.title,
    },
  };
}
