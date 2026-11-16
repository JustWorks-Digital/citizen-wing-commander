import type { CatalogMission } from "@/db/schema";
import {
  auecFromRewards,
  formatAuecAmount,
  formatRewardsLabel,
  normalizeCatalogRewards,
  rewardsFromAuec,
  type HaulingCatalogMissionPayload,
} from "@/lib/missions/catalogMission";
import { normalizeHaulingCategory } from "@/lib/missions/haulingCategory";
import {
  normalizeMissionRank,
  stripRankFromTitle,
} from "@/lib/missions/missionRank";
import { resolveScuSplits } from "@/lib/missions/missionScuSplits";
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
 * Trip `scuSplits` (incl. player corrections) win when present.
 */
export function enrichSessionMissionFromCatalog(
  mission: SessionMission,
  catalog: CatalogMission | null | undefined,
): SessionMission {
  if (!catalog || !isHaulingPayload(catalog.payload)) return mission;
  const payload = catalog.payload;
  const extras = payload.extras ?? {};
  const legacyDeliverySplits = Array.isArray(extras.deliverySplits)
    ? (extras.deliverySplits as Array<{
        from: string;
        to: string;
        commodity: string;
        scu: number;
        isUserCorrected?: boolean;
        scuAutoSelected?: number;
      }>)
    : null;
  const fromCatalog = resolveScuSplits({
    scuSplits: payload.scuSplits,
    scuLocationSplits:
      catalog.scuLocationSplits ?? payload.scuLocationSplits ?? null,
    legacyDeliverySplits,
    cargo: payload.cargo,
    fromFallbackSlug: payload.fromLocationSlugs[0],
  });
  // Trip edits (incl. isUserCorrected) stay authoritative when present.
  const scuSplits =
    mission.scuSplits && mission.scuSplits.length > 0
      ? mission.scuSplits
      : fromCatalog;

  const category =
    normalizeHaulingCategory(payload.category) ?? mission.mobiglas.category;

  // Prefer catalog DB/payload rank; session rank is already load-normalized.
  const rank =
    normalizeMissionRank(catalog.rank) ??
    normalizeMissionRank(payload.rank) ??
    normalizeMissionRank(mission.rank);
  const title =
    (catalog.title?.trim() || stripRankFromTitle(mission.title).title).trim() ||
    mission.title;

  const catalogRewards = normalizeCatalogRewards(
    catalog.rewards?.length ? catalog.rewards : payload.rewards,
  );
  const rewards =
    catalogRewards.length > 0
      ? catalogRewards
      : mission.rewards && mission.rewards.length > 0
        ? mission.rewards
        : rewardsFromAuec(mission.rewardAuec);
  const rewardAuecFromCatalog = auecFromRewards(catalogRewards);
  const rewardDisplayFromRewards =
    catalogRewards.length > 0 ? formatRewardsLabel(catalogRewards) : null;

  return {
    ...mission,
    catalogMissionId: catalog.id,
    title,
    rank,
    contractor: catalog.contractorSlug
      ? (getContractorBySlug(catalog.contractorSlug)?.name ??
        catalog.contractorSlug)
      : mission.contractor,
    rewards,
    rewardAuec:
      rewardAuecFromCatalog > 0 ? rewardAuecFromCatalog : mission.rewardAuec,
    rewardDisplay:
      rewardDisplayFromRewards && rewardDisplayFromRewards !== "—"
        ? rewardDisplayFromRewards
        : rewardAuecFromCatalog > 0
          ? formatAuecAmount(rewardAuecFromCatalog)
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
    scuMaxContainerSize:
      catalog.scuMaxContainerSize ?? mission.scuMaxContainerSize,
    scuCargoBoxSplits:
      payload.scuCargoBoxSplits ?? mission.scuCargoBoxSplits,
    scuBoxSplits: catalog.scuBoxSplits ?? mission.scuBoxSplits,
    scuTotalCertainty:
      catalog.scuTotalCertainty ??
      payload.scuTotalCertainty ??
      mission.scuTotalCertainty ??
      null,
    scuBoxSplitsCertainty:
      catalog.scuBoxSplitsCertainty ??
      payload.scuBoxSplitsCertainty ??
      mission.scuBoxSplitsCertainty ??
      null,
    scuCargoBoxSplitsCertainty:
      payload.scuCargoBoxSplitsCertainty ??
      mission.scuCargoBoxSplitsCertainty,
    scuSplits,
    screenshots: payload.latestScreenshotPath
      ? [payload.latestScreenshotPath]
      : mission.screenshots,
    mobiglas: {
      ...mission.mobiglas,
      category,
      title,
    },
  };
}
