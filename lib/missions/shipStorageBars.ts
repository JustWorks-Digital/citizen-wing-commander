import { getCommodityBySlug } from "@/lib/fixtures";
import {
  shipStorageLocationLabels,
  shipStorageLocationValues,
  type HaulingChecklistRow,
  type ShipStorageLocation,
} from "@/lib/missions/mockSession";

export type ShipStorageBarSegment = {
  commoditySlug: string;
  commodityName: string;
  scu: number;
  color: string | null;
  color2: string | null;
};

export type ShipStorageBar = {
  zone: ShipStorageLocation;
  label: string;
  segments: ShipStorageBarSegment[];
};

/**
 * Stacked bay bars for one checklist stop: front → middle → rear.
 * Segments within a zone are split by commodity (SCU-weighted in the UI).
 */
export function buildShipStorageBars(
  row: Pick<
    HaulingChecklistRow,
    "cargoDeliveries" | "shipStorageLocation"
  >,
): ShipStorageBar[] {
  const byZone = new Map<
    ShipStorageLocation,
    Map<string, ShipStorageBarSegment>
  >();

  const add = (
    zone: ShipStorageLocation,
    commoditySlug: string,
    scu: number,
  ) => {
    let zoneMap = byZone.get(zone);
    if (!zoneMap) {
      zoneMap = new Map();
      byZone.set(zone, zoneMap);
    }
    const existing = zoneMap.get(commoditySlug);
    if (existing) {
      existing.scu += scu;
      return;
    }
    const commodity = getCommodityBySlug(commoditySlug);
    zoneMap.set(commoditySlug, {
      commoditySlug,
      commodityName: commodity?.name ?? commoditySlug,
      scu,
      color: commodity?.color ?? null,
      color2: commodity?.color2 ?? null,
    });
  };

  for (const cargo of row.cargoDeliveries) {
    add(
      cargo.shipStorageLocation ?? row.shipStorageLocation,
      cargo.commoditySlug,
      cargo.scu,
    );
  }

  // Always front → middle → rear so each bay keeps a dedicated slot.
  return shipStorageLocationValues.map((zone) => ({
    zone,
    label: shipStorageLocationLabels[zone],
    segments: [...(byZone.get(zone)?.values() ?? [])],
  }));
}
