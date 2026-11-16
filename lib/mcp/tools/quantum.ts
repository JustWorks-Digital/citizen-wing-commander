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

export async function toolListLocationShops(input: {
  location: string;
  query?: string;
  limit?: number;
}) {
  const locationSlug = resolveLocationSlug(input.location);
  if (!locationSlug) {
    return textResult({
      error: `Unknown location: ${input.location}`,
    });
  }
  const limit = Math.min(Math.max(input.limit ?? 40, 1), 100);
  const shops = input.query?.trim()
    ? searchLocationShops(locationSlug, input.query, limit)
    : listLocationShops(locationSlug).slice(0, limit);
  return textResult({
    ok: true,
    locationSlug,
    locationName: getLocationBySlug(locationSlug)?.name ?? locationSlug,
    count: shops.length,
    shops,
    note: "Use shop slug/name as reasonShop on insert_quantum_travel or set_quantum_travel_reason.",
  });
}

/** Insert a quantum travel leg after a stop (or session start). */
export async function toolInsertQuantumTravel(input: {
  to: string;
  reasonShop: string;
  from?: string;
  afterRowId?: string;
  sessionId?: string | null;
}) {
  try {
    const session = await getChecklistSession(input.sessionId);
    const afterRowId =
      input.afterRowId?.trim() || INSERT_AFTER_SESSION_START;
    const toSlug = resolveLocationSlug(input.to);
    if (!toSlug) {
      return textResult({ error: `Unknown destination: ${input.to}` });
    }
    const fromSlug =
      (input.from?.trim()
        ? resolveLocationSlug(input.from)
        : null) ||
      quantumFromSlugAfter({
        rows: session.rows,
        afterRowId,
        startLocationSlug: session.startLocationSlug,
      });
    if (!fromSlug) {
      return textResult({
        error:
          "Could not resolve from location. Pass from=, set session start, or afterRowId to a stop.",
      });
    }
    const reasonShopSlug = resolveLocationShopSlug(input.reasonShop, toSlug);
    if (!reasonShopSlug) {
      return textResult({
        error: `Unknown shop reason at ${toSlug}: ${input.reasonShop}. Call list_location_shops first.`,
        shops: listLocationShops(toSlug).map((shop) => ({
          slug: shop.slug,
          name: shop.name,
        })),
      });
    }
    const rows = insertQuantumTravelAfter(session.rows, afterRowId, {
      fromSlug,
      toSlug,
      reasonShopSlug,
    });
    const next = await saveChecklistSession({ ...session, rows });
    const inserted = next.rows.find(
      (row) =>
        row.routeAction === "quantum" &&
        row.locationSlug === fromSlug &&
        row.quantumToLocationSlug === toSlug &&
        row.reasonShopSlug === reasonShopSlug,
    );
    return textResult({
      ok: true,
      sessionId: next.id,
      rowId: inserted?.id ?? null,
      fromSlug,
      toSlug,
      reasonShopSlug,
      reasonShopName: getLocationShopBySlug(reasonShopSlug)?.name ?? reasonShopSlug,
      rowCount: next.rows.length,
    });
  } catch (error) {
    return textResult({
      error:
        error instanceof Error
          ? error.message
          : "Failed to insert quantum travel",
    });
  }
}

/** Update the shop reason on an existing quantum travel row. */
export async function toolSetQuantumTravelReason(input: {
  rowId: string;
  reasonShop: string | null;
  sessionId?: string | null;
}) {
  try {
    const session = await getChecklistSession(input.sessionId);
    const row = session.rows.find((entry) => entry.id === input.rowId);
    if (!row) {
      return textResult({
        error: `Unknown row id: ${input.rowId}`,
        knownRowIds: session.rows.map((entry) => entry.id),
      });
    }
    if (row.routeAction !== "quantum") {
      return textResult({
        error: `Row ${input.rowId} is not a quantum travel leg`,
      });
    }
    let reasonShopSlug: string | null = null;
    if (input.reasonShop?.trim()) {
      reasonShopSlug = resolveLocationShopSlug(
        input.reasonShop,
        row.quantumToLocationSlug,
      );
      if (!reasonShopSlug) {
        return textResult({
          error: `Unknown shop reason: ${input.reasonShop}`,
          shops: listLocationShops(row.quantumToLocationSlug ?? "").map(
            (shop) => ({ slug: shop.slug, name: shop.name }),
          ),
        });
      }
    }
    const updated = setQuantumTravelReason(
      session.rows,
      input.rowId,
      reasonShopSlug,
    );
    if (!updated.ok) {
      return textResult({ error: updated.error });
    }
    const next = await saveChecklistSession({
      ...session,
      rows: updated.rows,
    });
    const saved = next.rows.find((entry) => entry.id === input.rowId);
    return textResult({
      ok: true,
      sessionId: next.id,
      rowId: input.rowId,
      reasonShopSlug: saved?.reasonShopSlug ?? null,
      reasonShopName: saved?.reasonShopSlug
        ? (getLocationShopBySlug(saved.reasonShopSlug)?.name ??
          saved.reasonShopSlug)
        : null,
    });
  } catch (error) {
    return textResult({
      error:
        error instanceof Error
          ? error.message
          : "Failed to set quantum travel reason",
    });
  }
}
