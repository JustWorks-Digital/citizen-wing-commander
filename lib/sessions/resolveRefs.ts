import {
  getCommodityBySlug,
  getContractorBySlug,
  getLocationBySlug,
  getShipBySlug,
  listCommodities,
  listContractors,
  listLocations,
  listShips,
} from "@/lib/fixtures";
import { resolveLocationShopSlug } from "@/lib/fixtures/locationShops";
import {
  shipStorageLocationValues,
  type CargoDelivery,
  type LegKind,
  type ShipStorageLocation,
} from "@/lib/missions/mockSession";

function normalize(value: string | null | undefined): string {
  if (value == null) return "";
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function resolveLocationSlug(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (getLocationBySlug(trimmed)) return trimmed;

  const needle = normalize(trimmed);
  const exact = listLocations().find(
    (loc) => normalize(loc.name) === needle || normalize(loc.slug) === needle,
  );
  if (exact) return exact.slug;

  const partial = listLocations().find(
    (loc) =>
      normalize(loc.name).includes(needle) ||
      needle.includes(normalize(loc.name)),
  );
  return partial?.slug ?? null;
}

export function resolveCommoditySlug(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (getCommodityBySlug(trimmed)) return trimmed;

  const needle = normalize(trimmed);
  const exact = listCommodities().find(
    (c) =>
      normalize(c.name) === needle ||
      normalize(c.slug) === needle ||
      normalize(c.code) === needle,
  );
  if (exact) return exact.slug;

  const partial = listCommodities().find((c) =>
    normalize(c.name).includes(needle),
  );
  return partial?.slug ?? null;
}

export function searchLocations(query: string, limit = 10) {
  const needle = normalize(query);
  if (!needle) return listLocations().slice(0, limit);

  const scored: { loc: ReturnType<typeof listLocations>[number]; score: number }[] =
    [];
  for (const loc of listLocations()) {
    const name = normalize(loc.name);
    const slug = normalize(loc.slug);
    const parent = normalize(loc.parentName ?? "");
    const system = normalize(loc.system ?? "");
    let score = 0;
    if (name === needle || slug === needle) score = 100;
    else if (name.startsWith(needle) || slug.startsWith(needle)) score = 80;
    else if (name.includes(needle) || slug.includes(needle)) score = 55;
    else if (parent.startsWith(needle) || parent.includes(needle)) score = 35;
    else if (system.includes(needle)) score = 15;
    else continue;
    scored.push({ loc, score });
  }
  scored.sort(
    (a, b) => b.score - a.score || a.loc.name.localeCompare(b.loc.name),
  );
  return scored.slice(0, limit).map((row) => row.loc);
}

export function searchCommodities(query: string, limit = 10) {
  const needle = normalize(query);
  if (!needle) return listCommodities().slice(0, limit);
  return listCommodities()
    .filter(
      (c) =>
        normalize(c.name).includes(needle) ||
        normalize(c.slug).includes(needle) ||
        normalize(c.code).includes(needle) ||
        normalize(c.kind ?? "").includes(needle),
    )
    .slice(0, limit);
}

export function resolveShipSlug(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (getShipBySlug(trimmed)) return trimmed;

  const needle = normalize(trimmed);
  const exact = listShips().find(
    (ship) =>
      normalize(ship.slug) === needle ||
      normalize(ship.name) === needle ||
      normalize(ship.nameFull) === needle,
  );
  if (exact) return exact.slug;

  const partial = listShips().find(
    (ship) =>
      normalize(ship.name).includes(needle) ||
      normalize(ship.nameFull).includes(needle) ||
      normalize(ship.slug).includes(needle),
  );
  return partial?.slug ?? null;
}

export function searchShips(query: string, limit = 10) {
  const needle = normalize(query);
  if (!needle) return listShips().slice(0, limit);
  return listShips()
    .filter(
      (ship) =>
        normalize(ship.name).includes(needle) ||
        normalize(ship.nameFull).includes(needle) ||
        normalize(ship.slug).includes(needle) ||
        normalize(ship.manufacturer ?? "").includes(needle),
    )
    .slice(0, limit);
}

export function resolveContractorSlug(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (getContractorBySlug(trimmed)) return trimmed;

  const needle = normalize(trimmed);
  const exact = listContractors().find(
    (contractor) =>
      normalize(contractor.slug) === needle ||
      normalize(contractor.name) === needle ||
      contractor.aliases.some((alias) => normalize(alias) === needle),
  );
  if (exact) return exact.slug;

  const partial = listContractors().find(
    (contractor) =>
      normalize(contractor.name).includes(needle) ||
      needle.includes(normalize(contractor.name)) ||
      contractor.aliases.some(
        (alias) =>
          normalize(alias).includes(needle) ||
          needle.includes(normalize(alias)),
      ),
  );
  return partial?.slug ?? null;
}

export function searchContractors(query: string, limit = 10) {
  const needle = normalize(query);
  if (!needle) return listContractors().slice(0, limit);
  return listContractors()
    .filter(
      (contractor) =>
        normalize(contractor.name).includes(needle) ||
        normalize(contractor.slug).includes(needle) ||
        contractor.aliases.some((alias) => normalize(alias).includes(needle)),
    )
    .slice(0, limit);
}

export function resolveShipSlugs(inputs: string[]): {
  ok: true;
  shipSlugs: string[];
} | {
  ok: false;
  error: string;
} {
  const shipSlugs: string[] = [];
  for (const input of inputs) {
    const slug = resolveShipSlug(input);
    if (!slug) {
      return { ok: false, error: `Unknown ship: ${input}` };
    }
    if (!shipSlugs.includes(slug)) shipSlugs.push(slug);
  }
  return { ok: true, shipSlugs };
}

export type IncomingCargoLine = {
  commodity: string;
  scu: number;
  role?: "pickup" | "delivery";
  /** Per-line bay zone; falls back to leg shipStorageLocation. */
  shipStorageLocation?: string;
};

export function resolveShipStorageLocation(
  input: string | undefined,
): ShipStorageLocation | null {
  if (!input?.trim()) return null;
  const needle = input.trim().toLowerCase();
  const aliases: Record<string, ShipStorageLocation> = {
    front: "front",
    fore: "front",
    forward: "front",
    bow: "front",
    middle: "middle",
    mid: "middle",
    center: "middle",
    centre: "middle",
    rear: "rear",
    aft: "rear",
    back: "rear",
    stern: "rear",
  };
  if (aliases[needle]) return aliases[needle];
  return (
    shipStorageLocationValues.find((value) => value === needle) ?? null
  );
}

export type IncomingLeg = {
  id?: string;
  legKind: LegKind;
  location: string;
  /** Destination location for `legKind: "quantum"` (name or slug). */
  quantumToLocation?: string | null;
  /** Shop reason for quantum legs (name or slug, e.g. Platinum Bay). */
  reasonShop?: string | null;
  cargo?: IncomingCargoLine[];
  /** Required: front | middle | rear (aliases like aft/fore accepted). */
  shipStorageLocation: string;
  distanceToNext?: { value: number; unit: "m" | "km" | "Mm" | "Gm" } | null;
  isCompleted?: boolean;
};

export function resolveIncomingLeg(leg: IncomingLeg, index: number) {
  const locationSlug = resolveLocationSlug(leg.location);
  if (!locationSlug) {
    return {
      ok: false as const,
      error: `Unknown location: ${leg.location}`,
    };
  }

  let quantumToLocationSlug: string | null = null;
  let reasonShopSlug: string | null = null;
  if (leg.legKind === "quantum") {
    const toRaw = leg.quantumToLocation?.trim() || "";
    if (!toRaw) {
      return {
        ok: false as const,
        error: "quantum legs require quantumToLocation",
      };
    }
    quantumToLocationSlug = resolveLocationSlug(toRaw);
    if (!quantumToLocationSlug) {
      return {
        ok: false as const,
        error: `Unknown quantum destination: ${toRaw}`,
      };
    }
    const reasonRaw = leg.reasonShop?.trim() || "";
    if (reasonRaw) {
      reasonShopSlug = resolveLocationShopSlug(
        reasonRaw,
        quantumToLocationSlug,
      );
      if (!reasonShopSlug) {
        return {
          ok: false as const,
          error: `Unknown shop reason at destination: ${reasonRaw}`,
        };
      }
    }
  }

  const rowShipStorage = resolveShipStorageLocation(
    leg.shipStorageLocation || "front",
  );
  if (!rowShipStorage) {
    return {
      ok: false as const,
      error:
        "shipStorageLocation must be front, middle, or rear (cargo bay zone)",
    };
  }

  if (leg.legKind === "quantum") {
    return {
      ok: true as const,
      row: {
        id: leg.id?.trim() || `quantum-${index + 1}`,
        legKind: "quantum" as const,
        locationSlug,
        quantumToLocationSlug,
        reasonShopSlug,
        cargoDeliveries: [],
        shipStorageLocation: rowShipStorage,
        distanceToNext: leg.distanceToNext ?? null,
        isCompleted: Boolean(leg.isCompleted),
      },
    };
  }

  const cargoDeliveries: CargoDelivery[] = [];
  for (const line of leg.cargo ?? []) {
    const commoditySlug = resolveCommoditySlug(line.commodity);
    if (!commoditySlug) {
      return {
        ok: false as const,
        error: `Unknown commodity: ${line.commodity}`,
      };
    }
    if (leg.legKind === "both" && !line.role) {
      return {
        ok: false as const,
        error: `Cargo lines on both stops need role pickup or delivery (${line.commodity})`,
      };
    }

    let lineStorage = rowShipStorage;
    if (line.shipStorageLocation) {
      const resolvedLineStorage = resolveShipStorageLocation(
        line.shipStorageLocation,
      );
      if (!resolvedLineStorage) {
        return {
          ok: false as const,
          error: `Invalid cargo shipStorageLocation for ${line.commodity}`,
        };
      }
      lineStorage = resolvedLineStorage;
    } else if (leg.legKind === "both") {
      return {
        ok: false as const,
        error: `Cargo lines on both stops need shipStorageLocation (${line.commodity})`,
      };
    }

    cargoDeliveries.push({
      commoditySlug,
      scu: Math.trunc(line.scu),
      shipStorageLocation: lineStorage,
      ...(line.role ? { role: line.role } : {}),
    });
  }

  return {
    ok: true as const,
    row: {
      id: leg.id?.trim() || `leg-${index + 1}`,
      legKind: leg.legKind,
      locationSlug,
      cargoDeliveries,
      shipStorageLocation: rowShipStorage,
      distanceToNext: leg.distanceToNext ?? null,
      isCompleted: Boolean(leg.isCompleted),
    },
  };
}
