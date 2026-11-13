import type { CatalogMission } from "@/db/schema";
import { auecFromRewards } from "@/lib/missions/catalogMission";
import { catalogPayload } from "@/lib/missions/catalogMissionDisplay";
import { cargoInventory } from "@/lib/missions/cargoInventory";
import { estimateMissionsHaulingRepXp } from "@/lib/missions/haulingRepXp";
import type { DistanceToNext, HaulingChecklistRow } from "@/lib/missions/mockSession";
import { sessionMissionFromCatalog } from "@/lib/missions/sessionMissionFromCatalog";
import { intakeContractFromSessionMission } from "@/lib/missions/sessionMissions";
import { buildRouteFromIntake } from "@/lib/sessions/buildRouteFromIntake";
import { resolveIncomingLeg } from "@/lib/sessions/resolveRefs";
import {
  distanceBetweenLocationSlugs,
  sumDistanceToNext,
} from "@/lib/starmap/distance";

export type CatalogSelectionTotals = {
  /** Unique pickup/delivery location slugs across the selection. */
  stopCount: number;
  /** Approximate QT distance visiting those stops in first-seen order. */
  distance: DistanceToNext | null;
  /** Sum of contract SCU across the selection. */
  scuTotal: number;
  /**
   * Peak SCU aboard if the selected contracts were flown as one merged trip
   * (same route builder as add-to-session). Falls back to `scuTotal` when
   * the route cannot be built.
   */
  peakScu: number;
  auecTotal: number;
  /** Approximate hauling reputation XP from contract titles. */
  expTotal: number;
};

/** Ordered unique location slugs from catalog hauling payloads. */
export function catalogSelectionStopSlugs(
  missions: CatalogMission[],
): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const mission of missions) {
    const payload = catalogPayload(mission);
    const slugs = [
      ...(payload?.fromLocationSlugs ?? []),
      ...(payload?.toLocationSlugs ?? []),
      ...(payload?.scuSplits ?? []).flatMap((split) => [
        split.fromLocationSlug,
        split.toLocationSlug,
      ]),
    ];
    for (const slug of slugs) {
      const key = slug.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      ordered.push(slug.trim());
    }
  }
  return ordered;
}

/** Peak aboard SCU for a merged trip of the selected catalog contracts. */
export function catalogSelectionPeakScu(missions: CatalogMission[]): number {
  if (missions.length === 0) return 0;

  let sessionMissions;
  try {
    sessionMissions = missions.map(sessionMissionFromCatalog);
  } catch {
    return missions.reduce((sum, mission) => sum + (mission.scuTotal ?? 0), 0);
  }

  const built = buildRouteFromIntake({
    kind: "hauling_contracts_intake",
    version: 1,
    sessionName: "catalog-selection",
    contracts: sessionMissions.map(intakeContractFromSessionMission),
  });
  if (!built.ok) {
    return missions.reduce((sum, mission) => sum + (mission.scuTotal ?? 0), 0);
  }

  const rows: HaulingChecklistRow[] = [];
  for (const [index, leg] of built.legs.entries()) {
    const resolved = resolveIncomingLeg(leg, index);
    if (!resolved.ok) {
      return missions.reduce((sum, mission) => sum + (mission.scuTotal ?? 0), 0);
    }
    rows.push(resolved.row);
  }

  return cargoInventory.peakOnboard(rows);
}

/** Totals for the contracts-catalog selected chip block. */
export function catalogSelectionTotals(
  missions: CatalogMission[],
): CatalogSelectionTotals {
  const stopSlugs = catalogSelectionStopSlugs(missions);
  const legs: DistanceToNext[] = [];
  for (let i = 0; i < stopSlugs.length - 1; i += 1) {
    const leg = distanceBetweenLocationSlugs(stopSlugs[i]!, stopSlugs[i + 1]!);
    if (leg) legs.push(leg);
  }

  let auecTotal = 0;
  let scuTotal = 0;
  for (const mission of missions) {
    const rewards =
      mission.rewards?.length
        ? mission.rewards
        : catalogPayload(mission)?.rewards ?? [];
    auecTotal += auecFromRewards(rewards);
    scuTotal += Math.max(0, mission.scuTotal ?? 0);
  }

  return {
    stopCount: stopSlugs.length,
    distance: sumDistanceToNext(legs),
    scuTotal,
    peakScu: catalogSelectionPeakScu(missions),
    auecTotal,
    expTotal: estimateMissionsHaulingRepXp(missions),
  };
}
