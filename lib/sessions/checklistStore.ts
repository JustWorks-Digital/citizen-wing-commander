import "server-only";

import { createHash } from "node:crypto";
import {
  createDeliverySession,
  getDeliverySession,
  getSelectedDeliverySession,
  listActiveDeliverySessionTabs,
  rowToChecklist,
  selectDeliverySession,
  softDeleteDeliverySession,
  updateDeliverySessionChecklist,
} from "@/db/queries/deliverySessions";
import { copySessionChecklist } from "@/lib/missions/copySessionChecklist";
import {
  emptySessionChecklist,
  summarizeSessionChecklist,
  type HaulingChecklistRow,
  type SessionChecklist,
  type SessionTabSummary,
} from "@/lib/missions/sessionChecklist";
import type { SessionMission } from "@/lib/missions/sessionMissions";
import { publishChecklistUpdated } from "@/lib/sessions/checklistSseHub";
export type { SessionTabSummary };

export function checklistEtag(session: SessionChecklist): string {
  const basis = `${session.id}:${session.updatedAt}`;
  const hash = createHash("sha1").update(basis).digest("hex").slice(0, 16);
  return `"${hash}"`;
}

async function ensureAtLeastOneSession(): Promise<SessionChecklist> {
  const selected = await getSelectedDeliverySession();
  if (selected) {
    return rowToChecklist(selected);
  }
  const created = await createDeliverySession({
    name: "New trip",
    checklist: emptySessionChecklist({ sessionName: "New trip" }),
    select: true,
  });
  return rowToChecklist(created);
}

export async function listChecklistSessions(): Promise<{
  activeSessionId: string;
  sessions: SessionTabSummary[];
}> {
  const list = await listActiveDeliverySessionTabs();
  if (list.sessions.length === 0) {
    const created = await ensureAtLeastOneSession();
    return {
      activeSessionId: created.id,
      sessions: [summarizeSessionChecklist(created)],
    };
  }
  return {
    activeSessionId: list.activeSessionId,
    sessions: list.sessions,
  };
}

export async function getChecklistSession(
  sessionId?: string | null,
): Promise<SessionChecklist> {
  const id = sessionId?.trim();
  if (id) {
    const row = await getDeliverySession(id);
    if (!row || !row.isActive) {
      throw new Error(`Unknown session id: ${id}`);
    }
    return rowToChecklist(row);
  }
  return ensureAtLeastOneSession();
}

export async function setActiveChecklistSession(
  sessionId: string,
): Promise<SessionChecklist> {
  const row = await selectDeliverySession(sessionId);
  if (!row) {
    throw new Error(`Unknown session id: ${sessionId}`);
  }
  return rowToChecklist(row);
}

export async function createChecklistSession(input?: {
  sessionName?: string;
  activate?: boolean;
}): Promise<SessionChecklist> {
  const sessionName = input?.sessionName?.trim() || "New trip";
  const row = await createDeliverySession({
    name: sessionName,
    checklist: emptySessionChecklist({ sessionName }),
    select: input?.activate !== false,
  });
  return rowToChecklist(row);
}

/**
 * Duplicate a trip into a new session tab (route, ships, box mixes kept;
 * completion / handled progress reset). Activates the copy by default.
 */
export async function duplicateChecklistSession(
  sessionId: string,
  input?: { activate?: boolean },
): Promise<SessionChecklist> {
  const source = await getChecklistSession(sessionId);
  const checklist = copySessionChecklist(source);
  const row = await createDeliverySession({
    name: checklist.sessionName,
    checklist,
    select: input?.activate !== false,
  });
  return rowToChecklist(row);
}

/** Soft-delete a session tab; ensures another active session remains. */
export async function deleteChecklistSession(sessionId: string): Promise<{
  deletedSessionId: string;
  activeSessionId: string;
  sessions: SessionTabSummary[];
}> {
  const id = sessionId.trim();
  const deleted = await softDeleteDeliverySession(id);
  if (!deleted) {
    throw new Error(`Unknown session id: ${id}`);
  }
  const list = await listChecklistSessions();
  return {
    deletedSessionId: id,
    activeSessionId: list.activeSessionId,
    sessions: list.sessions,
  };
}

export async function saveChecklistSession(
  session: SessionChecklist,
): Promise<SessionChecklist> {
  const id = session.id?.trim();
  if (!id) {
    const created = await createDeliverySession({
      name: session.sessionName,
      checklist: emptySessionChecklist(session),
      select: true,
    });
    const checklist = rowToChecklist(created);
    publishChecklistUpdated(checklist.id, checklist.updatedAt);
    return checklist;
  }

  const updated = await updateDeliverySessionChecklist(id, session);
  if (!updated) {
    // First save for a client-minted id that isn't in DB yet.
    const created = await createDeliverySession({
      name: session.sessionName,
      checklist: { ...session, id },
      select: true,
    });
    const checklist = rowToChecklist(created);
    publishChecklistUpdated(checklist.id, checklist.updatedAt);
    return checklist;
  }
  const checklist = rowToChecklist(updated);
  publishChecklistUpdated(checklist.id, checklist.updatedAt);
  return checklist;
}

export async function replaceChecklistRows(
  rows: HaulingChecklistRow[],
  sessionName?: string,
  options?: {
    sessionId?: string | null;
    resetTimer?: boolean;
    shipSlugs?: string[];
    missionCount?: number;
    missionsCompleted?: number;
    missions?: SessionMission[];
  },
): Promise<SessionChecklist> {
  const current = await getChecklistSession(options?.sessionId);
  const now = new Date().toISOString();
  const missions =
    options?.missions !== undefined ? options.missions : current.missions;
  const missionCount =
    options?.missionCount !== undefined
      ? options.missionCount
      : options?.missions !== undefined
        ? options.missions.length
        : current.missionCount;
  return saveChecklistSession({
    ...current,
    sessionName: sessionName?.trim() || current.sessionName,
    shipSlugs:
      options?.shipSlugs !== undefined ? options.shipSlugs : current.shipSlugs,
    missionCount,
    missionsCompleted:
      options?.missionsCompleted !== undefined
        ? options.missionsCompleted
        : options?.resetTimer
          ? 0
          : current.missionsCompleted,
    missions,
    startedAt: options?.resetTimer ? now : current.startedAt,
    completedAt: options?.resetTimer ? null : current.completedAt,
    rows,
  });
}

export async function setLegCompleted(
  rowId: string,
  isCompleted: boolean,
  sessionId?: string | null,
): Promise<SessionChecklist> {
  const current = await getChecklistSession(sessionId);
  const rows = current.rows.map((row) =>
    row.id === rowId ? { ...row, isCompleted } : row,
  );
  return saveChecklistSession({ ...current, rows });
}

export async function setSessionName(
  sessionName: string,
  sessionId?: string | null,
): Promise<SessionChecklist> {
  const current = await getChecklistSession(sessionId);
  return saveChecklistSession({
    ...current,
    sessionName: sessionName.trim() || current.sessionName,
  });
}

export async function setSessionShips(
  shipSlugs: string[],
  sessionId?: string | null,
): Promise<SessionChecklist> {
  const current = await getChecklistSession(sessionId);
  return saveChecklistSession({
    ...current,
    shipSlugs,
  });
}

export async function setSessionStartLocation(
  startLocationSlug: string | null,
  sessionId?: string | null,
): Promise<SessionChecklist> {
  const current = await getChecklistSession(sessionId);
  return saveChecklistSession({
    ...current,
    startLocationSlug,
  });
}
