import { describe, expect, it } from "vitest";
import { cargoBay } from "@/lib/ships/cargoBay";
import { getCargoGridSketchBySlug } from "@/lib/ships/cargoGrids";
import {
  TEST_SHIP_SLUGS,
  getTripStops,
  totalScu,
  type TestShipSlug,
} from "./fixtures";

function sketch(shipSlug: TestShipSlug) {
  const value = getCargoGridSketchBySlug(shipSlug);
  if (!value) throw new Error(`Missing cargo-grid fixture for ${shipSlug}`);
  return value;
}

describe.each(TEST_SHIP_SLUGS)("cargoBay.packAtStop (%s)", (shipSlug) => {
  it("returns empty boxes for an unknown stop id", () => {
    const stops = getTripStops("aboardCargo");
    const grid = sketch(shipSlug);
    const plan = cargoBay.packAtStop("missing-stop", grid, stops, {
      packMode: "suggested",
    });
    expect(plan.boxes).toEqual([]);
    expect(totalScu(plan)).toBe(0);
  });

  it("dispatches each packMode to a nonempty plan at stop 1", () => {
    const stops = getTripStops("aboardCargo");
    const grid = sketch(shipSlug);

    for (const packMode of [
      "suggested",
      "by-cargo-type",
      "by-mission-location",
    ] as const) {
      const plan = cargoBay.packAtStop("stop-1", grid, stops, {
        packMode,
      });
      expect(totalScu(plan), packMode).toBe(17);
    }
  });

  it("keeps aboard cargo when Cargo type is mission prioritized", () => {
    const stops = getTripStops("aboardCargo");
    const grid = sketch(shipSlug);
    const plain = cargoBay.packAtStop("stop-2", grid, stops, {
      packMode: "by-cargo-type",
      missionPrioritized: false,
    });
    const prioritized = cargoBay.packAtStop("stop-2", grid, stops, {
      packMode: "by-cargo-type",
      missionPrioritized: true,
    });
    expect(totalScu(prioritized)).toBe(totalScu(plain));
  });
});
