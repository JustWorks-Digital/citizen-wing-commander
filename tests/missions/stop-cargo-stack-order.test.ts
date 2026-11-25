import { describe, expect, it } from "vitest";
import type { HaulingChecklistRow } from "@/lib/missions/sessionChecklist";
import {
  planStopCargoStacks,
  stopCargoBoxGroups,
} from "@/lib/missions/stopDeliveryBoxes";

describe("Unloaded / Loaded pad stack order", () => {
  it("places highest-SCU cargo leftmost (delivery)", () => {
    // Mixed insertion order — medical 4, scrap 24, stims 9 — must render L→R 24, 9, 4.
    const row: HaulingChecklistRow = {
      id: "leg-order",
      routeAction: "delivery",
      locationSlug: "baijini-point",
      shipStorageLocation: "middle",
      distanceToNext: null,
      isCompleted: false,
      cargoDeliveries: [
        {
          commoditySlug: "medical-supplies",
          scu: 4,
          role: "delivery",
          missionId: "m1",
        },
        {
          commoditySlug: "scrap",
          scu: 24,
          role: "delivery",
          missionId: "m1",
        },
        {
          commoditySlug: "stims",
          scu: 9,
          role: "delivery",
          missionId: "m1",
        },
      ],
    };

    expect(stopCargoBoxGroups(row, "delivery").map((g) => g.commoditySlug)).toEqual([
      "scrap",
      "stims",
      "medical-supplies",
    ]);

    const plan = planStopCargoStacks(row, "delivery");
    expect(plan).not.toBeNull();
    expect(plan!.stackLabels.map((label) => label.commoditySlug)).toEqual([
      "scrap",
      "stims",
      "medical-supplies",
    ]);
    expect(plan!.stackLabels.map((label) => label.x)).toEqual(
      [...plan!.stackLabels].map((label) => label.x).sort((a, b) => a - b),
    );
  });

  it("places highest-SCU cargo leftmost (pickup)", () => {
    const row: HaulingChecklistRow = {
      id: "leg-pickup-order",
      routeAction: "pickup",
      locationSlug: "area18",
      shipStorageLocation: "front",
      distanceToNext: null,
      isCompleted: false,
      cargoDeliveries: [
        { commoditySlug: "waste", scu: 5, role: "pickup", missionId: "m2" },
        { commoditySlug: "stims", scu: 16, role: "pickup", missionId: "m2" },
        { commoditySlug: "scrap", scu: 8, role: "pickup", missionId: "m2" },
      ],
    };

    expect(
      planStopCargoStacks(row, "pickup")!.stackLabels.map((l) => l.commoditySlug),
    ).toEqual(["stims", "scrap", "waste"]);
  });
});
