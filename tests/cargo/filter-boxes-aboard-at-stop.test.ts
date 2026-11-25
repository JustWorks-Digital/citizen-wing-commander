import { describe, expect, it } from "vitest";
import { cargoBay } from "@/lib/ships/cargoBay";
import { getCargoGridSketchBySlug } from "@/lib/ships/cargoGrids";
import { getTripStops, totalScu } from "./fixtures";

/**
 * Location tab filters All’s filled grid — same cells, not a re-pack.
 * Fixture: aboardCargo (pickup ice+food, then pickup/transfer + agricium).
 */
describe("filterBoxesAboardAtStop", () => {
  it("keeps All origins for cargo aboard at the first pickup stop", () => {
    const stops = getTripStops("aboardCargo");
    const sketch = getCargoGridSketchBySlug("c2-hercules-starlifter");
    expect(sketch).toBeTruthy();

    const allPlan = cargoBay.packAllContractPickups(sketch!, stops, {
      packMode: "suggested",
    });
    // All = every pickup: ice 8 + food 9 + agricium 40.
    expect(totalScu(allPlan)).toBe(57);

    const atStop1 = cargoBay.filterBoxesAboardAtStop(
      "stop-1",
      allPlan.boxes,
      stops,
    );
    // stop-1 aboard = ice 8 + food 9 (agricium not picked up yet).
    expect(atStop1.reduce((sum, box) => sum + box.size, 0)).toBe(17);

    const allById = new Map(allPlan.boxes.map((box) => [box.id, box]));
    for (const box of atStop1) {
      const fromAll = allById.get(box.id);
      expect(fromAll).toBeTruthy();
      expect(box.origin).toEqual(fromAll!.origin);
      expect(box.cells).toEqual(fromAll!.cells);
    }
  });

  it("includes stay cargo plus this stop’s pickup at a later stop", () => {
    const stops = getTripStops("aboardCargo");
    const sketch = getCargoGridSketchBySlug("c2-hercules-starlifter");
    expect(sketch).toBeTruthy();

    const allPlan = cargoBay.packAllContractPickups(sketch!, stops, {
      packMode: "suggested",
    });
    const atStop2 = cargoBay.filterBoxesAboardAtStop(
      "stop-2",
      allPlan.boxes,
      stops,
    );
    // scrap delivery never loaded → ignored; stay ice+food + agricium pickup.
    expect(atStop2.reduce((sum, box) => sum + box.size, 0)).toBe(57);

    const allOrigins = new Map(
      allPlan.boxes.map((box) => [box.id, box.origin] as const),
    );
    for (const box of atStop2) {
      expect(box.origin).toEqual(allOrigins.get(box.id));
    }
  });
});
