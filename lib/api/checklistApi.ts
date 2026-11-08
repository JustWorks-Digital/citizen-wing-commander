import { appApi } from "@/lib/api/appRoutes";
import type { SessionChecklistModel } from "@/lib/missions/mockSession";
import type { SessionTabSummary } from "@/lib/missions/sessionChecklist";

export type ChecklistFetchResult = {
  session: SessionChecklistModel | null;
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
  const session = (await res.json()) as SessionChecklistModel;
  return { session, etag: nextEtag, notModified: false };
}

/** Persist a checklist session (uses `session.id`). */
export async function saveChecklist(
  session: SessionChecklistModel,
): Promise<{ session: SessionChecklistModel; etag: string | null }> {
  const res = await fetch(checklistUrl(session.id), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(session),
  });
  if (!res.ok) {
    throw new Error(`Checklist save failed (${res.status})`);
  }
  return {
    session: (await res.json()) as SessionChecklistModel,
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
}): Promise<SessionChecklistModel> {
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
  return (await res.json()) as SessionChecklistModel;
}

/** Make a session the active one (MCP default + UI focus). */
export async function activateChecklistSession(
  sessionId: string,
): Promise<SessionChecklistModel> {
  const res = await fetch(appApi.checklistSessionActivate(sessionId), {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error(`Checklist session activate failed (${res.status})`);
  }
  return (await res.json()) as SessionChecklistModel;
}
