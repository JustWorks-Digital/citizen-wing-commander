import type { CatalogMission } from "@/db/schema";
import { getContractorBySlug, getLocationBySlug } from "@/lib/fixtures";
import {
  auecFromRewards,
  formatAuecAmount,
  type CatalogMissionReward,
  type HaulingCatalogMissionPayload,
} from "@/lib/missions/catalogMission";

export function catalogPayload(
  mission: CatalogMission,
): HaulingCatalogMissionPayload | null {
  const payload = mission.payload as HaulingCatalogMissionPayload | null;
  if (!payload || payload.kind !== "hauling") return null;
  return payload;
}

export function locationDisplayName(slugOrName: string | null | undefined): string {
  if (!slugOrName?.trim()) return "—";
  return getLocationBySlug(slugOrName)?.name ?? slugOrName;
}

export function contractorDisplayName(
  slugOrName: string | null | undefined,
): string {
  if (!slugOrName?.trim()) return "—";
  return getContractorBySlug(slugOrName)?.name ?? slugOrName;
}

function formatRewardLine(reward: CatalogMissionReward): string {
  if (reward.kind === "auec") {
    if (reward.amount <= 0) return "";
    return formatAuecAmount(reward.amount);
  }
  return reward.name;
}

/** Compact table/detail label for catalog rewards (aUEC + other kinds). */
export function catalogRewardLabel(mission: CatalogMission): string {
  const rewards =
    mission.rewards?.length
      ? mission.rewards
      : catalogPayload(mission)?.rewards ?? [];
  const parts = rewards.map(formatRewardLine).filter(Boolean);
  if (parts.length === 0) {
    const auec = auecFromRewards(rewards);
    return auec > 0 ? formatRewardLine({ kind: "auec", amount: auec }) : "—";
  }
  return parts.join(" · ");
}

export function catalogRouteSummary(mission: CatalogMission): {
  from: string[];
  to: string[];
} {
  const payload = catalogPayload(mission);
  return {
    from: (payload?.fromLocationSlugs ?? []).map(locationDisplayName),
    to: (payload?.toLocationSlugs ?? []).map(locationDisplayName),
  };
}

/** Per-line cargo labels for table lists (commodity names). */
export function catalogCargoLines(mission: CatalogMission): string[] {
  const payload = catalogPayload(mission);
  const cargo = payload?.cargo ?? [];
  if (cargo.length === 0) {
    return mission.scuTotal > 0 ? [`${mission.scuTotal} SCU`] : [];
  }
  return cargo.map((line) => line.commodityName);
}

export function catalogCargoSummary(mission: CatalogMission): string {
  const lines = catalogCargoLines(mission);
  return lines.length > 0 ? lines.join(" · ") : "—";
}
