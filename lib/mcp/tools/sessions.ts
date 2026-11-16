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
  const trip = sessionTripUrl(session.id);
  return textResult({
    ok: true,
    message: `Created session ${session.id}${input?.activate === false ? "" : " (active)"}.`,
    session: presentSession(session),
    tripPath: trip.path,
    tripUrl: trip.url,
    sourceHandoff:
      "If chat attachments cannot be pushed to MCP, ask the user to open tripUrl → Source → paste Accepted contract shots → reply continue. Then list_hauling_screenshots (status=pending) + get_hauling_screenshot.",
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
  missions?: SessionChecklist["missions"];
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

