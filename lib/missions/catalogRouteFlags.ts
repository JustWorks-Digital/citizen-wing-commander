import type { ScuLocationSplits } from "@/lib/missions/catalogMission";

/** Denormalized route shape derived from pickup/delivery location counts. */
export type CatalogRouteFlags = {
  isDirect: boolean;
  isOnePickup: boolean;
  isOneDelivery: boolean;
};

export const CATALOG_ROUTE_FILTER_VALUES = [
  "Direct",
  "Non-direct",
  "One pickup",
  "One delivery",
] as const;

export type CatalogRouteFilterValue =
  (typeof CATALOG_ROUTE_FILTER_VALUES)[number];

function locationCount(
  map: Record<string, number> | null | undefined,
): number {
  if (!map) return 0;
  return Object.keys(map).filter((slug) => slug.trim().length > 0).length;
}

/**
 * Derive route flags from `scuLocationSplits`.
 * Direct = exactly one pickup and one delivery; Non-direct is everything else.
 * One pickup / one delivery are independent of Direct.
 */
export function catalogRouteFlagsFromLocationSplits(
  splits: ScuLocationSplits | null | undefined,
  fallback?: { fromSlugs?: string[]; toSlugs?: string[] },
): CatalogRouteFlags {
  let fromCount = locationCount(splits?.from);
  let toCount = locationCount(splits?.to);

  if (fromCount === 0 && (fallback?.fromSlugs?.length ?? 0) > 0) {
    fromCount = new Set(
      (fallback?.fromSlugs ?? []).map((slug) => slug.trim()).filter(Boolean),
    ).size;
  }
  if (toCount === 0 && (fallback?.toSlugs?.length ?? 0) > 0) {
    toCount = new Set(
      (fallback?.toSlugs ?? []).map((slug) => slug.trim()).filter(Boolean),
    ).size;
  }

  const isOnePickup = fromCount === 1;
  const isOneDelivery = toCount === 1;
  const isDirect = isOnePickup && isOneDelivery;

  return { isDirect, isOnePickup, isOneDelivery };
}

/** Filter/display tags for a route-flag row. */
export function catalogRouteFilterTags(
  flags: CatalogRouteFlags,
): CatalogRouteFilterValue[] {
  const tags: CatalogRouteFilterValue[] = [
    flags.isDirect ? "Direct" : "Non-direct",
  ];
  if (flags.isOnePickup) tags.push("One pickup");
  if (flags.isOneDelivery) tags.push("One delivery");
  return tags;
}

/** Short labels for table cells (Direct first; skip redundant one-pickup/delivery on Direct). */
export function catalogRouteDisplayLabels(
  flags: CatalogRouteFlags,
): string[] {
  if (flags.isDirect) return ["Direct"];
  const labels = ["Non-direct"];
  if (flags.isOnePickup) labels.push("One pickup");
  if (flags.isOneDelivery) labels.push("One delivery");
  return labels;
}
