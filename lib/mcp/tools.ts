import { readFile } from "node:fs/promises";
import path from "node:path";
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
  storeHaulingScreenshot,
} from "@/lib/sessions/screenshotStore";
import { buildRouteFromIntake } from "@/lib/sessions/buildRouteFromIntake";
import {
  resolveIncomingLeg,
  resolveLocationSlug,
  resolveShipSlugs,
  searchCommodities,
  searchLocations,
  searchShips,
  type IncomingLeg,
} from "@/lib/sessions/resolveRefs";
import type { HaulingContractsIntake } from "@/lib/missions/haulingIntake";
import type { SessionChecklistModel } from "@/lib/missions/mockSession";
import { buildSessionMissionsFromIntake } from "@/lib/missions/sessionMissionsFromIntake";

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
    };
  });
}

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

  const missions = await buildSessionMissionsFromIntake(intake.contracts);

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
    })),
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
      note: "Ephemeral .data/mcp-screenshots store (not committed; cleared on redeploy without a volume).",
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
  });
}

export async function toolClearHaulingScreenshots(batchId?: string) {
  const result = await clearHaulingScreenshots(batchId);
  return textResult({
    ok: true,
    message: `Removed ${result.removed} screenshot(s) from batch ${result.batchId}.`,
    ...result,
  });
}
