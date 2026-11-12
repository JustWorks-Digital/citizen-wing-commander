import type {
  CargoDelivery,
  HaulingChecklistRow,
  RouteAction,
  ShipStorageLocation,
} from "@/lib/missions/mockSession";
import type { CargoGridPlacementPlan } from "@/lib/ships/cargoGridPlacement";

export type MakeStopInput = {
  id: string;
  routeAction: RouteAction;
  locationSlug: string;
  cargo?: CargoDelivery[];
  shipStorageLocation?: ShipStorageLocation;
  isCompleted?: boolean;
};

/** Build a checklist stop for trip / packing / transfer-ledger tests. */
export function makeStop(input: MakeStopInput): HaulingChecklistRow {
  return {
    id: input.id,
    routeAction: input.routeAction,
    locationSlug: input.locationSlug,
    cargoDeliveries: input.cargo ?? [],
    shipStorageLocation: input.shipStorageLocation ?? "front",
    distanceToNext: null,
    isCompleted: input.isCompleted ?? false,
  };
}

export function cargo(
  commoditySlug: string,
  scu: number,
  extras?: Partial<CargoDelivery>,
): CargoDelivery {
  return { commoditySlug, scu, ...extras };
}

/**
 * Named trip stop lists for cargo tests.
 * Keys describe trip shape (or scenario); call `getTripStops(key)` for a fresh copy.
 * Commodity choices inside are arbitrary filler.
 */
const stopFixtures = {
  /** Trip: pickup → deliver (unload matches earlier load). */
  pickupThenDeliver: [
    makeStop({
      id: "stop-1",
      routeAction: "pickup",
      locationSlug: "area18",
      cargo: [cargo("pressurized-ice", 16, { shipStorageLocation: "front" })],
    }),
    makeStop({
      id: "stop-2",
      routeAction: "delivery",
      locationSlug: "port-tressler",
      cargo: [cargo("pressurized-ice", 16, { shipStorageLocation: "front" })],
    }),
  ],

  /** Trip: pickup, then a pickup/transfer stop (load and unload at the same stop). */
  pickupTransferMix: [
    makeStop({
      id: "stop-1",
      routeAction: "pickup",
      locationSlug: "area18",
      cargo: [cargo("pressurized-ice", 10, { shipStorageLocation: "front" })],
    }),
    makeStop({
      id: "stop-2",
      routeAction: "both",
      locationSlug: "orison",
      cargo: [
        cargo("agricium", 20, {
          role: "pickup",
          shipStorageLocation: "rear",
        }),
        cargo("pressurized-ice", 10, {
          role: "delivery",
          shipStorageLocation: "front",
        }),
      ],
    }),
  ],

  /**
   * Minimal trip where a delivery amount exceeds SCU currently aboard
   * (transfer ledger must clamp at 0).
   */
  deliveryExceedsAboard: [
    makeStop({
      id: "stop-1",
      routeAction: "pickup",
      locationSlug: "area18",
      cargo: [
        cargo("pressurized-ice", 8, { shipStorageLocation: "front" }),
        cargo("processed-food", 9, { shipStorageLocation: "front" }),
      ],
    }),
    makeStop({
      id: "stop-2",
      routeAction: "delivery",
      locationSlug: "baijini-point",
      cargo: [
        cargo("medical-supplies", 32, { shipStorageLocation: "middle" }),
      ],
      shipStorageLocation: "middle",
    }),
  ],

  /**
   * Trip with aboard cargo across stops: pickup, then a pickup/transfer stop
   * that also lists a delivery of cargo never loaded earlier (packing must ignore it).
   */
  aboardCargo: [
    makeStop({
      id: "stop-1",
      routeAction: "pickup",
      locationSlug: "area18",
      cargo: [
        cargo("pressurized-ice", 8, { shipStorageLocation: "front" }),
        cargo("processed-food", 9, { shipStorageLocation: "front" }),
      ],
    }),
    makeStop({
      id: "stop-2",
      routeAction: "both",
      locationSlug: "orison",
      cargo: [
        cargo("scrap", 24, {
          role: "delivery",
          shipStorageLocation: "front",
        }),
        cargo("agricium", 40, {
          role: "pickup",
          shipStorageLocation: "rear",
        }),
      ],
    }),
    makeStop({
      id: "stop-3",
      routeAction: "delivery",
      locationSlug: "port-tressler",
      cargo: [],
      shipStorageLocation: "rear",
    }),
  ],
} as const satisfies Record<string, HaulingChecklistRow[]>;

export type TripStopFixtureKey = keyof typeof stopFixtures;

/** Load a named trip’s stops (fresh copy so tests can mutate safely). */
export function getTripStops(key: TripStopFixtureKey): HaulingChecklistRow[] {
  return structuredClone(stopFixtures[key]);
}

export function totalScu(plan: CargoGridPlacementPlan): number {
  return plan.boxes.reduce((sum, box) => sum + box.size, 0);
}

export function scuByCommodity(
  plan: CargoGridPlacementPlan,
): Record<string, number> {
  const by: Record<string, number> = {};
  for (const box of plan.boxes) {
    by[box.commoditySlug] = (by[box.commoditySlug] ?? 0) + box.size;
  }
  return by;
}

/** Real cargo-grid fixtures under `lib/fixtures/cargoGrids.json` — pack tests must use these. */
export const TEST_SHIP_SLUGS = [
  "c2-hercules-starlifter",
  "constellation-mk-v-centaurus",
] as const;

export type TestShipSlug = (typeof TEST_SHIP_SLUGS)[number];
