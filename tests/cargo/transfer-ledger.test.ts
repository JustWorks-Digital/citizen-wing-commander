import { describe, expect, it } from "vitest";
import { cargoInventory } from "@/lib/missions/cargoInventory";
import { getTripStops } from "./fixtures";

/**
 * Transfer ledger = planned SCU in/out at each stop (not bay contents).
 *
 * Public API: cargoInventory.transferLedgerByStop
 * - pickup: ScuTransfer | false
 * - delivery: ScuTransfer | false
 * (when both run, phase order follows the first cargo line’s role)
 */
describe("transfer ledger (cargoInventory.transferLedgerByStop)", () => {
  it("tracks pickup and delivery transfers across stop shapes", () => {
    const pickupThenDeliverLedger = cargoInventory.transferLedgerByStop(
      getTripStops("pickupThenDeliver"),
    );

    // Pickup only: arrive empty, load 16 SCU, leave with that cargo still aboard
    expect(pickupThenDeliverLedger.get("stop-1")).toEqual({
      pickup: { before: 0, amount: 16, after: 16 },
      delivery: false,
    });

    // Deliver only: arrive with 16 already aboard then unload all of it so cargo bay is empty
    expect(pickupThenDeliverLedger.get("stop-2")).toEqual({
      pickup: false,
      delivery: { before: 16, amount: 16, after: 0 },
    });

    const pickupTransferMixStops = getTripStops("pickupTransferMix");

    // Pickup/transfer stop: arrive with cargo aboard, pickup more, then deliver
    expect(
      cargoInventory.transferLedgerByStop(pickupTransferMixStops).get("stop-2"),
    ).toEqual({
      pickup: { before: 10, amount: 20, after: 30 },
      delivery: { before: 30, amount: 10, after: 20 },
    });
  });

  it("unloads before loading when delivery lines are listed first on a both stop", () => {
    const ledger = cargoInventory.transferLedgerByStop(
      getTripStops("aboardCargo"),
    );
    // stop-1 loads 17; stop-2 lists scrap delivery then agricium pickup
    expect(ledger.get("stop-2")).toEqual({
      pickup: { before: 0, amount: 40, after: 40 },
      delivery: { before: 17, amount: 24, after: 0 },
    });
    expect(cargoInventory.peakScuAtStop(ledger.get("stop-2")!)).toBe(40);
  });

  it("does not let aboard SCU go below zero", () => {
    const ledgerByStop = cargoInventory.transferLedgerByStop(
      getTripStops("deliveryExceedsAboard"),
    );

    // 17 aboard after pickup
    expect(ledgerByStop.get("stop-1")).toEqual({
      pickup: { before: 0, amount: 17, after: 17 },
      delivery: false,
    });
    // Delivery of 32 from 17 aboard → after is 0, not negative
    expect(ledgerByStop.get("stop-2")).toEqual({
      pickup: false,
      delivery: { before: 17, amount: 32, after: 0 },
    });
  });
});
