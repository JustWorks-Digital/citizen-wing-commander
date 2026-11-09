import type { HaulingChecklistRow } from "@/lib/missions/mockSession";
import { screenshotUrlFromLogicalPath } from "@/lib/missions/catalogScreenshotUrl";
import type { SessionMission } from "@/lib/missions/sessionMissions";
import { resolveLocationSlug } from "@/lib/sessions/resolveRefs";

export type RowMissionScreenshotRef = {
  logicalPath: string;
  filename: string;
  /** Short label for chips (filename without extension). */
  label: string;
  /** Mission title(s) this shot belongs to. */
  missionTitles: string[];
  /**
   * Image URL for `<batchId>/<filename>` under the screenshot store.
   * Null when the logical path cannot be resolved to an API URL.
   */
  url: string | null;
};

function locationMatchesRow(
  locationNameOrSlug: string,
  rowLocationSlug: string,
): boolean {
  const resolved = resolveLocationSlug(locationNameOrSlug);
  if (resolved && resolved === rowLocationSlug) return true;
  return (
    locationNameOrSlug.trim().toLowerCase() === rowLocationSlug.toLowerCase()
  );
}

function missionCollectsAt(
  mission: SessionMission,
  rowLocationSlug: string,
): boolean {
  if (mission.from.some((loc) => locationMatchesRow(loc, rowLocationSlug))) {
    return true;
  }
  const splits = mission.deliverySplits;
  if (splits?.some((split) => locationMatchesRow(split.from, rowLocationSlug))) {
    return true;
  }
  if (mission.pickupSplits) {
    return Object.keys(mission.pickupSplits).some((loc) =>
      locationMatchesRow(loc, rowLocationSlug),
    );
  }
  return false;
}

function missionDeliversAt(
  mission: SessionMission,
  rowLocationSlug: string,
): boolean {
  if (mission.to.some((loc) => locationMatchesRow(loc, rowLocationSlug))) {
    return true;
  }
  const splits = mission.deliverySplits;
  return Boolean(
    splits?.some((split) => locationMatchesRow(split.to, rowLocationSlug)),
  );
}

function rowHasPickupCargo(row: HaulingChecklistRow): boolean {
  if (row.legKind === "pickup") return true;
  if (row.legKind === "delivery") return false;
  return row.cargoDeliveries.some(
    (cargo) => cargo.role === "pickup" || cargo.role == null,
  );
}

function rowHasDeliveryCargo(row: HaulingChecklistRow): boolean {
  if (row.legKind === "delivery") return true;
  if (row.legKind === "pickup") return false;
  return row.cargoDeliveries.some(
    (cargo) => cargo.role === "delivery" || cargo.role == null,
  );
}

function filenameFromLogicalPath(logicalPath: string): string {
  const parts = logicalPath.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? logicalPath;
}

function labelFromFilename(filename: string): string {
  return filename.replace(/\.[a-z0-9]+$/i, "");
}

function screenshotUrlForSession(
  logicalPath: string,
  sessionId: string,
): string | null {
  const parts = logicalPath.split("/").filter(Boolean);
  if (parts.length === 0) return null;
  // Bare filename → treat as this session’s batch.
  if (parts.length === 1) {
    return screenshotUrlFromLogicalPath(`${sessionId}/${parts[0]}`);
  }
  return screenshotUrlFromLogicalPath(logicalPath);
}

/**
 * Missions that touch this stop (collect and/or deliver), with their
 * screenshot references — used on checklist rows so drivers can open the
 * contract shot for the cargo they’re handling here.
 */
export function missionsRelevantToRow(
  missions: SessionMission[],
  row: HaulingChecklistRow,
): SessionMission[] {
  const wantPickup = rowHasPickupCargo(row);
  const wantDelivery = rowHasDeliveryCargo(row);
  const missionIdsOnCargo = new Set(
    row.cargoDeliveries
      .map((cargo) => cargo.missionId)
      .filter((id): id is string => Boolean(id)),
  );

  return missions.filter((mission) => {
    if (mission.isHidden) return false;
    if (missionIdsOnCargo.has(mission.id)) return true;
    const collects = missionCollectsAt(mission, row.locationSlug);
    const delivers = missionDeliversAt(mission, row.locationSlug);
    if (wantDelivery && delivers) return true;
    if (wantPickup && collects) return true;
    return false;
  });
}

/** Unique screenshot refs for missions relevant to a checklist stop. */
export function screenshotRefsForRow(
  missions: SessionMission[],
  row: HaulingChecklistRow,
  sessionId: string,
): RowMissionScreenshotRef[] {
  const relevant = missionsRelevantToRow(missions, row);
  const byPath = new Map<string, RowMissionScreenshotRef>();

  for (const mission of relevant) {
    for (const logicalPath of mission.screenshots) {
      const trimmed = logicalPath.trim();
      if (!trimmed) continue;
      const existing = byPath.get(trimmed);
      if (existing) {
        if (!existing.missionTitles.includes(mission.title)) {
          existing.missionTitles.push(mission.title);
        }
        continue;
      }
      const filename = filenameFromLogicalPath(trimmed);
      byPath.set(trimmed, {
        logicalPath: trimmed,
        filename,
        label: labelFromFilename(filename),
        missionTitles: [mission.title],
        url: screenshotUrlForSession(trimmed, sessionId),
      });
    }
  }

  return [...byPath.values()];
}
