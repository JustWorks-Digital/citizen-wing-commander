import type { CatalogMission } from "@/db/schema";
import type { HaulingCatalogMissionPayload } from "@/lib/missions/catalogMission";
import { getLocationBySlug } from "@/lib/fixtures";
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
  const deliverySplits = Array.isArray(extras.deliverySplits)
    ? (extras.deliverySplits as SessionMission["deliverySplits"])
    : mission.deliverySplits;

  return {
    ...mission,
    catalogMissionId: catalog.id,
    title: catalog.title || mission.title,
    contractor: catalog.contractor ?? mission.contractor,
    rewardAuec: catalog.rewardAuec ?? mission.rewardAuec,
    rewardDisplay:
      catalog.rewardAuec != null
        ? `${Math.round(catalog.rewardAuec / 1000)}k`
        : mission.rewardDisplay,
    from: payload.fromLocationSlugs.map(locationDisplay),
    to: payload.toLocationSlugs.map(locationDisplay),
    cargo: payload.cargo.map((line) => ({
      commodity: line.commodityName,
      scu: line.scu,
    })),
    cargoSummary: payload.cargo
      .map((line) => `${line.scu} SCU ${line.commodityName}`)
      .join(" · "),
    maxContainerScu: catalog.maxContainerScu ?? mission.maxContainerScu,
    deliverySplits,
    screenshots: payload.latestScreenshotPath
      ? [payload.latestScreenshotPath]
      : mission.screenshots,
  };
}
