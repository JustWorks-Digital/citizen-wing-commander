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
import { validateChecklistTripCargo } from "@/lib/missions/tripPlan";
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


export const PLAYBOOK_PATH = path.join(
  process.cwd(),
  "docs/mcp-screenshot-hauling-playbook.md",
);

export const AI_PROFILE_PATH = path.join(process.cwd(), "docs/mcp-ai-profile.md");

export function presentShips(shipSlugs: string[]) {
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

export function presentCargoGridSketch(sketch: ShipCargoGridSketch) {
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
      heightCells: zone.heightCells ?? sketch.heightCells,
      xStartCells: zone.xStartCells ?? null,
      yStartCells: zone.yStartCells ?? null,
      scu: cargoGridZoneScu(sketch, zone),
    })),
    notes: sketch.notes,
  };
}

export const cargoGridCoordinateSystem = {
  cellSizeScu: 1,
  axes: {
    x: "nose → ramp (length along the bay)",
    y: "port → starboard (width)",
    z: "deck → ceiling (height)",
  },
  storageLocations: ["front", "middle", "rear"] as const,
  boxSizesScu: [1, 2, 4, 8, 16, 32] as const,
  note: "Do not invent grid sizes. Prefer these sketches when packing; ships without a sketch have no bay geometry yet.",
};

/**
 * Soft cargo-causality check (same as UI “Invalid trip plan”).
 * Never blocks a write — callers attach this to MCP responses for AI feedback.
 */
export function presentTripCargoValidation(session: SessionChecklist) {
  const check = validateChecklistTripCargo(
    session.rows,
    session.startLocationSlug ?? null,
  );
  const tripCargoIssues = check.issues.map((issue) => ({
    stopId: issue.stopId,
    locationSlug: issue.locationSlug,
    locationName:
      getLocationBySlug(issue.locationSlug)?.name ?? issue.locationSlug,
    commoditySlug: issue.missing.commoditySlug,
    commodityName:
      getCommodityBySlug(issue.missing.commoditySlug)?.name ??
      issue.missing.commoditySlug,
    neededScu: issue.missing.scu,
    shortfallScu: issue.shortfallScu,
    missionId: issue.missing.missionId,
  }));
  return {
    tripPlanValid: check.ok,
    tripCargoIssues,
    ...(check.ok
      ? {}
      : {
          tripPlanWarning:
            "Soft warning (route was still saved): one or more deliveries need cargo that is not yet aboard at that stop. Prefer fixing legs so each commodity is picked up before it is delivered, unless the player intentionally ordered it this way. The UI shows Invalid trip plan.",
        }),
  };
}

export function presentSession(session: SessionChecklist) {
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
    finishStatus: session.finishStatus ?? null,
    finishFeedback: session.finishFeedback ?? null,
    updatedAt: session.updatedAt,
    totalTime: formatSessionDuration(getSessionElapsedMs(session)),
    rows: session.rows.map((row) => ({
      id: row.id,
      routeAction: row.routeAction,
      locationSlug: row.locationSlug,
      locationName: getLocationBySlug(row.locationSlug)?.name ?? row.locationSlug,
      quantumToLocationSlug: row.quantumToLocationSlug ?? null,
      quantumToLocationName: row.quantumToLocationSlug
        ? (getLocationBySlug(row.quantumToLocationSlug)?.name ??
          row.quantumToLocationSlug)
        : null,
      reasonShopSlug: row.reasonShopSlug ?? null,
      reasonShopName: row.reasonShopSlug
        ? (getLocationShopBySlug(row.reasonShopSlug)?.name ??
          row.reasonShopSlug)
        : null,
      cargo: formatCargoDeliveries(
        row.cargoDeliveries,
        row.routeAction === "pickup" || row.routeAction === "delivery"
          ? row.routeAction
          : null,
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

export function textResult(payload: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

export type McpTextResult = ReturnType<typeof textResult>;

/** Merge fields into a successful tool JSON payload (leave error responses alone). */
export function mergeTextResult(
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
export function sessionScreenshotSoftGate(
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
      "SCREENSHOTS MISSING: one or more contracts have empty/omitted screenshots[]. If the user attached images, you MUST call store_hauling_screenshot (prefer ChatGPT `file` / fileUrl; sessionId + missionId auto-attaches) or set_mission_screenshots. Omit screenshots only when the user provided no images.",
    next: "store_hauling_screenshot (file or fileUrl + sessionId + missionId) or set_mission_screenshots",
  };
}

export function catalogScreenshotSoftGate(
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

export async function resolveTargetSession(sessionId?: string | null) {
  try {
    return await getChecklistSession(sessionId);
  } catch (error) {
    return null;
  }
}

