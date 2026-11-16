import { appOrigin } from "@/lib/api/appOrigin";
import { appPaths } from "@/lib/appPaths";

/** Relative path + absolute URL for a trip checklist page. */
export function sessionTripUrl(sessionId: string): {
  path: string;
  url: string;
} {
  const path = appPaths.session(sessionId);
  return { path, url: `${appOrigin()}${path}` };
}
