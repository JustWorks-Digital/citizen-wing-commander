/**
 * Named App Router API paths.
 * Call sites must use these (or domain clients) — never hardcode `/api/...` strings.
 */
export const appApi = {
  checklist: "/api/checklist",
  checklistSessions: "/api/checklist/sessions",
  checklistSessionActivate: (sessionId: string) =>
    `/api/checklist/sessions/${encodeURIComponent(sessionId)}/activate`,
  sessions: "/api/sessions",
  healthDb: "/api/health/db",
} as const;

export type AppApiName = keyof typeof appApi;
export type AppApiPath = (typeof appApi)[AppApiName];
