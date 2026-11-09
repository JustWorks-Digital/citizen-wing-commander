import locationPositionsFixture from "@/lib/fixtures/locationPositions.json";
import type { DistanceToNext } from "@/lib/missions/mockSession";

export type LocationPositionMeters = {
  slug: string;
  name: string;
  system: string;
  x: number;
  y: number;
  z: number;
  qtValid?: boolean;
};

const positionBySlug = new Map(
  (locationPositionsFixture.items as LocationPositionMeters[]).map((row) => [
    row.slug.trim().toLowerCase(),
    row,
  ]),
);

/** Resolve baked CitizenHQ XYZ for a checklist location slug. */
export function resolveLocationPosition(
  locationSlug: string,
): LocationPositionMeters | null {
  return positionBySlug.get(locationSlug.trim().toLowerCase()) ?? null;
}

/** Straight-line meters between two system-frame positions. */
export function distanceMetersBetweenPositions(
  a: Pick<LocationPositionMeters, "x" | "y" | "z">,
  b: Pick<LocationPositionMeters, "x" | "y" | "z">,
): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

/** Pick SC-style km / Mm / Gm display units. */
export function kmToDistanceToNext(km: number): DistanceToNext {
  if (km < 1_000) {
    return { value: roundDistance(km), unit: "km" };
  }
  const megameters = km / 1_000;
  if (megameters < 1_000) {
    return { value: roundDistance(megameters), unit: "Mm" };
  }
  return { value: roundDistance(megameters / 1_000), unit: "Gm" };
}

function roundDistance(value: number): number {
  if (value >= 100) return Math.round(value);
  if (value >= 10) return Math.round(value * 10) / 10;
  return Math.round(value * 100) / 100;
}

/**
 * QT-style straight-line distance between two location slugs using baked
 * CitizenHQ XYZ (meters, system star origin). Same point → 0 km.
 * Cross-system or unresolved → null.
 */
export function distanceBetweenLocationSlugs(
  fromSlug: string,
  toSlug: string,
): DistanceToNext | null {
  const from = resolveLocationPosition(fromSlug);
  const to = resolveLocationPosition(toSlug);
  if (!from || !to) return null;
  if (from.system !== to.system) return null;
  if (from.slug === to.slug) {
    return { value: 0, unit: "km" };
  }
  const meters = distanceMetersBetweenPositions(from, to);
  if (!Number.isFinite(meters)) return null;
  return kmToDistanceToNext(meters / 1_000);
}
