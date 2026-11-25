import { describe, expect, it } from "vitest";
import { cargoBay, ALL_CONTRACTS_PACK_STOP_ID } from "@/lib/ships/cargoBay";
import {
  stopsForAllContractPickups,
} from "@/lib/ships/cargoGridPlacement";
import { getCargoGridSketchBySlug } from "@/lib/ships/cargoGrids";
import {
  cargo,
  makeStop,
  scuDemandByCommodity,
  totalScu,
} from "./fixtures";

/**
 * Cargo bay All tab: pack every contract pickup on the trip (contracts total),
 * not peak-at-stop occupancy.
 */
describe("packAllContractPickups", () => {
  it("demand equals sum of every pickup across stops", () => {
    // Two pickups at different locations — All must include both (10 + 20 = 30).
    const stops = [
      makeStop({
        id: "stop-1",
        routeAction: "pickup",
        locationSlug: "area18",
        cargo: [cargo("pressurized-ice", 10)],
      }),
      makeStop({
        id: "stop-2",
        routeAction: "pickup_delivery",
        locationSlug: "orison",
        cargo: [
          cargo("pressurized-ice", 10, { role: "delivery" }),
          cargo("agricium", 20, { role: "pickup" }),
        ],
      }),
    ];
    const packStops = stopsForAllContractPickups(stops);
    expect(packStops).toHaveLength(1);
    expect(packStops[0]!.id).toBe(ALL_CONTRACTS_PACK_STOP_ID);
    expect(
      packStops[0]!.cargoDeliveries.reduce((sum, line) => sum + line.scu, 0),
    ).toBe(30);

    const sketch = getCargoGridSketchBySlug("c2-hercules-starlifter");
    expect(sketch).toBeTruthy();
    const plan = cargoBay.packAllContractPickups(sketch!, stops, {
      packMode: "suggested",
    });
    const demand = Object.values(scuDemandByCommodity(plan)).reduce(
      (sum, n) => sum + n,
      0,
    );
    expect(demand).toBe(30);
    expect(totalScu(plan)).toBe(30);
  });
});
