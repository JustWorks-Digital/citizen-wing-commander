import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  addCatalogMissionNote,
  backfillCatalogMissionVariants,
  getCatalogMission,
  listCatalogMissionNotes,
  listCatalogMissionVariants,
  listCatalogMissions,
  recordCatalogMissionRun,
  upsertCatalogMission,
} from "@/db/queries/catalogMissions";
import {
  formatCargoDeliveries,
  getCommodityBySlug,
  getContractorBySlug,
  getLocationBySlug,
  getShipBySlug,
  getStarSystemBySlug,
  sumCargoScu,
  sumShipCargoScu,
} from "@/lib/fixtures";
import {
  cargoFromScuSplits,
  locationsFromScuSplits,
  normalizeCatalogRewards,
  objectivesFromScuSplits,
  type CatalogMissionReward,
  type CatalogMissionScuSplit,
  type HaulingCatalogMissionPayload,
} from "@/lib/missions/catalogMission";
import { normalizeHaulingCategory } from "@/lib/missions/haulingCategory";
import { normalizeMissionRank } from "@/lib/missions/missionRank";
import { renameAllCatalogMissionScreenshots } from "@/lib/missions/renameCatalogScreenshot";
import { normalizeStarSystemSlug } from "@/lib/missions/starSystem";
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
  saveChecklistSession,
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
  resolveHaulingScreenshotBytes,
  storeHaulingScreenshotBuffer,
} from "@/lib/sessions/screenshotStore";
import { buildRouteFromIntake } from "@/lib/sessions/buildRouteFromIntake";
import {
  resolveCommoditySlug,
  resolveContractorSlug,
  resolveIncomingLeg,
  resolveLocationSlug,
  resolveShipSlugs,
  searchCommodities,
  searchContractors,
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
import {
  listResolvedShipBayPreferences,
  resolveShipBayPreferences,
  updateShipBayPreferences,
} from "@/lib/ships/resolveShipBayPreferences";
import type { ShipBayPreferencePayload } from "@/lib/ships/shipBayPreferences";
import {
  compilePackProgramForMode,
  derivePackStrategy,
  type CargoBayPackProgram,
} from "@/lib/ships/cargoBayPackProgram";
import { packBaysFromSketch } from "@/lib/ships/packBaysFromSketch";
import { planStopOccupancyAtStop } from "@/lib/ships/planStopOccupancy";
import { getShipBayPreferenceFixture } from "@/lib/ships/shipBayPreferences";
import { placementPlanLegend } from "@/lib/ships/cargoGridPlacement";

const PLAYBOOK_PATH = path.join(
  process.cwd(),
  "docs/mcp-screenshot-hauling-playbook.md",
);

const AI_PROFILE_PATH = path.join(process.cwd(), "docs/mcp-ai-profile.md");

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

type McpTextResult = ReturnType<typeof textResult>;

/** Merge fields into a successful tool JSON payload (leave error responses alone). */
function mergeTextResult(
  result: McpTextResult,
  extra: Record<string, unknown>,
): McpTextResult {
  const block = result.content[0];
  if (!block || block.type !== "text") return textResult(extra);
  try {
    const parsed = JSON.parse(block.text) as Record<string, unknown>;
    if (typeof parsed.error === "string") return result;
    return textResult({ ...parsed, ...extra });
  } catch {
    return result;
  }
}

/**
 * Soft gate: screenshots stay optional in the schema, but missing paths get a
 * loud warning so agents attach evidence when the user had images.
 */
function sessionScreenshotSoftGate(
  contracts: HaulingContractsIntake["contracts"],
): Record<string, unknown> {
  const contractsWithoutScreenshots = contracts
    .map((contract, index) => ({
      key:
        contract.id?.trim() ||
        contract.title?.trim() ||
        `contracts[${index}]`,
      hasShots:
        Array.isArray(contract.screenshots) &&
        contract.screenshots.some((path) => path.trim().length > 0),
    }))
    .filter((row) => !row.hasShots)
    .map((row) => row.key);

  if (contractsWithoutScreenshots.length === 0) {
    return { screenshotsMissing: false };
  }

  return {
    screenshotsMissing: true,
    contractsWithoutScreenshots,
    warning:
      "SCREENSHOTS MISSING: one or more contracts have empty/omitted screenshots[]. If the user attached images, you MUST call store_hauling_screenshot (prefer fileUrl; sessionId + missionId auto-attaches) or set_mission_screenshots. Omit screenshots only when the user provided no images.",
    next: "store_hauling_screenshot (fileUrl + sessionId + missionId) or set_mission_screenshots",
  };
}

function catalogScreenshotSoftGate(
  latestScreenshotPath?: string | null,
): Record<string, unknown> {
  if (latestScreenshotPath?.trim()) {
    return { screenshotsMissing: false };
  }
  return {
    screenshotsMissing: true,
    warning:
      "SCREENSHOT MISSING: latestScreenshotPath was omitted. If the user attached an image for this mission, you MUST call store_hauling_screenshot and re-call create_mission with latestScreenshotPath set to the returned logicalPath. Omit only when the user provided no image.",
    next: "store_hauling_screenshot → create_mission (same fields + latestScreenshotPath)",
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

  const screenshotGate = sessionScreenshotSoftGate(intake.contracts);

  if (intake.startLocation != null && intake.startLocation.trim()) {
    const start = await toolSetSessionStartLocation(
      intake.startLocation,
      intake.sessionId,
    );
    return mergeTextResult(start, screenshotGate);
  }

  return mergeTextResult(replaced, screenshotGate);
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

export function toolSearchContractors(query: string, limit = 10) {
  return textResult({
    results: searchContractors(query, limit).map((contractor) => ({
      slug: contractor.slug,
      name: contractor.name,
      aliases: contractor.aliases,
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
    const bayPreferences = slug
      ? await resolveShipBayPreferences(slug)
      : null;
    if (!sketch) {
      return textResult({
        ok: false,
        shipSlug: slug,
        error: `No cargo-grid sketch for ${slug}. Known sketches: ${knownSketches
          .map((entry) => entry.shipSlug)
          .join(", ")}.`,
        coordinateSystem: cargoGridCoordinateSystem,
        placementRules,
        bayPreferences,
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
      bayPreferences,
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
  const bayPreferences = await Promise.all(
    session.shipSlugs.map((slug) => resolveShipBayPreferences(slug)),
  );

  return textResult({
    ok: true,
    source: "session",
    sessionId: session.id,
    ships,
    grids,
    bayPreferences,
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

/** Standing AI brief: Star Citizen context, tone, and how to use this product. */
export async function toolGetAiProfile() {
  try {
    const markdown = await readFile(AI_PROFILE_PATH, "utf8");
    return {
      content: [{ type: "text" as const, text: markdown }],
    };
  } catch {
    return textResult({
      error: "AI profile missing on server. Expected docs/mcp-ai-profile.md",
    });
  }
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

/**
 * Persist a user/chat screenshot into the ephemeral MCP screenshot store.
 * Prefer `fileUrl` (server downloads) when the client cannot send base64.
 * Optional `missionId` attaches the stored path onto that session mission.
 */
export async function toolStoreHaulingScreenshot(input: {
  imageBase64?: string;
  fileUrl?: string;
  filePath?: string;
  filename?: string;
  batchId?: string;
  sessionId?: string | null;
  missionId?: string;
  contractId?: string;
  /** When missionId is set: append (default) or replace mission.screenshots. */
  attachMode?: "append" | "replace";
}) {
  try {
    const resolved = await resolveHaulingScreenshotBytes({
      imageBase64: input.imageBase64,
      fileUrl: input.fileUrl,
      filePath: input.filePath,
    });
    const batchId =
      input.batchId?.trim() ||
      input.sessionId?.trim() ||
      undefined;
    const stored = await storeHaulingScreenshotBuffer({
      batchId,
      filename: input.filename?.trim() || resolved.suggestedFilename,
      buffer: resolved.buffer,
      ext: resolved.ext,
      contractId: input.contractId,
    });

    let attached: {
      missionId: string;
      screenshots: string[];
      sessionId: string;
    } | null = null;

    const missionId = input.missionId?.trim() || "";
    if (missionId) {
      const session = await getChecklistSession(input.sessionId ?? batchId);
      const missions = session.missions ?? [];
      if (!missions.some((mission) => mission.id === missionId)) {
        return textResult({
          ok: true,
          stored: true,
          attached: false,
          message: `Stored screenshot at ${stored.logicalPath}, but mission was not found for attach`,
          ...stored,
          sourceKind: resolved.sourceKind,
          error: `Unknown mission id: ${missionId}`,
          knownMissionIds: missions.map((mission) => mission.id),
          note: "File is saved. Call set_mission_screenshots with this logicalPath once you have the correct missionId.",
        });
      }
      const mode = input.attachMode === "replace" ? "replace" : "append";
      const nextMissions = missions.map((mission) => {
        if (mission.id !== missionId) return mission;
        const previous = mission.screenshots ?? [];
        const screenshots =
          mode === "replace"
            ? [stored.logicalPath]
            : [
                ...previous.filter((path) => path !== stored.logicalPath),
                stored.logicalPath,
              ];
        return { ...mission, screenshots };
      });
      const next = await saveChecklistSession({
        ...session,
        missions: nextMissions,
      });
      const updated = (next.missions ?? []).find(
        (mission) => mission.id === missionId,
      );
      attached = {
        missionId,
        sessionId: next.id,
        screenshots: updated?.screenshots ?? [stored.logicalPath],
      };
    }

    return textResult({
      ok: true,
      message: attached
        ? `Stored screenshot at ${stored.logicalPath} and attached to mission ${attached.missionId}`
        : `Stored screenshot at ${stored.logicalPath}`,
      ...stored,
      sourceKind: resolved.sourceKind,
      attached,
      note: attached
        ? "Stored under .data/mcp-screenshots and linked on mission.screenshots."
        : "Stored under .data/mcp-screenshots (gitignored). Pass missionId to auto-attach, or call set_mission_screenshots. Prefer fileUrl over imageBase64 for ChatGPT.",
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

/**
 * Attach screenshot logical paths to an existing session mission.
 * Does not rebuild route rows — only updates `mission.screenshots`.
 */
export async function toolSetMissionScreenshots(input: {
  missionId: string;
  screenshots: string[];
  sessionId?: string | null;
}) {
  try {
    const session = await getChecklistSession(input.sessionId);
    const missionId = input.missionId.trim();
    const paths = (input.screenshots ?? [])
      .map((path) => path.trim())
      .filter(Boolean);
    const missions = (session.missions ?? []).map((mission) =>
      mission.id === missionId
        ? { ...mission, screenshots: [...paths] }
        : mission,
    );
    if (!(session.missions ?? []).some((mission) => mission.id === missionId)) {
      return textResult({
        error: `Unknown mission id: ${missionId}`,
        knownMissionIds: (session.missions ?? []).map((mission) => mission.id),
      });
    }
    const next = await saveChecklistSession({
      ...session,
      missions,
    });
    const updated = (next.missions ?? []).find(
      (mission) => mission.id === missionId,
    );
    return textResult({
      ok: true,
      sessionId: next.id,
      missionId,
      screenshots: updated?.screenshots ?? paths,
      note: "Route/checklist rows unchanged. Contract source UI reads mission.screenshots.",
    });
  } catch (error) {
    return textResult({
      error:
        error instanceof Error
          ? error.message
          : "Failed to set mission screenshots",
    });
  }
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

function presentCatalogMissionVariantSummary(
  row: NonNullable<Awaited<ReturnType<typeof getCatalogMission>>>,
) {
  return {
    id: row.id,
    scuTotal: row.scuTotal,
    rewards: row.rewards,
    latestScreenshotPath: row.latestScreenshotPath,
    lastObservedAt: row.lastObservedAt,
  };
}

function presentCatalogMission(
  row: Awaited<ReturnType<typeof getCatalogMission>>,
) {
  if (!row) return null;
  return {
    id: row.id,
    type: row.type,
    fingerprint: row.fingerprint,
    variantGroupId: row.variantGroupId,
    variantFamilyKey: row.variantFamilyKey,
    title: row.title,
    rank: row.rank,
    contractorSlug: row.contractorSlug,
    contractorName: row.contractorSlug
      ? (getContractorBySlug(row.contractorSlug)?.name ?? row.contractorSlug)
      : null,
    rewards: row.rewards,
    offerLocationSlug: row.offerLocationSlug,
    offerLocationName: row.offerLocationSlug
      ? (getLocationBySlug(row.offerLocationSlug)?.name ?? row.offerLocationSlug)
      : null,
    offerStarSystemSlug: row.offerStarSystemSlug,
    offerStarSystemName: row.offerStarSystemSlug
      ? (getStarSystemBySlug(row.offerStarSystemSlug)?.name ??
        row.offerStarSystemSlug)
      : null,
    scuTotal: row.scuTotal,
    scuMaxContainerSize: row.scuMaxContainerSize,
    scuBoxSplits: row.scuBoxSplits,
    scuLocationSplits: row.scuLocationSplits,
    category:
      (row.payload as HaulingCatalogMissionPayload | null)?.category ?? null,
    latestScreenshotPath: row.latestScreenshotPath,
    missionRunCount: row.missionRunCount,
    missionTotalDurationMs: row.missionTotalDurationMs,
    missionAvgDurationMs: row.missionAvgDurationMs,
    lastObservedAt: row.lastObservedAt,
    payload: row.payload,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function presentCatalogMissionWithVariants(
  row: NonNullable<Awaited<ReturnType<typeof getCatalogMission>>>,
) {
  const variants = await listCatalogMissionVariants(row.variantGroupId);
  return {
    ...presentCatalogMission(row),
    variants: variants.map(presentCatalogMissionVariantSummary),
  };
}

/**
 * Create or update a catalog mission (fingerprint upsert).
 * `type` selects the payload shape — currently `hauling` only.
 */
export async function toolCreateMission(input: {
  type?: "hauling";
  title: string;
  /** Hauling career rank (Trainee…Master). Extracted from title when omitted. */
  rank?: string;
  contractor?: string;
  /**
   * Payout lines. Prefer over rewardAuec.
   * Hauling: usually [{ kind: "auec", amount }]. Blueprint for other mission types.
   */
  rewards?: CatalogMissionReward[];
  /** @deprecated Prefer rewards: [{ kind: "auec", amount }] */
  rewardAuec?: number;
  /** Where the offer was seen / screenshot taken. */
  offerLocation?: string;
  /** Star system where the offer was seen (Stanton / Pyro / Nyx). */
  offerStarSystem?: string;
  /** Hauling: pickup locations. */
  from?: string[];
  /** Hauling: delivery locations. */
  to?: string[];
  /** Hauling: cargo lines. */
  cargo?: Array<{ commodity: string; scu: number }>;
  /**
   * Hauling: structured per-stop SCU amounts (sibling of scuTotal).
   * Prefer for multi-stop contracts; cargo/from/to can be derived.
   */
  scuSplits?: Array<{
    kind?: "deliver" | "collect";
    from: string;
    to: string;
    commodity: string;
    scu: number;
  }>;
  /** SCU totals per location: `{ from: { slug: scu }, to: { slug: scu } }`. */
  scuLocationSplits?: {
    from: Record<string, number>;
    to: Record<string, number>;
  };
  /**
   * Screenshot-style Primary Objectives bullets (plain text).
   * When omitted and scuSplits are present, derived automatically.
   */
  objectives?: string[];
  /** MobiGlas Category: Local / Planetary / Stellar / Interstellar (or full "Hauling - …"). */
  category?: string;
  /**
   * Join this catalog mission’s variant group when SCU totals differ.
   * Same SCU (+ route/commodities) still upserts by fingerprint; aUEC-only diffs stay one row.
   */
  variantOf?: string;
  scuMaxContainerSize?: number;
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

    const offerLocationSlug = input.offerLocation?.trim()
      ? resolveLocationSlug(input.offerLocation)
      : null;
    if (input.offerLocation?.trim() && !offerLocationSlug) {
      return textResult({
        error: `Unknown offer location: ${input.offerLocation}`,
      });
    }

    const offerStarSystemSlug = input.offerStarSystem?.trim()
      ? normalizeStarSystemSlug(input.offerStarSystem)
      : null;
    if (input.offerStarSystem?.trim() && !offerStarSystemSlug) {
      return textResult({
        error: `Unknown offer star system: ${input.offerStarSystem}. Live fixtures: Stanton, Pyro, Nyx.`,
      });
    }

    const contractorSlug = input.contractor?.trim()
      ? resolveContractorSlug(input.contractor)
      : null;
    if (input.contractor?.trim() && !contractorSlug) {
      return textResult({
        error: `Unknown contractor: ${input.contractor}. Prefer search_contractors first.`,
      });
    }

    const scuSplits: CatalogMissionScuSplit[] = [];
    for (const line of input.scuSplits ?? []) {
      const fromLocationSlug = resolveLocationSlug(line.from);
      if (!fromLocationSlug) {
        return textResult({ error: `Unknown scuSplit from: ${line.from}` });
      }
      const toLocationSlug = resolveLocationSlug(line.to);
      if (!toLocationSlug) {
        return textResult({ error: `Unknown scuSplit to: ${line.to}` });
      }
      const commoditySlug = resolveCommoditySlug(line.commodity);
      if (!commoditySlug) {
        return textResult({
          error: `Unknown scuSplit commodity: ${line.commodity}`,
        });
      }
      scuSplits.push({
        kind: line.kind ?? "deliver",
        fromLocationSlug,
        toLocationSlug,
        commoditySlug,
        commodityName:
          getCommodityBySlug(commoditySlug)?.name ?? commoditySlug,
        scu: line.scu,
      });
    }

    let fromLocationSlugs: string[] = [];
    for (const loc of input.from ?? []) {
      const slug = resolveLocationSlug(loc);
      if (!slug) return textResult({ error: `Unknown from location: ${loc}` });
      if (!fromLocationSlugs.includes(slug)) fromLocationSlugs.push(slug);
    }
    let toLocationSlugs: string[] = [];
    for (const loc of input.to ?? []) {
      const slug = resolveLocationSlug(loc);
      if (!slug) return textResult({ error: `Unknown to location: ${loc}` });
      if (!toLocationSlugs.includes(slug)) toLocationSlugs.push(slug);
    }

    let cargo: Array<{
      commoditySlug: string;
      commodityName: string;
      scu: number;
    }> = [];
    for (const line of input.cargo ?? []) {
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

    if (scuSplits.length > 0) {
      if (cargo.length === 0) cargo = cargoFromScuSplits(scuSplits);
      const derived = locationsFromScuSplits(scuSplits);
      if (fromLocationSlugs.length === 0) {
        fromLocationSlugs = derived.fromLocationSlugs;
      }
      if (toLocationSlugs.length === 0) {
        toLocationSlugs = derived.toLocationSlugs;
      }
    }

    if (!fromLocationSlugs.length || !toLocationSlugs.length || !cargo.length) {
      return textResult({
        error:
          "Hauling missions require from/to/cargo, or scuSplits[] that can derive them.",
      });
    }

    const objectives =
      input.objectives !== undefined
        ? input.objectives
        : scuSplits.length > 0
          ? objectivesFromScuSplits(
              scuSplits,
              (slug) => getLocationBySlug(slug)?.name ?? slug,
            )
          : undefined;

    const row = await upsertCatalogMission({
      type: "hauling",
      variantOfMissionId: input.variantOf,
      payload: {
        title: input.title,
        rank: normalizeMissionRank(input.rank) ?? undefined,
        category: normalizeHaulingCategory(input.category),
        contractorSlug,
        rewards: normalizeCatalogRewards(input.rewards, input.rewardAuec),
        offerLocationSlug,
        offerStarSystemSlug,
        fromLocationSlugs,
        toLocationSlugs,
        cargo,
        scuSplits:
          input.scuSplits !== undefined ? scuSplits : undefined,
        scuLocationSplits: input.scuLocationSplits,
        objectives,
        scuMaxContainerSize: input.scuMaxContainerSize ?? null,
        latestScreenshotPath: input.latestScreenshotPath ?? null,
        extras: input.extras,
      },
    });

    return textResult({
      ok: true,
      message: `Saved ${row.type} mission ${row.id} (${row.title}).`,
      mission: await presentCatalogMissionWithVariants(row),
      ...catalogScreenshotSoftGate(input.latestScreenshotPath),
    });
  } catch (error) {
    return textResult({
      error:
        error instanceof Error ? error.message : "Failed to create mission",
    });
  }
}

/** Recompute family keys and merge SCU-variant groups for existing catalog rows. */
export async function toolBackfillCatalogMissionVariants() {
  try {
    const result = await backfillCatalogMissionVariants();
    return textResult({
      ok: true,
      message: `Updated ${result.updatedFamilyKeys} family key(s); merged ${result.mergedGroups} variant group(s).`,
      ...result,
    });
  } catch (error) {
    return textResult({
      error:
        error instanceof Error
          ? error.message
          : "Failed to backfill catalog mission variants",
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
      mission: await presentCatalogMissionWithVariants(row),
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
      message: `Recorded run; missionAvgDurationMs=${result.mission.missionAvgDurationMs}`,
      run: result.run,
      mission: presentCatalogMission(result.mission),
    });
  } catch (error) {
    return textResult({
      error: error instanceof Error ? error.message : "Failed to record run",
    });
  }
}

export async function toolRenameCatalogScreenshots(input?: {
  dryRun?: boolean;
  limit?: number;
  cleanupDuplicates?: boolean;
}) {
  try {
    const result = await renameAllCatalogMissionScreenshots({
      dryRun: Boolean(input?.dryRun),
      limit: input?.limit ?? 500,
      cleanupDuplicates: input?.cleanupDuplicates !== false,
    });
    return textResult({
      ok: true,
      message: input?.dryRun
        ? `Dry run: ${result.changed} would change, ${result.skipped} already match, ${result.errors.length} errors.`
        : `Renamed/copied/relinked ${result.changed}; skipped ${result.skipped}; duplicatesDeleted ${result.duplicatesDeleted}; errors ${result.errors.length}.`,
      ...result,
    });
  } catch (error) {
    return textResult({
      error:
        error instanceof Error
          ? error.message
          : "Failed to rename catalog screenshots",
    });
  }
}

export async function toolListShipBayPreferences() {
  const items = await listResolvedShipBayPreferences();
  return textResult({
    ok: true,
    priority: "database_over_file",
    note: "Database rows override the committed file fixture for the same shipSlug. File entries are defaults until DB is written.",
    items,
  });
}

export async function toolGetShipBayPreferences(ship: string) {
  const resolved = resolveShipSlugs([ship]);
  if (!resolved.ok) {
    return textResult({ error: resolved.error });
  }
  const shipSlug = resolved.shipSlugs[0]!;
  const prefs = await resolveShipBayPreferences(shipSlug);
  return textResult({
    ok: true,
    priority: "database_over_file",
    ...prefs,
  });
}

export async function toolUpdateShipBayPreferences(input: {
  ship: string;
  notes?: string;
  appendNotes?: boolean;
  preferredZoneOrder?: Array<"front" | "middle" | "rear">;
  preferredRuleIds?: Array<
    | "prefer-flat-layers"
    | "prefer-flat-stable-support"
    | "prefer-back-when-full-height"
  >;
  commodityZoneHints?: Record<string, "front" | "middle" | "rear">;
  guidelines?: string[];
  appendGuidelines?: string[];
}) {
  const resolved = resolveShipSlugs([input.ship]);
  if (!resolved.ok) {
    return textResult({ error: resolved.error });
  }
  const shipSlug = resolved.shipSlugs[0]!;

  const patch: Partial<ShipBayPreferencePayload> & {
    appendGuidelines?: string[];
    replaceNotes?: boolean;
  } = {
    replaceNotes: !input.appendNotes,
  };
  if (typeof input.notes === "string") patch.notes = input.notes;
  if (input.preferredZoneOrder) {
    patch.preferredZoneOrder = input.preferredZoneOrder;
  }
  if (input.preferredRuleIds) patch.preferredRuleIds = input.preferredRuleIds;
  if (input.commodityZoneHints) {
    patch.commodityZoneHints = input.commodityZoneHints;
  }
  if (input.guidelines) patch.guidelines = input.guidelines;
  if (input.appendGuidelines?.length) {
    patch.appendGuidelines = input.appendGuidelines;
  }

  try {
    const prefs = await updateShipBayPreferences({
      shipSlug,
      patch,
      updatedBy: "mcp",
    });
    return textResult({
      ok: true,
      message: `Updated bay preferences for ${shipSlug} (stored in database; file fixture unchanged).`,
      ...prefs,
    });
  } catch (error) {
    return textResult({
      error:
        error instanceof Error
          ? error.message
          : "Failed to update ship bay preferences",
    });
  }
}

/**
 * Compile a Sorting UI preset into an explicit pack-program DSL document.
 * Use this when ChatGPT/UI should emit or inspect the JSON sorting contract.
 */
export async function toolCompileCargoBayPackProgram(input: {
  sessionId?: string;
  ship?: string;
  mode?: "suggested" | "by-cargo-type" | "by-mission-location";
  missionPrioritized?: boolean;
}) {
  const mode = input.mode ?? "by-cargo-type";
  let shipSlug: string | null = null;
  if (input.ship?.trim()) {
    const resolved = resolveShipSlugs([input.ship]);
    if (!resolved.ok) {
      return textResult({ error: resolved.error });
    }
    shipSlug = resolved.shipSlugs[0] ?? null;
    if (!shipSlug) {
      return textResult({ error: `Unknown ship: ${input.ship}` });
    }
  } else {
    const session = await getChecklistSession(input.sessionId);
    shipSlug = session.shipSlugs[0] ?? null;
    if (!shipSlug) {
      return textResult({
        error: "Session has no ships; pass ship= or set_session_ships first.",
      });
    }
  }

  const sketch = getCargoGridSketchBySlug(shipSlug);
  if (!sketch) {
    return textResult({
      error: `No cargo-grid sketch for ${shipSlug}`,
    });
  }

  const biasXyMode =
    mode === "by-cargo-type" && input.missionPrioritized
      ? (getShipBayPreferenceFixture(shipSlug).missionPriorityPacking?.bias ??
        null)
      : null;

  const program = compilePackProgramForMode({
    mode,
    bays: packBaysFromSketch(sketch),
    missionPrioritized: Boolean(input.missionPrioritized),
    biasXyMode,
  });

  return textResult({
    ok: true,
    shipSlug,
    mode,
    strategy: derivePackStrategy(program),
    program,
    note: "Pass program to plan_stop_occupancy_with_pack_program, or emit an equivalent custom program of group/order/stack/require/reserve/bias-xy calls.",
  });
}

/**
 * Plan bay occupancy for the active (or given) stop using a pack-program DSL
 * document, or compile from a Sorting preset when program is omitted.
 */
export async function toolPlanStopOccupancyWithPackProgram(input: {
  sessionId?: string;
  rowId?: string;
  mode?: "suggested" | "by-cargo-type" | "by-mission-location";
  missionPrioritized?: boolean;
  program?: CargoBayPackProgram;
}) {
  const session = await getChecklistSession(input.sessionId);
  const shipSlug = session.shipSlugs[0] ?? null;
  if (!shipSlug) {
    return textResult({ error: "Session has no ships." });
  }
  const sketch = getCargoGridSketchBySlug(shipSlug);
  if (!sketch) {
    return textResult({ error: `No cargo-grid sketch for ${shipSlug}` });
  }

  const activeRow =
    (input.rowId
      ? session.rows.find((row) => row.id === input.rowId)
      : null) ??
    session.rows.find((row) => !row.isCompleted) ??
    session.rows[session.rows.length - 1] ??
    null;
  if (!activeRow) {
    return textResult({ error: "Session has no checklist rows." });
  }

  const plan = planStopOccupancyAtStop(sketch, session.rows, activeRow.id, {
    packMode: input.mode ?? "by-cargo-type",
    missionPrioritized: Boolean(input.missionPrioritized),
    packProgram: input.program,
  });

  return textResult({
    ok: true,
    sessionId: session.id,
    shipSlug,
    rowId: activeRow.id,
    boxCount: plan.boxes.length,
    unplacedCount: plan.unplaced.length,
    unplaced: plan.unplaced,
    legend: placementPlanLegend(plan),
    boxes: plan.boxes.map((box) => ({
      id: box.id,
      size: box.size,
      commoditySlug: box.commoditySlug,
      commodityName: box.commodityName,
      origin: box.origin,
      footprint: box.footprint,
      cells: box.cells,
      action: box.action,
      deliveryLocationSlug: box.deliveryLocationSlug ?? null,
    })),
  });
}
