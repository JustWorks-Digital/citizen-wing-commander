import type { CatalogMission } from "@/db/schema";
import {
  auecFromRewards,
  formatAuecAmount,
  type HaulingCatalogMissionPayload,
} from "@/lib/missions/catalogMission";
import { normalizeHaulingCategory } from "@/lib/missions/haulingCategory";
import {
  normalizeMissionRank,
  parseRankFromTitle,
  stripRankFromTitle,
} from "@/lib/missions/missionRank";
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
  const fromScuSplits =
    payload.scuSplits && payload.scuSplits.length > 0
      ? payload.scuSplits.map((split) => ({
          from: locationDisplay(split.fromLocationSlug),
          to: locationDisplay(split.toLocationSlug),
          commodity: split.commodityName,
          scu: split.scu,
        }))
      : null;
  const fromLocationSplits = (() => {
    if (fromScuSplits) return null;
    const locSplits =
      catalog.scuLocationSplits ?? payload.scuLocationSplits ?? null;
    if (!locSplits) return null;
    const fromSlug =
      Object.keys(locSplits.from)[0] ?? payload.fromLocationSlugs[0] ?? "";
    const commodity =
      payload.cargo[0]?.commodityName ?? mission.cargo[0]?.commodity ?? "Cargo";
    const lines: NonNullable<SessionMission["deliverySplits"]> = [];
    for (const [toSlug, scu] of Object.entries(locSplits.to)) {
      if (scu <= 0) continue;
      lines.push({
        from: locationDisplay(fromSlug),
        to: locationDisplay(toSlug),
        commodity,
        scu,
      });
    }
    return lines.length > 0 ? lines : null;
  })();
  const deliverySplits = fromScuSplits
    ? fromScuSplits
    : fromLocationSplits
      ? fromLocationSplits
      : Array.isArray(extras.deliverySplits)
        ? (extras.deliverySplits as SessionMission["deliverySplits"])
        : mission.deliverySplits;

  const category =
    normalizeHaulingCategory(payload.category) ?? mission.mobiglas.category;

  // Catalog stores rank separately and titles without "X Rank - …". Recompose
  // so session UI that parses rank from title still shows it.
  const rank =
    normalizeMissionRank(catalog.rank) ?? parseRankFromTitle(mission.title);
  const baseTitle =
    (catalog.title?.trim() || stripRankFromTitle(mission.title).title).trim() ||
    mission.title;
  const titleWithRank = rank ? `${rank} Rank - ${baseTitle}` : baseTitle;

  return {
    ...mission,
    catalogMissionId: catalog.id,
    title: titleWithRank,
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
    scuCargoBoxSplits:
      payload.scuCargoBoxSplits ?? mission.scuCargoBoxSplits,
    scuBoxSplits: catalog.scuBoxSplits ?? mission.scuBoxSplits,
    deliverySplits,
    screenshots: payload.latestScreenshotPath
      ? [payload.latestScreenshotPath]
      : mission.screenshots,
    mobiglas: {
      ...mission.mobiglas,
      category,
      title: titleWithRank,
    },
  };
}
