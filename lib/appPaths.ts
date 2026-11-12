/**
 * Named App Router page paths (not API).
 * Keep session URLs in one place for tabs / redirects / MCP docs.
 */
export const appPaths = {
  home: "/",
  /** Hauling session checklist (home redirects to active session). */
  sessions: "/",
  /** Planning catalog of observed missions. */
  missionsCatalog: "/missions",
  /** Upload contract/mission screenshots for AI intake into the catalog. */
  intake: "/intake",
  session: (sessionId: string) =>
    `/sessions/${encodeURIComponent(sessionId)}`,
} as const;
