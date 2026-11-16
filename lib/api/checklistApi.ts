import { appApi } from "@/lib/api/appRoutes";
import type { SessionChecklist, SessionTabSummary } from "@/lib/missions/sessionChecklist";
export type ChecklistFetchResult = {
  session: SessionChecklist | null;
  etag: string | null;
  notModified: boolean;
};

export type ChecklistSessionsList = {
  activeSessionId: string;
  sessions: SessionTabSummary[];
};

function checklistUrl(sessionId?: string | null): string {
  if (!sessionId) return appApi.checklist;
  const url = new URL(appApi.checklist, "http://local");
  url.searchParams.set("sessionId", sessionId);
  return `${url.pathname}${url.search}`;
}

/** Load a checklist session (defaults to active). Conditional GET via ETag. */
export async function fetchChecklist(
  etag: string | null,
  sessionId?: string | null,
): Promise<ChecklistFetchResult> {
  const headers: HeadersInit = {};
  if (etag) headers["If-None-Match"] = etag;
  const res = await fetch(checklistUrl(sessionId), {
    cache: "no-store",
    headers,
  });
  const nextEtag = res.headers.get("ETag");
  if (res.status === 304) {
    return { session: null, etag: nextEtag ?? etag, notModified: true };
  }
  if (!res.ok) {
    throw new Error(`Checklist load failed (${res.status})`);
  }
  const session = (await res.json()) as SessionChecklist;
  return { session, etag: nextEtag, notModified: false };
}

/** Persist a checklist session (uses `session.id`). */
export async function saveChecklist(
  session: SessionChecklist,
): Promise<{ session: SessionChecklist; etag: string | null }> {
  const res = await fetch(checklistUrl(session.id), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(session),
  });
  if (!res.ok) {
    throw new Error(`Checklist save failed (${res.status})`);
  }
  return {
    session: (await res.json()) as SessionChecklist,
    etag: res.headers.get("ETag"),
  };
}

/** List open hauling sessions for the tab strip. */
export async function fetchChecklistSessions(): Promise<ChecklistSessionsList> {
  const res = await fetch(appApi.checklistSessions, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Checklist sessions load failed (${res.status})`);
  }
  return (await res.json()) as ChecklistSessionsList;
}

/** Create a new empty session and activate it. */
export async function createChecklistSession(input?: {
  sessionName?: string;
}): Promise<SessionChecklist> {
  const res = await fetch(appApi.checklistSessions, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionName: input?.sessionName,
      activate: true,
    }),
  });
  if (!res.ok) {
    throw new Error(`Checklist session create failed (${res.status})`);
  }
  return (await res.json()) as SessionChecklist;
}

/** Make a session the active one (MCP default + UI focus). */
export async function activateChecklistSession(
  sessionId: string,
): Promise<SessionChecklist> {
  const res = await fetch(appApi.checklistSessionActivate(sessionId), {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error(`Checklist session activate failed (${res.status})`);
  }
  return (await res.json()) as SessionChecklist;
}

/** Duplicate a trip into a new session (progress reset, config kept). */
export async function copyChecklistSession(
  sessionId: string,
): Promise<SessionChecklist> {
  const res = await fetch(appApi.checklistSessionCopy(sessionId), {
    method: "POST",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(
      body?.error ?? `Checklist session copy failed (${res.status})`,
    );
  }
  return (await res.json()) as SessionChecklist;
}

export type DeleteChecklistSessionResult = {
  deletedSessionId: string;
  activeSessionId: string;
  sessions: SessionTabSummary[];
};

/** Soft-delete a session tab (closes it for the crew). */
export async function deleteChecklistSession(
  sessionId: string,
): Promise<DeleteChecklistSessionResult> {
  const res = await fetch(appApi.checklistSession(sessionId), {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(`Checklist session delete failed (${res.status})`);
  }
  return (await res.json()) as DeleteChecklistSessionResult;
}
