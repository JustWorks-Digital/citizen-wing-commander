import type {
  HaulingChecklistRow,
  SessionChecklistModel,
} from "@/lib/missions/mockSession";
import { applySessionCompletionTiming } from "@/lib/missions/mockSession";
import { recomputeDistances } from "@/lib/missions/quantumTravel";

/** Trip has started once any checklist stop is marked complete. */
export function isTripStarted(rows: HaulingChecklistRow[]): boolean {
  return rows.some((row) => row.isCompleted);
}

/**
 * Clear stop completion so the trip can be reordered again.
 * Does not change contracts (missions), cargo handled flags, or mission counts.
 */
export function resetTripProgress(
  session: SessionChecklistModel,
): SessionChecklistModel {
  const rows = session.rows.map((row) => ({
    ...row,
    isCompleted: false,
  }));
  return applySessionCompletionTiming({
    ...session,
    rows,
  });
}

/**
 * Reorder checklist stops by id list, then refresh leg distances.
 * Refused after the trip has started (any stop completed).
 */
export function reorderChecklistStops(
  rows: HaulingChecklistRow[],
  orderedIds: string[],
):
  | { ok: true; rows: HaulingChecklistRow[] }
  | { ok: false; error: string } {
  if (isTripStarted(rows)) {
    return { ok: false, error: "Trip has started; stop order is locked" };
  }
  if (orderedIds.length !== rows.length) {
    return { ok: false, error: "Order must include every stop" };
  }

  const byId = new Map(rows.map((row) => [row.id, row]));
  const next: HaulingChecklistRow[] = [];
  const seen = new Set<string>();

  for (const id of orderedIds) {
    const row = byId.get(id);
    if (!row) {
      return { ok: false, error: `Unknown stop: ${id}` };
    }
    if (seen.has(id)) {
      return { ok: false, error: `Duplicate stop: ${id}` };
    }
    seen.add(id);
    next.push(row);
  }

  if (seen.size !== rows.length) {
    return { ok: false, error: "Order must include every stop" };
  }

  return { ok: true, rows: recomputeDistances(next) };
}

/** Move `fromId` so it sits at the index of `toId` (before that stop). */
export function moveStopIdBefore(
  orderedIds: string[],
  fromId: string,
  toId: string,
): string[] {
  if (fromId === toId) return orderedIds;
  const next = [...orderedIds];
  const fromIndex = next.indexOf(fromId);
  const toIndex = next.indexOf(toId);
  if (fromIndex < 0 || toIndex < 0) return orderedIds;
  next.splice(fromIndex, 1);
  const insertAt = next.indexOf(toId);
  if (insertAt < 0) return orderedIds;
  next.splice(insertAt, 0, fromId);
  return next;
}
