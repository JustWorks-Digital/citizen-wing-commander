import type { HaulingChecklistRow } from "@/lib/missions/mockSession";
import type { SessionMission } from "@/lib/missions/sessionMissions";

function applyCargoToOnboard(
  onboard: number,
  rows: HaulingChecklistRow[],
  options?: { stopAfterIncomplete?: boolean },
): { onboard: number; peak: number } {
  let current = onboard;
  let peak = Math.max(0, current);
  for (const row of rows) {
    if (options?.stopAfterIncomplete && !row.isCompleted) break;
    if (row.legKind === "quantum") continue;
    const fallback = row.legKind === "both" ? null : row.legKind;
    for (const cargo of row.cargoDeliveries) {
      const role = cargo.role ?? fallback;
      if (role === "pickup") current += cargo.scu;
      else if (role === "delivery") current -= cargo.scu;
      current = Math.max(0, current);
      peak = Math.max(peak, current);
    }
  }
  return { onboard: current, peak };
}

/**
 * Estimate SCU currently aboard from completed legs only
 * (pickups add, deliveries subtract), in route order.
 */
export function estimateOnboardScu(rows: HaulingChecklistRow[]): number {
  return applyCargoToOnboard(0, rows, { stopAfterIncomplete: true }).onboard;
}

export type StopOnboardScuReceipt = {
  /** Onboard before this stop’s pickups. */
  beforePickup: number;
  /** Onboard after this stop’s pickups, before unload. */
  beforeDelivery: number;
  /** Onboard after this stop’s unload. */
  after: number;
  pickup: number;
  delivery: number;
};

/**
 * Planned onboard SCU by stop (full route order).
 * Pickups apply before deliveries at each stop for clear load/unload receipts.
 */
export function estimateOnboardScuByStop(
  rows: HaulingChecklistRow[],
): Map<string, StopOnboardScuReceipt> {
  let current = 0;
  const byStop = new Map<string, StopOnboardScuReceipt>();
  for (const row of rows) {
    let pickup = 0;
    let delivery = 0;
    if (row.legKind !== "quantum") {
      const fallback = row.legKind === "both" ? null : row.legKind;
      for (const cargo of row.cargoDeliveries) {
        const role = cargo.role ?? fallback;
        if (role === "pickup") pickup += cargo.scu;
        else if (role === "delivery") delivery += cargo.scu;
      }
    }
    const beforePickup = current;
    current += pickup;
    const beforeDelivery = current;
    current = Math.max(0, current - delivery);
    byStop.set(row.id, {
      beforePickup,
      beforeDelivery,
      after: current,
      pickup,
      delivery,
    });
  }
  return byStop;
}

/**
 * Highest SCU aboard if the full route is flown as planned
 * (peak after each pickup/delivery in order).
 */
export function estimatePeakOnboardScu(rows: HaulingChecklistRow[]): number {
  return applyCargoToOnboard(0, rows).peak;
}

export type MissionScuBreakdownItem = {
  missionId: string;
  title: string;
  scu: number;
  /** Logical screenshot paths for the source icon / lightbox. */
  screenshots: string[];
};

function missionCargoScu(mission: SessionMission): number {
  return mission.cargo.reduce((sum, line) => sum + line.scu, 0);
}

/**
 * Per-contract SCU for visible (non-hidden) session missions.
 * Empty when the mission list is missing — callers may fall back to route totals.
 */
export function estimateMissionScuBreakdown(
  missions: SessionMission[] | undefined,
): MissionScuBreakdownItem[] {
  return (missions ?? [])
    .filter((mission) => !mission.isHidden)
    .map((mission) => ({
      missionId: mission.id,
      title: mission.title,
      scu: missionCargoScu(mission),
      screenshots: [...(mission.screenshots ?? [])],
    }));
}

/**
 * Total SCU across agreed (visible) missions.
 * Falls back to route pickup totals when the mission list is empty.
 */
export function estimateMissionsTotalScu(
  missions: SessionMission[] | undefined,
  rows: HaulingChecklistRow[],
): number {
  const breakdown = estimateMissionScuBreakdown(missions);
  if (breakdown.length > 0) {
    return breakdown.reduce((sum, item) => sum + item.scu, 0);
  }

  let pickupTotal = 0;
  for (const row of rows) {
    const fallback = row.legKind === "both" ? null : row.legKind;
    for (const cargo of row.cargoDeliveries) {
      const role = cargo.role ?? fallback;
      if (role === "pickup") pickupTotal += cargo.scu;
    }
  }
  return pickupTotal;
}
