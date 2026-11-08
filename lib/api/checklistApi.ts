import { appApi } from "@/lib/api/appRoutes";
import type { SessionChecklistModel } from "@/lib/missions/mockSession";

export type ChecklistFetchResult = {
  session: SessionChecklistModel | null;
  etag: string | null;
  notModified: boolean;
};

/** Load the shared active checklist (conditional GET via ETag). */
export async function fetchChecklist(
  etag: string | null,
): Promise<ChecklistFetchResult> {
  const headers: HeadersInit = {};
  if (etag) headers["If-None-Match"] = etag;
  const res = await fetch(appApi.checklist, {
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

/** Persist the shared active checklist. */
export async function saveChecklist(
  session: SessionChecklistModel,
): Promise<{ session: SessionChecklistModel; etag: string | null }> {
  const res = await fetch(appApi.checklist, {
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
