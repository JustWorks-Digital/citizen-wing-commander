import type { HaulingChecklistRow } from "@/lib/missions/mockSession";
import {
  isQuantumTravelRow,
  rowPresenceLocationSlug,
} from "@/lib/missions/mockSession";
import { distanceBetweenLocationSlugs } from "@/lib/starmap/distance";

/** Sentinel: insert before the first cargo/quantum stop (after session start). */
export const INSERT_AFTER_SESSION_START = "route-start";

function sameSlug(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Refresh adjacent `distanceToNext` after insert / reorder / location edits. */
export function recomputeDistances(
  rows: HaulingChecklistRow[],
): HaulingChecklistRow[] {
  return rows.map((row, index) => {
    const next = rows[index + 1];
    if (!next) {
      return { ...row, distanceToNext: null };
    }
    const from = rowPresenceLocationSlug(row);
    const to = next.locationSlug;
    return {
      ...row,
      distanceToNext:
        distanceBetweenLocationSlugs(from, to) ?? row.distanceToNext,
    };
  });
}

export function createQuantumTravelRow(input: {
  fromSlug: string;
  toSlug: string;
  reasonShopSlug?: string | null;
  id?: string;
}): HaulingChecklistRow {
  const fromSlug = input.fromSlug.trim();
  const toSlug = input.toSlug.trim();
  const reasonShopSlug = input.reasonShopSlug?.trim() || null;
  return {
    id: input.id ?? `quantum-${crypto.randomUUID()}`,
    routeAction: "quantum",
    locationSlug: fromSlug,
    quantumToLocationSlug: toSlug,
    reasonShopSlug,
    cargoDeliveries: [],
    shipStorageLocation: "front",
    distanceToNext: distanceBetweenLocationSlugs(fromSlug, toSlug),
    isCompleted: false,
  };
}

/**
 * From-slug when inserting a quantum leg after a checklist row (or session start).
 */
export function quantumFromSlugAfter(input: {
  rows: HaulingChecklistRow[];
  afterRowId: string;
  startLocationSlug?: string | null;
}): string | null {
  const { rows, afterRowId, startLocationSlug } = input;
  if (afterRowId === INSERT_AFTER_SESSION_START) {
    return startLocationSlug?.trim() || null;
  }
  const row = rows.find((entry) => entry.id === afterRowId);
  if (!row) return null;
  return rowPresenceLocationSlug(row);
}

/** Insert a quantum travel row after `afterRowId` (or at the front for session start). */
export function insertQuantumTravelAfter(
  rows: HaulingChecklistRow[],
  afterRowId: string,
  input: {
    fromSlug: string;
    toSlug: string;
    reasonShopSlug?: string | null;
  },
): HaulingChecklistRow[] {
  const quantum = createQuantumTravelRow(input);
  if (afterRowId === INSERT_AFTER_SESSION_START) {
    return recomputeDistances([quantum, ...rows]);
  }
  const index = rows.findIndex((row) => row.id === afterRowId);
  if (index < 0) {
    return recomputeDistances([...rows, quantum]);
  }
  return recomputeDistances([
    ...rows.slice(0, index + 1),
    quantum,
    ...rows.slice(index + 1),
  ]);
}

/**
 * Keep manual quantum legs across mission-driven route rebuilds by re-anchoring
 * each after the last non-quantum stop that matches the travel origin.
 */
export function mergePreservedQuantumRows(
  previousRows: HaulingChecklistRow[],
  rebuiltRows: HaulingChecklistRow[],
): HaulingChecklistRow[] {
  const quantums = previousRows.filter(isQuantumTravelRow);
  if (quantums.length === 0) return rebuiltRows;

  let result = [...rebuiltRows];
  for (const quantum of quantums) {
    if (result.some((row) => row.id === quantum.id)) continue;
    const from = quantum.locationSlug;
    let insertAt = result.length;
    for (let i = result.length - 1; i >= 0; i -= 1) {
      const row = result[i]!;
      if (isQuantumTravelRow(row)) continue;
      if (sameSlug(row.locationSlug, from)) {
        insertAt = i + 1;
        break;
      }
    }
    result = [
      ...result.slice(0, insertAt),
      { ...quantum, isCompleted: quantum.isCompleted },
      ...result.slice(insertAt),
    ];
  }
  return recomputeDistances(result);
}

/** Set or clear the shop reason on an existing quantum travel row. */
export function setQuantumTravelReason(
  rows: HaulingChecklistRow[],
  rowId: string,
  reasonShopSlug: string | null,
):
  | { ok: true; rows: HaulingChecklistRow[] }
  | { ok: false; error: string } {
  const index = rows.findIndex((row) => row.id === rowId);
  if (index < 0) {
    return { ok: false, error: `Unknown row id: ${rowId}` };
  }
  const row = rows[index]!;
  if (!isQuantumTravelRow(row)) {
    return { ok: false, error: `Row ${rowId} is not a quantum travel leg` };
  }
  const next = [...rows];
  next[index] = {
    ...row,
    reasonShopSlug: reasonShopSlug?.trim() || null,
  };
  return { ok: true, rows: next };
}

/**
 * Update origin and/or destination on an existing quantum travel row.
 * Clears reason when the destination shop is no longer at the new `to` location.
 */
export function updateQuantumTravelEndpoints(
  rows: HaulingChecklistRow[],
  rowId: string,
  patch: { fromSlug?: string; toSlug?: string },
  options?: {
    /** Return true when `reasonShopSlug` still belongs at `toSlug`. */
    isReasonValidAtDestination?: (
      reasonShopSlug: string,
      toSlug: string,
    ) => boolean;
  },
):
  | { ok: true; rows: HaulingChecklistRow[] }
  | { ok: false; error: string } {
  const index = rows.findIndex((row) => row.id === rowId);
  if (index < 0) {
    return { ok: false, error: `Unknown row id: ${rowId}` };
  }
  const row = rows[index]!;
  if (!isQuantumTravelRow(row)) {
    return { ok: false, error: `Row ${rowId} is not a quantum travel leg` };
  }

  const fromSlug = (patch.fromSlug ?? row.locationSlug).trim();
  const toSlug = (patch.toSlug ?? row.quantumToLocationSlug ?? "").trim();
  if (!fromSlug) {
    return { ok: false, error: "Current location is required" };
  }
  if (!toSlug) {
    return { ok: false, error: "Destination is required" };
  }
  if (sameSlug(fromSlug, toSlug)) {
    return { ok: false, error: "Destination must differ from current location" };
  }

  let reasonShopSlug = row.reasonShopSlug ?? null;
  if (
    reasonShopSlug &&
    patch.toSlug &&
    options?.isReasonValidAtDestination &&
    !options.isReasonValidAtDestination(reasonShopSlug, toSlug)
  ) {
    reasonShopSlug = null;
  }

  const next = [...rows];
  next[index] = {
    ...row,
    locationSlug: fromSlug,
    quantumToLocationSlug: toSlug,
    reasonShopSlug,
    distanceToNext: distanceBetweenLocationSlugs(fromSlug, toSlug),
  };
  return { ok: true, rows: recomputeDistances(next) };
}

/** Update a stop’s `locationSlug` and refresh adjacent leg distances. */
export function updateChecklistRowLocation(
  rows: HaulingChecklistRow[],
  rowId: string,
  locationSlug: string,
):
  | { ok: true; rows: HaulingChecklistRow[] }
  | { ok: false; error: string } {
  const slug = locationSlug.trim();
  if (!slug) {
    return { ok: false, error: "Location is required" };
  }
  const index = rows.findIndex((row) => row.id === rowId);
  if (index < 0) {
    return { ok: false, error: `Unknown row id: ${rowId}` };
  }
  const row = rows[index]!;
  const next = [...rows];
  next[index] = { ...row, locationSlug: slug };
  return { ok: true, rows: recomputeDistances(next) };
}
