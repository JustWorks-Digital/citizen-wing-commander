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
    if (row.routeAction === "quantum") continue;
    const fallback = row.routeAction === "both" ? null : row.routeAction;
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

/** Onboard SCU around one load or unload transfer at a stop. */
export type ScuTransfer = {
  /** Aboard when this transfer starts. */
  before: number;
  /** SCU moved in this transfer. */
  amount: number;
  /** Aboard when this transfer ends. */
  after: number;
};

/**
 * SCU transfer ledger for one stop (full planned trip walk).
 * Idle pickup/delivery are `false` (no load / no unload at this stop).
 * When both run, `pickup.after` === `delivery.before`.
 */
export type StopTransferLedger = {
  pickup: ScuTransfer | false;
  delivery: ScuTransfer | false;
};

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
 * Cargo helpers (transfer ledger, onboard estimates, mission SCU).
 *
 * Prefer `cargoInventory.transferLedgerByStop(tripStops)` over long flat names.
 */
export const cargoInventory = {
  /**
   * SCU transfer ledger by stop id for the full planned trip.
   * Pickups apply before deliveries at each stop.
   */
  transferLedgerByStop(
    rows: HaulingChecklistRow[],
  ): Map<string, StopTransferLedger> {
    let current = 0;
    const byStop = new Map<string, StopTransferLedger>();
    for (const row of rows) {
      let pickupAmount = 0;
      let deliveryAmount = 0;
      if (row.routeAction !== "quantum") {
        const fallback = row.routeAction === "both" ? null : row.routeAction;
        for (const cargo of row.cargoDeliveries) {
          const role = cargo.role ?? fallback;
          if (role === "pickup") pickupAmount += cargo.scu;
          else if (role === "delivery") deliveryAmount += cargo.scu;
        }
      }
      const beforePickup = current;
      current += pickupAmount;
      const afterPickup = current;
      current = Math.max(0, current - deliveryAmount);
      byStop.set(row.id, {
        pickup:
          pickupAmount > 0
            ? {
                before: beforePickup,
                amount: pickupAmount,
                after: afterPickup,
              }
            : false,
        delivery:
          deliveryAmount > 0
            ? {
                before: afterPickup,
                amount: deliveryAmount,
                after: current,
              }
            : false,
      });
    }
    return byStop;
  },

  /** Peak aboard SCU at a stop (after pickup, else before deliver). */
  peakScuAtStop(ledger: StopTransferLedger): number {
    if (ledger.pickup) return ledger.pickup.after;
    if (ledger.delivery) return ledger.delivery.before;
    return 0;
  },

  /**
   * Stop id where aboard SCU peaks (after pickups, before unload).
   * Used for cargo-bay “All stops” scope so the grid shows the fullest load.
   */
  peakStopId(rows: HaulingChecklistRow[]): string | null {
    const ledgerByStop = cargoInventory.transferLedgerByStop(rows);
    let bestId: string | null = null;
    let bestScu = -1;
    for (const row of rows) {
      if (row.routeAction === "quantum") continue;
      const ledger = ledgerByStop.get(row.id);
      const scu = ledger ? cargoInventory.peakScuAtStop(ledger) : 0;
      if (scu > bestScu) {
        bestScu = scu;
        bestId = row.id;
      }
    }
    return bestId;
  },

  /**
   * SCU currently aboard from completed stops only
   * (pickups add, deliveries subtract), in trip order.
   */
  fromCompleted(rows: HaulingChecklistRow[]): number {
    return applyCargoToOnboard(0, rows, { stopAfterIncomplete: true }).onboard;
  },

  /**
   * Highest SCU aboard if the full trip is flown as planned
   * (peak after each pickup/delivery in order).
   */
  peakOnboard(rows: HaulingChecklistRow[]): number {
    return applyCargoToOnboard(0, rows).peak;
  },

  /**
   * Per-contract SCU for visible (non-hidden) session missions.
   * Empty when the mission list is missing — callers may fall back to trip totals.
   */
  missionBreakdown(
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
  },

  /**
   * Total SCU across agreed (visible) missions.
   * Falls back to trip pickup totals when the mission list is empty.
   */
  missionsTotal(
    missions: SessionMission[] | undefined,
    rows: HaulingChecklistRow[],
  ): number {
    const breakdown = cargoInventory.missionBreakdown(missions);
    if (breakdown.length > 0) {
      return breakdown.reduce((sum, item) => sum + item.scu, 0);
    }

    let pickupTotal = 0;
    for (const row of rows) {
      const fallback = row.routeAction === "both" ? null : row.routeAction;
      for (const cargo of row.cargoDeliveries) {
        const role = cargo.role ?? fallback;
        if (role === "pickup") pickupTotal += cargo.scu;
      }
    }
    return pickupTotal;
  },
};
