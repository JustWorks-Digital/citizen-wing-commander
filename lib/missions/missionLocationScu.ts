import type { HaulingChecklistRow } from "@/lib/missions/sessionChecklist";
import type { SessionMission } from "@/lib/missions/sessionMissions";
import {
  commoditySlugOf,
  locationLabelOf,
  locationSlugOf,
} from "@/lib/missions/missionScuShared";

/** Per-location collect/deliver SCU for one mission commodity. */
export type MissionLocationScuLine = {
  role: "pickup" | "delivery";
  /** Location name/slug as stored on the mission / split. */
  locationKey: string;
  locationSlug: string;
  locationLabel: string;
  commodity: string;
  commoditySlug: string;
  scu: number;
};

/** Location SCU lines from the live route for one mission (no invented places). */
function locationLinesFromRows(
  mission: SessionMission,
  rows: HaulingChecklistRow[],
): MissionLocationScuLine[] {
  const commodityBySlug = new Map(
    mission.cargo.map((line) => [
      commoditySlugOf(line.commodity),
      line.commodity,
    ]),
  );
  const byKey = new Map<string, MissionLocationScuLine>();

  for (const row of rows) {
    if (row.routeAction === "quantum") continue;
    for (const cargo of row.cargoDeliveries) {
      if (cargo.missionId && cargo.missionId !== mission.id) continue;
      const commodity = commodityBySlug.get(cargo.commoditySlug);
      if (!commodity) continue;
      const role =
        cargo.role ??
        (row.routeAction === "pickup" || row.routeAction === "delivery"
          ? row.routeAction
          : null);
      if (role !== "pickup" && role !== "delivery") continue;

      const locationKey = row.locationSlug;
      const key = `${role}::${locationSlugOf(locationKey)}::${cargo.commoditySlug}`;
      const existing = byKey.get(key);
      if (existing) {
        existing.scu += Math.max(0, Math.floor(cargo.scu));
      } else {
        byKey.set(key, {
          role,
          locationKey,
          locationSlug: locationSlugOf(locationKey),
          locationLabel: locationLabelOf(locationKey),
          commodity,
          commoditySlug: cargo.commoditySlug,
          scu: Math.max(0, Math.floor(cargo.scu)),
        });
      }
    }
  }

  return [...byKey.values()];
}

/**
 * Collect/deliver SCU by location for one mission.
 * Live route rows win when present; otherwise `scuSplits` / from–to fallback.
 */
export const missionLocationScu = {
  locationLines(
    mission: SessionMission,
    rows?: HaulingChecklistRow[] | null,
  ): MissionLocationScuLine[] {
    // Live route is authoritative: never invent even-split amounts for
    // destinations that do not actually move this commodity.
    if (rows?.length) {
      return locationLinesFromRows(mission, rows);
    }

    const out: MissionLocationScuLine[] = [];
    const splits = mission.scuSplits ?? [];

    if (splits.length > 0) {
      const pickupKey = new Map<string, MissionLocationScuLine>();
      const deliveryKey = new Map<string, MissionLocationScuLine>();
      for (const split of splits) {
        const commoditySlug =
          split.commoditySlug || commoditySlugOf(split.commodityName);
        const fromKey = split.fromLocationSlug.trim();
        const toKey = split.toLocationSlug.trim();
        if (fromKey) {
          const key = `${locationSlugOf(fromKey)}::${commoditySlug}`;
          const existing = pickupKey.get(key);
          if (existing) {
            existing.scu += Math.max(0, Math.floor(split.scu));
          } else {
            pickupKey.set(key, {
              role: "pickup",
              locationKey: fromKey,
              locationSlug: locationSlugOf(fromKey),
              locationLabel: locationLabelOf(fromKey),
              commodity: split.commodityName,
              commoditySlug,
              scu: Math.max(0, Math.floor(split.scu)),
            });
          }
        }
        if (toKey) {
          const key = `${locationSlugOf(toKey)}::${commoditySlug}`;
          const existing = deliveryKey.get(key);
          if (existing) {
            existing.scu += Math.max(0, Math.floor(split.scu));
          } else {
            deliveryKey.set(key, {
              role: "delivery",
              locationKey: toKey,
              locationSlug: locationSlugOf(toKey),
              locationLabel: locationLabelOf(toKey),
              commodity: split.commodityName,
              commoditySlug,
              scu: Math.max(0, Math.floor(split.scu)),
            });
          }
        }
      }
      out.push(...pickupKey.values(), ...deliveryKey.values());
    } else {
      for (const line of mission.cargo) {
        const scu = Math.max(0, Math.floor(Number(line.scu) || 0));
        if (scu <= 0) continue;
        const commoditySlug = commoditySlugOf(line.commodity);
        for (const from of mission.from) {
          out.push({
            role: "pickup",
            locationKey: from,
            locationSlug: locationSlugOf(from),
            locationLabel: locationLabelOf(from),
            commodity: line.commodity,
            commoditySlug,
            scu:
              mission.from.length === 1
                ? scu
                : Math.floor(scu / mission.from.length),
          });
        }
        for (const to of mission.to) {
          out.push({
            role: "delivery",
            locationKey: to,
            locationSlug: locationSlugOf(to),
            locationLabel: locationLabelOf(to),
            commodity: line.commodity,
            commoditySlug,
            scu:
              mission.to.length === 1
                ? scu
                : Math.floor(scu / mission.to.length),
          });
        }
      }
    }

    return out;
  },
};
