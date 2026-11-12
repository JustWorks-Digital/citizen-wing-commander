import type { SessionMission } from "@/lib/missions/sessionMissions";

export type { SessionMission } from "@/lib/missions/sessionMissions";

/** Units for distance-to-next (Star Citizen QT / starmap style). */
export type DistanceUnit = "m" | "km" | "Mm" | "Gm";

export type DistanceToNext = {
  value: number;
  unit: DistanceUnit;
};

/**
 * Optional fine-grained bay cell on a ship cargo grid.
 * Axes: X nose→ramp, Y port→starboard, Z deck→ceiling (see `cargoGridCoords`).
 */
export type CargoGridCoordRef = {
  x: number;
  y: number;
  z: number;
};

export type CargoDelivery = {
  /** Slug from `lib/fixtures/commodities.json` (UEX). */
  commoditySlug: string;
  scu: number;
  /**
   * For `routeAction: "both"` stops, mark each line as pickup or delivery.
   * Optional on pure pickup/delivery stops.
   */
  role?: "pickup" | "delivery";
  /**
   * Bay zone for this cargo line. Falls back to the row `shipStorageLocation`
   * when omitted (typical for single-role legs).
   */
  shipStorageLocation?: ShipStorageLocation;
  /**
   * Exact 1 SCU cell (or anchor cell for a multi-SCU stack) on the ship grid.
   * When set, prefer this over coarse `shipStorageLocation` for UI hints.
   */
  gridCoord?: CargoGridCoordRef;
  /**
   * Explicit crate sizes for bay packing (from a selected mission breakdown).
   * When set, the placer uses these instead of greedy 8→4→2→1.
   */
  boxSizes?: Array<1 | 2 | 4 | 8 | 16 | 32>;
  /** Session mission id this cargo line came from (when known). */
  missionId?: string;
  /**
   * Crew marked this pickup/delivery brick handled (shared session state).
   * Toggled from the stop cargo tiles; synced to all viewers.
   */
  isHandled?: boolean;
};

/**
 * What this checklist row does on the route:
 * pickup / delivery / both at a location, or quantum travel.
 */
export type RouteAction = "pickup" | "delivery" | "both" | "quantum";

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
  routeAction: RouteAction;
  /** Slug from `lib/fixtures/locations.json` (Star Citizen Wiki starmap). */
  locationSlug: string;
  /**
   * Destination for `routeAction: "quantum"` travel rows (from = `locationSlug`).
   * Null/omitted on pickup/delivery stops.
   */
  quantumToLocationSlug?: string | null;
  /**
   * Shop / facility reason for a quantum leg (fixture slug from
   * `locationShops`, e.g. platinum-bay, cargo-center).
   */
  reasonShopSlug?: string | null;
  /** Cargo amounts at this stop (pickup and/or delivery). */
  cargoDeliveries: CargoDelivery[];
  shipStorageLocation: ShipStorageLocation;
  /** Null when there is no next stop (final row). */
  distanceToNext: DistanceToNext | null;
  isCompleted: boolean;
};

export function isQuantumTravelRow(row: HaulingChecklistRow): boolean {
  return row.routeAction === "quantum";
}

/** Where the crew is after finishing this row (quantum → destination). */
export function rowPresenceLocationSlug(row: HaulingChecklistRow): string {
  if (
    row.routeAction === "quantum" &&
    row.quantumToLocationSlug?.trim()
  ) {
    return row.quantumToLocationSlug.trim();
  }
  return row.locationSlug;
}

export type SessionChecklistModel = {
  /**
   * Stable id for UI tabs + MCP targeting (`sessionId`).
   * Short hex string; generated when a session is created.
   */
  id: string;
  sessionName: string;
  /**
   * Ships used on this session (one or more for a crew).
   * Slugs from `lib/fixtures/ships.json` (UEX).
   */
  shipSlugs: string[];
  /**
   * Where the crew starts the run (route origin).
   * Slug from `lib/fixtures/locations.json`, or null if unset.
   */
  startLocationSlug: string | null;
  /** Accepted / planned hauling missions in this session (contracts). */
  missionCount: number;
  /** Missions marked done (not the same as route-leg completion). */
  missionsCompleted: number;
  /** Full mission cards for the Missions modal / MobiGlas detail. */
  missions: SessionMission[];
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

/**
 * Format elapsed ms for session UI.
 * First minute: seconds only (`45s`). After that: minutes (and hours), no seconds
 * (`12m`, `1h 02m`).
 */
export function formatSessionDuration(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
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
    "routeAction" | "cargoDeliveries" | "shipStorageLocation"
  >,
): ShipStorageLineDisplay[] {
  if (row.routeAction === "quantum") return [];
  const fallbackRole =
    row.routeAction === "pickup" || row.routeAction === "delivery"
      ? row.routeAction
      : null;
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
        role && row.routeAction === "both"
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
  id: "11111111-1111-4111-8111-111111111111",
  sessionName: "Stanton hauling run",
  shipSlugs: ["c2-hercules-starlifter", "misc-freelancer-max"],
  startLocationSlug: "area18",
  missionCount: 1,
  missionsCompleted: 0,
  missions: [
    {
      id: "demo-area18-haul",
      title: "Junior Rank - Direct Medium Cargo Haul",
      contractor: "Covalex Independent Contractors",
      rewardAuec: 80000,
      rewardDisplay: "80,000 aUEC",
      from: ["Area18"],
      to: ["Baijini Point"],
      cargo: [
        { commodity: "Pressurized Ice", scu: 8 },
        { commodity: "Processed Food", scu: 9 },
      ],
      cargoSummary: "8 SCU Pressurized Ice · 9 SCU Processed Food",
      isCompleted: false,
      screenshots: ["demo-batch/area18-baijini-contract.png"],
      mobiglas: {
        tab: "Accepted",
        acceptedCount: "1/10",
        category: "Hauling - Planetary",
        title: "Junior Rank - Direct Medium Cargo Haul",
        contractor: "Covalex Independent Contractors",
        rewardAuec: 80000,
        rewardDisplay: "80,000 aUEC",
        timeRemaining: null,
        deadline: null,
        details:
          "Demo contract for Storybook / local preview. Haul mixed cargo from Area18 toward Baijini Point.",
        contact: "Chase Hewitt, Jr. Logistics Coordinator, Covalex Shipping",
        objectives: [
          {
            label: "Deliver cargo toward Baijini Point",
            progressCurrent: 0,
            progressTotal: 17,
            children: ["Collect from Area18"],
          },
        ],
      },
    },
  ],
  startedAt: new Date().toISOString(),
  completedAt: null,
  updatedAt: new Date().toISOString(),
  rows: [
    {
      id: "leg-1",
      routeAction: "pickup",
      locationSlug: "area18",
      cargoDeliveries: [
        {
          commoditySlug: "pressurized-ice",
          scu: 8,
          shipStorageLocation: "front",
          missionId: "demo-area18-haul",
          boxSizes: [8],
        },
        {
          commoditySlug: "processed-food",
          scu: 9,
          shipStorageLocation: "front",
          missionId: "demo-area18-haul",
          boxSizes: [8, 1],
        },
      ],
      shipStorageLocation: "front",
      distanceToNext: { value: 12.4, unit: "Mm" },
      isCompleted: true,
    },
    {
      id: "leg-2",
      routeAction: "delivery",
      locationSlug: "baijini-point",
      cargoDeliveries: [
        {
          commoditySlug: "medical-supplies",
          scu: 32,
          shipStorageLocation: "middle",
          missionId: "demo-area18-haul",
          boxSizes: [16, 16],
        },
      ],
      shipStorageLocation: "middle",
      distanceToNext: { value: 27, unit: "Gm" },
      isCompleted: false,
    },
    {
      id: "leg-3",
      routeAction: "both",
      locationSlug: "orison",
      cargoDeliveries: [
        {
          commoditySlug: "scrap",
          scu: 24,
          role: "delivery",
          shipStorageLocation: "front",
          missionId: "demo-area18-haul",
          boxSizes: [8, 8, 8],
        },
        {
          commoditySlug: "agricium",
          scu: 40,
          role: "pickup",
          shipStorageLocation: "rear",
          missionId: "demo-area18-haul",
          boxSizes: [32, 8],
        },
      ],
      shipStorageLocation: "rear",
      distanceToNext: { value: 450.5, unit: "km" },
      isCompleted: false,
    },
    {
      id: "leg-4",
      routeAction: "delivery",
      locationSlug: "port-tressler",
      cargoDeliveries: [],
      shipStorageLocation: "rear",
      distanceToNext: null,
      isCompleted: false,
    },
  ],
};
