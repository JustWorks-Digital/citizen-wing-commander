import { describe, expect, it } from "vitest";
import { cargoBay } from "@/lib/ships/cargoBay";
import {
  cargoGridOverflowScu,
  cargoGridTotalScu,
  getCargoGridSketchBySlug,
} from "@/lib/ships/cargoGrids";
import {
  placementPlanLocationLegend,
  upcomingDeliveryLocationSlugs,
} from "@/lib/ships/cargoGridPlacement";
import {
  cargo,
  makeStop,
  scuDemandByCommodity,
  totalScu,
} from "./fixtures";

const PACK_MODES = [
  "suggested",
  "by-cargo-type",
  "by-mission-location",
] as const;

/** Bay UI hides crates when a location legend exists and slug is missing. */
function visibleBayBoxCount(
  plan: ReturnType<typeof cargoBay.packAtStop>,
  locationOrder: string[],
): number {
  const locationLegend = placementPlanLocationLegend(plan, { locationOrder });
  return plan.boxes.filter((box) => {
    if (locationLegend.length === 0) return true;
    if (box.deliveryLocationSlug == null) return false;
    return true;
  }).length;
}

describe("Galaxy hangar overflow (unstable SCU)", () => {
  it("keeps official capacity at 720 and exposes overflow reserve", () => {
    const grid = getCargoGridSketchBySlug("galaxy")!;
    expect(cargoGridTotalScu(grid)).toBe(720);
    expect(cargoGridOverflowScu(grid)).toBe(432);
  });

  it("packs senior 727 peak as 720 stable + 7 overflow (all pack modes)", () => {
    const grid = getCargoGridSketchBySlug("galaxy")!;
    // Prod session 6ff09a56… — Contracts total 727 vs Galaxy 720.
    const stops = [
      makeStop({
        id: "leg-1",
        routeAction: "pickup",
        locationSlug: "everus-harbor",
        shipStorageLocation: "middle",
        cargo: [
          cargo("quantum-fuel", 50, { shipStorageLocation: "middle" }),
          cargo("hydrogen-fuel", 190, { shipStorageLocation: "middle" }),
          cargo("ship-ammunition", 128, { shipStorageLocation: "middle" }),
          cargo("pressurized-ice", 13, { shipStorageLocation: "middle" }),
          cargo("processed-food", 346, { shipStorageLocation: "middle" }),
        ],
      }),
      makeStop({
        id: "leg-2",
        routeAction: "delivery",
        locationSlug: "sakura-sun-magnolia-workcenter",
        shipStorageLocation: "middle",
        cargo: [
          cargo("quantum-fuel", 50, {
            role: "delivery",
            shipStorageLocation: "middle",
          }),
          cargo("hydrogen-fuel", 190, {
            role: "delivery",
            shipStorageLocation: "middle",
          }),
          cargo("ship-ammunition", 128, {
            role: "delivery",
            shipStorageLocation: "middle",
          }),
          cargo("pressurized-ice", 13, {
            role: "delivery",
            shipStorageLocation: "middle",
          }),
          cargo("processed-food", 346, {
            role: "delivery",
            shipStorageLocation: "middle",
          }),
        ],
      }),
    ];
    const demandTotal = 727;

    for (const packMode of PACK_MODES) {
      const plan = cargoBay.packAtStop("leg-1", grid, stops, {
        packMode,
        includeAboardCargo: true,
      });
      const demand = Object.values(scuDemandByCommodity(plan)).reduce(
        (sum, n) => sum + n,
        0,
      );
      const overflowScu = plan.boxes
        .filter((box) => box.isOverflow)
        .reduce((sum, box) => sum + box.size, 0);
      const stableScu = plan.boxes
        .filter((box) => !box.isOverflow)
        .reduce((sum, box) => sum + box.size, 0);

      expect(demand, `${packMode} demand`).toBe(demandTotal);
      expect(totalScu(plan), `${packMode} placed`).toBe(demandTotal);
      expect(stableScu, `${packMode} stable`).toBe(720);
      expect(overflowScu, `${packMode} overflow`).toBe(7);
      expect(plan.unplaced, `${packMode} unplaced`).toEqual([]);
      expect(
        plan.boxes.some((box) => box.isOverflow && box.origin.x >= 25),
        `${packMode} overflow toward rear hangar`,
      ).toBe(true);

      // Regression: overflow carve re-pack must keep delivery tags so the bay
      // UI does not hide every crate when a location legend is present.
      const withSlug = plan.boxes.filter((box) => box.deliveryLocationSlug);
      expect(withSlug.length, `${packMode} delivery tags`).toBe(
        plan.boxes.length,
      );
      const locationOrder = upcomingDeliveryLocationSlugs(stops, "leg-1");
      expect(
        visibleBayBoxCount(plan, locationOrder),
        `${packMode} visible in bay`,
      ).toBe(plan.boxes.length);
    }
  });
});
