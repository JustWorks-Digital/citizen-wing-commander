import type {
  HaulingChecklistRow,
  SessionChecklistModel,
} from "@/lib/missions/mockSession";
import { applySessionCompletionTiming } from "@/lib/missions/mockSession";
import { recomputeDistances } from "@/lib/missions/quantumTravel";
import { rebuildRowsFromMissions } from "@/lib/missions/rebuildSessionRoute";

/** Trip has started once any checklist stop is marked complete. */
export function isTripStarted(rows: HaulingChecklistRow[]): boolean {
  return rows.some((row) => row.isCompleted);
}

function cargoHandledKey(
  locationSlug: string,
  commoditySlug: string,
  role: string | null | undefined,
  missionId?: string | null,
): string {
  return `${locationSlug}|${commoditySlug}|${role ?? ""}|${missionId ?? ""}`;
}

function cargoHandledLooseKey(
  locationSlug: string,
  commoditySlug: string,
  role: string | null | undefined,
): string {
  return cargoHandledKey(locationSlug, commoditySlug, role);
}

/**
 * Clear stop + contract completion so the trip can be reordered again.
 * Brings completed-off-route contracts back onto the route table.
 * Cargo handled flags are preserved across the rebuild when keys still match.
 */
export function resetTripProgress(
  session: SessionChecklistModel,
): SessionChecklistModel {
  const rows = session.rows.map((row) => ({
    ...row,
    isCompleted: false,
  }));
  const missions = (session.missions ?? []).map((mission) =>
    mission.isCompleted ? { ...mission, isCompleted: false } : mission,
  );
  const counted = missions.filter((mission) => !mission.isHidden);
  const cleared = applySessionCompletionTiming({
    ...session,
    rows,
    missions,
    missionCount: counted.length,
    missionsCompleted: 0,
  });
  const rebuilt = rebuildRowsFromMissions(cleared, missions);
  if (!rebuilt.ok) return cleared;

  const handledExact = new Set<string>();
  const handledLoose = new Set<string>();
  for (const row of session.rows) {
    for (const cargo of row.cargoDeliveries) {
      if (!cargo.isHandled) continue;
      handledExact.add(
        cargoHandledKey(
          row.locationSlug,
          cargo.commoditySlug,
          cargo.role,
          cargo.missionId,
        ),
      );
      handledLoose.add(
        cargoHandledLooseKey(
          row.locationSlug,
          cargo.commoditySlug,
          cargo.role,
        ),
      );
    }
  }
  if (handledExact.size === 0 && handledLoose.size === 0) {
    return rebuilt.session;
  }

  return {
    ...rebuilt.session,
    rows: rebuilt.session.rows.map((row) => ({
      ...row,
      cargoDeliveries: row.cargoDeliveries.map((cargo) => {
        const exact = cargoHandledKey(
          row.locationSlug,
          cargo.commoditySlug,
          cargo.role,
          cargo.missionId,
        );
        const loose = cargoHandledLooseKey(
          row.locationSlug,
          cargo.commoditySlug,
          cargo.role,
        );
        const keep = handledExact.has(exact) || handledLoose.has(loose);
        return keep ? { ...cargo, isHandled: true } : cargo;
      }),
    })),
  };
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
