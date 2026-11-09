import type { CatalogMission } from "@/db/schema";
import {
  auecFromRewards,
  formatAuecAmount,
  type HaulingCatalogMissionPayload,
} from "@/lib/missions/catalogMission";
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
 * Build a session mission from a durable catalog row.
 * Session id defaults to the catalog UUID so re-adds can dedupe by id / catalogMissionId.
 */
export function sessionMissionFromCatalog(
  catalog: CatalogMission,
): SessionMission {
  if (!isHaulingPayload(catalog.payload)) {
    throw new Error(`Catalog mission ${catalog.id} is not a hauling payload`);
  }
  const payload = catalog.payload;
  const extras = payload.extras ?? {};
  const rewardAuec = auecFromRewards(catalog.rewards?.length ? catalog.rewards : payload.rewards);
  const contractor = catalog.contractorSlug
    ? (getContractorBySlug(catalog.contractorSlug)?.name ??
      catalog.contractorSlug)
    : "Unknown contractor";
  const from = payload.fromLocationSlugs.map(locationDisplay);
  const to = payload.toLocationSlugs.map(locationDisplay);
  const cargo = payload.cargo.map((line) => ({
    commodity: line.commodityName,
    scu: line.scu,
  }));
  const cargoSummary = cargo
    .map((line) => `${line.scu} SCU ${line.commodity}`)
    .join(" · ");
  const deliverySplits =
    payload.scuSplits && payload.scuSplits.length > 0
      ? payload.scuSplits.map((split) => ({
          from: locationDisplay(split.fromLocationSlug),
          to: locationDisplay(split.toLocationSlug),
          commodity: split.commodityName,
          scu: split.scu,
        }))
      : Array.isArray(extras.deliverySplits)
        ? (extras.deliverySplits as SessionMission["deliverySplits"])
        : undefined;

  const screenshots = payload.latestScreenshotPath
    ? [payload.latestScreenshotPath]
    : catalog.latestScreenshotPath
      ? [catalog.latestScreenshotPath]
      : [];

  return {
    id: catalog.id,
    catalogMissionId: catalog.id,
    title: catalog.title || payload.title,
    contractor,
    rewardAuec,
    rewardDisplay: rewardAuec > 0 ? formatAuecAmount(rewardAuec) : undefined,
    from,
    to,
    cargo,
    deliverySplits,
    maxContainerScu: catalog.scuMaxContainerSize ?? payload.scuMaxContainerSize ?? undefined,
    scuBoxSplits: catalog.scuBoxSplits ?? payload.scuBoxSplits,
    cargoSummary,
    isCompleted: false,
    isHidden: false,
    screenshots,
    mobiglas: {
      tab: "Accepted",
      category: "Hauling - Planetary",
      title: catalog.title || payload.title,
      contractor,
      rewardAuec,
      rewardDisplay: rewardAuec > 0 ? formatAuecAmount(rewardAuec) : undefined,
      timeRemaining: null,
      deadline: null,
      details: `Haul ${cargoSummary} from ${from.join(", ")} to ${to.join(", ")}.${
        catalog.scuMaxContainerSize
          ? ` Containers at most ${catalog.scuMaxContainerSize} SCU.`
          : ""
      }`,
      objectives: [
        {
          label: `Deliver ${cargoSummary} to ${to.join(", ")}`,
          progressCurrent: 0,
          progressTotal: cargo.reduce((sum, line) => sum + line.scu, 0),
          children: from.map((site) => `Collect from ${site}`),
        },
      ],
    },
  };
}
