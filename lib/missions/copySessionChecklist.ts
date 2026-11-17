import {
  createSessionId,
  normalizeSessionChecklist,
  type CargoDelivery,
  type HaulingChecklistRow,
  type SessionChecklist,
} from "@/lib/missions/sessionChecklist";
import type { SessionMission } from "@/lib/missions/sessionMissions";

/** Trailing copy marker: `Trip name · a7f3`. */
const COPY_SUFFIX_RE = /\s·\s[a-f0-9]{4}$/i;

export function shortCopyId(sessionId: string): string {
  const hex = sessionId.replace(/-/g, "").slice(0, 4);
  return hex || "copy";
}

/** Base name without a prior copy suffix, then ` · {shortId}`. */
export function sessionNameForCopy(
  sourceName: string,
  newSessionId: string,
): string {
  const base = sourceName.trim().replace(COPY_SUFFIX_RE, "") || "New trip";
  return `${base} · ${shortCopyId(newSessionId)}`;
}

function resetCargoHandled(cargo: CargoDelivery): CargoDelivery {
  if (!cargo.isHandled) return cargo;
  const { isHandled: _handled, ...rest } = cargo;
  return rest;
}

function resetRow(row: HaulingChecklistRow): HaulingChecklistRow {
  return {
    ...row,
    isCompleted: false,
    cargoDeliveries: row.cargoDeliveries.map(resetCargoHandled),
  };
}

function resetMission(mission: SessionMission): SessionMission {
  return {
    ...mission,
    isCompleted: false,
  };
}

/**
 * Deep-ish clone of a trip checklist into a fresh session:
 * new id + name marker, same route/ships/box mixes, progress cleared.
 */
export function copySessionChecklist(
  source: SessionChecklist,
  options?: { now?: Date },
): SessionChecklist {
  const now = options?.now ?? new Date();
  const nowIso = now.toISOString();
  const id = createSessionId();

  return normalizeSessionChecklist(
    {
      ...source,
      id,
      sessionName: sessionNameForCopy(source.sessionName, id),
      missionsCompleted: 0,
      missions: (source.missions ?? []).map(resetMission),
      startedAt: nowIso,
      completedAt: null,
      finishStatus: null,
      finishFeedback: null,
      updatedAt: nowIso,
      rows: (source.rows ?? []).map(resetRow),
    },
    { preferId: id, touchUpdatedAt: true },
  );
}
