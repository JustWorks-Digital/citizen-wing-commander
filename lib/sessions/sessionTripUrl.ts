import { appOrigin } from "@/lib/api/appOrigin";
import { appPaths } from "@/lib/appPaths";

/** Relative path + absolute URL for a session checklist page. */
export function sessionPageUrl(sessionId: string): {
  path: string;
  url: string;
} {
  const path = appPaths.session(sessionId);
  return { path, url: `${appOrigin()}${path}` };
}

/** @deprecated Prefer `sessionPageUrl`. */
export const sessionTripUrl = sessionPageUrl;
