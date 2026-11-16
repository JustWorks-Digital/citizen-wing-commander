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
  PLAYBOOK_PATH,
  mergeTextResult,
  resolveTargetSession,
  sessionScreenshotSoftGate,
  textResult,
} from "./shared";
import {
  toolReplaceHaulingChecklist,
  toolSetSessionStartLocation,
} from "./sessions";

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
 * Prefer ChatGPT `file` (openai/fileParams) or `fileUrl` when the client
 * cannot send base64. Optional `missionId` attaches the stored path onto
 * that session mission.
 */
export async function toolStoreHaulingScreenshot(input: {
  /** Native ChatGPT attachment via `_meta["openai/fileParams"]`. */
  file?: unknown;
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
      file: input.file,
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
        : "Stored under .data/mcp-screenshots (gitignored). Pass missionId to auto-attach, or call set_mission_screenshots. Prefer ChatGPT `file` (openai/fileParams) or fileUrl over imageBase64.",
    });
  } catch (error) {
    return textResult({
      error: error instanceof Error ? error.message : "Failed to store screenshot",
    });
  }
}

export async function toolListHaulingScreenshots(input?: {
  batchId?: string;
  sessionId?: string;
  status?: HaulingScreenshotStatus | "all";
}) {
  const batchId =
    input?.batchId?.trim() || input?.sessionId?.trim() || "default";
  const status = input?.status ?? "pending";
  const screenshots = await listHaulingScreenshots(batchId, { status });
  const all = await listHaulingScreenshots(batchId, { status: "all" });
  const pendingCount = all.filter((shot) => shot.status === "pending").length;
  const processedCount = all.filter(
    (shot) => shot.status === "processed",
  ).length;
  return textResult({
    batchId,
    status,
    count: screenshots.length,
    pendingCount,
    processedCount,
    screenshots,
    note:
      "UI Source uploads use sessionId as batchId. Default status=pending (awaiting AI parse). Call get_hauling_screenshot one image at a time for vision. After apply_hauling_contracts_intake, call mark_hauling_screenshots_processed.",
  });
}

export async function toolMarkHaulingScreenshotsProcessed(input: {
  batchId?: string;
  sessionId?: string;
  filenames?: string[];
  logicalPaths?: string[];
  allPending?: boolean;
}) {
  const batchId = input.batchId?.trim() || input.sessionId?.trim() || "";
  if (!batchId) {
    return textResult({ error: "Provide batchId or sessionId" });
  }
  try {
    const result = await markHaulingScreenshotsProcessed({
      batchId,
      filenames: input.filenames,
      logicalPaths: input.logicalPaths,
      allPending: input.allPending,
    });
    return textResult({
      ...result,
      note: "Marked Source shots processed. Pending count is for remaining unparsed uploads.",
    });
  } catch (error) {
    return textResult({
      error:
        error instanceof Error
          ? error.message
          : "Failed to mark screenshots processed",
    });
  }
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

function isCargoBoxScu(size: number): size is CargoBoxScu {
  return (CARGO_BOX_SCU as readonly number[]).includes(size);
}

function scuTotalFromSplits(splits: ScuBoxSplits): number {
  return (
    splits.scuOne * 1 +
    splits.scuTwo * 2 +
    splits.scuFour * 4 +
    splits.scuEight * 8 +
    splits.scuSixteen * 16 +
    splits.scuThirtyTwo * 32
  );
}

function resolveScuBoxSplitsInput(input: {
  scuBoxSplits?: Partial<ScuBoxSplits> | null;
  boxes?: Array<{ size: number; count: number }> | null;
}): ScuBoxSplits | { error: string } {
  if (input.boxes && input.boxes.length > 0) {
    const sizes: CargoBoxScu[] = [];
    for (const entry of input.boxes) {
      if (!isCargoBoxScu(entry.size)) {
        return {
          error: `Unsupported crate size ${entry.size}. Allowed: ${CARGO_BOX_SCU.join(", ")}`,
        };
      }
      const count = Math.max(0, Math.floor(Number(entry.count) || 0));
      for (let i = 0; i < count; i += 1) sizes.push(entry.size);
    }
    return breakdownFromBoxSizes(sizes);
  }
  if (input.scuBoxSplits) {
    return normalizeScuBoxSplits(input.scuBoxSplits);
  }
  return {
    error:
      "Provide boxes: [{ size, count }, …] (preferred from terminal UI) or scuBoxSplits counts.",
  };
}

/**
 * Correct a session mission’s crate mix (e.g. after reading the freight
 * elevator / hangar UI at pickup). Restamps bay packing sizes onto the route;
 * also updates the linked catalog default when present.
 */
export async function toolSetMissionScuBoxSplits(input: {
  missionId: string;
  sessionId?: string | null;
  /**
   * Commodity name or slug when the mission has multiple cargo types.
   * Optional when there is only one cargo line.
   */
  commodity?: string | null;
  /** Preferred: terminal-style counts, e.g. [{ size: 16, count: 18 }, { size: 1, count: 1 }]. */
  boxes?: Array<{ size: number; count: number }> | null;
  /** Alternate: explicit scuOne…scuThirtyTwo counts. */
  scuBoxSplits?: Partial<ScuBoxSplits> | null;
  /**
   * Certainty for this commodity’s crate mix (and mission rollup): known
   * (hangar/screenshot), estimated (AI), or unknown. Hangar → `known`.
   * With `commodity`, stamps that slug in `scuCargoBoxSplitsCertainty`.
   */
  scuBoxSplitsCertainty?: "known" | "estimated" | "unknown" | null;
  /** Certainty for mission SCU totals (same vocabulary). */
  scuTotalCertainty?: "known" | "estimated" | "unknown" | null;
  /** When false, skip writing the linked catalog mission default. Default true. */
  updateCatalog?: boolean;
}) {
  try {
    const session = await getChecklistSession(input.sessionId);
    const missionId = input.missionId.trim();
    const mission = (session.missions ?? []).find(
      (entry) => entry.id === missionId,
    );
    if (!mission) {
      return textResult({
        error: `Unknown mission id: ${missionId}`,
        knownMissionIds: (session.missions ?? []).map((entry) => entry.id),
      });
    }

    const resolved = resolveScuBoxSplitsInput({
      boxes: input.boxes,
      scuBoxSplits: input.scuBoxSplits,
    });
    if ("error" in resolved) {
      return textResult({ error: resolved.error });
    }
    const scuBoxSplits = resolved;

    const commodityHint = input.commodity?.trim() || null;
    const lineScu = (() => {
      if (!commodityHint) {
        return mission.cargo.reduce(
          (sum, line) => sum + (Number(line.scu) || 0),
          0,
        );
      }
      const slug =
        resolveCommoditySlug(commodityHint) ??
        commodityHint.trim().toLowerCase();
      const line = mission.cargo.find((entry) => {
        const entrySlug =
          resolveCommoditySlug(entry.commodity) ??
          entry.commodity.trim().toLowerCase();
        return (
          entrySlug === slug ||
          entry.commodity.trim().toLowerCase() ===
            commodityHint.trim().toLowerCase()
        );
      });
      return line ? Number(line.scu) || 0 : null;
    })();

    const boxScu = scuTotalFromSplits(scuBoxSplits);
    if (lineScu == null) {
      return textResult({
        error: `Unknown commodity for mission ${missionId}: ${commodityHint}`,
        knownCommodities: mission.cargo.map((line) => line.commodity),
      });
    }
    if (lineScu > 0 && boxScu !== lineScu) {
      return textResult({
        error: commodityHint
          ? `Box mix totals ${boxScu} SCU but ${commodityHint} is ${lineScu} SCU. Counts must sum to that commodity’s SCU.`
          : `Box mix totals ${boxScu} SCU but mission cargo is ${lineScu} SCU. Counts must sum to the mission total.`,
        missionScu: lineScu,
        boxScu,
        label: formatBreakdownLabel(scuBoxSplits),
      });
    }

    const certaintyOptions = {
      ...(input.scuBoxSplitsCertainty !== undefined
        ? { scuBoxSplitsCertainty: input.scuBoxSplitsCertainty }
        : {}),
      ...(input.scuTotalCertainty !== undefined
        ? { scuTotalCertainty: input.scuTotalCertainty }
        : {}),
    };
    const result = setMissionScuBoxSplits(
      session,
      missionId,
      scuBoxSplits,
      commodityHint,
      Object.keys(certaintyOptions).length > 0 ? certaintyOptions : undefined,
    );
    if (!result.ok) {
      return textResult({ error: result.error });
    }

    const next = await saveChecklistSession(result.session);
    const updated = (next.missions ?? []).find(
      (entry) => entry.id === missionId,
    );

    let catalogUpdated: string | null = null;
    let catalogError: string | null = null;
    let sessionOut = next;
    let updatedOut = updated;
    const catalogId = updated?.catalogMissionId ?? null;
    const shouldUpdateCatalog = input.updateCatalog !== false;
    const missionAggregate = updated
      ? cargoBoxSplits.selectedAggregate(updated)
      : scuBoxSplits;
    if (shouldUpdateCatalog && catalogId && updated) {
      try {
        await updateCatalogMissionScuBoxSplits({
          missionId: catalogId,
          scuBoxSplits: missionAggregate,
          scuCargoBoxSplits: updated.scuCargoBoxSplits,
          ...(input.scuBoxSplitsCertainty !== undefined
            ? { scuBoxSplitsCertainty: input.scuBoxSplitsCertainty }
            : {}),
          ...(updated.scuCargoBoxSplitsCertainty
            ? {
                scuCargoBoxSplitsCertainty: updated.scuCargoBoxSplitsCertainty,
              }
            : {}),
          ...(input.scuTotalCertainty !== undefined
            ? { scuTotalCertainty: input.scuTotalCertainty }
            : {}),
        });
        catalogUpdated = catalogId;
      } catch (error) {
        if (isCatalogMissionNotFoundError(error)) {
          sessionOut = await saveChecklistSession(
            clearCatalogMissionLink(next, missionId),
          );
          updatedOut = (sessionOut.missions ?? []).find(
            (entry) => entry.id === missionId,
          );
          catalogUpdated = null;
          catalogError = null;
        } else {
          catalogError =
            error instanceof Error
              ? error.message
              : "Failed to update catalog scuBoxSplits";
        }
      }
    }

    const stampedPickup = sessionOut.rows
      .flatMap((row) =>
        row.cargoDeliveries
          .filter(
            (cargo) =>
              cargo.missionId === missionId &&
              (cargo.role === "pickup" ||
                row.routeAction === "pickup" ||
                row.routeAction === "pickup_delivery"),
          )
          .map((cargo) => ({
            locationSlug: row.locationSlug,
            commoditySlug: cargo.commoditySlug,
            scu: cargo.scu,
            boxSizes: cargo.boxSizes ?? [],
          })),
      )
      .filter((entry) => (entry.boxSizes?.length ?? 0) > 0);

    return textResult({
      ok: true,
      sessionId: sessionOut.id,
      missionId,
      commodity: commodityHint,
      label: formatBreakdownLabel(scuBoxSplits),
      scuBoxSplits: missionAggregate,
      scuCargoBoxSplits: updatedOut?.scuCargoBoxSplits ?? null,
      scuBoxSplitsCertainty: updatedOut?.scuBoxSplitsCertainty ?? null,
      scuCargoBoxSplitsCertainty: updatedOut?.scuCargoBoxSplitsCertainty ?? null,
      scuTotalCertainty: updatedOut?.scuTotalCertainty ?? null,
      catalogMissionId: updatedOut?.catalogMissionId ?? null,
      boxScu,
      missionScu: lineScu,
      catalogUpdated,
      catalogError,
      stampedPickup,
      note: "Session crate mix updated and bay packing sizes restamped. UI Collect pads use these boxSizes.",
    });
  } catch (error) {
    return textResult({
      error:
        error instanceof Error
          ? error.message
          : "Failed to set mission scuBoxSplits",
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

/** List contract/mission images uploaded on the Capture page. */
export async function toolListIntakeUploads(input?: {
  status?: "pending" | "processed" | "all";
}) {
  const status = input?.status ?? "pending";
  const uploads = await listIntakeUploads(status);
  return textResult({
    status,
    count: uploads.length,
    uploads,
    note:
      "Pending shots live under intake-pending/; after you extract contracts into the catalog, call mark_intake_upload_processed. Prefer get_intake_upload for image bytes.",
  });
}

/** Read a Capture-page upload (base64) for AI contract extraction. */
export async function toolGetIntakeUpload(input: {
  logicalPath?: string;
  filename?: string;
  status?: "pending" | "processed";
}) {
  try {
    const shot = await readIntakeUpload(input);
    return textResult({
      ok: true,
      status: shot.status,
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
        error instanceof Error ? error.message : "Failed to read intake upload",
    });
  }
}

/** Move a pending Capture upload into the processed batch after AI capture. */
export async function toolMarkIntakeUploadProcessed(input: {
  logicalPath?: string;
  filename?: string;
}) {
  try {
    const result = await markIntakeUploadProcessed(input);
    return textResult({
      ...result,
      note: "File moved to intake-processed/. Prefer create_mission / apply_hauling_contracts_intake before marking processed.",
    });
  } catch (error) {
    return textResult({
      error:
        error instanceof Error
          ? error.message
          : "Failed to mark intake upload processed",
    });
  }
}

