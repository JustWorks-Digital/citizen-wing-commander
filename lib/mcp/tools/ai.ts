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
