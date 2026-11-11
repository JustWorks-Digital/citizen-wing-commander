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

function recomputeDistances(rows: HaulingChecklistRow[]): HaulingChecklistRow[] {
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
    legKind: "quantum",
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
