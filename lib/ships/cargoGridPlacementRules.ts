import type { CargoBoxFootprint } from "@/lib/ships/cargoBoxSizes";
import type { CargoGridStorageLocation } from "@/lib/ships/cargoGrids";

/**
 * Bay AABB used by the placer (zEnd exclusive — same as `heightCells`).
 * Kept local-shaped so rules stay decoupled from the full placement module.
 */
export type CargoPlacementBounds = {
  xStart: number;
  xEnd: number;
  yStart: number;
  yEnd: number;
  zEnd: number;
};

export type CargoPlacementRuleId = "prefer-back-when-full-height";

export type CargoPlacementRuleContext = {
  bounds: CargoPlacementBounds;
  footprint: CargoBoxFootprint;
  /** Coarse bay (front / middle / rear) — future rules may key off this. */
  zone: CargoGridStorageLocation;
};

/**
 * Axis scan order for `findSlot`. Default is nose→ramp (ascending X),
 * port→starboard (ascending Y), deck→ceiling (ascending Z).
 */
export type CargoPlacementSlotOrder = {
  xs: number[];
  ys: number[];
  zs: number[];
};

export type CargoPlacementRule = {
  id: CargoPlacementRuleId;
  /** Short “use when…” note for humans / future toggles. */
  summary: string;
  /**
   * Return a custom scan order, or `null` to leave the order unchanged
   * (later rules may still adjust).
   */
  slotOrder: (
    ctx: CargoPlacementRuleContext,
    current: CargoPlacementSlotOrder,
  ) => CargoPlacementSlotOrder | null;
};

function rangeAscending(start: number, endInclusive: number): number[] {
  const out: number[] = [];
  for (let value = start; value <= endInclusive; value += 1) out.push(value);
  return out;
}

function rangeDescending(start: number, endInclusive: number): number[] {
  const out: number[] = [];
  for (let value = endInclusive; value >= start; value -= 1) out.push(value);
  return out;
}

export function defaultSlotOrder(
  bounds: CargoPlacementBounds,
  footprint: CargoBoxFootprint,
): CargoPlacementSlotOrder {
  return {
    xs: rangeAscending(bounds.xStart, bounds.xEnd - footprint.dx),
    ys: rangeAscending(bounds.yStart, bounds.yEnd - footprint.dy),
    zs: rangeAscending(0, bounds.zEnd - footprint.dz),
  };
}

/**
 * A crate that occupies the full bay height in one footprint blocks the
 * aisle through that column. Prefer the back of the bay (rampward / high X)
 * so nose-side columns stay reachable.
 */
const preferBackWhenFullHeight: CargoPlacementRule = {
  id: "prefer-back-when-full-height",
  summary:
    "Full-height crates pack from the back of the bay (high X) so they do not wall off cells behind them.",
  slotOrder(ctx, current) {
    if (ctx.footprint.dz < ctx.bounds.zEnd) return null;
    return {
      ...current,
      xs: rangeDescending(ctx.bounds.xStart, ctx.bounds.xEnd - ctx.footprint.dx),
    };
  },
};

/**
 * Ordered placement rules. Append new rules here; each may refine the scan
 * order. First matching adjustments compose in list order.
 */
export const cargoPlacementRules: readonly CargoPlacementRule[] = [
  preferBackWhenFullHeight,
];

/** Apply the active rule list to produce the final XY/Z scan order. */
export function resolvePlacementSlotOrder(
  ctx: CargoPlacementRuleContext,
  rules: readonly CargoPlacementRule[] = cargoPlacementRules,
): CargoPlacementSlotOrder {
  let order = defaultSlotOrder(ctx.bounds, ctx.footprint);
  for (const rule of rules) {
    const next = rule.slotOrder(ctx, order);
    if (next) order = next;
  }
  return order;
}
