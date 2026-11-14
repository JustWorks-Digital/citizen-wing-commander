import type { HaulingChecklistRow } from "@/lib/missions/mockSession";
import { screenshotUrlFromLogicalPath } from "@/lib/missions/catalogScreenshotUrl";
import type { SessionMission } from "@/lib/missions/sessionMissions";
import {
  resolveCommoditySlug,
  resolveLocationSlug,
} from "@/lib/sessions/resolveRefs";

export type RowMissionScreenshotRef = {
  logicalPath: string;
  filename: string;
  /** Short label for chips (filename without extension). */
  label: string;
  /** Mission title(s) this shot belongs to. */
  missionTitles: string[];
  /**
   * Lightbox bottom caption(s): mission title + SCU splits for verification.
   * Joined with blank lines when multiple missions share a shot.
   */
  captions: string[];
  /**
   * Image URL for `<batchId>/<filename>` under the screenshot store.
   * Null when the logical path cannot be resolved to an API URL.
   */
  url: string | null;
};

/** Compact per-stop / cargo SCU lines for session mission screenshot captions. */
export function sessionMissionScuSplitsCaption(mission: SessionMission): string {
  if (mission.deliverySplits && mission.deliverySplits.length > 0) {
    return mission.deliverySplits
      .map((split) => {
        const cargo = `${split.scu} SCU ${split.commodity}`;
        if (split.from === split.to) return `${cargo} · ${split.to}`;
        return `${cargo} · ${split.from} → ${split.to}`;
      })
      .join("\n");
  }
  if (mission.cargo.length > 0) {
    return mission.cargo
      .map((line) => `${line.scu} SCU ${line.commodity}`)
      .join(" · ");
  }
  return mission.cargoSummary?.trim() || "";
}

/** Mission title + SCU splits for source screenshot captions. */
export function sessionMissionSourceCaption(mission: SessionMission): string {
  const splits = sessionMissionScuSplitsCaption(mission);
  return splits ? `${mission.title}\n${splits}` : mission.title;
}

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
  if (row.routeAction === "pickup") return true;
  if (row.routeAction === "delivery") return false;
  return row.cargoDeliveries.some(
    (cargo) => cargo.role === "pickup" || cargo.role == null,
  );
}

function rowHasDeliveryCargo(row: HaulingChecklistRow): boolean {
  if (row.routeAction === "delivery") return true;
  if (row.routeAction === "pickup") return false;
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

function commoditySlugOf(nameOrSlug: string): string {
  return (
    resolveCommoditySlug(nameOrSlug) ?? nameOrSlug.trim().toLowerCase()
  );
}

/** Whether the mission’s cargo / splits include this commodity slug. */
export function missionCarriesCommodity(
  mission: SessionMission,
  commoditySlug: string,
): boolean {
  const want = commoditySlug.trim().toLowerCase();
  if (!want) return false;
  if (
    mission.cargo.some((line) => commoditySlugOf(line.commodity) === want)
  ) {
    return true;
  }
  if (
    mission.deliverySplits?.some(
      (split) => commoditySlugOf(split.commodity) === want,
    )
  ) {
    return true;
  }
  if (mission.pickupSplits) {
    for (const lines of Object.values(mission.pickupSplits)) {
      if (lines.some((line) => commoditySlugOf(line.commodity) === want)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Infer `missionId` for a cargo line that was stored without one — match
 * stop location + pickup/delivery role + commodity against session missions.
 * Returns null when already tagged, ambiguous, or unmatched.
 */
export function inferCargoMissionId(input: {
  missionId?: string | null;
  commoditySlug: string;
  role?: "pickup" | "delivery" | null;
  row: HaulingChecklistRow;
  missions: SessionMission[];
  groupRole?: "pickup" | "delivery" | null;
}): string | null {
  const tagged = input.missionId?.trim();
  if (tagged) return tagged;

  const role = input.role ?? input.groupRole ?? null;
  const slug = input.row.locationSlug;
  const candidates = input.missions.filter((mission) => {
    if (mission.isHidden) return false;
    const collects = missionCollectsAt(mission, slug);
    const delivers = missionDeliversAt(mission, slug);
    if (role === "pickup" && !collects) return false;
    if (role === "delivery" && !delivers) return false;
    if (role == null && !collects && !delivers) return false;
    return missionCarriesCommodity(mission, input.commoditySlug);
  });
  return candidates.length === 1 ? candidates[0]!.id : null;
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
      .map((cargo) =>
        inferCargoMissionId({
          missionId: cargo.missionId,
          commoditySlug: cargo.commoditySlug,
          role: cargo.role,
          row,
          missions,
        }),
      )
      .filter((id): id is string => Boolean(id)),
  );

  return missions.filter((mission) => {
    if (mission.isHidden) return false;
    // Prefer cargo-tagged missions for this stop — do not also pull in every
    // other contract that merely shares the location.
    if (missionIdsOnCargo.size > 0) {
      return missionIdsOnCargo.has(mission.id);
    }
    const collects = missionCollectsAt(mission, row.locationSlug);
    const delivers = missionDeliversAt(mission, row.locationSlug);
    if (wantDelivery && delivers) return true;
    if (wantPickup && collects) return true;
    return false;
  });
}

function pushMissionScreenshotRef(
  byPath: Map<string, RowMissionScreenshotRef>,
  mission: SessionMission,
  logicalPath: string,
  sessionId: string,
): void {
  const trimmed = logicalPath.trim();
  if (!trimmed) return;
  const caption = sessionMissionSourceCaption(mission);
  const existing = byPath.get(trimmed);
  if (existing) {
    if (!existing.missionTitles.includes(mission.title)) {
      existing.missionTitles.push(mission.title);
    }
    if (!existing.captions.includes(caption)) {
      existing.captions.push(caption);
    }
    return;
  }
  const filename = filenameFromLogicalPath(trimmed);
  byPath.set(trimmed, {
    logicalPath: trimmed,
    filename,
    label: labelFromFilename(filename),
    missionTitles: [mission.title],
    captions: [caption],
    url: screenshotUrlForSession(trimmed, sessionId),
  });
}

/** Screenshot refs for a single session mission (cargo-layout source icon). */
export function screenshotRefsForMission(
  mission: SessionMission,
  sessionId: string,
): RowMissionScreenshotRef[] {
  const byPath = new Map<string, RowMissionScreenshotRef>();
  for (const logicalPath of mission.screenshots) {
    pushMissionScreenshotRef(byPath, mission, logicalPath, sessionId);
  }
  return [...byPath.values()];
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
      pushMissionScreenshotRef(byPath, mission, logicalPath, sessionId);
    }
  }

  return [...byPath.values()];
}
