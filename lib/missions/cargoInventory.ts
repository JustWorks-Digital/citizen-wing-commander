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
 * When both run, phase order follows the first cargo line’s role at that stop
 * (pickup-then-delivery or delivery-then-pickup); the later phase’s `before`
 * equals the earlier phase’s `after`.
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

/** Pickup SCU for one commodity at a stop (aggregated). */
export type StopPickupCommodityScu = {
  commoditySlug: string;
  scu: number;
};

/** Pickup or delivery SCU for one commodity at a stop (aggregated). */
export type StopTransferCommodityScu = StopPickupCommodityScu & {
  action: "pickup" | "delivery";
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
   * At `both` stops, phase order follows the first cargo line’s role so
   * unload-then-load hubs (delivery lines first) do not double-count aboard.
   */
  transferLedgerByStop(
    rows: HaulingChecklistRow[],
  ): Map<string, StopTransferLedger> {
    let current = 0;
    const byStop = new Map<string, StopTransferLedger>();
    for (const row of rows) {
      let pickupAmount = 0;
      let deliveryAmount = 0;
      let firstRole: "pickup" | "delivery" | null = null;
      if (row.routeAction !== "quantum") {
        const fallback = row.routeAction === "both" ? null : row.routeAction;
        for (const cargo of row.cargoDeliveries) {
          const role = cargo.role ?? fallback;
          if (role !== "pickup" && role !== "delivery") continue;
          if (!firstRole) firstRole = role;
          if (role === "pickup") pickupAmount += cargo.scu;
          else deliveryAmount += cargo.scu;
        }
      }

      const deliverFirst =
        firstRole === "delivery" ||
        (firstRole == null && deliveryAmount > 0 && pickupAmount === 0);

      let pickup: ScuTransfer | false = false;
      let delivery: ScuTransfer | false = false;

      if (deliverFirst) {
        if (deliveryAmount > 0) {
          const before = current;
          current = Math.max(0, current - deliveryAmount);
          delivery = { before, amount: deliveryAmount, after: current };
        }
        if (pickupAmount > 0) {
          const before = current;
          current += pickupAmount;
          pickup = { before, amount: pickupAmount, after: current };
        }
      } else {
        if (pickupAmount > 0) {
          const before = current;
          current += pickupAmount;
          pickup = { before, amount: pickupAmount, after: current };
        }
        if (deliveryAmount > 0) {
          const before = current;
          current = Math.max(0, current - deliveryAmount);
          delivery = { before, amount: deliveryAmount, after: current };
        }
      }

      byStop.set(row.id, { pickup, delivery });
    }
    return byStop;
  },

  /**
   * Peak aboard SCU at a stop across its transfer phases
   * (handles pickup-then-delivery and delivery-then-pickup).
   */
  peakScuAtStop(ledger: StopTransferLedger): number {
    let peak = 0;
    if (ledger.pickup) {
      peak = Math.max(peak, ledger.pickup.before, ledger.pickup.after);
    }
    if (ledger.delivery) {
      peak = Math.max(peak, ledger.delivery.before, ledger.delivery.after);
    }
    return peak;
  },

  /**
   * Stop id where aboard SCU peaks during the planned trip
   * (fullest planned bay load along the route).
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
   * Pickup SCU by commodity at one stop (aggregated).
   * Empty for quantum / delivery-only stops.
   */
  pickupByCommodityAtStop(
    row: HaulingChecklistRow | null | undefined,
  ): StopPickupCommodityScu[] {
    return cargoInventory
      .transferByCommodityAtStop(row)
      .filter((item) => item.action === "pickup")
      .map(({ commoditySlug, scu }) => ({ commoditySlug, scu }));
  },

  /**
   * Pickup + delivery SCU by commodity at one stop (aggregated).
   * Empty for quantum stops / stops with no cargo lines.
   */
  transferByCommodityAtStop(
    row: HaulingChecklistRow | null | undefined,
  ): StopTransferCommodityScu[] {
    if (!row || row.routeAction === "quantum") return [];
    const fallback = row.routeAction === "both" ? null : row.routeAction;
    const byKey = new Map<string, StopTransferCommodityScu>();
    for (const cargo of row.cargoDeliveries) {
      const role = cargo.role ?? fallback;
      if (role !== "pickup" && role !== "delivery") continue;
      const key = `${role}:${cargo.commoditySlug}`;
      const existing = byKey.get(key);
      if (existing) {
        existing.scu += cargo.scu;
      } else {
        byKey.set(key, {
          action: role,
          commoditySlug: cargo.commoditySlug,
          scu: cargo.scu,
        });
      }
    }
    return [...byKey.values()].sort((a, b) => {
      if (a.action !== b.action) {
        return a.action === "pickup" ? -1 : 1;
      }
      return a.commoditySlug.localeCompare(b.commoditySlug);
    });
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
