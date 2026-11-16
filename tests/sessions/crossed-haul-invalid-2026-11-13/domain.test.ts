import { describe, expect, it } from "vitest";
import { cargoInventory } from "@/lib/missions/cargoInventory";
import { validateChecklistTripCargo } from "@/lib/missions/tripPlan";
import { loadSessionFixture } from "../loadSessionFixture";

const pack = loadSessionFixture("crossed-haul-invalid-2026-11-13");

describe("session fixture crossed-haul-invalid-2026-11-13", () => {
  it("matches locked session shape expectations", () => {
    const { session, expectations } = pack;
    expect(session.sessionName).toBe(expectations.sessionName);
    expect(session.startLocationSlug).toBe(expectations.startLocationSlug);
    expect(session.missionCount).toBe(expectations.missionCount);
    expect(session.rows).toHaveLength(expectations.rowCount);
  });

  it("locks peak cargo stop from the live route", () => {
    const { session, expectations } = pack;
    expect(cargoInventory.peakStopId(session.rows)).toBe(
      expectations.peakStopId,
    );
    const ledger = cargoInventory.transferLedgerByStop(session.rows);
    const peakLedger = expectations.peakStopId
      ? ledger.get(expectations.peakStopId)
      : undefined;
    expect(peakLedger).toBeDefined();
    expect(cargoInventory.peakScuAtStop(peakLedger!)).toBe(
      expectations.peakScu,
    );
  });

  it("locks trip cargo validation issue count", () => {
    const { session, expectations } = pack;
    const result = validateChecklistTripCargo(
      session.rows,
      session.startLocationSlug,
    );
    expect(result.ok).toBe(expectations.tripCargo.ok);
    expect(result.issues).toHaveLength(expectations.tripCargo.issueCount);
  });
});
