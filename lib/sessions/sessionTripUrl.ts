import { appPaths } from "@/lib/appPaths";

const DEFAULT_APP_ORIGIN =
  "https://citizen-wing-commander-production.up.railway.app";

/** Public web origin for MCP handoff links (override with APP_ORIGIN). */
export function appOrigin(): string {
  const fromEnv =
    process.env.APP_ORIGIN?.trim() || process.env.PUBLIC_APP_ORIGIN?.trim();
  return (fromEnv || DEFAULT_APP_ORIGIN).replace(/\/$/, "");
}

/** Relative path + absolute URL for a trip checklist page. */
export function sessionTripUrl(sessionId: string): {
  path: string;
  url: string;
} {
  const path = appPaths.session(sessionId);
  return { path, url: `${appOrigin()}${path}` };
}
