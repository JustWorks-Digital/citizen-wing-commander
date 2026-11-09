import type { CatalogMission } from "@/db/schema";
import { getLocationBySlug } from "@/lib/fixtures";
import type { HaulingCatalogMissionPayload } from "@/lib/missions/catalogMission";

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

export function catalogRewardLabel(mission: CatalogMission): string {
  const reward = mission.rewardAuec ?? 0;
  if (reward <= 0) return "—";
  if (reward >= 1000) return `${Math.round(reward / 1000)}k aUEC`;
  return `${reward} aUEC`;
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

export function catalogCargoSummary(mission: CatalogMission): string {
  const payload = catalogPayload(mission);
  const cargo = payload?.cargo ?? [];
  if (cargo.length === 0) {
    return mission.totalScu > 0 ? `${mission.totalScu} SCU` : "—";
  }
  return cargo
    .map((line) => `${line.scu} SCU ${line.commodityName}`)
    .join(" · ");
}
