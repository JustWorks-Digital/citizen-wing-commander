import { describe, expect, it } from "vitest";
import type { HaulingChecklistRow } from "@/lib/missions/mockSession";
import {
  createQuantumTravelRow,
  quantumHopDistance,
  recomputeDistances,
} from "@/lib/missions/quantumTravel";
import { buildRouteStopTimeline } from "@/lib/missions/routeStopTimeline";
import { distanceBetweenLocationSlugs } from "@/lib/starmap/distance";

function cargoStop(
  id: string,
  locationSlug: string,
): HaulingChecklistRow {
  return {
    id,
    routeAction: "pickup",
    locationSlug,
    cargoDeliveries: [],
    shipStorageLocation: "front",
    distanceToNext: null,
    isCompleted: false,
  };
}

describe("quantum travel distance", () => {
  it("keeps the hop on quantum rows after recomputeDistances", () => {
    const from = "everus-harbor";
    const to = "lorville";
    const hop = distanceBetweenLocationSlugs(from, to);
    expect(hop).not.toBeNull();

    const quantum = createQuantumTravelRow({ fromSlug: from, toSlug: to });
    const rows = recomputeDistances([
      cargoStop("leg-1", from),
      quantum,
      cargoStop("leg-2", to),
    ]);

    const qt = rows.find((row) => row.id === quantum.id)!;
    expect(qt.distanceToNext).toEqual(hop);
    expect(quantumHopDistance(qt)).toEqual(hop);
  });

  it("includes quantum hop in the route timeline total", () => {
    const from = "everus-harbor";
    const to = "lorville";
    const hop = distanceBetweenLocationSlugs(from, to);
    expect(hop).not.toBeNull();

    const rows = recomputeDistances([
      createQuantumTravelRow({ fromSlug: from, toSlug: to }),
      cargoStop("leg-1", to),
    ]);
    const timeline = buildRouteStopTimeline({ rows, startLocationSlug: from });
    const quantumNode = timeline.nodes.find((node) =>
      node.id.startsWith("quantum-"),
    );
    expect(quantumNode?.distanceToNext).toEqual(hop);
    expect(timeline.total).not.toBeNull();
  });

  it("uses live hop even when stored distanceToNext is a stale zero", () => {
    const from = "everus-harbor";
    const to = "lorville";
    const hop = distanceBetweenLocationSlugs(from, to);
    expect(hop).not.toBeNull();

    const quantum = createQuantumTravelRow({ fromSlug: from, toSlug: to });
    quantum.distanceToNext = { value: 0, unit: "km" };
    const rows = [quantum, cargoStop("leg-1", to)];
    const timeline = buildRouteStopTimeline({
      rows,
      startLocationSlug: from,
    });
    const quantumNode = timeline.nodes.find((node) => node.id === quantum.id);
    expect(quantumNode?.distanceToNext).toEqual(hop);
    expect(timeline.total).toEqual(hop);
  });

  it("counts a completed quantum hop as traveled", () => {
    const from = "everus-harbor";
    const to = "lorville";
    const hop = distanceBetweenLocationSlugs(from, to);
    expect(hop).not.toBeNull();

    const quantum = {
      ...createQuantumTravelRow({ fromSlug: from, toSlug: to }),
      isCompleted: true,
      distanceToNext: { value: 0, unit: "km" as const },
    };
    const timeline = buildRouteStopTimeline({
      rows: [quantum, cargoStop("leg-1", to)],
      startLocationSlug: from,
    });
    expect(timeline.traveled).toEqual(hop);
  });

  it("counts start→first as traveled when isStartCompleted", () => {
    const from = "everus-harbor";
    const to = "lorville";
    const hop = distanceBetweenLocationSlugs(from, to);
    expect(hop).not.toBeNull();

    const before = buildRouteStopTimeline({
      rows: [cargoStop("leg-1", to)],
      startLocationSlug: from,
      isStartCompleted: false,
    });
    expect(before.traveled).toBeNull();
    expect(before.total).toEqual(hop);

    const after = buildRouteStopTimeline({
      rows: [cargoStop("leg-1", to)],
      startLocationSlug: from,
      isStartCompleted: true,
    });
    expect(after.traveled).toEqual(hop);
    expect(after.total).toEqual(hop);
  });
});
