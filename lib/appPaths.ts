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
  /** Upload contract/mission screenshots for AI catalog capture. */
  capture: "/capture",
  /** Feature overlays for stream marketing / OBS review. */
  marketing: "/marketing",
  /** Clean auto-rotating OBS browser source for one aspect-ratio family. */
  marketingObs: (family: "landscape" | "square" | "banner") =>
    `/marketing/obs/${encodeURIComponent(family)}`,
  session: (sessionId: string) =>
    `/sessions/${encodeURIComponent(sessionId)}`,
} as const;
