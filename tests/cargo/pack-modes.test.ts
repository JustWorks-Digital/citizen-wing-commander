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

  it("keeps transfer crates off stay-cargo cells when packing the full bay", () => {
    const stops = getTripStops("aboardCargo");
    const grid = sketch(shipSlug);
    const plan = cargoBay.packAtStop("stop-2", grid, stops, {
      packMode: "by-cargo-type",
      includeAboardCargo: true,
    });
    const transfer = plan.boxes.filter(
      (box) => box.action === "pickup" || box.action === "delivery",
    );
    const stay = plan.boxes.filter((box) => box.action == null);
    const stayKeys = new Set(
      stay.flatMap((box) =>
        box.cells.map((cell) => `${cell.x},${cell.y},${cell.z}`),
      ),
    );
    for (const box of transfer) {
      for (const cell of box.cells) {
        expect(
          stayKeys.has(`${cell.x},${cell.y},${cell.z}`),
          `${box.commoditySlug} ${box.size} overlaps stay at ${cell.x},${cell.y},${cell.z}`,
        ).toBe(false);
      }
    }
    expect(totalScu({ ...plan, boxes: transfer })).toBe(40);
  });

  it("tags only this stop’s transfers with pickup/delivery (stay cargo has no action)", () => {
    const stops = getTripStops("aboardCargo");
    const grid = sketch(shipSlug);
    const plans = [
      ["suggested", cargoBay.packSuggestedAtStop("stop-2", grid, stops, null)],
      ["cargo-type", cargoBay.packByCargoTypeAtStop("stop-2", grid, stops)],
      ["contract", cargoBay.packDeliveriesFromStop("stop-2", grid, stops)],
    ] as const;

    for (const [label, plan] of plans) {
      const transferBy = scuByCommodity({
        zone: plan.zone,
        boxes: plan.boxes.filter(
          (box) => box.action === "pickup" || box.action === "delivery",
        ),
        unplaced: [],
      });
      const stayBy = scuByCommodity({
        zone: plan.zone,
        boxes: plan.boxes.filter((box) => box.action == null),
        unplaced: [],
      });

      // Only the local pickup is a transfer at stop-2
      expect(transferBy, label).toEqual({ agricium: 40 });
      expect(stayBy, label).toEqual({
        "pressurized-ice": 8,
        "processed-food": 9,
      });
    }
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
