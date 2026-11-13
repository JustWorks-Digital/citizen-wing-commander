import type { SessionChecklistModel } from "@/lib/missions/mockSession";
import type { TripCargoIssue } from "@/lib/missions/tripPlan";
import sessionJson from "./crossed-haul-invalid-2026-11-13/session.json";
import issuesJson from "./crossed-haul-invalid-2026-11-13/trip-cargo-issues.json";

/** Live-session backup: crossed Covalex↔Shubin hauls with invalid first-stop drops. */
export const crossedHaulInvalidSession =
  sessionJson as unknown as SessionChecklistModel;

export const crossedHaulInvalidTripCargoIssues = {
  ok: issuesJson.ok as boolean,
  issueCount: issuesJson.issueCount as number,
  issues: issuesJson.issues as TripCargoIssue[],
};
