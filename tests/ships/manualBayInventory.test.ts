import { describe, expect, it } from "vitest";
import {
  commodityGroupsFromMission,
  removeCommodityFromManualBay,
  type ManualBayInventoryMissionGroup,
} from "@/lib/ships/manualBayInventory";
import type { PlacedCargoBox } from "@/lib/ships/cargoGridPlacement";

describe("commodityGroupsFromMission", () => {
  it("keeps Fill rows after everything is placed so Reset can show", () => {
    const group: ManualBayInventoryMissionGroup = {
      missionId: "m1",
      missionTitle: "Haul",
      lines: [
        {
          key: "m1:processed-food:8",
          missionId: "m1",
          missionTitle: "Haul",
          commoditySlug: "processed-food",
          commodityName: "Processed Food",
          size: 8,
          color: null,
          color2: null,
          demanded: 2,
          placed: 2,
          remaining: 0,
        },
      ],
    };
    const commodities = commodityGroupsFromMission(group);
    expect(commodities).toHaveLength(1);
    expect(commodities[0]!.remainingScu).toBe(0);
    expect(commodities[0]!.placedScu).toBe(16);
    expect(commodities[0]!.lines).toHaveLength(0);
  });
});

describe("removeCommodityFromManualBay", () => {
  it("pulls only that mission commodity off the bay", () => {
    const boxes = [
      {
        id: "a",
        size: 8,
        origin: { x: 0, y: 0, z: 0 },
        footprint: { dx: 2, dy: 2, dz: 2 },
        commoditySlug: "processed-food",
        commodityName: "Processed Food",
        color: null,
        color2: null,
        cells: [],
        missionId: "m1",
      },
      {
        id: "b",
        size: 8,
        origin: { x: 2, y: 0, z: 0 },
        footprint: { dx: 2, dy: 2, dz: 2 },
        commoditySlug: "hydrogen-fuel",
        commodityName: "Hydrogen Fuel",
        color: null,
        color2: null,
        cells: [],
        missionId: "m1",
      },
      {
        id: "c",
        size: 8,
        origin: { x: 4, y: 0, z: 0 },
        footprint: { dx: 2, dy: 2, dz: 2 },
        commoditySlug: "processed-food",
        commodityName: "Processed Food",
        color: null,
        color2: null,
        cells: [],
        missionId: "m2",
      },
    ] as PlacedCargoBox[];

    const next = removeCommodityFromManualBay(boxes, "m1", "processed-food");
    expect(next.map((box) => box.id)).toEqual(["b", "c"]);
  });
});
