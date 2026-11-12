import { describe, expect, it } from "vitest";
import { cargoInventory } from "@/lib/missions/cargoInventory";
import { getCargoGridSketchBySlug } from "@/lib/ships/cargoGrids";
import { cargoBay } from "@/lib/ships/cargoBay";
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

describe("peak stop on a trip", () => {
  it("cargoInventory.peakStopId picks the stop with max peak SCU", () => {
    const stops = getTripStops("aboardCargo");
    // aboardCargo: stop-1 loads 17, stop-2 picks up 40 → peak after that pickup
    expect(cargoInventory.peakStopId(stops)).toBe("stop-2");
  });

  describe.each(TEST_SHIP_SLUGS)("pack modes at peak (%s)", (shipSlug) => {
    it("all pack modes match Suggested SCU at the peak stop", () => {
      const stops = getTripStops("aboardCargo");
      const peakId = cargoInventory.peakStopId(stops);
      expect(peakId).toBe("stop-2");
      const grid = sketch(shipSlug);

      const suggested = cargoBay.packAtStop(peakId!, grid, stops, {
        packMode: "suggested",
      });
      const cargoType = cargoBay.packAtStop(peakId!, grid, stops, {
        packMode: "by-cargo-type",
      });
      const contract = cargoBay.packAtStop(peakId!, grid, stops, {
        packMode: "by-mission-location",
      });

      expect(totalScu(cargoType)).toBe(totalScu(suggested));
      expect(totalScu(contract)).toBe(totalScu(suggested));
      // Peak pack includes aboard cargo + the current stop’s pickup
      expect(totalScu(suggested)).toBeGreaterThan(40);
    });
  });
});
