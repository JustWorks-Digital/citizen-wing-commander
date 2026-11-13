import { getLocationBySlug } from "@/lib/fixtures";
import type {
  DistanceToNext,
  HaulingChecklistRow,
  RouteAction,
} from "@/lib/missions/mockSession";
import { isQuantumTravelRow } from "@/lib/missions/mockSession";
import { quantumStopDistance } from "@/lib/missions/quantumTravel";
import {
  distanceBetweenLocationSlugs,
  sumDistanceToNext,
} from "@/lib/starmap/distance";

export type RouteTimelineNodeKind = "start" | "stop";

export type RouteTimelineNode = {
  id: string;
  kind: RouteTimelineNodeKind;
  locationSlug: string;
  locationName: string;
  routeAction: RouteAction | null;
  /** 1-based stop number; null for start. */
  stopNumber: number | null;
  isCompleted: boolean;
  /** First incomplete stop on the route. */
  isNext: boolean;
  /** Distance from this node to the next node (null on final cargo; quantum keeps hop). */
  distanceToNext: DistanceToNext | null;
};

export type RouteStopTimeline = {
  nodes: RouteTimelineNode[];
  /** Distance along completed → next legs (from completed nodes). */
  traveled: DistanceToNext | null;
  /** Distance still ahead (from incomplete nodes that have a next). */
  remaining: DistanceToNext | null;
  /** Full route distance (all legs with a known length). */
  total: DistanceToNext | null;
  completedStopCount: number;
  totalStopCount: number;
};

function locationName(slug: string): string {
  return getLocationBySlug(slug)?.name ?? slug;
}

function resolveLegDistance(
  fromSlug: string,
  toSlug: string,
  fallback: DistanceToNext | null | undefined,
): DistanceToNext | null {
  return distanceBetweenLocationSlugs(fromSlug, toSlug) ?? fallback ?? null;
}

function sameSlug(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Build a vertical route timeline for the session stops modal.
 * Start is included only when it differs from the first stop (avoids duplicates).
 */
export function buildRouteStopTimeline(input: {
  rows: HaulingChecklistRow[];
  startLocationSlug?: string | null;
  /**
   * Synthetic start → first-stop quantum origin marked done (UI-only until a
   * cargo stop is completed). Counts start distance as traveled.
   */
  isStartCompleted?: boolean;
}): RouteStopTimeline {
  const rows = input.rows;
  const startSlug = input.startLocationSlug?.trim() || null;
  const firstSlug = rows[0]?.locationSlug ?? null;
  const includeStart = Boolean(
    startSlug && (!firstSlug || !sameSlug(startSlug, firstSlug)),
  );
  const lastCompletedIndex = (() => {
    let last = -1;
    for (let i = 0; i < rows.length; i += 1) {
      if (rows[i]?.isCompleted) last = i;
    }
    return last;
  })();
  const anyStopCompleted = lastCompletedIndex >= 0;
  const startLegCompleted = Boolean(
    input.isStartCompleted || anyStopCompleted,
  );
  const nextIncompleteIndex = rows.findIndex((row) => !row.isCompleted);

  const nodes: RouteTimelineNode[] = [];

  if (includeStart && startSlug) {
    const first = rows[0];
    nodes.push({
      id: "route-start",
      kind: "start",
      locationSlug: startSlug,
      locationName: locationName(startSlug),
      routeAction: null,
      stopNumber: null,
      isCompleted: startLegCompleted,
      isNext: !startLegCompleted && nextIncompleteIndex === 0,
      distanceToNext: first
        ? resolveLegDistance(startSlug, first.locationSlug, null)
        : null,
    });
  }

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]!;
    const next = rows[i + 1];
    nodes.push({
      id: row.id,
      kind: "stop",
      locationSlug: row.locationSlug,
      locationName: locationName(row.locationSlug),
      routeAction: row.routeAction,
      stopNumber: i + 1,
      isCompleted: row.isCompleted,
      isNext: i === nextIncompleteIndex,
      distanceToNext: isQuantumTravelRow(row)
        ? quantumStopDistance(row, next)
        : next
          ? resolveLegDistance(
              row.locationSlug,
              next.locationSlug,
              row.distanceToNext,
            )
          : null,
    });
  }

  const traveledParts: Array<DistanceToNext | null> = [];
  const remainingParts: Array<DistanceToNext | null> = [];
  const totalParts: Array<DistanceToNext | null> = [];

  for (const node of nodes) {
    if (!node.distanceToNext) continue;
    totalParts.push(node.distanceToNext);
    if (node.kind === "start") {
      if (startLegCompleted) traveledParts.push(node.distanceToNext);
      else remainingParts.push(node.distanceToNext);
      continue;
    }
    const stopIndex = rows.findIndex((row) => row.id === node.id);
    if (stopIndex < 0) continue;
    if (rows[stopIndex]?.isCompleted) {
      traveledParts.push(node.distanceToNext);
    } else {
      remainingParts.push(node.distanceToNext);
    }
  }

  return {
    nodes,
    traveled: sumDistanceToNext(traveledParts),
    remaining: sumDistanceToNext(remainingParts),
    total: sumDistanceToNext(totalParts),
    completedStopCount: rows.filter((row) => row.isCompleted).length,
    totalStopCount: rows.length,
  };
}
