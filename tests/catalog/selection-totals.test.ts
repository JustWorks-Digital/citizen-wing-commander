import { describe, expect, it } from "vitest";
import { sampleCatalogMissions } from "@/components/catalog/missionCatalogFixtures";
import { catalogSelectionTotals } from "@/lib/missions/catalogSelectionTotals";

describe("catalogSelectionTotals", () => {
  it("sums aUEC, EXP, and SCU across selected catalog missions", () => {
    const totals = catalogSelectionTotals(sampleCatalogMissions);
    expect(totals.auecTotal).toBe(42000 + 18500 + 61000);
    expect(totals.expTotal).toBe(500 + 1000 + 50);
    expect(totals.scuTotal).toBe(90);
    expect(totals.stopCount).toBe(6);
    // Merged route unloads between pickups — peak is the largest single load (48), not 90.
    expect(totals.peakScu).toBe(48);
  });

  it("returns zero totals for an empty selection", () => {
    expect(catalogSelectionTotals([])).toEqual({
      stopCount: 0,
      distance: null,
      scuTotal: 0,
      peakScu: 0,
      auecTotal: 0,
      expTotal: 0,
    });
  });

  it("uses contract SCU as peak for a single direct haul", () => {
    const totals = catalogSelectionTotals([sampleCatalogMissions[0]!]);
    expect(totals.scuTotal).toBe(10);
    expect(totals.peakScu).toBe(10);
  });
});
