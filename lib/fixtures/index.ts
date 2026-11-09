import commoditiesFixture from "@/lib/fixtures/commodities.json";
import contractorsFixture from "@/lib/fixtures/contractors.json";
import locationsFixture from "@/lib/fixtures/locations.json";
import shipsFixture from "@/lib/fixtures/ships.json";
import type {
  FixtureCommodity,
  FixtureContractor,
  FixtureFile,
  FixtureLocation,
  FixtureShip,
} from "@/lib/fixtures/types";

const locations = locationsFixture as FixtureFile<FixtureLocation>;
const commodities = commoditiesFixture as FixtureFile<FixtureCommodity>;
const ships = shipsFixture as FixtureFile<FixtureShip>;
const contractors = contractorsFixture as FixtureFile<FixtureContractor>;

const locationsBySlug = new Map(
  locations.items.map((item) => [item.slug, item] as const),
);
const commoditiesBySlug = new Map(
  commodities.items.map((item) => [item.slug, item] as const),
);
const shipsBySlug = new Map(
  ships.items.map((item) => [item.slug, item] as const),
);
const contractorsBySlug = new Map(
  contractors.items.map((item) => [item.slug, item] as const),
);

export function listLocations(): FixtureLocation[] {
  return locations.items;
}

export function getLocationBySlug(slug: string): FixtureLocation | undefined {
  return locationsBySlug.get(slug);
}

export function listCommodities(): FixtureCommodity[] {
  return commodities.items;
}

export function getCommodityBySlug(
  slug: string,
): FixtureCommodity | undefined {
  return commoditiesBySlug.get(slug);
}

export { getCommodityIconSrc } from "@/lib/fixtures/commodityIcons";

export function listShips(): FixtureShip[] {
  return ships.items;
}

export function getShipBySlug(slug: string): FixtureShip | undefined {
  return shipsBySlug.get(slug);
}

export function listContractors(): FixtureContractor[] {
  return contractors.items;
}

export function getContractorBySlug(
  slug: string,
): FixtureContractor | undefined {
  return contractorsBySlug.get(slug);
}

export function sumShipCargoScu(shipSlugs: string[]): number {
  return shipSlugs.reduce((total, slug) => {
    return total + (getShipBySlug(slug)?.cargoScu ?? 0);
  }, 0);
}

export type CargoLineDisplay = {
  role: "pickup" | "delivery" | null;
  /** Full plain-text label for MCP / non-UI use. */
  label: string;
  scu: number | null;
  commodityName: string | null;
  commoditySlug: string | null;
  color: string | null;
  color2: string | null;
};

/** Structured cargo lines for colored UI rendering. */
export function describeCargoDeliveries(
  deliveries: {
    commoditySlug: string;
    scu: number;
    role?: "pickup" | "delivery";
  }[],
  fallbackRole?: "pickup" | "delivery" | null,
): CargoLineDisplay[] {
  if (deliveries.length === 0) {
    return [
      {
        role: null,
        label: "—",
        scu: null,
        commodityName: null,
        commoditySlug: null,
        color: null,
        color2: null,
      },
    ];
  }
  return deliveries.map(({ commoditySlug, scu, role }) => {
    const commodity = getCommodityBySlug(commoditySlug);
    const commodityName = commodity?.name ?? commoditySlug;
    const amount = `${scu} ${commodityName}`;
    const resolvedRole = role ?? fallbackRole ?? null;
    const rolePrefix =
      resolvedRole === "pickup"
        ? "Pickup "
        : resolvedRole === "delivery"
          ? "Delivery "
          : "";
    return {
      role: resolvedRole,
      label: `${rolePrefix}${amount}`,
      scu,
      commodityName,
      commoditySlug,
      color: commodity?.color ?? null,
      color2: commodity?.color2 ?? null,
    };
  });
}

/** e.g. "8 Ice (Raw) + 9 Processed Food" or "Pickup 40 Agricium + Delivery 24 Scrap" */
export function formatCargoDeliveries(
  deliveries: {
    commoditySlug: string;
    scu: number;
    role?: "pickup" | "delivery";
  }[],
  fallbackRole?: "pickup" | "delivery" | null,
): string {
  return describeCargoDeliveries(deliveries, fallbackRole)
    .map((line) => line.label)
    .join(" + ");
}

export function sumCargoScu(
  deliveries: { commoditySlug: string; scu: number }[],
): number {
  return deliveries.reduce((total, row) => total + row.scu, 0);
}

/** Split SCU for both-stop legs (pickup vs delivery). */
export function sumCargoScuByRole(
  deliveries: {
    scu: number;
    role?: "pickup" | "delivery";
  }[],
  fallbackRole?: "pickup" | "delivery" | null,
): { pickup: number; delivery: number; total: number } {
  let pickup = 0;
  let delivery = 0;
  for (const row of deliveries) {
    const role = row.role ?? fallbackRole ?? null;
    if (role === "pickup") pickup += row.scu;
    else if (role === "delivery") delivery += row.scu;
    else {
      // Untagged lines count toward total only via sum below.
    }
  }
  const total = deliveries.reduce((sum, row) => sum + row.scu, 0);
  if (pickup === 0 && delivery === 0 && fallbackRole === "pickup") {
    pickup = total;
  } else if (pickup === 0 && delivery === 0 && fallbackRole === "delivery") {
    delivery = total;
  }
  return { pickup, delivery, total };
}

export const fixtureMeta = {
  locations: {
    source: locations.source,
    sourceLabel: locations.sourceLabel,
    fetchedAt: locations.fetchedAt,
    count: locations.items.length,
  },
  commodities: {
    source: commodities.source,
    sourceLabel: commodities.sourceLabel,
    fetchedAt: commodities.fetchedAt,
    count: commodities.items.length,
  },
  ships: {
    source: ships.source,
    sourceLabel: ships.sourceLabel,
    fetchedAt: ships.fetchedAt,
    count: ships.items.length,
  },
  contractors: {
    source: contractors.source,
    sourceLabel: contractors.sourceLabel,
    fetchedAt: contractors.fetchedAt,
    count: contractors.items.length,
  },
};
