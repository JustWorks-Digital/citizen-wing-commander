import { describe, expect, it } from "vitest";
import { cargoBay } from "@/lib/ships/cargoBay";
import {
  cargoGridTotalScu,
  getCargoGridSketchBySlug,
} from "@/lib/ships/cargoGrids";
import {
  cargo,
  makeStop,
  scuDemandByCommodity,
  totalScu,
} from "./fixtures";

const SHIPS_WITH_GRIDS = [
  "galaxy",
  "c2-hercules-starlifter",
  "constellation-mk-v-centaurus",
] as const;

/** Pack modes that feed All-tab + Manual base plans. */
const PACK_MODES = [
  "suggested",
  "by-cargo-type",
  "by-mission-location",
] as const;

function sketch(shipSlug: (typeof SHIPS_WITH_GRIDS)[number]) {
  const value = getCargoGridSketchBySlug(shipSlug);
  if (!value) throw new Error(`Missing cargo-grid fixture for ${shipSlug}`);
  return value;
}

function demandScu(plan: ReturnType<typeof cargoBay.packAtStop>): number {
  return Object.values(scuDemandByCommodity(plan)).reduce(
    (sum, n) => sum + n,
    0,
  );
}

/**
 * Regression: ships without a `middle` cargo zone used to collapse middle-tagged
 * cargo into a single fallback AABB (Galaxy → Lift L only = 256/720). Contract-
 * based packing also refused to seed a second island of the same delivery region
 * in a disconnected bay. All-tab / manual base plans must pack across every
 * cargo bay up to capacity.
 */
describe("All-tab bay SCU demand (middle-tagged cargo)", () => {
  describe.each(SHIPS_WITH_GRIDS)("%s", (shipSlug) => {
    it("uses full multi-bay capacity for middle-tagged pickup (all pack modes)", () => {
      const grid = sketch(shipSlug);
      const capacity = cargoGridTotalScu(grid);
      const stops = [
        makeStop({
          id: "stop-1",
          routeAction: "pickup",
          locationSlug: "everus-harbor",
          shipStorageLocation: "middle",
          cargo: [
            cargo("processed-food", capacity, {
              shipStorageLocation: "middle",
            }),
          ],
        }),
        makeStop({
          id: "stop-2",
          routeAction: "delivery",
          locationSlug: "hdpc-cassillo",
          shipStorageLocation: "middle",
          cargo: [
            cargo("processed-food", capacity, {
              role: "delivery",
              shipStorageLocation: "middle",
            }),
          ],
        }),
      ];

      for (const packMode of PACK_MODES) {
        const plan = cargoBay.packAtStop("stop-1", grid, stops, {
          packMode,
          includeAboardCargo: true,
        });
        expect(demandScu(plan), `${packMode} demand`).toBe(capacity);
        // Must not collapse to a single small bay (Galaxy Lift = 144, Lift L = 256).
        expect(totalScu(plan), `${packMode} placed`).toBeGreaterThan(
          Math.floor(capacity * 0.35),
        );
        // Prefer filling the sketch: allow minor geometry waste on awkward grids.
        expect(totalScu(plan), `${packMode} near capacity`).toBeGreaterThanOrEqual(
          Math.floor(capacity * 0.9),
        );
      }
    });

    it("reports full pickup demand when over capacity (placed + unplaced/overflow)", () => {
      const grid = sketch(shipSlug);
      const capacity = cargoGridTotalScu(grid);
      const over = capacity + 32;
      const stops = [
        makeStop({
          id: "stop-1",
          routeAction: "pickup",
          locationSlug: "everus-harbor",
          shipStorageLocation: "middle",
          cargo: [
            cargo("hydrogen-fuel", over, { shipStorageLocation: "middle" }),
          ],
        }),
      ];
      const plan = cargoBay.packAtStop("stop-1", grid, stops, {
        packMode: "suggested",
        includeAboardCargo: true,
      });
      expect(demandScu(plan)).toBe(over);
      expect(totalScu(plan)).toBeGreaterThanOrEqual(Math.floor(capacity * 0.9));
      const overflowScu = plan.boxes
        .filter((box) => box.isOverflow)
        .reduce((sum, box) => sum + box.size, 0);
      const stillUnplaced = plan.unplaced.reduce(
        (sum, entry) => sum + entry.size,
        0,
      );
      // Excess must land in overflow (when the ship has it) and/or unplaced.
      expect(overflowScu + stillUnplaced).toBeGreaterThan(0);
      expect(overflowScu + stillUnplaced).toBeGreaterThanOrEqual(32);
    });
  });

  it("Galaxy senior multi-commodity middle pickup packs ~full 720 bay (all modes)", () => {
    const grid = sketch("galaxy");
    expect(cargoGridTotalScu(grid)).toBe(720);
    // Prod session 6ff09a56… — All tab must not stop at Lift-only (~144/256).
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
    ];
    const demandTotal = 727;

    for (const packMode of PACK_MODES) {
      const plan = cargoBay.packAtStop("leg-1", grid, stops, {
        packMode,
        includeAboardCargo: true,
      });
      expect(demandScu(plan), `${packMode} demand`).toBe(demandTotal);
      expect(totalScu(plan), `${packMode} placed`).toBe(demandTotal);
      const overflowScu = plan.boxes
        .filter((box) => box.isOverflow)
        .reduce((sum, box) => sum + box.size, 0);
      // Cargo-type may send more than 7 to overflow rather than bury types.
      if (packMode === "by-cargo-type") {
        expect(overflowScu, `${packMode} overflow`).toBeGreaterThanOrEqual(7);
        expect(plan.cargoTypeClusters?.ok, `${packMode} clusters`).toBe(true);
      } else {
        expect(overflowScu, `${packMode} overflow`).toBe(7);
      }
    }
  });

  it("Galaxy middle fill places exact sketch capacity with uniform crates", () => {
    const grid = sketch("galaxy");
    const capacity = cargoGridTotalScu(grid);
    const stops = [
      makeStop({
        id: "stop-1",
        routeAction: "pickup",
        locationSlug: "everus-harbor",
        shipStorageLocation: "middle",
        cargo: [
          cargo("processed-food", capacity, { shipStorageLocation: "middle" }),
        ],
      }),
    ];
    for (const packMode of PACK_MODES) {
      const plan = cargoBay.packAtStop("stop-1", grid, stops, {
        packMode,
        includeAboardCargo: true,
      });
      expect(totalScu(plan), `${packMode} placed`).toBe(720);
      expect(plan.unplaced, `${packMode} unplaced`).toEqual([]);
    }
  });
});
