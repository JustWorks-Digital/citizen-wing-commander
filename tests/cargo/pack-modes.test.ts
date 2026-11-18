import { describe, expect, it } from "vitest";
import { cargoBay } from "@/lib/ships/cargoBay";
import { getCargoGridSketchBySlug } from "@/lib/ships/cargoGrids";
import {
  TEST_SHIP_SLUGS,
  getTripStops,
  scuByCommodity,
  scuDemandByCommodity,
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

  it("pack modes keep the same cargo-type SCU demand (placed + unplaced)", () => {
    const stops = getTripStops("aboardCargo");
    const grid = sketch(shipSlug);

    for (const stop of stops) {
      if (stop.routeAction === "quantum") continue;
      const suggested = cargoBay.packAtStop(stop.id, grid, stops, {
        packMode: "suggested",
        includeAboardCargo: true,
      });
      const cargoType = cargoBay.packAtStop(stop.id, grid, stops, {
        packMode: "by-cargo-type",
        includeAboardCargo: true,
      });
      const contract = cargoBay.packAtStop(stop.id, grid, stops, {
        packMode: "by-mission-location",
        includeAboardCargo: true,
      });
      const expected = scuDemandByCommodity(suggested);
      expect(scuDemandByCommodity(cargoType), `${stop.id} cargo-type`).toEqual(
        expected,
      );
      expect(scuDemandByCommodity(contract), `${stop.id} contract`).toEqual(
        expected,
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

  it("does not let one cargo type monopolize an overfull bay", () => {
    const stops = getTripStops("aboardCargo");
    const grid = sketch(shipSlug);
    // Inflate stop-1 pickups so one commodity alone could fill the bay if
    // cargo-type packed largest-group-first without interleaving.
    const overloaded = stops.map((stop) => {
      if (stop.id !== "stop-1") return stop;
      return {
        ...stop,
        cargoDeliveries: stop.cargoDeliveries.map((cargo) =>
          cargo.commoditySlug === "processed-food"
            ? { ...cargo, scu: Math.max(cargo.scu, 900) }
            : cargo,
        ),
      };
    });
    const plan = cargoBay.packAtStop("stop-1", grid, overloaded, {
      packMode: "by-cargo-type",
      includeAboardCargo: true,
    });
    const by = scuByCommodity(plan);
    // Other pickup commodities must still get seats (not only processed-food).
    expect((by["pressurized-ice"] ?? 0) > 0).toBe(true);
    expect(Object.keys(by).length).toBeGreaterThan(1);
  });
});
