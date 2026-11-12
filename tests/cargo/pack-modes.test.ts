import { describe, expect, it } from "vitest";
import { cargoBay } from "@/lib/ships/cargoBay";
import { getCargoGridSketchBySlug } from "@/lib/ships/cargoGrids";
import {
  TEST_SHIP_SLUGS,
  getTripStops,
  scuByCommodity,
  totalScu,
  type TestShipSlug,
} from "./fixtures";

function sketch(shipSlug: TestShipSlug) {
  const value = getCargoGridSketchBySlug(shipSlug);
  if (!value) throw new Error(`Missing cargo-grid fixture for ${shipSlug}`);
  return value;
}

describe.each(TEST_SHIP_SLUGS)("pack modes at a stop (%s)", (shipSlug) => {
  it("Suggested / Cargo type / Contract match total SCU at each cargo stop", () => {
    const stops = getTripStops("aboardCargo");
    const grid = sketch(shipSlug);

    for (const stop of stops) {
      if (stop.routeAction === "quantum") continue;
      const suggested = cargoBay.packSuggestedAtStop(
        stop.id,
        grid,
        stops,
        null,
      );
      const cargoType = cargoBay.packByCargoTypeAtStop(stop.id, grid, stops);
      const contract = cargoBay.packDeliveriesFromStop(stop.id, grid, stops);
      expect(totalScu(cargoType), `${stop.id} cargo-type`).toBe(
        totalScu(suggested),
      );
      expect(totalScu(contract), `${stop.id} contract`).toBe(
        totalScu(suggested),
      );
    }
  });

  it("includes aboard cargo at a pickup/transfer stop (not only the current stop’s cargo)", () => {
    const stops = getTripStops("aboardCargo");
    const grid = sketch(shipSlug);
    const plan = cargoBay.packByCargoTypeAtStop("stop-2", grid, stops);
    const by = scuByCommodity(plan);

    // Local pickup
    expect(by["agricium"]).toBe(40);
    // Still aboard from stop-1
    expect(by["pressurized-ice"]).toBe(8);
    expect(by["processed-food"]).toBe(9);
    // Delivery listed here but never loaded earlier — must not appear
    expect(by["scrap"]).toBeUndefined();
  });

  it("does not pack future deliveries that are not yet aboard (early stop)", () => {
    const stops = getTripStops("aboardCargo");
    const grid = sketch(shipSlug);
    const plan = cargoBay.packDeliveriesFromStop("stop-1", grid, stops);
    const by = scuByCommodity(plan);

    expect(totalScu(plan)).toBe(17);
    expect(by["pressurized-ice"]).toBe(8);
    expect(by["processed-food"]).toBe(9);
    expect(by["agricium"]).toBeUndefined();
    expect(by["scrap"]).toBeUndefined();
  });

  it("shows delivery cargo that was actually loaded earlier", () => {
    const stops = getTripStops("pickupThenDeliver");
    const grid = sketch(shipSlug);
    const plan = cargoBay.packByCargoTypeAtStop("stop-2", grid, stops);
    expect(scuByCommodity(plan)).toEqual({ "pressurized-ice": 16 });
  });
});
