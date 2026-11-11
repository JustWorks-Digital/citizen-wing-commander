import { getCommodityBySlug, getLocationBySlug } from "@/lib/fixtures";
import {
  shipStorageLocationValues,
  type HaulingChecklistRow,
  type RouteAction,
  type ShipStorageLocation,
} from "@/lib/missions/mockSession";

export type CargoBayCommodity = {
  commoditySlug: string;
  commodityName: string;
  scu: number;
  color: string | null;
  color2: string | null;
};

export type CargoBayTile = {
  key: string;
  locationSlug: string;
  locationName: string;
  role: "pickup" | "delivery";
  scu: number;
  isCompleted: boolean;
  commodities: CargoBayCommodity[];
};

export type CargoBaySection = {
  zone: ShipStorageLocation;
  tiles: CargoBayTile[];
};

/** Two location tiles per visual row inside a bay section. */
export const CARGO_BAY_TILES_PER_ROW = 2;

function resolveRole(
  routeAction: RouteAction,
  role: "pickup" | "delivery" | undefined,
): "pickup" | "delivery" | null {
  if (role) return role;
  if (routeAction === "pickup" || routeAction === "delivery") return routeAction;
  return null;
}

function addCommodity(
  tile: CargoBayTile,
  commoditySlug: string,
  scu: number,
): void {
  const commodity = getCommodityBySlug(commoditySlug);
  const existing = tile.commodities.find(
    (item) => item.commoditySlug === commoditySlug,
  );
  if (existing) {
    existing.scu += scu;
    return;
  }
  tile.commodities.push({
    commoditySlug,
    commodityName: commodity?.name ?? commoditySlug,
    scu,
    color: commodity?.color ?? null,
    color2: commodity?.color2 ?? null,
  });
}

/**
 * Build top-down bay sections (front → middle → rear) from checklist rows.
 * Incomplete cargo still occupies tiles; completed legs stay visible but muted in UI.
 */
export function buildCargoBaySections(
  rows: HaulingChecklistRow[],
): CargoBaySection[] {
  const buckets = new Map<string, CargoBayTile>();

  for (const row of rows) {
    if (row.routeAction === "quantum") continue;

    for (const cargo of row.cargoDeliveries) {
      const role = resolveRole(row.routeAction, cargo.role);
      if (!role) continue;

      const zone = cargo.shipStorageLocation ?? row.shipStorageLocation;
      const key = `${zone}:${row.locationSlug}:${role}`;
      const existing = buckets.get(key);
      if (existing) {
        existing.scu += cargo.scu;
        existing.isCompleted = existing.isCompleted && row.isCompleted;
        addCommodity(existing, cargo.commoditySlug, cargo.scu);
        continue;
      }

      const tile: CargoBayTile = {
        key,
        locationSlug: row.locationSlug,
        locationName:
          getLocationBySlug(row.locationSlug)?.name ?? row.locationSlug,
        role,
        scu: cargo.scu,
        isCompleted: row.isCompleted,
        commodities: [],
      };
      addCommodity(tile, cargo.commoditySlug, cargo.scu);
      buckets.set(key, tile);
    }
  }

  return shipStorageLocationValues.map((zone) => ({
    zone,
    tiles: [...buckets.values()].filter((tile) =>
      tile.key.startsWith(`${zone}:`),
    ),
  }));
}
