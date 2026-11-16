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
    scuTotalCertainty: row.scuTotalCertainty,
    scuMaxContainerSize: row.scuMaxContainerSize,
    scuBoxSplits: row.scuBoxSplits,
    scuBoxSplitsCertainty: row.scuBoxSplitsCertainty,
    scuCargoBoxSplitsCertainty:
      (row.payload as HaulingCatalogMissionPayload | null)
        ?.scuCargoBoxSplitsCertainty ?? null,
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
   * Payout lines.
   * Hauling: usually [{ kind: "auec", amount }]. Blueprint for other mission types.
   */
  rewards?: CatalogMissionReward[];
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
  /**
   * Certainty that scuTotal is known from screenshot / hangar
   * (`known` | `estimated` | `unknown`).
   */
  scuTotalCertainty?: "known" | "estimated" | "unknown" | null;
  /**
   * Mission rollup crate-mix certainty (`known` | `estimated` | `unknown`).
   * Prefer `scuCargoBoxSplitsCertainty` for per-commodity AI guesses.
   */
  scuBoxSplitsCertainty?: "known" | "estimated" | "unknown" | null;
  /**
   * Per-commodity crate-mix certainty (slug → known | estimated | unknown).
   * Use when some cargo lines are readable and others are AI-estimated.
   */
  scuCargoBoxSplitsCertainty?: Record<
    string,
    "known" | "estimated" | "unknown" | null
  > | null;
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
        rewards: normalizeCatalogRewards(input.rewards),
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
        scuTotalCertainty: input.scuTotalCertainty,
        scuBoxSplitsCertainty: input.scuBoxSplitsCertainty,
        scuCargoBoxSplitsCertainty: input.scuCargoBoxSplitsCertainty ?? undefined,
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

