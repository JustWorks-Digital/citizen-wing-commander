/**
 * Named App Router API paths.
 * Call sites must use these (or domain clients) — never hardcode `/api/...` strings.
 */
export const appApi = {
  checklist: "/api/checklist",
  sessions: "/api/sessions",
  healthDb: "/api/health/db",
} as const;

export type AppApiName = keyof typeof appApi;
export type AppApiPath = (typeof appApi)[AppApiName];
