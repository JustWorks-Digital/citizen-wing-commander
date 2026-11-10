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
  /** Onboard after this stop’s pickups, before unload. */
  beforeDelivery: number;
  /** Onboard after this stop’s unload. */
  after: number;
  pickup: number;
  delivery: number;
};

/**
 * Planned onboard SCU by stop (full route order).
 * Pickups apply before deliveries at each stop for a clear unload receipt.
 */
export function estimateOnboardScuByStop(
  rows: HaulingChecklistRow[],
): Map<string, StopOnboardScuReceipt> {
  let current = 0;
  const byStop = new Map<string, StopOnboardScuReceipt>();
  for (const row of rows) {
    let pickup = 0;
    let delivery = 0;
    const fallback = row.legKind === "both" ? null : row.legKind;
    for (const cargo of row.cargoDeliveries) {
      const role = cargo.role ?? fallback;
      if (role === "pickup") pickup += cargo.scu;
      else if (role === "delivery") delivery += cargo.scu;
    }
    current += pickup;
    const beforeDelivery = current;
    current = Math.max(0, current - delivery);
    byStop.set(row.id, {
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

/**
 * Total SCU across agreed (visible) missions.
 * Falls back to route pickup totals when the mission list is empty.
 */
export function estimateMissionsTotalScu(
  missions: SessionMission[] | undefined,
  rows: HaulingChecklistRow[],
): number {
  const agreed = (missions ?? []).filter((mission) => !mission.isHidden);
  if (agreed.length > 0) {
    return agreed.reduce(
      (sum, mission) =>
        sum + mission.cargo.reduce((lineSum, line) => lineSum + line.scu, 0),
      0,
    );
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
