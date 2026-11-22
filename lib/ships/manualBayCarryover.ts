/**
 * Manual bay layout when advancing stops: the player’s earlier arrangement is
 * the same physical crates — keep those poses; only refresh stop actions.
 */

import type {
  CargoGridBoxAction,
  PlacedCargoBox,
} from "@/lib/ships/cargoGridPlacement";

function commodityKey(box: PlacedCargoBox): string {
  return `${box.missionId ?? "_"}:${box.commoditySlug}`;
}

function commoditySlug(box: PlacedCargoBox): string {
  return box.commoditySlug;
}

function addScu(map: Map<string, number>, key: string, size: number) {
  map.set(key, (map.get(key) ?? 0) + size);
}

export const manualBayCarryover = {
  /**
   * Keep earlier Manual crates while this stop still needs that commodity’s
   * SCU on the bay. Poses stay identical (same objects). Action becomes
   * `delivery` until this stop’s delivery SCU is covered, then stay (no
   * action). Does not place fresh auto-pack poses for re-split sizes.
   */
  boxesAtStop(
    autoBoxes: readonly PlacedCargoBox[],
    earlierLayout: readonly PlacedCargoBox[],
  ): PlacedCargoBox[] {
    if (earlierLayout.length === 0) return [...autoBoxes];

    const totalByKey = new Map<string, number>();
    const deliveryByKey = new Map<string, number>();
    const totalBySlug = new Map<string, number>();
    const deliveryBySlug = new Map<string, number>();
    const sampleByKey = new Map<string, PlacedCargoBox>();
    const sampleBySlug = new Map<string, PlacedCargoBox>();

    for (const box of autoBoxes) {
      const key = commodityKey(box);
      const slug = commoditySlug(box);
      addScu(totalByKey, key, box.size);
      addScu(totalBySlug, slug, box.size);
      if (box.action === "delivery") {
        addScu(deliveryByKey, key, box.size);
        addScu(deliveryBySlug, slug, box.size);
      }
      if (!sampleByKey.has(key)) sampleByKey.set(key, box);
      if (!sampleBySlug.has(slug)) sampleBySlug.set(slug, box);
    }

    const remainingTotalKey = new Map(totalByKey);
    const remainingTotalSlug = new Map(totalBySlug);
    const deliveryTaggedKey = new Map<string, number>();
    const deliveryTaggedSlug = new Map<string, number>();
    const carried: PlacedCargoBox[] = [];

    for (const earlier of earlierLayout) {
      const key = commodityKey(earlier);
      const slug = commoditySlug(earlier);
      const preferKey = (remainingTotalKey.get(key) ?? 0) >= earlier.size;
      const remaining = preferKey ? remainingTotalKey : remainingTotalSlug;
      const id = preferKey ? key : slug;
      const left = remaining.get(id) ?? 0;
      if (left < earlier.size) continue;
      remaining.set(id, left - earlier.size);

      const deliveryBudget = preferKey
        ? (deliveryByKey.get(key) ?? 0)
        : (deliveryBySlug.get(slug) ?? 0);
      const taggedMap = preferKey ? deliveryTaggedKey : deliveryTaggedSlug;
      const taggedId = preferKey ? key : slug;
      const alreadyTagged = taggedMap.get(taggedId) ?? 0;
      const action: CargoGridBoxAction | undefined =
        alreadyTagged + earlier.size <= deliveryBudget ? "delivery" : undefined;
      if (action === "delivery") {
        taggedMap.set(taggedId, alreadyTagged + earlier.size);
      }

      const sample =
        (preferKey ? sampleByKey.get(key) : undefined) ??
        sampleBySlug.get(slug) ??
        earlier;

      carried.push({
        ...earlier,
        origin: { ...earlier.origin },
        footprint: { ...earlier.footprint },
        cells: earlier.cells.map((cell) => ({ ...cell })),
        action,
        deliveryLocationSlug:
          action === "delivery"
            ? sample.deliveryLocationSlug
            : undefined,
        deliveryLocationName:
          action === "delivery"
            ? sample.deliveryLocationName
            : undefined,
        locationGroupIndex:
          action === "delivery" ? sample.locationGroupIndex : undefined,
        isOverflow: earlier.isOverflow,
      });
    }

    return carried;
  },
};
