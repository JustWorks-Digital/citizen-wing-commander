import { describe, expect, it } from "vitest";
import { cargoBay } from "@/lib/ships/cargoBay";
import { getCargoGridSketchBySlug } from "@/lib/ships/cargoGrids";
import { cargoInventory } from "@/lib/missions/cargoInventory";
import { cargo, makeStop } from "./fixtures";

/**
 * Session 850b218f-d900-4ede-abd1-743669607d06 — Everus Harbor Galaxy.
 * Trip complete (Aboard 0/720 on strip) but cargo bay All still showed 618 SCU.
 * Packing plan stays; display must deplete after completed deliveries.
 */
function everusGalaxyCompletedStops() {
  return [
    makeStop({
      id: "leg-1",
      routeAction: "pickup",
      locationSlug: "everus-harbor",
      shipStorageLocation: "middle",
      isCompleted: true,
      cargo: [
        cargo("pressurized-ice", 19, { shipStorageLocation: "middle" }),
        cargo("processed-food", 288, { shipStorageLocation: "middle" }),
        cargo("quantum-fuel", 60, { shipStorageLocation: "middle" }),
        cargo("hydrogen-fuel", 164, { shipStorageLocation: "middle" }),
        cargo("ship-ammunition", 87, { shipStorageLocation: "middle" }),
      ],
    }),
    makeStop({
      id: "leg-3",
      routeAction: "delivery",
      locationSlug: "hdpc-cassillo",
      shipStorageLocation: "middle",
      isCompleted: true,
      cargo: [
        cargo("pressurized-ice", 9, { shipStorageLocation: "middle" }),
        cargo("hydrogen-fuel", 94, { shipStorageLocation: "middle" }),
      ],
    }),
    makeStop({
      id: "leg-4",
      routeAction: "delivery",
      locationSlug: "sakura-sun-magnolia-workcenter",
      shipStorageLocation: "middle",
      isCompleted: true,
      cargo: [
        cargo("quantum-fuel", 60, { shipStorageLocation: "middle" }),
        cargo("hydrogen-fuel", 70, { shipStorageLocation: "middle" }),
      ],
    }),
    makeStop({
      id: "leg-2",
      routeAction: "delivery",
      locationSlug: "hdpc-farnesway",
      shipStorageLocation: "middle",
      isCompleted: true,
      cargo: [
        cargo("pressurized-ice", 10, { shipStorageLocation: "middle" }),
        cargo("processed-food", 123, { shipStorageLocation: "middle" }),
        cargo("ship-ammunition", 87, { shipStorageLocation: "middle" }),
      ],
    }),
    makeStop({
      id: "leg-5",
      routeAction: "delivery",
      locationSlug: "lorville",
      shipStorageLocation: "front",
      isCompleted: true,
      cargo: [cargo("processed-food", 165, { shipStorageLocation: "front" })],
    }),
  ];
}

describe("filterBoxesRemainingAboard", () => {
  it("clears the All packing plan after every delivery is Done", () => {
    const stops = everusGalaxyCompletedStops();
    expect(cargoInventory.fromCompleted(stops)).toBe(0);

    const sketch = getCargoGridSketchBySlug("galaxy");
    expect(sketch).toBeTruthy();
    const allPlan = cargoBay.packAllContractPickups(sketch!, stops, {
      packMode: "suggested",
    });
    expect(allPlan.boxes.reduce((sum, box) => sum + box.size, 0)).toBe(618);

    const remaining = cargoBay.filterBoxesRemainingAboard(allPlan.boxes, stops);
    expect(remaining).toEqual([]);
  });

  it("keeps crates aboard after pickup Done before any delivery", () => {
    const stops = everusGalaxyCompletedStops().map((stop, index) => ({
      ...stop,
      isCompleted: index === 0,
    }));
    expect(cargoInventory.fromCompleted(stops)).toBe(618);

    const sketch = getCargoGridSketchBySlug("galaxy");
    const allPlan = cargoBay.packAllContractPickups(sketch!, stops, {
      packMode: "suggested",
    });
    const remaining = cargoBay.filterBoxesRemainingAboard(allPlan.boxes, stops);
    expect(remaining.reduce((sum, box) => sum + box.size, 0)).toBe(618);

    const allById = new Map(allPlan.boxes.map((box) => [box.id, box]));
    for (const box of remaining) {
      expect(box.origin).toEqual(allById.get(box.id)!.origin);
    }
  });
});

describe("filterBoxesAboardAtStop respectCompletion", () => {
  it("shows an empty bay on the last completed delivery stop", () => {
    const stops = everusGalaxyCompletedStops();
    const sketch = getCargoGridSketchBySlug("galaxy");
    const allPlan = cargoBay.packAllContractPickups(sketch!, stops, {
      packMode: "suggested",
    });

    const atLorville = cargoBay.filterBoxesAboardAtStop(
      "leg-5",
      allPlan.boxes,
      stops,
      { includeAboardCargo: true, respectCompletion: true },
    );
    expect(atLorville).toEqual([]);
  });

  it("still shows unload crates while the delivery stop is incomplete", () => {
    const stops = everusGalaxyCompletedStops().map((stop) =>
      stop.id === "leg-5" ? { ...stop, isCompleted: false } : stop,
    );
    const sketch = getCargoGridSketchBySlug("galaxy");
    const allPlan = cargoBay.packAllContractPickups(sketch!, stops, {
      packMode: "suggested",
    });

    const atLorville = cargoBay.filterBoxesAboardAtStop(
      "leg-5",
      allPlan.boxes,
      stops,
      { includeAboardCargo: true, respectCompletion: true },
    );
    // Soft demand is 165 PF; suggested packing uses whole crates so claim
    // stops at 160 (20×8) — leftover 5 SCU has no matching box.
    expect(atLorville.reduce((sum, box) => sum + box.size, 0)).toBe(160);
    expect(
      atLorville.every((box) => box.commoditySlug === "processed-food"),
    ).toBe(true);
  });
});
