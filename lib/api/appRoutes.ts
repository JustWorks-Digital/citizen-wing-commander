/**
 * Named App Router API paths.
 * Call sites must use these (or domain clients) — never hardcode `/api/...` strings.
 */
export const appApi = {
  checklist: "/api/checklist",
  checklistSessions: "/api/checklist/sessions",
  checklistSession: (sessionId: string) =>
    `/api/checklist/sessions/${encodeURIComponent(sessionId)}`,
  checklistSessionActivate: (sessionId: string) =>
    `/api/checklist/sessions/${encodeURIComponent(sessionId)}/activate`,
  checklistSessionScreenshots: (sessionId: string) =>
    `/api/checklist/sessions/${encodeURIComponent(sessionId)}/screenshots`,
  checklistSessionScreenshot: (sessionId: string, filename: string) =>
    `/api/checklist/sessions/${encodeURIComponent(sessionId)}/screenshots/${encodeURIComponent(filename)}`,
  catalogMissions: "/api/catalog/missions",
  catalogMissionsRenameScreenshots:
    "/api/catalog/missions/rename-screenshots",
  catalogMissionsBackfillRanks: "/api/catalog/missions/backfill-ranks",
  catalogMissionsBackfillRouteFlags:
    "/api/catalog/missions/backfill-route-flags",
  catalogMissionsBackfillOfferStarSystem:
    "/api/catalog/missions/backfill-offer-star-system",
  catalogMissionsAddToSession: "/api/catalog/missions/add-to-session",
  catalogMissionsScuBoxSplits: "/api/catalog/missions/scu-box-splits",
  sessions: "/api/sessions",
  ships: "/api/ships",
  healthDb: "/api/health/db",
  /** Contract/mission screenshot inbox for AI intake. */
  intakeUploads: "/api/intake/uploads",
  intakeUpload: (filename: string) =>
    `/api/intake/uploads/${encodeURIComponent(filename)}`,
  intakeUploadProcessed: (filename: string) =>
    `/api/intake/uploads/${encodeURIComponent(filename)}/processed`,
} as const;

export type AppApiName = keyof typeof appApi;
export type AppApiPath = (typeof appApi)[AppApiName];
