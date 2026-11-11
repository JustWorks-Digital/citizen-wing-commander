import type { CargoBoxFootprint } from "@/lib/ships/cargoBoxSizes";
import type { CargoGridCoord } from "@/lib/ships/cargoGridCoords";
import {
  expandPackProgram,
  type CargoBayPackProgram,
  type PackCall,
  type PackOrderBy,
} from "@/lib/ships/cargoBayPackProgram";

/** Metrics gathered for each legal slot candidate. */
export type PackSlotCandidateMetrics = {
  origin: CargoGridCoord;
  /** Face-adjacent same-cluster contacts (side + stack). */
  sameClusterTouch: number;
  /** Face-adjacent same-region contacts (excl. same cluster). */
  sameRegionTouch: number;
  sameClusterSupport: number;
  otherClusterSupport: number;
  /** Face-adjacent side contacts with a different cargo-type cluster. */
  otherClusterSide: number;
  regionSupport: number;
  foreignSide: number;
  foreignSupport: number;
  /** Min support cell SCU under footprint (deck = +inf). */
  supportScuMin: number;
  emptyCellsOnSameZ: number;
  bayEndToward: number;
  edgeDistance: number;
  identicalSizeStack: boolean;
  /** Optional legacy placement-rule score (higher = better); final tiebreak only. */
  placementRuleScore?: number;
};

export type PackSlotPolicy = {
  /** Slot-relevant calls, already priority-sorted. */
  calls: PackCall[];
  preferSameCargoType: boolean;
  preferSameDeliveryLocation: boolean;
  largerBelow: boolean;
  allowOnLargerWhenOrphan: boolean;
  requireFullFootprint: boolean;
  forbidForeignSupport: boolean;
  requireRegionContiguity: boolean;
  biasXyMode: "edges-first" | "center-first" | null;
};

export function derivePackSlotPolicy(
  program: CargoBayPackProgram,
): PackSlotPolicy {
  const calls = expandPackProgram(program).filter((call) => {
    if (call.call === "order" && call.target === "candidate-slots") return true;
    if (call.call === "stack") return true;
    if (call.call === "require") return true;
    if (call.call === "bias-xy") return true;
    return false;
  });

  return {
    calls,
    preferSameCargoType: calls.some(
      (call) => call.call === "stack" && call.prefer === "same-cargo-type",
    ),
    preferSameDeliveryLocation: calls.some(
      (call) =>
        call.call === "stack" && call.prefer === "same-delivery-location",
    ),
    largerBelow: calls.some(
      (call) => call.call === "stack" && call.larger === "below",
    ),
    allowOnLargerWhenOrphan: calls.some(
      (call) =>
        call.call === "stack" &&
        call.allow === "on-larger-support" &&
        (call.whenAny?.includes("would-orphan-stack") ||
          call.whenAny?.includes("no-room-beside-same-type")),
    ),
    requireFullFootprint: calls.some(
      (call) =>
        call.call === "require" && call.support === "covers-footprint",
    ),
    forbidForeignSupport: calls.some(
      (call) => call.call === "stack" && call.forbidForeignSupport === true,
    ),
    requireRegionContiguity: calls.some(
      (call) => call.call === "stack" && call.requireContiguity === true,
    ),
    biasXyMode:
      (
        calls.find(
          (call): call is Extract<PackCall, { call: "bias-xy" }> =>
            call.call === "bias-xy",
        ) ?? null
      )?.mode ?? null,
  };
}

function metricValue(
  metrics: PackSlotCandidateMetrics,
  by: PackOrderBy,
): number | null {
  switch (by) {
    case "z":
      return metrics.origin.z;
    case "empty-cells-on-same-z":
      return metrics.emptyCellsOnSameZ;
    case "support-scu":
      return Number.isFinite(metrics.supportScuMin)
        ? metrics.supportScuMin
        : Number.POSITIVE_INFINITY;
    default:
      return null;
  }
}

/**
 * Tiered compare: walk pack calls by priority; first distinguishing call wins.
 * Returns <0 if a is better, >0 if b is better, 0 if tied through all calls.
 */
export function comparePackSlotCandidates(
  a: PackSlotCandidateMetrics,
  b: PackSlotCandidateMetrics,
  policy: PackSlotPolicy,
  boxScu: number,
): number {
  for (const call of policy.calls) {
    if (call.call === "require") {
      // Hard filter applied before compare — no opinion here.
      continue;
    }

    if (call.call === "order" && call.target === "candidate-slots") {
      const va = metricValue(a, call.by);
      const vb = metricValue(b, call.by);
      if (va == null || vb == null || va === vb) continue;
      return call.direction === "ascending" ? va - vb : vb - va;
    }

    if (call.call === "stack") {
      if (call.prefer === "same-cargo-type") {
        if (a.identicalSizeStack !== b.identicalSizeStack) {
          return a.identicalSizeStack ? -1 : 1;
        }
        const va = a.sameClusterTouch + a.sameClusterSupport * 2;
        const vb = b.sameClusterTouch + b.sameClusterSupport * 2;
        if (va !== vb) return vb - va;
        if (a.otherClusterSupport !== b.otherClusterSupport) {
          return a.otherClusterSupport - b.otherClusterSupport;
        }
      }
      if (call.over === "different-cargo-type") {
        // Prefer not sitting on a different cargo type (side contact OK).
        if (a.otherClusterSupport !== b.otherClusterSupport) {
          return a.otherClusterSupport - b.otherClusterSupport;
        }
      }
      if (call.prefer === "same-delivery-location") {
        const va = a.sameRegionTouch + a.regionSupport * 2;
        const vb = b.sameRegionTouch + b.regionSupport * 2;
        if (va !== vb) return vb - va;
      }
      if (call.over === "different-delivery-location") {
        // Soft gap: prefer fewer foreign side/support contacts.
        const aTouch = a.foreignSide + a.foreignSupport;
        const bTouch = b.foreignSide + b.foreignSupport;
        if (aTouch !== bTouch) return aTouch - bTouch;
      }
      if (
        call.prefer === "same-cargo-type" ||
        call.prefer === "same-delivery-location" ||
        call.over === "different-cargo-type" ||
        call.over === "different-delivery-location"
      ) {
        continue;
      }
      if (call.larger === "below") {
        // Prefer support >= box (stable); then higher support SCU.
        const aOk = a.origin.z === 0 || a.supportScuMin >= boxScu;
        const bOk = b.origin.z === 0 || b.supportScuMin >= boxScu;
        if (aOk !== bOk) return aOk ? -1 : 1;
        if (a.supportScuMin !== b.supportScuMin) {
          return b.supportScuMin - a.supportScuMin;
        }
        continue;
      }
      if (call.allow === "on-larger-support") {
        // Soft: only distinguishes when one candidate is orphan-avoiding on larger.
        const aSame = a.sameClusterTouch + a.sameClusterSupport;
        const bSame = b.sameClusterTouch + b.sameClusterSupport;
        if (aSame === 0 && bSame === 0) {
          const aLarger = a.supportScuMin >= boxScu;
          const bLarger = b.supportScuMin >= boxScu;
          if (aLarger !== bLarger) return aLarger ? -1 : 1;
        }
        continue;
      }
      if (call.forbidForeignSupport) {
        if (a.foreignSupport !== b.foreignSupport) {
          return a.foreignSupport - b.foreignSupport;
        }
        continue;
      }
    }

    if (call.call === "bias-xy") {
      // Early unload (handled via mission score elsewhere) — prefer edges vs center.
      if (call.mode === "edges-first") {
        if (a.edgeDistance !== b.edgeDistance) {
          return b.edgeDistance - a.edgeDistance;
        }
      } else if (a.edgeDistance !== b.edgeDistance) {
        return a.edgeDistance - b.edgeDistance;
      }
    }
  }

  // Prefer richer placement-rule score when pack calls tied.
  const sa = a.placementRuleScore ?? 0;
  const sb = b.placementRuleScore ?? 0;
  if (sa !== sb) return sb - sa;

  // Stable tie-break: lower z, then x, then y.
  if (a.origin.z !== b.origin.z) return a.origin.z - b.origin.z;
  if (a.origin.x !== b.origin.x) return a.origin.x - b.origin.x;
  return a.origin.y - b.origin.y;
}

export function countEmptyOnLayer(
  bounds: { xStart: number; xEnd: number; yStart: number; yEnd: number },
  z: number,
  occupied: ReadonlySet<string>,
  coordKey: (c: CargoGridCoord) => string,
): number {
  let empty = 0;
  for (let x = bounds.xStart; x < bounds.xEnd; x += 1) {
    for (let y = bounds.yStart; y < bounds.yEnd; y += 1) {
      if (!occupied.has(coordKey({ x, y, z }))) empty += 1;
    }
  }
  return empty;
}

export function supportScuMinUnder(
  origin: CargoGridCoord,
  footprint: CargoBoxFootprint,
  occupiedSizes: ReadonlyMap<string, number>,
  coordKey: (c: CargoGridCoord) => string,
): number {
  if (origin.z === 0) return Number.POSITIVE_INFINITY;
  let min = Number.POSITIVE_INFINITY;
  for (let dx = 0; dx < footprint.dx; dx += 1) {
    for (let dy = 0; dy < footprint.dy; dy += 1) {
      const size = occupiedSizes.get(
        coordKey({
          x: origin.x + dx,
          y: origin.y + dy,
          z: origin.z - 1,
        }),
      );
      if (size == null) return 0;
      min = Math.min(min, size);
    }
  }
  return min;
}
