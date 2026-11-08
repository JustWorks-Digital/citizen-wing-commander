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
  getChecklistSession,
  replaceChecklistRows,
  setLegCompleted,
  setSessionName,
  setSessionShips,
} from "@/lib/sessions/checklistStore";
import {
  resolveIncomingLeg,
  resolveShipSlugs,
  searchCommodities,
  searchLocations,
  searchShips,
  type IncomingLeg,
} from "@/lib/sessions/resolveRefs";
import type { SessionChecklistModel } from "@/lib/missions/mockSession";

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
  return {
    sessionName: session.sessionName,
    ships: presentShips(session.shipSlugs),
    totalShipCargoScu: sumShipCargoScu(session.shipSlugs),
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

export async function toolGetHaulingChecklist() {
  const session = await getChecklistSession();
  return textResult(presentSession(session));
}

export async function toolSetSessionName(sessionName: string) {
  const session = await setSessionName(sessionName);
  return textResult(presentSession(session));
}

export async function toolSetSessionShips(ships: string[]) {
  const resolved = resolveShipSlugs(ships);
  if (!resolved.ok) {
    return textResult({ error: resolved.error });
  }
  const session = await setSessionShips(resolved.shipSlugs);
  return textResult({
    ok: true,
    message: `Set ${resolved.shipSlugs.length} ship(s) on the session.`,
    session: presentSession(session),
  });
}

export async function toolReplaceHaulingChecklist(input: {
  sessionName?: string;
  ships?: string[];
  legs: IncomingLeg[];
}) {
  const rows = [];
  for (const [index, leg] of input.legs.entries()) {
    const resolved = resolveIncomingLeg(leg, index);
    if (!resolved.ok) {
      return textResult({ error: resolved.error });
    }
    rows.push(resolved.row);
  }

  let session = await replaceChecklistRows(rows, input.sessionName);

  if (input.ships) {
    const resolvedShips = resolveShipSlugs(input.ships);
    if (!resolvedShips.ok) {
      return textResult({ error: resolvedShips.error });
    }
    session = await setSessionShips(resolvedShips.shipSlugs);
  }

  return textResult({
    ok: true,
    message: `Replaced checklist with ${rows.length} leg(s).`,
    session: presentSession(session),
  });
}

export async function toolSetLegCompleted(input: {
  rowId: string;
  isCompleted: boolean;
}) {
  const session = await getChecklistSession();
  if (!session.rows.some((row) => row.id === input.rowId)) {
    return textResult({ error: `Unknown row id: ${input.rowId}` });
  }
  const next = await setLegCompleted(input.rowId, input.isCompleted);
  return textResult(presentSession(next));
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
