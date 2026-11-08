/**
 * Named App Router page paths (not API).
 * Keep session URLs in one place for tabs / redirects / MCP docs.
 */
export const appPaths = {
  home: "/",
  session: (sessionId: string) =>
    `/sessions/${encodeURIComponent(sessionId)}`,
} as const;
