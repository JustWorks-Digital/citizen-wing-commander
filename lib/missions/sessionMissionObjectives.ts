import { getLocationBySlug } from "@/lib/fixtures";
import { formatAuecAmount } from "@/lib/missions/catalogMission";
import type { HaulingIntakeCargoLine } from "@/lib/missions/haulingIntake";
import type {
  CargoDelivery,
  HaulingChecklistRow,
} from "@/lib/missions/mockSession";
import type { SessionMission } from "@/lib/missions/sessionMissions";
import {
  resolveCommoditySlug,
  resolveLocationSlug,
} from "@/lib/sessions/resolveRefs";

export type MissionObjectiveLine = {
  /** Station / pad name (parent bullet). */
  locationLabel: string;
  /** Cargo lines under the station (e.g. "4 SCU Quartz"). */
  cargoItems: string[];
};

export type SessionMissionDeliverySplit = NonNullable<
  SessionMission["deliverySplits"]
>[number];

function locationLabel(nameOrSlug: string): string {
  const bySlug = getLocationBySlug(nameOrSlug);
  if (bySlug) return bySlug.name;
  return nameOrSlug;
}

function cargoItemLabels(
  lines: Array<{ commodity: string; scu: number }>,
): string[] {
  return lines
    .filter((line) => line.scu > 0)
    .map((line) => `${line.scu} SCU ${line.commodity}`);
}

function mergeCargoItems(
  lines: Array<{ commodity: string; scu: number }>,
): string[] {
  const byCommodity = new Map<string, number>();
  for (const line of lines) {
    if (line.scu <= 0) continue;
    byCommodity.set(
      line.commodity,
      (byCommodity.get(line.commodity) ?? 0) + line.scu,
    );
  }
  return [...byCommodity.entries()].map(
    ([commodity, scu]) => `${scu} SCU ${commodity}`,
  );
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

function locationMatchesRow(
  locationNameOrSlug: string,
  rowLocationSlug: string,
): boolean {
  const resolved = resolveLocationSlug(locationNameOrSlug);
  if (resolved && resolved === rowLocationSlug) return true;
  return (
    locationNameOrSlug.trim().toLowerCase() === rowLocationSlug.toLowerCase()
  );
}

function missionCommoditySlugs(mission: SessionMission): Set<string> {
  const slugs = new Set<string>();
  for (const line of mission.cargo) {
    const slug =
      resolveCommoditySlug(line.commodity) ??
      line.commodity.trim().toLowerCase();
    if (slug) slugs.add(slug);
  }
  for (const split of mission.deliverySplits ?? []) {
    const slug =
      resolveCommoditySlug(split.commodity) ??
      split.commodity.trim().toLowerCase();
    if (slug) slugs.add(slug);
  }
  return slugs;
}

function commodityDisplayName(
  mission: SessionMission,
  commoditySlug: string,
): string {
  for (const line of mission.cargo) {
    const slug =
      resolveCommoditySlug(line.commodity) ??
      line.commodity.trim().toLowerCase();
    if (slug === commoditySlug) return line.commodity;
  }
  for (const split of mission.deliverySplits ?? []) {
    const slug =
      resolveCommoditySlug(split.commodity) ??
      split.commodity.trim().toLowerCase();
    if (slug === commoditySlug) return split.commodity;
  }
  return commoditySlug;
}

function rowCargoForRole(
  row: HaulingChecklistRow,
  role: "pickup" | "delivery",
): CargoDelivery[] {
  if (row.routeAction === role) return row.cargoDeliveries;
  if (row.routeAction === "both") {
    return row.cargoDeliveries.filter(
      (cargo) => cargo.role === role || cargo.role == null,
    );
  }
  return [];
}

function cargoBelongsToMission(
  mission: SessionMission,
  cargo: CargoDelivery,
): boolean {
  if (cargo.missionId === mission.id) return true;
  if (cargo.missionId) return false;
  return missionCommoditySlugs(mission).has(cargo.commoditySlug);
}

function defaultFromLocation(mission: SessionMission): string {
  return mission.from[0] ?? "";
}

/**
 * Prefer stored `deliverySplits`; otherwise rebuild from route cargo lines
 * (per-stop SCU already on the checklist).
 */
export function resolveMissionDeliverySplits(
  mission: SessionMission,
  rows?: HaulingChecklistRow[] | null,
): SessionMissionDeliverySplit[] | null {
  if (mission.deliverySplits && mission.deliverySplits.length > 0) {
    return mission.deliverySplits;
  }
  if (!rows?.length) return null;

  const fromDefault = defaultFromLocation(mission);
  const derived: SessionMissionDeliverySplit[] = [];

  for (const row of rows) {
    const deliversHere =
      mission.to.length === 0 ||
      mission.to.some((loc) => locationMatchesRow(loc, row.locationSlug));
    if (!deliversHere) continue;

    const deliveries = rowCargoForRole(row, "delivery");
    for (const cargo of deliveries) {
      if (!cargoBelongsToMission(mission, cargo)) continue;
      if (cargo.scu <= 0) continue;
      const toName =
        getLocationBySlug(row.locationSlug)?.name ?? row.locationSlug;
      derived.push({
        from: fromDefault,
        to: toName,
        commodity: commodityDisplayName(mission, cargo.commoditySlug),
        scu: cargo.scu,
      });
    }
  }

  return derived.length > 0 ? derived : null;
}

function objectivesFromDeliverySplits(
  splits: SessionMissionDeliverySplit[],
  field: "from" | "to",
): MissionObjectiveLine[] | null {
  if (splits.length === 0) return null;
  const byLocation = new Map<
    string,
    Array<{ commodity: string; scu: number }>
  >();
  for (const split of splits) {
    const key = split[field]?.trim();
    if (!key || split.scu <= 0) continue;
    const bucket = byLocation.get(key) ?? [];
    bucket.push({ commodity: split.commodity, scu: split.scu });
    byLocation.set(key, bucket);
  }
  if (byLocation.size === 0) return null;
  return [...byLocation.entries()].map(([location, lines]) => ({
    locationLabel: locationLabel(location),
    cargoItems: mergeCargoItems(lines),
  }));
}

function collectFromPickupRows(
  mission: SessionMission,
  rows: HaulingChecklistRow[],
): MissionObjectiveLine[] | null {
  const byLocation = new Map<
    string,
    Array<{ commodity: string; scu: number }>
  >();

  for (const row of rows) {
    const pickups = rowCargoForRole(row, "pickup");
    for (const cargo of pickups) {
      if (!cargoBelongsToMission(mission, cargo)) continue;
      if (cargo.scu <= 0) continue;
      if (
        mission.from.length > 0 &&
        !mission.from.some((loc) => locationMatchesRow(loc, row.locationSlug))
      ) {
        continue;
      }
      const name =
        getLocationBySlug(row.locationSlug)?.name ?? row.locationSlug;
      const bucket = byLocation.get(name) ?? [];
      bucket.push({
        commodity: commodityDisplayName(mission, cargo.commoditySlug),
        scu: cargo.scu,
      });
      byLocation.set(name, bucket);
    }
  }

  if (byLocation.size === 0) return null;
  return [...byLocation.entries()].map(([location, lines]) => ({
    locationLabel: location,
    cargoItems: mergeCargoItems(lines),
  }));
}

function fallbackCargoItems(mission: SessionMission): string[] {
  return cargoItemLabels(
    mission.cargo.map((line) => ({
      commodity: line.commodity,
      scu: line.scu,
    })),
  );
}

/** Collect: station → sub-bullets for each cargo type. */
export function missionCollectObjectives(
  mission: SessionMission,
  rows?: HaulingChecklistRow[] | null,
): MissionObjectiveLine[] {
  const splits = resolveMissionDeliverySplits(mission, rows);
  if (splits) {
    const fromSplits = objectivesFromDeliverySplits(splits, "from");
    if (fromSplits) return fromSplits;
  }

  if (rows?.length) {
    const fromRows = collectFromPickupRows(mission, rows);
    if (fromRows) return fromRows;
  }

  const pickupSplits = mission.pickupSplits;
  if (pickupSplits && Object.keys(pickupSplits).length > 0) {
    return Object.entries(pickupSplits).map(([location, lines]) => ({
      locationLabel: locationLabel(location),
      cargoItems: cargoItemLabels(lines),
    }));
  }
  const cargoItems = fallbackCargoItems(mission);
  return mission.from.map((location) => ({
    locationLabel: locationLabel(location),
    cargoItems,
  }));
}

/** Deliver: station → sub-bullets for each cargo type + amount. */
export function missionDeliverObjectives(
  mission: SessionMission,
  rows?: HaulingChecklistRow[] | null,
): MissionObjectiveLine[] {
  const splits = resolveMissionDeliverySplits(mission, rows);
  if (splits) {
    const toSplits = objectivesFromDeliverySplits(splits, "to");
    if (toSplits) return toSplits;
  }

  const cargoItems = fallbackCargoItems(mission);
  return mission.to.map((location) => ({
    locationLabel: locationLabel(location),
    cargoItems,
  }));
}
