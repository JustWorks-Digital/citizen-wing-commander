import "server-only";

import { createHash } from "node:crypto";
import {
  createDeliverySession,
  getDeliverySession,
  getSelectedDeliverySession,
  listActiveDeliverySessionTabs,
  rowToChecklist,
  selectDeliverySession,
  updateDeliverySessionChecklist,
} from "@/db/queries/deliverySessions";
import type {
  HaulingChecklistRow,
  SessionChecklistModel,
  SessionMission,
} from "@/lib/missions/mockSession";
import {
  emptySessionChecklist,
  summarizeSessionChecklist,
  type SessionTabSummary,
} from "@/lib/missions/sessionChecklist";

export type { SessionTabSummary };

export function checklistEtag(session: SessionChecklistModel): string {
  const basis = `${session.id}:${session.updatedAt}`;
  const hash = createHash("sha1").update(basis).digest("hex").slice(0, 16);
  return `"${hash}"`;
}

async function ensureAtLeastOneSession(): Promise<SessionChecklistModel> {
  const selected = await getSelectedDeliverySession();
  if (selected) {
    return rowToChecklist(selected);
  }
  const created = await createDeliverySession({
    name: "New session",
    checklist: emptySessionChecklist({ sessionName: "New session" }),
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
): Promise<SessionChecklistModel> {
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
): Promise<SessionChecklistModel> {
  const row = await selectDeliverySession(sessionId);
  if (!row) {
    throw new Error(`Unknown session id: ${sessionId}`);
  }
  return rowToChecklist(row);
}

export async function createChecklistSession(input?: {
  sessionName?: string;
  activate?: boolean;
}): Promise<SessionChecklistModel> {
  const sessionName = input?.sessionName?.trim() || "New session";
  const row = await createDeliverySession({
    name: sessionName,
    checklist: emptySessionChecklist({ sessionName }),
    select: input?.activate !== false,
  });
  return rowToChecklist(row);
}

export async function saveChecklistSession(
  session: SessionChecklistModel,
): Promise<SessionChecklistModel> {
  const id = session.id?.trim();
  if (!id) {
    const created = await createDeliverySession({
      name: session.sessionName,
      checklist: emptySessionChecklist(session),
      select: true,
    });
    return rowToChecklist(created);
  }

  const updated = await updateDeliverySessionChecklist(id, session);
  if (!updated) {
    // First save for a client-minted id that isn't in DB yet.
    const created = await createDeliverySession({
      name: session.sessionName,
      checklist: { ...session, id },
      select: true,
    });
    return rowToChecklist(created);
  }
  return rowToChecklist(updated);
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
): Promise<SessionChecklistModel> {
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
): Promise<SessionChecklistModel> {
  const current = await getChecklistSession(sessionId);
  const rows = current.rows.map((row) =>
    row.id === rowId ? { ...row, isCompleted } : row,
  );
  return saveChecklistSession({ ...current, rows });
}

export async function setSessionName(
  sessionName: string,
  sessionId?: string | null,
): Promise<SessionChecklistModel> {
  const current = await getChecklistSession(sessionId);
  return saveChecklistSession({
    ...current,
    sessionName: sessionName.trim() || current.sessionName,
  });
}

export async function setSessionShips(
  shipSlugs: string[],
  sessionId?: string | null,
): Promise<SessionChecklistModel> {
  const current = await getChecklistSession(sessionId);
  return saveChecklistSession({
    ...current,
    shipSlugs,
  });
}

export async function setSessionStartLocation(
  startLocationSlug: string | null,
  sessionId?: string | null,
): Promise<SessionChecklistModel> {
  const current = await getChecklistSession(sessionId);
  return saveChecklistSession({
    ...current,
    startLocationSlug,
  });
}
