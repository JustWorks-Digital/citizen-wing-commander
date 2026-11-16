import { restampAllMissionBoxSizes } from "@/lib/missions/rebuildSessionRoute";
import {
  normalizeSessionMission,
  type SessionMission,
} from "@/lib/missions/sessionMissions";

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

/** One hauling checklist row (stop on the route). */
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

/** Live hauling trip checklist (tabs, MCP session, Postgres payload). */
export type SessionChecklist = {
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

/** Round to nearest hundredth; drop trailing zeros (1.50 → 1.5). */
function formatDistanceValue(value: number): string {
  if (value === 0) return "0";
  return value.toFixed(2).replace(/\.?0+$/, "");
}

/** Same hundredth rounding for narrow UI (mobile checklist / toolbar). */
function formatDistanceValueCompact(value: number): string {
  return formatDistanceValue(value);
}

export function formatDistanceToNext(
  distance: DistanceToNext | null,
  options?: { compact?: boolean },
): string {
  if (!distance) return "—";
  if (distance.value === 0) return "0";
  const value = options?.compact
    ? formatDistanceValueCompact(distance.value)
    : formatDistanceValue(distance.value);
  return `${value} ${distance.unit}`;
}

export function areAllLegsComplete(rows: HaulingChecklistRow[]): boolean {
  return rows.length > 0 && rows.every((row) => row.isCompleted);
}

/** Set/clear `completedAt` from create → last item checked. */
export function applySessionCompletionTiming(
  session: SessionChecklist,
  now = new Date(),
): SessionChecklist {
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
  session: Pick<SessionChecklist, "startedAt" | "completedAt">,
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

const ROUTE_ACTIONS = new Set<RouteAction>([
  "pickup",
  "delivery",
  "both",
  "quantum",
]);

/**
 * Map legacy `legKind` on stored rows to `routeAction`.
 * TODO: remove once all delivery_sessions checklist JSON uses routeAction only.
 */
function normalizeChecklistRow(raw: unknown): HaulingChecklistRow {
  const row = (raw ?? {}) as Record<string, unknown>;
  const legacy = row.legKind;
  const next = row.routeAction;
  const routeAction =
    typeof next === "string" && ROUTE_ACTIONS.has(next as RouteAction)
      ? (next as RouteAction)
      : typeof legacy === "string" && ROUTE_ACTIONS.has(legacy as RouteAction)
        ? (legacy as RouteAction)
        : "pickup";
  const { legKind: _legacy, ...rest } = row;
  return {
    ...(rest as Omit<HaulingChecklistRow, "routeAction">),
    routeAction,
  };
}

export type SessionTabSummary = {
  id: string;
  sessionName: string;
  /** DB / checklist creation time (ISO). */
  createdAt: string;
  updatedAt: string;
  missionCount: number;
  rowCount: number;
  /** Session ships (primary first) — shown in trip switcher menus. */
  shipSlugs: string[];
};

/** UUID for DB row + MCP `sessionId` (works in Node + browser). */
export function createSessionId(): string {
  return crypto.randomUUID();
}

export function emptySessionChecklist(
  overrides?: Partial<SessionChecklist>,
): SessionChecklist {
  const now = new Date().toISOString();
  return normalizeSessionChecklist({
    id: createSessionId(),
    sessionName: "New trip",
    shipSlugs: [],
    startLocationSlug: null,
    missionCount: 0,
    missionsCompleted: 0,
    missions: [],
    startedAt: now,
    completedAt: null,
    updatedAt: now,
    rows: [],
    ...overrides,
  });
}

export function normalizeSessionChecklist(
  raw: Partial<SessionChecklist> & {
    sessionName?: string;
    rows?: HaulingChecklistRow[];
  },
  options?: { touchUpdatedAt?: boolean; preferId?: string },
): SessionChecklist {
  const startedAt =
    typeof raw.startedAt === "string" && raw.startedAt
      ? raw.startedAt
      : new Date().toISOString();
  const updatedAt =
    options?.touchUpdatedAt ||
    typeof raw.updatedAt !== "string" ||
    !raw.updatedAt
      ? new Date().toISOString()
      : raw.updatedAt;
  const idCandidate =
    (typeof options?.preferId === "string" && options.preferId.trim()) ||
    (typeof raw.id === "string" && raw.id.trim()) ||
    "";
  const id =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      idCandidate,
    ) || /^[a-z0-9_-]{4,64}$/i.test(idCandidate)
      ? idCandidate
      : createSessionId();

  return restampAllMissionBoxSizes(
    applySessionCompletionTiming({
      id,
      sessionName: raw.sessionName?.trim() || "New trip",
      shipSlugs: Array.isArray(raw.shipSlugs) ? raw.shipSlugs : [],
      startLocationSlug:
        typeof raw.startLocationSlug === "string" && raw.startLocationSlug.trim()
          ? raw.startLocationSlug.trim()
          : null,
      missionCount: Math.max(
        0,
        Math.trunc(
          typeof raw.missionCount === "number" && Number.isFinite(raw.missionCount)
            ? raw.missionCount
            : 0,
        ),
      ),
      missionsCompleted: (() => {
        const total = Math.max(
          0,
          Math.trunc(
            typeof raw.missionCount === "number" &&
              Number.isFinite(raw.missionCount)
              ? raw.missionCount
              : 0,
          ),
        );
        const done = Math.max(
          0,
          Math.trunc(
            typeof raw.missionsCompleted === "number" &&
              Number.isFinite(raw.missionsCompleted)
              ? raw.missionsCompleted
              : 0,
          ),
        );
        return Math.min(done, total);
      })(),
      missions: Array.isArray(raw.missions)
        ? (raw.missions as SessionMission[]).map(normalizeSessionMission)
        : [],
      startedAt,
      completedAt:
        typeof raw.completedAt === "string" ? raw.completedAt : null,
      updatedAt,
      rows: Array.isArray(raw.rows)
        ? raw.rows.map((row) => normalizeChecklistRow(row))
        : [],
    }),
  );
}

export function summarizeSessionChecklist(
  session: SessionChecklist,
  options?: { createdAt?: string | Date | null },
): SessionTabSummary {
  const fromDb =
    options?.createdAt instanceof Date
      ? options.createdAt.toISOString()
      : typeof options?.createdAt === "string" && options.createdAt.trim()
        ? options.createdAt.trim()
        : null;
  return {
    id: session.id,
    sessionName: session.sessionName,
    createdAt: fromDb ?? session.startedAt,
    updatedAt: session.updatedAt,
    missionCount: session.missionCount,
    rowCount: session.rows.length,
    shipSlugs: session.shipSlugs ?? [],
  };
}
