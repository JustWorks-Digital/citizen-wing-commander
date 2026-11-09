import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  addCatalogMissionNote,
  getCatalogMission,
  listCatalogMissionNotes,
  listCatalogMissions,
  recordCatalogMissionRun,
  upsertCatalogMission,
} from "@/db/queries/catalogMissions";
import {
  formatCargoDeliveries,
  getCommodityBySlug,
  getLocationBySlug,
  getShipBySlug,
  sumCargoScu,
  sumShipCargoScu,
} from "@/lib/fixtures";
import {
  describeShipStorageLines,
  formatSessionDuration,
  getSessionElapsedMs,
  shipStorageLocationLabels,
} from "@/lib/missions/mockSession";
import {
  createChecklistSession,
  getChecklistSession,
  listChecklistSessions,
  replaceChecklistRows,
  setActiveChecklistSession,
  setLegCompleted,
  setSessionName,
  setSessionShips,
  setSessionStartLocation,
} from "@/lib/sessions/checklistStore";
import {
  clearHaulingScreenshots,
  listHaulingScreenshots,
  readHaulingScreenshot,
  storeHaulingScreenshot,
} from "@/lib/sessions/screenshotStore";
import { buildRouteFromIntake } from "@/lib/sessions/buildRouteFromIntake";
import {
  resolveCommoditySlug,
  resolveIncomingLeg,
  resolveLocationSlug,
  resolveShipSlugs,
  searchCommodities,
  searchLocations,
  searchShips,
  type IncomingLeg,
} from "@/lib/sessions/resolveRefs";
import type { CatalogMissionNoteSentiment } from "@/lib/missions/catalogMission";
import type { HaulingContractsIntake } from "@/lib/missions/haulingIntake";
import type { SessionChecklistModel } from "@/lib/missions/mockSession";
import { linkSessionMissionsToCatalog } from "@/lib/missions/linkSessionMissionToCatalog";
import { buildSessionMissionsFromIntake } from "@/lib/missions/sessionMissionsFromIntake";
import { cargoPlacementRules } from "@/lib/ships/cargoGridPlacementRules";
import {
  cargoGridSketches,
  cargoGridTotalLength,
  cargoGridTotalScu,
  cargoGridZoneScu,
  cargoGridZoneWidth,
  getCargoGridSketchBySlug,
  getCargoGridViewScale,
  type ShipCargoGridSketch,
} from "@/lib/ships/cargoGrids";

const PLAYBOOK_PATH = path.join(
  process.cwd(),
  "docs/mcp-screenshot-hauling-playbook.md",
);

function presentShips(shipSlugs: string[]) {
  return shipSlugs.map((slug) => {
    const ship = getShipBySlug(slug);
    return {
      slug,
      name: ship?.name ?? slug,
      nameFull: ship?.nameFull ?? slug,
      manufacturer: ship?.manufacturer ?? null,
      cargoScu: ship?.cargoScu ?? 0,
      hasCargoGridSketch: Boolean(getCargoGridSketchBySlug(slug)),
    };
  });
}

function presentCargoGridSketch(sketch: ShipCargoGridSketch) {
  return {
    shipSlug: sketch.shipSlug,
    shipName: sketch.shipName,
    widthCells: sketch.widthCells,
    heightCells: sketch.heightCells,
    totalLengthCells: cargoGridTotalLength(sketch),
    totalCargoScu: cargoGridTotalScu(sketch),
    viewScale: getCargoGridViewScale(sketch.shipSlug),
    zones: sketch.zones.map((zone) => ({
      id: zone.id,
      label: zone.label,
      kind: zone.kind,
      storageLocation: zone.storageLocation ?? null,
      lengthCells: zone.lengthCells,
      widthCells: cargoGridZoneWidth(sketch, zone),
      heightCells: sketch.heightCells,
      scu: cargoGridZoneScu(sketch, zone),
    })),
    notes: sketch.notes,
  };
}

const cargoGridCoordinateSystem = {
  cellSizeScu: 1,
  axes: {
    x: "nose → ramp (length along the bay)",
    y: "port → starboard (width)",
    z: "deck → ceiling (height)",
  },
  storageLocations: ["front", "middle", "rear"] as const,
  boxSizesScu: [1, 2, 4, 8] as const,
  note: "Do not invent grid sizes. Prefer these sketches when packing; ships without a sketch have no bay geometry yet.",
};

function presentSession(session: SessionChecklistModel) {
  const startSlug = session.startLocationSlug;
  const startLoc = startSlug ? getLocationBySlug(startSlug) : null;
  return {
    id: session.id,
    sessionId: session.id,
    sessionName: session.sessionName,
    ships: presentShips(session.shipSlugs),
    totalShipCargoScu: sumShipCargoScu(session.shipSlugs),
    startLocation: startSlug
      ? {
          slug: startSlug,
          name: startLoc?.name ?? startSlug,
          parentName: startLoc?.parentName ?? null,
          type: startLoc?.type ?? null,
        }
      : null,
    missionCount: session.missionCount,
    missionsCompleted: session.missionsCompleted,
    missions: session.missions ?? [],
    startedAt: session.startedAt,
    completedAt: session.completedAt,
    updatedAt: session.updatedAt,
    totalTime: formatSessionDuration(getSessionElapsedMs(session)),
    rows: session.rows.map((row) => ({
      id: row.id,
      legKind: row.legKind,
      locationSlug: row.locationSlug,
      locationName: getLocationBySlug(row.locationSlug)?.name ?? row.locationSlug,
      cargo: formatCargoDeliveries(
        row.cargoDeliveries,
        row.legKind === "both" ? null : row.legKind,
      ),
      cargoDeliveries: row.cargoDeliveries.map((line) => ({
        commoditySlug: line.commoditySlug,
        commodityName:
          getCommodityBySlug(line.commoditySlug)?.name ?? line.commoditySlug,
        scu: line.scu,
        role: line.role,
        shipStorageLocation:
          line.shipStorageLocation ?? row.shipStorageLocation,
      })),
      scuTotal: sumCargoScu(row.cargoDeliveries),
      shipStorageLocation: row.shipStorageLocation,
      shipStorageLocationLabel:
        shipStorageLocationLabels[row.shipStorageLocation],
      shipStorageLines: describeShipStorageLines(row),
      distanceToNext: row.distanceToNext,
      isCompleted: row.isCompleted,
    })),
  };
}

function textResult(payload: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

async function resolveTargetSession(sessionId?: string | null) {
  try {
    return await getChecklistSession(sessionId);
  } catch (error) {
    return null;
  }
}

export async function toolListHaulingSessions() {
  const list = await listChecklistSessions();
  return textResult({
    activeSessionId: list.activeSessionId,
    sessions: list.sessions,
    note: "Pass sessionId on write tools to target a tab; omit to use activeSessionId.",
  });
}

export async function toolCreateHaulingSession(input?: {
  sessionName?: string;
  activate?: boolean;
}) {
  const session = await createChecklistSession({
    sessionName: input?.sessionName,
    activate: input?.activate !== false,
  });
  return textResult({
    ok: true,
    message: `Created session ${session.id}${input?.activate === false ? "" : " (active)"}.`,
    session: presentSession(session),
  });
}

export async function toolSetActiveHaulingSession(sessionId: string) {
  try {
    const session = await setActiveChecklistSession(sessionId);
    return textResult({
      ok: true,
      message: `Active session is now ${session.id}.`,
      session: presentSession(session),
    });
  } catch (error) {
    return textResult({
      error: error instanceof Error ? error.message : "Failed to set active session",
    });
  }
}

export async function toolGetHaulingChecklist(sessionId?: string | null) {
  const session = await resolveTargetSession(sessionId);
  if (!session) {
    return textResult({ error: `Unknown session id: ${sessionId}` });
  }
  return textResult(presentSession(session));
}

export async function toolSetSessionName(
  sessionName: string,
  sessionId?: string | null,
) {
  try {
    const session = await setSessionName(sessionName, sessionId);
    return textResult(presentSession(session));
  } catch (error) {
    return textResult({
      error: error instanceof Error ? error.message : "Failed to set session name",
    });
  }
}

export async function toolSetSessionShips(
  ships: string[],
  sessionId?: string | null,
) {
  const resolved = resolveShipSlugs(ships);
  if (!resolved.ok) {
    return textResult({ error: resolved.error });
  }
  try {
    const session = await setSessionShips(resolved.shipSlugs, sessionId);
    return textResult({
      ok: true,
      message: `Set ${resolved.shipSlugs.length} ship(s) on session ${session.id}.`,
      session: presentSession(session),
    });
  } catch (error) {
    return textResult({
      error: error instanceof Error ? error.message : "Failed to set ships",
    });
  }
}

export async function toolSetSessionStartLocation(
  location: string | null,
  sessionId?: string | null,
) {
  try {
    if (location == null || !location.trim()) {
      const session = await setSessionStartLocation(null, sessionId);
      return textResult({
        ok: true,
        message: "Cleared session start location.",
        session: presentSession(session),
      });
    }
    const slug = resolveLocationSlug(location);
    if (!slug) {
      return textResult({ error: `Unknown location: ${location}` });
    }
    const session = await setSessionStartLocation(slug, sessionId);
    return textResult({
      ok: true,
      message: `Set start location to ${getLocationBySlug(slug)?.name ?? slug}.`,
      session: presentSession(session),
    });
  } catch (error) {
    return textResult({
      error:
        error instanceof Error ? error.message : "Failed to set start location",
    });
  }
}

export async function toolReplaceHaulingChecklist(input: {
  sessionId?: string | null;
  sessionName?: string;
  ships?: string[];
  legs: IncomingLeg[];
  resetTimer?: boolean;
  missionCount?: number;
  missionsCompleted?: number;
  missions?: SessionChecklistModel["missions"];
}) {
  const rows = [];
  for (const [index, leg] of input.legs.entries()) {
    const resolved = resolveIncomingLeg(leg, index);
    if (!resolved.ok) {
      return textResult({ error: resolved.error });
    }
    rows.push(resolved.row);
  }

  let shipSlugs: string[] | undefined;
  if (input.ships) {
    const resolvedShips = resolveShipSlugs(input.ships);
    if (!resolvedShips.ok) {
      return textResult({ error: resolvedShips.error });
    }
    shipSlugs = resolvedShips.shipSlugs;
  }

  try {
    const session = await replaceChecklistRows(rows, input.sessionName, {
      sessionId: input.sessionId,
      resetTimer: input.resetTimer,
      shipSlugs,
      missionCount: input.missionCount,
      missionsCompleted: input.missionsCompleted,
      missions: input.missions,
    });

    return textResult({
      ok: true,
      message: `Replaced checklist on session ${session.id} with ${rows.length} leg(s).`,
      session: presentSession(session),
    });
  } catch (error) {
    return textResult({
      error:
        error instanceof Error ? error.message : "Failed to replace checklist",
    });
  }
}

/**
 * Apply accepted `hauling_contracts_intake` JSON.
 * Uses optional `legs` when provided; otherwise auto-merges contracts into stops.
 */
export async function toolApplyHaulingContractsIntake(
  intake: HaulingContractsIntake & {
    legs?: IncomingLeg[];
    sessionId?: string | null;
  },
) {
  if (!intake.sessionName?.trim()) {
    return textResult({ error: "sessionName is required" });
  }
  if (!Array.isArray(intake.contracts) || intake.contracts.length === 0) {
    return textResult({ error: "contracts must include at least one contract" });
  }

  let legs: IncomingLeg[];
  if (Array.isArray(intake.legs) && intake.legs.length > 0) {
    legs = intake.legs;
  } else {
    const built = buildRouteFromIntake(intake);
    if (!built.ok) {
      return textResult({ error: built.error });
    }
    legs = built.legs;
  }

  const builtMissions = await buildSessionMissionsFromIntake(intake.contracts);
  const missions = await linkSessionMissionsToCatalog(
    builtMissions,
    intake.startLocation ?? null,
  );

  const replaced = await toolReplaceHaulingChecklist({
    sessionId: intake.sessionId,
    sessionName: intake.sessionName,
    ships: intake.ships,
    legs,
    resetTimer: intake.resetTimer !== false,
    missionCount: missions.length,
    missionsCompleted: intake.resetTimer !== false ? 0 : undefined,
    missions,
  });

  if (intake.startLocation != null && intake.startLocation.trim()) {
    const start = await toolSetSessionStartLocation(
      intake.startLocation,
      intake.sessionId,
    );
    return start;
  }

  return replaced;
}

export async function toolSetLegCompleted(input: {
  rowId: string;
  isCompleted: boolean;
  sessionId?: string | null;
}) {
  try {
    const session = await getChecklistSession(input.sessionId);
    if (!session.rows.some((row) => row.id === input.rowId)) {
      return textResult({ error: `Unknown row id: ${input.rowId}` });
    }
    const next = await setLegCompleted(
      input.rowId,
      input.isCompleted,
      input.sessionId,
    );
    return textResult(presentSession(next));
  } catch (error) {
    return textResult({
      error: error instanceof Error ? error.message : "Failed to set leg",
    });
  }
}

export function toolSearchLocations(query: string, limit = 10) {
  return textResult({
    results: searchLocations(query, limit).map((loc) => ({
      slug: loc.slug,
      name: loc.name,
      type: loc.type,
      system: loc.system,
      parentName: loc.parentName,
    })),
  });
}

export function toolSearchCommodities(query: string, limit = 10) {
  return textResult({
    results: searchCommodities(query, limit).map((c) => ({
      slug: c.slug,
      name: c.name,
      code: c.code,
      kind: c.kind,
    })),
  });
}

export function toolSearchShips(query: string, limit = 10) {
  return textResult({
    results: searchShips(query, limit).map((ship) => ({
      slug: ship.slug,
      name: ship.name,
      nameFull: ship.nameFull,
      manufacturer: ship.manufacturer,
      cargoScu: ship.cargoScu,
      isCargo: ship.isCargo,
      hasCargoGridSketch: Boolean(getCargoGridSketchBySlug(ship.slug)),
    })),
  });
}

/**
 * Bay geometry + packing-rule summaries for AI guidance.
 * Prefer session ships; optional shipSlug/name looks up one sketch directly.
 */
export async function toolGetSessionCargoGrid(input?: {
  sessionId?: string | null;
  ship?: string | null;
}) {
  const placementRules = cargoPlacementRules.map((rule) => ({
    id: rule.id,
    summary: rule.summary,
  }));
  const knownSketches = cargoGridSketches.map(presentCargoGridSketch);

  const shipQuery = input?.ship?.trim();
  if (shipQuery) {
    const resolved = resolveShipSlugs([shipQuery]);
    if (!resolved.ok) {
      return textResult({
        error: resolved.error,
        coordinateSystem: cargoGridCoordinateSystem,
        placementRules,
        knownSketches,
      });
    }
    const slug = resolved.shipSlugs[0] ?? null;
    const sketch = getCargoGridSketchBySlug(slug);
    if (!sketch) {
      return textResult({
        ok: false,
        shipSlug: slug,
        error: `No cargo-grid sketch for ${slug}. Known sketches: ${knownSketches
          .map((entry) => entry.shipSlug)
          .join(", ")}.`,
        coordinateSystem: cargoGridCoordinateSystem,
        placementRules,
        knownSketches,
      });
    }
    return textResult({
      ok: true,
      source: "ship",
      shipSlug: slug,
      grid: presentCargoGridSketch(sketch),
      coordinateSystem: cargoGridCoordinateSystem,
      placementRules,
      knownSketches,
    });
  }

  const session = await resolveTargetSession(input?.sessionId);
  if (!session) {
    return textResult({
      error: input?.sessionId
        ? `Unknown session id: ${input.sessionId}`
        : "No active hauling session",
      coordinateSystem: cargoGridCoordinateSystem,
      placementRules,
      knownSketches,
    });
  }

  const ships = presentShips(session.shipSlugs);
  const grids = session.shipSlugs.flatMap((slug) => {
    const sketch = getCargoGridSketchBySlug(slug);
    return sketch ? [presentCargoGridSketch(sketch)] : [];
  });
  const missingSketches = session.shipSlugs.filter(
    (slug) => !getCargoGridSketchBySlug(slug),
  );

  return textResult({
    ok: true,
    source: "session",
    sessionId: session.id,
    ships,
    grids,
    missingSketches,
    message:
      grids.length > 0
        ? `Found ${grids.length} cargo-grid sketch(es) for session ships.`
        : session.shipSlugs.length === 0
          ? "Session has no ships set. Call set_session_ships or pass ship=."
          : `No sketches for session ships (${missingSketches.join(", ")}). Known: ${knownSketches
              .map((entry) => entry.shipSlug)
              .join(", ")}.`,
    coordinateSystem: cargoGridCoordinateSystem,
    placementRules,
    knownSketches,
  });
}

/** Playbook for screenshot → optimized route → replace_hauling_checklist. */
export async function toolGetHaulingIntakePlaybook() {
  try {
    const markdown = await readFile(PLAYBOOK_PATH, "utf8");
    return {
      content: [{ type: "text" as const, text: markdown }],
    };
  } catch {
    return textResult({
      error:
        "Playbook missing on server. Expected docs/mcp-screenshot-hauling-playbook.md",
    });
  }
}

/** Persist a user/chat screenshot into the ephemeral MCP screenshot store. */
export async function toolStoreHaulingScreenshot(input: {
  imageBase64: string;
  filename?: string;
  batchId?: string;
  contractId?: string;
}) {
  try {
    const stored = await storeHaulingScreenshot(input);
    return textResult({
      ok: true,
      message: `Stored screenshot at ${stored.logicalPath}`,
      ...stored,
      note: "Stored under .data/mcp-screenshots (gitignored). Survives redeploy when Railway mounts a volume at /app/.data.",
    });
  } catch (error) {
    return textResult({
      error: error instanceof Error ? error.message : "Failed to store screenshot",
    });
  }
}

export async function toolListHaulingScreenshots(batchId?: string) {
  const screenshots = await listHaulingScreenshots(batchId);
  return textResult({
    batchId: batchId?.trim() || "default",
    count: screenshots.length,
    screenshots,
    note: "UI uploads use sessionId as batchId. Pass that id here to see app-uploaded shots.",
  });
}

/** Return screenshot bytes (base64) so agents can read UI-uploaded images. */
export async function toolGetHaulingScreenshot(input: {
  logicalPath?: string;
  batchId?: string;
  filename?: string;
}) {
  try {
    const logicalPath =
      input.logicalPath?.trim() ||
      (input.batchId && input.filename
        ? `${input.batchId.trim()}/${input.filename.trim()}`
        : "");
    if (!logicalPath) {
      return textResult({
        error: "Provide logicalPath, or batchId + filename",
      });
    }
    const shot = await readHaulingScreenshot(logicalPath);
    return textResult({
      ok: true,
      logicalPath: shot.logicalPath,
      filename: shot.filename,
      bytes: shot.bytes,
      contentType: shot.contentType,
      imageBase64: shot.imageBase64,
      dataUrl: `data:${shot.contentType};base64,${shot.imageBase64}`,
    });
  } catch (error) {
    return textResult({
      error:
        error instanceof Error ? error.message : "Failed to read screenshot",
    });
  }
}

export async function toolClearHaulingScreenshots(batchId?: string) {
  const result = await clearHaulingScreenshots(batchId);
  return textResult({
    ok: true,
    message: `Removed ${result.removed} screenshot(s) from batch ${result.batchId}.`,
    ...result,
  });
}

function presentCatalogMission(row: Awaited<ReturnType<typeof getCatalogMission>>) {
  if (!row) return null;
  return {
    id: row.id,
    type: row.type,
    fingerprint: row.fingerprint,
    title: row.title,
    contractor: row.contractor,
    rewardAuec: row.rewardAuec,
    offerLocationSlug: row.offerLocationSlug,
    offerLocationName: row.offerLocationSlug
      ? (getLocationBySlug(row.offerLocationSlug)?.name ?? row.offerLocationSlug)
      : null,
    totalScu: row.totalScu,
    maxContainerScu: row.maxContainerScu,
    boxBreakdown: row.boxBreakdown,
    latestScreenshotPath: row.latestScreenshotPath,
    runCount: row.runCount,
    totalDurationMs: row.totalDurationMs,
    avgDurationMs: row.avgDurationMs,
    lastObservedAt: row.lastObservedAt,
    payload: row.payload,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Create or update a catalog mission (fingerprint upsert).
 * `type` selects the payload shape — currently `hauling` only.
 */
export async function toolCreateMission(input: {
  type?: "hauling";
  title: string;
  contractor?: string;
  rewardAuec?: number;
  /** Where the offer was seen / screenshot taken. */
  offerLocation?: string;
  /** Hauling: pickup locations. */
  from?: string[];
  /** Hauling: delivery locations. */
  to?: string[];
  /** Hauling: cargo lines. */
  cargo?: Array<{ commodity: string; scu: number }>;
  maxContainerScu?: number;
  latestScreenshotPath?: string;
  extras?: Record<string, unknown>;
}) {
  const type = input.type ?? "hauling";
  try {
    if (type !== "hauling") {
      return textResult({
        error: `Unsupported mission type: ${type}. Supported: hauling.`,
      });
    }

    if (!input.from?.length || !input.to?.length || !input.cargo?.length) {
      return textResult({
        error: "Hauling missions require from[], to[], and cargo[].",
      });
    }

    const offerLocationSlug = input.offerLocation?.trim()
      ? resolveLocationSlug(input.offerLocation)
      : null;
    if (input.offerLocation?.trim() && !offerLocationSlug) {
      return textResult({
        error: `Unknown offer location: ${input.offerLocation}`,
      });
    }

    const fromLocationSlugs: string[] = [];
    for (const loc of input.from) {
      const slug = resolveLocationSlug(loc);
      if (!slug) return textResult({ error: `Unknown from location: ${loc}` });
      if (!fromLocationSlugs.includes(slug)) fromLocationSlugs.push(slug);
    }
    const toLocationSlugs: string[] = [];
    for (const loc of input.to) {
      const slug = resolveLocationSlug(loc);
      if (!slug) return textResult({ error: `Unknown to location: ${loc}` });
      if (!toLocationSlugs.includes(slug)) toLocationSlugs.push(slug);
    }

    const cargo: Array<{
      commoditySlug: string;
      commodityName: string;
      scu: number;
    }> = [];
    for (const line of input.cargo) {
      const commoditySlug = resolveCommoditySlug(line.commodity);
      if (!commoditySlug) {
        return textResult({ error: `Unknown commodity: ${line.commodity}` });
      }
      cargo.push({
        commoditySlug,
        commodityName:
          getCommodityBySlug(commoditySlug)?.name ?? commoditySlug,
        scu: line.scu,
      });
    }

    const row = await upsertCatalogMission({
      type: "hauling",
      payload: {
        title: input.title,
        contractor: input.contractor ?? null,
        rewardAuec: input.rewardAuec ?? null,
        offerLocationSlug,
        fromLocationSlugs,
        toLocationSlugs,
        cargo,
        maxContainerScu: input.maxContainerScu ?? null,
        latestScreenshotPath: input.latestScreenshotPath ?? null,
        extras: input.extras,
      },
    });

    return textResult({
      ok: true,
      message: `Saved ${row.type} mission ${row.id} (${row.title}).`,
      mission: presentCatalogMission(row),
    });
  } catch (error) {
    return textResult({
      error:
        error instanceof Error ? error.message : "Failed to create mission",
    });
  }
}

export async function toolListMissions(input?: {
  offerLocation?: string;
  type?: "hauling";
  limit?: number;
}) {
  try {
    let offerLocationSlug: string | null | undefined;
    if (input?.offerLocation?.trim()) {
      offerLocationSlug = resolveLocationSlug(input.offerLocation);
      if (!offerLocationSlug) {
        return textResult({
          error: `Unknown offer location: ${input.offerLocation}`,
        });
      }
    }
    const rows = await listCatalogMissions({
      offerLocationSlug,
      type: input?.type,
      limit: input?.limit,
    });
    return textResult({
      count: rows.length,
      missions: rows.map((row) => presentCatalogMission(row)),
    });
  } catch (error) {
    return textResult({
      error:
        error instanceof Error ? error.message : "Failed to list missions",
    });
  }
}

export async function toolGetMission(missionId: string) {
  try {
    const row = await getCatalogMission(missionId);
    if (!row) {
      return textResult({ error: `Unknown mission: ${missionId}` });
    }
    const notes = await listCatalogMissionNotes(missionId);
    return textResult({
      ok: true,
      mission: presentCatalogMission(row),
      notes,
    });
  } catch (error) {
    return textResult({
      error: error instanceof Error ? error.message : "Failed to get mission",
    });
  }
}

export async function toolAddMissionNote(input: {
  missionId: string;
  body: string;
  sentiment?: CatalogMissionNoteSentiment;
}) {
  try {
    const note = await addCatalogMissionNote(input);
    return textResult({
      ok: true,
      message: `Added note ${note.id}`,
      note,
    });
  } catch (error) {
    return textResult({
      error: error instanceof Error ? error.message : "Failed to add note",
    });
  }
}

export async function toolRecordMissionRun(input: {
  missionId: string;
  durationMs: number;
  offerLocation?: string;
  deliverySessionId?: string;
}) {
  try {
    let offerLocationSlug: string | null = null;
    if (input.offerLocation?.trim()) {
      offerLocationSlug = resolveLocationSlug(input.offerLocation);
      if (!offerLocationSlug) {
        return textResult({
          error: `Unknown offer location: ${input.offerLocation}`,
        });
      }
    }
    const result = await recordCatalogMissionRun({
      missionId: input.missionId,
      durationMs: input.durationMs,
      offerLocationSlug,
      deliverySessionId: input.deliverySessionId ?? null,
    });
    return textResult({
      ok: true,
      message: `Recorded run; avgDurationMs=${result.mission.avgDurationMs}`,
      run: result.run,
      mission: presentCatalogMission(result.mission),
    });
  } catch (error) {
    return textResult({
      error: error instanceof Error ? error.message : "Failed to record run",
    });
  }
}
