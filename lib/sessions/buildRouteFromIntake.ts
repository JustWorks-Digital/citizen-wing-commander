import { getLocationBySlug } from "@/lib/fixtures";
import type {
  HaulingContractsIntake,
  HaulingIntakeCargoLine,
  HaulingIntakeContract,
} from "@/lib/missions/haulingIntake";
import type { IncomingCargoLine, IncomingLeg } from "@/lib/sessions/resolveRefs";
import {
  resolveCommoditySlug,
  resolveLocationSlug,
} from "@/lib/sessions/resolveRefs";
import type { ShipStorageLocation } from "@/lib/missions/mockSession";

type StopBucket = {
  location: string;
  locationSlug: string;
  pickups: IncomingCargoLine[];
  deliveries: IncomingCargoLine[];
};

function defaultBay(locationSlug: string): ShipStorageLocation {
  const loc = getLocationBySlug(locationSlug);
  const name = `${loc?.name ?? ""} ${loc?.parentName ?? ""} ${locationSlug}`.toLowerCase();
  if (name.includes("hdms") || name.includes("arial")) return "rear";
  if (name.includes("hdpc") || name.includes("outpost")) return "middle";
  if (
    name.includes("lorville") ||
    name.includes("area18") ||
    name.includes("orison") ||
    name.includes("new babylon") ||
    name.includes("spaceport")
  ) {
    return "front";
  }
  return "middle";
}

function mergeCargo(
  into: IncomingCargoLine[],
  line: IncomingCargoLine,
): void {
  const existing = into.find(
    (row) =>
      row.commodity === line.commodity &&
      row.role === line.role &&
      row.shipStorageLocation === line.shipStorageLocation,
  );
  if (existing) {
    existing.scu += line.scu;
    return;
  }
  into.push({ ...line });
}

function resolveCargoLines(
  lines: HaulingIntakeCargoLine[],
  role: "pickup" | "delivery",
  bay: ShipStorageLocation,
): { ok: true; lines: IncomingCargoLine[] } | { ok: false; error: string } {
  const out: IncomingCargoLine[] = [];
  for (const line of lines) {
    const slug = resolveCommoditySlug(line.commodity);
    if (!slug) {
      return { ok: false, error: `Unknown commodity: ${line.commodity}` };
    }
    mergeCargo(out, {
      commodity: slug,
      scu: line.scu,
      role,
      shipStorageLocation: bay,
    });
  }
  return { ok: true, lines: out };
}

function ensureBucket(
  buckets: Map<string, StopBucket>,
  locationInput: string,
): { ok: true; bucket: StopBucket } | { ok: false; error: string } {
  const locationSlug = resolveLocationSlug(locationInput);
  if (!locationSlug) {
    return { ok: false, error: `Unknown location: ${locationInput}` };
  }
  const existing = buckets.get(locationSlug);
  if (existing) return { ok: true, bucket: existing };
  const loc = getLocationBySlug(locationSlug);
  const bucket: StopBucket = {
    location: loc?.name ?? locationInput,
    locationSlug,
    pickups: [],
    deliveries: [],
  };
  buckets.set(locationSlug, bucket);
  return { ok: true, bucket };
}

function ingestContract(
  buckets: Map<string, StopBucket>,
  contract: HaulingIntakeContract,
): { ok: true } | { ok: false; error: string } {
  const pickupSites =
    contract.pickupSplits && Object.keys(contract.pickupSplits).length > 0
      ? Object.keys(contract.pickupSplits)
      : contract.from;

  if (contract.pickupSplits && Object.keys(contract.pickupSplits).length > 0) {
    for (const [site, lines] of Object.entries(contract.pickupSplits)) {
      const bucketResult = ensureBucket(buckets, site);
      if (!bucketResult.ok) return bucketResult;
      const bay = defaultBay(bucketResult.bucket.locationSlug);
      const cargo = resolveCargoLines(lines, "pickup", bay);
      if (!cargo.ok) return cargo;
      for (const line of cargo.lines) {
        mergeCargo(bucketResult.bucket.pickups, line);
      }
    }
  } else if (pickupSites.length === 1) {
    const bucketResult = ensureBucket(buckets, pickupSites[0]!);
    if (!bucketResult.ok) return bucketResult;
    const bay = defaultBay(bucketResult.bucket.locationSlug);
    const cargo = resolveCargoLines(contract.cargo, "pickup", bay);
    if (!cargo.ok) return cargo;
    for (const line of cargo.lines) {
      mergeCargo(bucketResult.bucket.pickups, line);
    }
  } else {
    // No explicit splits: divide SCU across pickup sites (remainder on the first).
    for (const [siteIndex, site] of pickupSites.entries()) {
      const bucketResult = ensureBucket(buckets, site);
      if (!bucketResult.ok) return bucketResult;
      const bay = defaultBay(bucketResult.bucket.locationSlug);
      const splitLines = contract.cargo.map((line) => {
        const base = Math.floor(line.scu / pickupSites.length);
        const rem = line.scu % pickupSites.length;
        return {
          ...line,
          scu: base + (siteIndex === 0 ? rem : 0),
        };
      });
      const cargo = resolveCargoLines(splitLines, "pickup", bay);
      if (!cargo.ok) return cargo;
      for (const line of cargo.lines) {
        if (line.scu > 0) mergeCargo(bucketResult.bucket.pickups, line);
      }
    }
  }

  for (const site of contract.to) {
    const bucketResult = ensureBucket(buckets, site);
    if (!bucketResult.ok) return bucketResult;
    const bay = defaultBay(bucketResult.bucket.locationSlug);
    const cargo = resolveCargoLines(contract.cargo, "delivery", bay);
    if (!cargo.ok) return cargo;
    for (const line of cargo.lines) {
      mergeCargo(bucketResult.bucket.deliveries, line);
    }
  }

  return { ok: true };
}

function stopRank(bucket: StopBucket): number {
  const hasP = bucket.pickups.length > 0;
  const hasD = bucket.deliveries.length > 0;
  const loc = getLocationBySlug(bucket.locationSlug);
  const parent = (loc?.parentName ?? "").toLowerCase();
  const type = (loc?.type ?? "").toLowerCase();
  let body = 1;
  if (parent.includes("arial") || type.includes("moon")) body = 0;
  else if (type.includes("landingzone") || type.includes("city")) body = 3;
  else if (type.includes("manmade") || parent.includes("hurston")) body = 2;

  if (hasP && !hasD) return body * 10 + 0;
  if (hasP && hasD) return body * 10 + 1;
  return body * 10 + 2;
}

/**
 * Merge intake contracts into geography-ish stop legs.
 * Prefer passing explicit `legs` from an optimized route when available.
 */
export function buildRouteFromIntake(
  intake: HaulingContractsIntake,
): { ok: true; legs: IncomingLeg[] } | { ok: false; error: string } {
  if (!intake.contracts.length) {
    return { ok: false, error: "contracts must include at least one contract" };
  }

  const buckets = new Map<string, StopBucket>();
  for (const contract of intake.contracts) {
    const result = ingestContract(buckets, contract);
    if (!result.ok) return result;
  }

  const ordered = [...buckets.values()].sort((a, b) => {
    const rank = stopRank(a) - stopRank(b);
    if (rank !== 0) return rank;
    return a.location.localeCompare(b.location);
  });

  const legs: IncomingLeg[] = ordered.map((bucket, index) => {
    const hasP = bucket.pickups.length > 0;
    const hasD = bucket.deliveries.length > 0;
    const legKind = hasP && hasD ? "both" : hasP ? "pickup" : "delivery";
    const bay = defaultBay(bucket.locationSlug);
    const cargo =
      legKind === "both"
        ? [...bucket.deliveries, ...bucket.pickups]
        : hasP
          ? bucket.pickups.map(({ commodity, scu, shipStorageLocation }) => ({
              commodity,
              scu,
              shipStorageLocation,
            }))
          : bucket.deliveries.map(({ commodity, scu, shipStorageLocation }) => ({
              commodity,
              scu,
              shipStorageLocation,
            }));

    return {
      id: `leg-${index + 1}`,
      legKind,
      location: bucket.location,
      shipStorageLocation: bay,
      cargo,
      distanceToNext: index === ordered.length - 1 ? null : undefined,
      isCompleted: false,
    };
  });

  return { ok: true, legs };
}
