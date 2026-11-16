import type { SessionChecklist } from "@/lib/missions/sessionChecklist";
import type { TripCargoIssue } from "@/lib/missions/tripPlan";
import sessionJson from "@/tests/sessions/crossed-haul-invalid-2026-11-13/session.json";
import issuesJson from "@/tests/sessions/crossed-haul-invalid-2026-11-13/trip-cargo-issues.json";

/**
 * Live-session backup: crossed Covalex↔Shubin hauls with invalid first-stop drops.
 * Canonical pack: `tests/sessions/crossed-haul-invalid-2026-11-13/`.
 */
export const crossedHaulInvalidSession =
  sessionJson as unknown as SessionChecklist;

export const crossedHaulInvalidTripCargoIssues = {
  ok: issuesJson.ok as boolean,
  issueCount: issuesJson.issueCount as number,
  issues: issuesJson.issues as TripCargoIssue[],
};
