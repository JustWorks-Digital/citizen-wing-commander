import { describe, expect, it } from "vitest";
import type { HaulingChecklistRow } from "@/lib/missions/sessionChecklist";
import { cargoBay } from "@/lib/ships/cargoBay";
import type { PlacedCargoBox } from "@/lib/ships/cargoGridPlacement";
import { getCargoGridSketchBySlug } from "@/lib/ships/cargoGrids";
import {
  commodityGroupsFromMission,
  demandManualBayInventoryLines,
  manualBayInventory,
  removeCommodityFromManualBay,
  removeMissionFromManualBay,
  type ManualBayInventoryMissionGroup,
} from "@/lib/ships/manualBayInventory";

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

describe("removeMissionFromManualBay", () => {
  it("pulls every crate for that mission off the bay", () => {
    const boxes = [
      {
        id: "a",
        size: 1,
        origin: { x: 0, y: 0, z: 0 },
        footprint: { dx: 1, dy: 1, dz: 1 },
        commoditySlug: "hydrogen-fuel",
        commodityName: "Hydrogen Fuel",
        color: null,
        color2: null,
        cells: [],
        missionId: "m1",
      },
      {
        id: "b",
        size: 1,
        origin: { x: 1, y: 0, z: 0 },
        footprint: { dx: 1, dy: 1, dz: 1 },
        commoditySlug: "ship-ammunition",
        commodityName: "Ship Ammunition",
        color: null,
        color2: null,
        cells: [],
        missionId: "m1",
      },
      {
        id: "c",
        size: 1,
        origin: { x: 2, y: 0, z: 0 },
        footprint: { dx: 1, dy: 1, dz: 1 },
        commoditySlug: "stims",
        commodityName: "Stims",
        color: null,
        color2: null,
        cells: [],
        missionId: "m2",
      },
    ] as PlacedCargoBox[];

    const next = removeMissionFromManualBay(boxes, "m1");
    expect(next.map((box) => box.id)).toEqual(["c"]);
  });
});

describe("demandManualBayInventoryLines soft stay boxSizes", () => {
  // Session 3b1bcded… — contract-3 Stims 9 SCU (4×2 + 1×1); at SM0-13 soft
  // stay kept the full pickup mix on scu 4 while delivery was scu 2 → tray
  // demanded 11 SCU vs packer ~6.
  const stops = [
    {
      id: "leg-1",
      locationSlug: "covalex-distribution-centre-s4dc05",
      routeAction: "pickup" as const,
      isCompleted: true,
      cargoDeliveries: [
        {
          commoditySlug: "stims",
          scu: 9,
          missionId: "contract-3",
          shipStorageLocation: "middle" as const,
          boxSizes: [2, 2, 2, 2, 1] as Array<1 | 2>,
        },
      ],
      scuTotal: 9,
      shipStorageLocation: "middle" as const,
      distanceToNext: null,
    },
    {
      id: "leg-2",
      locationSlug: "shubin-mining-facility-sm0-10",
      routeAction: "delivery" as const,
      isCompleted: true,
      cargoDeliveries: [
        {
          commoditySlug: "stims",
          scu: 3,
          role: "delivery" as const,
          missionId: "contract-3",
          shipStorageLocation: "rear" as const,
          boxSizes: [2, 1] as Array<1 | 2>,
        },
      ],
      scuTotal: 3,
      shipStorageLocation: "rear" as const,
      distanceToNext: null,
    },
    {
      id: "leg-3",
      locationSlug: "shubin-mining-facility-sm0-13",
      routeAction: "delivery" as const,
      isCompleted: false,
      cargoDeliveries: [
        {
          commoditySlug: "stims",
          scu: 2,
          role: "delivery" as const,
          missionId: "contract-3",
          shipStorageLocation: "rear" as const,
          boxSizes: [2] as Array<2>,
        },
      ],
      scuTotal: 2,
      shipStorageLocation: "rear" as const,
      distanceToNext: null,
    },
    {
      id: "leg-4",
      locationSlug: "shubin-mining-facility-sm0-18",
      routeAction: "delivery" as const,
      isCompleted: false,
      cargoDeliveries: [
        {
          commoditySlug: "stims",
          scu: 2,
          role: "delivery" as const,
          missionId: "contract-3",
          shipStorageLocation: "rear" as const,
          boxSizes: [2] as Array<2>,
        },
      ],
      scuTotal: 2,
      shipStorageLocation: "rear" as const,
      distanceToNext: null,
    },
    {
      id: "leg-5",
      locationSlug: "shubin-mining-facility-sm0-22",
      routeAction: "delivery" as const,
      isCompleted: false,
      cargoDeliveries: [
        {
          commoditySlug: "stims",
          scu: 2,
          role: "delivery" as const,
          missionId: "contract-3",
          shipStorageLocation: "rear" as const,
          boxSizes: [2] as Array<2>,
        },
      ],
      scuTotal: 2,
      shipStorageLocation: "rear" as const,
      distanceToNext: null,
    },
  ] as unknown as HaulingChecklistRow[];

  it("demands only crates that sum to soft-visible stims SCU at SM0-13", () => {
    const lines = demandManualBayInventoryLines("leg-3", stops);
    const stims = lines.filter(
      (line) =>
        line.missionId === "contract-3" && line.commoditySlug === "stims",
    );
    const demandedScu = stims.reduce(
      (sum, line) => sum + line.demanded * line.size,
      0,
    );
    // Delivery 2 + stay 4 (not full pickup 9 on stay).
    expect(demandedScu).toBe(6);
    expect(stims.some((line) => line.size === 2 && line.demanded === 3)).toBe(
      true,
    );
  });

  it("clears stims remaining after By cargo type pack at SM0-13", () => {
    const sketch = getCargoGridSketchBySlug("c2-hercules-starlifter");
    expect(sketch).toBeTruthy();
    const plan = cargoBay.packByCargoTypeAtStop("leg-3", sketch!, stops);
    const placedScu = plan.boxes
      .filter(
        (box) =>
          box.missionId === "contract-3" && box.commoditySlug === "stims",
      )
      .reduce((sum, box) => sum + box.size, 0);
    expect(placedScu).toBe(6);

    const groups = manualBayInventory.remainingByMission(
      "leg-3",
      stops,
      plan.boxes,
    );
    const contract3 = groups.find((group) => group.missionId === "contract-3");
    expect(contract3).toBeTruthy();
    expect(manualBayInventory.missionRemainingScu(contract3!)).toBe(0);
  });
});
