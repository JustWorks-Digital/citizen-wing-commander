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
  updateCatalogMissionScuBoxSplits,
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
  getLocationShopBySlug,
  listLocationShops,
  resolveLocationShopSlug,
  searchLocationShops,
} from "@/lib/fixtures/locationShops";
import {
  INSERT_AFTER_SESSION_START,
  insertQuantumTravelAfter,
  quantumFromSlugAfter,
  setQuantumTravelReason,
} from "@/lib/missions/quantumTravel";
import {
  breakdownFromBoxSizes,
  formatBreakdownLabel,
} from "@/lib/missions/boxBreakdownOptions";
import { cargoBoxSplits } from "@/lib/missions/cargoBoxSplits";
import {
  clearCatalogMissionLink,
  isCatalogMissionNotFoundError,
} from "@/lib/missions/clearCatalogMissionLink";
import {
  cargoFromScuSplits,
  locationsFromScuSplits,
  normalizeCatalogRewards,
  normalizeScuBoxSplits,
  objectivesFromScuSplits,
  type CatalogMissionReward,
  type CatalogMissionScuSplit,
  type HaulingCatalogMissionPayload,
  type ScuBoxSplits,
} from "@/lib/missions/catalogMission";
import { setMissionScuBoxSplits } from "@/lib/missions/rebuildSessionRoute";
import {
  CARGO_BOX_SCU,
  type CargoBoxScu,
} from "@/lib/ships/cargoBoxSizes";
import { normalizeHaulingCategory } from "@/lib/missions/haulingCategory";
import { normalizeMissionRank } from "@/lib/missions/missionRank";
import { renameAllCatalogMissionScreenshots } from "@/lib/missions/renameCatalogScreenshot";
import { normalizeStarSystemSlug } from "@/lib/missions/starSystem";
import {
  describeShipStorageLines,
  formatSessionDuration,
  getSessionElapsedMs,
  shipStorageLocationLabels,
  type SessionChecklist,
} from "@/lib/missions/sessionChecklist";
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
  markHaulingScreenshotsProcessed,
  readHaulingScreenshot,
  resolveHaulingScreenshotBytes,
  storeHaulingScreenshotBuffer,
  type HaulingScreenshotStatus,
} from "@/lib/sessions/screenshotStore";
import { sessionTripUrl } from "@/lib/sessions/sessionTripUrl";
import {
  listIntakeUploads,
  markIntakeUploadProcessed,
  readIntakeUpload,
} from "@/lib/sessions/intakeUploadStore";
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
import { cargoBay } from "@/lib/ships/cargoBay";
import { getShipBayPreferenceFixture } from "@/lib/ships/shipBayPreferences";
import { placementPlanLegend } from "@/lib/ships/cargoGridPlacement";


import {
  AI_PROFILE_PATH,
  PLAYBOOK_PATH,
  cargoGridCoordinateSystem,
  catalogScreenshotSoftGate,
  mergeTextResult,
  presentCargoGridSketch,
  presentSession,
  presentShips,
  resolveTargetSession,
  sessionScreenshotSoftGate,
  textResult,
} from "./shared";

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
    note: "Pass program to pack_cargo_bay_at_stop, or emit an equivalent custom program of group/order/stack/require/reserve/bias-xy calls.",
  });
}

/**
 * Pack the bay grid for the active (or given) stop using a pack-program DSL
 * document, or compile from a Sorting preset when program is omitted.
 */
export async function toolPackCargoBayAtStop(input: {
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

  const plan = cargoBay.packAtStop(activeRow.id, sketch, session.rows, {
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

/** List shops / facilities at a location (quantum-travel Reason options). */
