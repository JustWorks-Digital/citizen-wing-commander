import type { CargoBoxFootprint } from "@/lib/ships/cargoBoxSizes";
import {
  cargoGridCoordKey,
  type CargoGridCoord,
} from "@/lib/ships/cargoGridCoords";
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

export type CargoPlacementRuleId =
  | "prefer-flat-layers"
  | "prefer-flat-stable-support"
  | "prefer-back-when-full-height";

export type CargoPlacementRuleContext = {
  bounds: CargoPlacementBounds;
  footprint: CargoBoxFootprint;
  /** Crate SCU volume (`dx * dy * dz` for standard boxes). */
  boxScu: number;
  /** Coarse bay (front / middle / rear) — future rules may key off this. */
  zone: CargoGridStorageLocation;
  /**
   * Occupied cells → crate SCU size that owns them.
   * Used by support / stacking preference rules.
   */
  occupiedSizes: ReadonlyMap<string, number>;
};

export type CargoPlacementAxis = "x" | "y" | "z";

/**
 * Axis scan order for `findSlot`.
 * `axes` is outer→inner nesting (default flat-first: z, then x, then y).
 */
export type CargoPlacementSlotOrder = {
  xs: number[];
  ys: number[];
  zs: number[];
  axes: CargoPlacementAxis[];
};

export type CargoPlacementRule = {
  id: CargoPlacementRuleId;
  /** Short “use when…” note for humans / MCP / future toggles. */
  summary: string;
  /**
   * Return a custom scan order, or `null` to leave the order unchanged
   * (later rules may still adjust).
   */
  slotOrder?: (
    ctx: CargoPlacementRuleContext,
    current: CargoPlacementSlotOrder,
  ) => CargoPlacementSlotOrder | null;
  /**
   * Preference score for a candidate origin that already `fits`.
   * Higher wins; `null` = no opinion. Ties keep scan order.
   */
  scoreSlot?: (
    ctx: CargoPlacementRuleContext,
    origin: CargoGridCoord,
  ) => number | null;
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
    // Fill a layer before stacking — flat floors look more organized.
    axes: ["z", "x", "y"],
  };
}

/**
 * Prefer filling the current layer (especially the deck) before stacking
 * upward, so the bay stays flat as long as possible.
 */
const preferFlatLayers: CargoPlacementRule = {
  id: "prefer-flat-layers",
  summary:
    "Prefer flat surfaces: fill the bottom layer completely before placing crates on higher layers.",
  slotOrder(_ctx, current) {
    return { ...current, axes: ["z", "x", "y"] };
  },
};

/**
 * Prefer stable flat platforms when stacking.
 * - Deck is best.
 * - Equal/larger support cells are ideal.
 * - 8 may sit on 4s; 8 or 4 may sit on a composed flat of 2s.
 * - Large crates should not rest only on 1 SCU cells.
 */
const preferFlatStableSupport: CargoPlacementRule = {
  id: "prefer-flat-stable-support",
  summary:
    "Prefer flat, stable support: 8-on-4 and composed 2s OK; avoid large crates on 1 SCU alone.",
  scoreSlot(ctx, origin) {
    if (origin.z === 0) return 3;
    const { footprint, boxScu, occupiedSizes } = ctx;
    const support: number[] = [];
    for (let dx = 0; dx < footprint.dx; dx += 1) {
      for (let dy = 0; dy < footprint.dy; dy += 1) {
        const supportSize = occupiedSizes.get(
          cargoGridCoordKey({
            x: origin.x + dx,
            y: origin.y + dy,
            z: origin.z - 1,
          }),
        );
        if (supportSize == null) return 0;
        support.push(supportSize);
      }
    }
    const min = Math.min(...support);
    if (min >= boxScu) return 2;
    if (boxScu === 8 && min >= 4) return 2;
    if ((boxScu === 8 || boxScu === 4) && min >= 2) return 1;
    if (boxScu >= 4 && min <= 1) return 0;
    return 0;
  },
};

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
 * Ordered placement rules. Append new rules here; each may refine scan
 * order and/or score candidates. Compose in list order.
 */
export const cargoPlacementRules: readonly CargoPlacementRule[] = [
  preferFlatLayers,
  preferFlatStableSupport,
  preferBackWhenFullHeight,
];

/** Apply the active rule list to produce the final XY/Z scan order. */
export function resolvePlacementSlotOrder(
  ctx: CargoPlacementRuleContext,
  rules: readonly CargoPlacementRule[] = cargoPlacementRules,
): CargoPlacementSlotOrder {
  let order = defaultSlotOrder(ctx.bounds, ctx.footprint);
  for (const rule of rules) {
    const next = rule.slotOrder?.(ctx, order) ?? null;
    if (next) order = next;
  }
  return order;
}

/** Sum preference scores from rules that care about this origin. */
export function scorePlacementSlot(
  ctx: CargoPlacementRuleContext,
  origin: CargoGridCoord,
  rules: readonly CargoPlacementRule[] = cargoPlacementRules,
): number {
  let total = 0;
  for (const rule of rules) {
    const score = rule.scoreSlot?.(ctx, origin);
    if (typeof score === "number") total += score;
  }
  return total;
}

/**
 * Walk candidate origins in `order.axes` nesting (outer → inner).
 */
export function forEachPlacementOrigin(
  order: CargoPlacementSlotOrder,
  visit: (origin: CargoGridCoord) => void,
): void {
  const ranges: Record<CargoPlacementAxis, number[]> = {
    x: order.xs,
    y: order.ys,
    z: order.zs,
  };
  const axes =
    order.axes.length === 3 ? order.axes : (["z", "x", "y"] as const);
  const [a0, a1, a2] = axes;
  for (const v0 of ranges[a0]) {
    for (const v1 of ranges[a1]) {
      for (const v2 of ranges[a2]) {
        const origin: CargoGridCoord = { x: 0, y: 0, z: 0 };
        origin[a0] = v0;
        origin[a1] = v1;
        origin[a2] = v2;
        visit(origin);
      }
    }
  }
}
