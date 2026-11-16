import {
  reconcileMissionCompletionFromStops,
  syncMissionsForStopCompletion,
} from "@/lib/missions/expectedCompletions";
import { applySessionCompletionTiming, type SessionChecklist } from "@/lib/missions/sessionChecklist";


/**
 * Toggle one checklist stop Done / open and mirror contract completion.
 * Does not rebuild legs — reopen used to call rebuildRowsFromMissions and
 * could replace a legal optimized route with an invalid intake merge order.
 */
export function toggleStopCompletion(
  session: SessionChecklist,
  rowId: string,
): SessionChecklist | null {
  const target = session.rows.find((row) => row.id === rowId);
  if (!target) return null;

  const stopIsCompleted = !target.isCompleted;
  const rows = session.rows.map((row) =>
    row.id === rowId ? { ...row, isCompleted: stopIsCompleted } : row,
  );
  const synced = syncMissionsForStopCompletion({
    missions: session.missions ?? [],
    rows,
    rowId,
    stopIsCompleted,
  });
  const missions = reconcileMissionCompletionFromStops(synced, rows);
  const counted = missions.filter((mission) => !mission.isHidden);

  return applySessionCompletionTiming({
    ...session,
    shipSlugs: session.shipSlugs ?? [],
    startLocationSlug: session.startLocationSlug ?? null,
    rows,
    missions,
    missionCount: counted.length,
    missionsCompleted: counted.filter((mission) => mission.isCompleted).length,
  });
}
