/** Units for distance-to-next (UI display; convert later if needed). */
export type DistanceUnit = "m" | "km" | "Mm" | "Gm" | "AU";

export type DistanceToNext = {
  value: number;
  unit: DistanceUnit;
};

export type CargoDelivery = {
  /** Slug from `lib/fixtures/commodities.json` (UEX). */
  commoditySlug: string;
  scu: number;
  /**
   * For `legKind: "both"` stops, mark each line as pickup or delivery.
   * Optional on pure pickup/delivery legs.
   */
  role?: "pickup" | "delivery";
  /**
   * Bay zone for this cargo line. Falls back to the row `shipStorageLocation`
   * when omitted (typical for single-role legs).
   */
  shipStorageLocation?: ShipStorageLocation;
};

/** Stop role for the location badge. */
export type LegKind = "pickup" | "delivery" | "both";

/**
 * Cargo bay zone on the ship (front / mid / aft).
 * Only these three values are allowed for now.
 */
export type ShipStorageLocation = "front" | "middle" | "rear";

export const shipStorageLocationValues = [
  "front",
  "middle",
  "rear",
] as const satisfies readonly ShipStorageLocation[];

export const shipStorageLocationLabels: Record<ShipStorageLocation, string> = {
  front: "Front",
  middle: "Middle",
  rear: "Rear",
};

/** One hauling checklist row (UI model until API wiring). */
export type HaulingChecklistRow = {
  id: string;
  legKind: LegKind;
  /** Slug from `lib/fixtures/locations.json` (Star Citizen Wiki starmap). */
  locationSlug: string;
  /** Cargo amounts at this stop (pickup and/or delivery). */
  cargoDeliveries: CargoDelivery[];
  shipStorageLocation: ShipStorageLocation;
  /** Null when there is no next stop (final row). */
  distanceToNext: DistanceToNext | null;
  isCompleted: boolean;
};

export type SessionChecklistModel = {
  sessionName: string;
  /**
   * Ships used on this session (one or more for a crew).
   * Slugs from `lib/fixtures/ships.json` (UEX).
   */
  shipSlugs: string[];
  /** ISO timestamp when the session was created / timer started. */
  startedAt: string;
  /**
   * ISO timestamp when the last checklist item was checked.
   * Null while the run is still in progress.
   */
  completedAt: string | null;
  /** ISO timestamp of the last shared write (sync / ETag revision). */
  updatedAt: string;
  rows: HaulingChecklistRow[];
};

export function formatDistanceToNext(distance: DistanceToNext | null): string {
  if (!distance) return "—";
  return `${distance.value} ${distance.unit}`;
}

export function areAllLegsComplete(rows: HaulingChecklistRow[]): boolean {
  return rows.length > 0 && rows.every((row) => row.isCompleted);
}

/** Set/clear `completedAt` from create → last item checked. */
export function applySessionCompletionTiming(
  session: SessionChecklistModel,
  now = new Date(),
): SessionChecklistModel {
  const startedAt = session.startedAt || now.toISOString();
  const allDone = areAllLegsComplete(session.rows);
  return {
    ...session,
    startedAt,
    completedAt: allDone
      ? session.completedAt ?? now.toISOString()
      : null,
  };
}

/** Format elapsed ms as `1h 02m 05s` / `12m 05s` / `45s`. */
export function formatSessionDuration(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  }
  return `${seconds}s`;
}

export function getSessionElapsedMs(
  session: Pick<SessionChecklistModel, "startedAt" | "completedAt">,
  now = Date.now(),
): number {
  const start = Date.parse(session.startedAt);
  if (Number.isNaN(start)) return 0;
  const end = session.completedAt
    ? Date.parse(session.completedAt)
    : now;
  if (Number.isNaN(end)) return 0;
  return Math.max(0, end - start);
}

export type ShipStorageLineDisplay = {
  role: "pickup" | "delivery" | null;
  location: ShipStorageLocation;
  label: string;
};

/**
 * One colored storage line per pickup/delivery bay assignment.
 * Dedupes identical role+zone pairs while keeping both roles when needed.
 */
export function describeShipStorageLines(
  row: Pick<
    HaulingChecklistRow,
    "legKind" | "cargoDeliveries" | "shipStorageLocation"
  >,
): ShipStorageLineDisplay[] {
  const fallbackRole = row.legKind === "both" ? null : row.legKind;
  const lines: ShipStorageLineDisplay[] = [];
  const seen = new Set<string>();

  const push = (
    role: "pickup" | "delivery" | null,
    location: ShipStorageLocation,
  ) => {
    const key = `${role ?? "none"}:${location}`;
    if (seen.has(key)) return;
    seen.add(key);
    const zone = shipStorageLocationLabels[location];
    lines.push({
      role,
      location,
      label:
        role && row.legKind === "both"
          ? `${role === "pickup" ? "Pickup" : "Delivery"} · ${zone}`
          : zone,
    });
  };

  if (row.cargoDeliveries.length === 0) {
    push(fallbackRole, row.shipStorageLocation);
    return lines;
  }

  for (const cargo of row.cargoDeliveries) {
    const role = cargo.role ?? fallbackRole;
    const location = cargo.shipStorageLocation ?? row.shipStorageLocation;
    push(role, location);
  }

  return lines;
}

/**
 * Static demo session so the table UI can ship before API wiring.
 * Location/cargo slugs must exist in fixtures (`npm run fixtures:fetch`).
 */
export const mockSessionChecklist: SessionChecklistModel = {
  sessionName: "Stanton hauling run",
  shipSlugs: ["c2-hercules-starlifter", "misc-freelancer-max"],
  startedAt: new Date().toISOString(),
  completedAt: null,
  updatedAt: new Date().toISOString(),
  rows: [
    {
      id: "leg-1",
      legKind: "pickup",
      locationSlug: "area18",
      cargoDeliveries: [
        {
          commoditySlug: "pressurized-ice",
          scu: 8,
          shipStorageLocation: "front",
        },
        {
          commoditySlug: "processed-food",
          scu: 9,
          shipStorageLocation: "front",
        },
      ],
      shipStorageLocation: "front",
      distanceToNext: { value: 12.4, unit: "Mm" },
      isCompleted: true,
    },
    {
      id: "leg-2",
      legKind: "delivery",
      locationSlug: "baijini-point",
      cargoDeliveries: [
        {
          commoditySlug: "medical-supplies",
          scu: 32,
          shipStorageLocation: "middle",
        },
      ],
      shipStorageLocation: "middle",
      distanceToNext: { value: 0.18, unit: "AU" },
      isCompleted: false,
    },
    {
      id: "leg-3",
      legKind: "both",
      locationSlug: "orison",
      cargoDeliveries: [
        {
          commoditySlug: "scrap",
          scu: 24,
          role: "delivery",
          shipStorageLocation: "front",
        },
        {
          commoditySlug: "agricium",
          scu: 40,
          role: "pickup",
          shipStorageLocation: "rear",
        },
      ],
      shipStorageLocation: "rear",
      distanceToNext: { value: 450.5, unit: "km" },
      isCompleted: false,
    },
    {
      id: "leg-4",
      legKind: "delivery",
      locationSlug: "port-tressler",
      cargoDeliveries: [],
      shipStorageLocation: "rear",
      distanceToNext: null,
      isCompleted: false,
    },
  ],
};
