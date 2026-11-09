import { getLocationBySlug } from "@/lib/fixtures";
import { formatAuecAmount } from "@/lib/missions/catalogMission";
import type { HaulingIntakeCargoLine } from "@/lib/missions/haulingIntake";
import type { SessionMission } from "@/lib/missions/sessionMissions";

export type MissionObjectiveLine = {
  locationLabel: string;
  cargoLabel: string;
};

function locationLabel(nameOrSlug: string): string {
  const bySlug = getLocationBySlug(nameOrSlug);
  if (bySlug) return bySlug.name;
  return nameOrSlug;
}

function formatCargoLines(lines: HaulingIntakeCargoLine[]): string {
  if (lines.length === 0) return "—";
  return lines.map((line) => `${line.scu} SCU ${line.commodity}`).join(" · ");
}

function formatSplitCargo(
  lines: Array<{ commodity: string; scu: number }>,
): string {
  if (lines.length === 0) return "—";
  return lines.map((line) => `${line.scu} SCU ${line.commodity}`).join(" · ");
}

export function missionTotalScu(mission: SessionMission): number {
  return mission.cargo.reduce((sum, line) => sum + Math.max(0, line.scu), 0);
}

export function missionRewardLabel(mission: SessionMission): string {
  if (mission.rewardDisplay?.trim()) return mission.rewardDisplay.trim();
  if (mission.rewardAuec > 0) {
    return formatAuecAmount(mission.rewardAuec);
  }
  return "—";
}

function objectivesFromDeliverySplits(
  mission: SessionMission,
  field: "from" | "to",
): MissionObjectiveLine[] | null {
  const splits = mission.deliverySplits;
  if (!splits?.length) return null;
  const byLocation = new Map<string, Array<{ commodity: string; scu: number }>>();
  for (const split of splits) {
    const key = split[field]?.trim();
    if (!key) continue;
    const bucket = byLocation.get(key) ?? [];
    bucket.push({ commodity: split.commodity, scu: split.scu });
    byLocation.set(key, bucket);
  }
  if (byLocation.size === 0) return null;
  return [...byLocation.entries()].map(([location, lines]) => ({
    locationLabel: locationLabel(location),
    cargoLabel: formatSplitCargo(lines),
  }));
}

/** Collect stops with cargo (deliverySplits → pickupSplits → from[]). */
export function missionCollectObjectives(
  mission: SessionMission,
): MissionObjectiveLine[] {
  const fromSplits = objectivesFromDeliverySplits(mission, "from");
  if (fromSplits) return fromSplits;

  const splits = mission.pickupSplits;
  if (splits && Object.keys(splits).length > 0) {
    return Object.entries(splits).map(([location, lines]) => ({
      locationLabel: locationLabel(location),
      cargoLabel: formatCargoLines(lines),
    }));
  }
  const cargoLabel = formatCargoLines(mission.cargo);
  return mission.from.map((location) => ({
    locationLabel: locationLabel(location),
    cargoLabel,
  }));
}

/** Delivery stops with cargo (deliverySplits → to[]). */
export function missionDeliverObjectives(
  mission: SessionMission,
): MissionObjectiveLine[] {
  const toSplits = objectivesFromDeliverySplits(mission, "to");
  if (toSplits) return toSplits;

  const cargoLabel = formatCargoLines(mission.cargo);
  return mission.to.map((location) => ({
    locationLabel: locationLabel(location),
    cargoLabel,
  }));
}
