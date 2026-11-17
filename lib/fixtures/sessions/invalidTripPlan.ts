import type { SessionChecklist } from "@/lib/missions/sessionChecklist";
import type { TripCargoIssue } from "@/lib/missions/tripPlan";
import sessionJson from "@/tests/sessions/hurston-covalex-invalid-2026-11-17/session.json";
import issuesJson from "@/tests/sessions/hurston-covalex-invalid-2026-11-17/trip-cargo-issues.json";

/**
 * Invalid trip plan reference (Hurston Covalex local+stellar).
 * Canonical pack: `tests/sessions/hurston-covalex-invalid-2026-11-17/`.
 */
export const invalidTripPlanSession =
  sessionJson as unknown as SessionChecklist;

export const invalidTripPlanTripCargoIssues = {
  ok: issuesJson.ok as boolean,
  issueCount: issuesJson.issueCount as number,
  issues: issuesJson.issues as TripCargoIssue[],
};
