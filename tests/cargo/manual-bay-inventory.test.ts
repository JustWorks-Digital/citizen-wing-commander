import { describe, expect, it } from "vitest";
import type { SessionMission } from "@/lib/missions/sessionMissions";
import {
  manualBayInventory,
  shortMissionDisplayId,
} from "@/lib/ships/manualBayInventory";
import type { PlacedCargoBox } from "@/lib/ships/cargoGridPlacement";
import { cargo, makeStop } from "./fixtures";

function placedBox(
  partial: Partial<PlacedCargoBox> &
    Pick<PlacedCargoBox, "id" | "size" | "commoditySlug" | "missionId">,
): PlacedCargoBox {
  return {
    origin: { x: 0, y: 0, z: 0 },
    footprint: { dx: 1, dy: 1, dz: 1 },
    commodityName: partial.commoditySlug,
    color: null,
    color2: null,
    cells: [{ x: 0, y: 0, z: 0 }],
    action: "pickup",
    ...partial,
  };
}

function missionStub(
  id: string,
  title: string,
  catalogMissionId?: string | null,
): SessionMission {
  return {
    id,
    title,
    catalogMissionId: catalogMissionId ?? null,
    contractor: "Outdr",
    rewardAuec: 0,
    from: [],
    to: [],
    cargo: [],
    isCompleted: false,
    screenshots: [],
    mobiglas: {
      tab: "Accepted",
      category: "Hauling - Local",
      title,
      contractor: "Outdr",
      rewardAuec: 0,
      details: "",
      objectives: [],
    },
  };
}

describe("shortMissionDisplayId", () => {
  // Session c6dee823… — intake ids contract-1… were truncating to "contract".
  it("prefers catalog UUID short form over intake contract-N ids", () => {
    expect(
      shortMissionDisplayId(
        "contract-1",
        "0556f030-58b8-4c67-bd6d-f6e610f224bd",
      ),
    ).toBe("0556f030");
  });

  it("keeps intake contract-N when no catalog link", () => {
    expect(shortMissionDisplayId("contract-2", null)).toBe("contract-2");
  });
});

describe("manualBayInventory", () => {
  it("groups identical commodity and size under separate missions", () => {
    const stops = [
      makeStop({
        id: "stop-1",
        routeAction: "pickup",
        locationSlug: "everus-harbor",
        cargo: [
          cargo("processed-food", 16, {
            missionId: "mission-a",
            boxSizes: [8, 8],
          }),
          cargo("processed-food", 16, {
            missionId: "mission-b",
            boxSizes: [8, 8],
          }),
        ],
      }),
    ];
    const groups = manualBayInventory.remainingByMission(
      "stop-1",
      stops,
      [],
      {
        missions: [
          missionStub(
            "mission-a",
            "Contract A",
            "0556f030-58b8-4c67-bd6d-f6e610f224bd",
          ),
          missionStub("mission-b", "Contract B"),
        ],
      },
    );

    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.missionTitle).sort()).toEqual([
      "Contract A",
      "Contract B",
    ]);
    expect(
      groups.find((group) => group.missionId === "mission-a")?.catalogMissionId,
    ).toBe("0556f030-58b8-4c67-bd6d-f6e610f224bd");
    expect(
      groups.find((group) => group.missionId === "mission-b")?.catalogMissionId,
    ).toBeNull();
    for (const group of groups) {
      const eight = group.lines.find((line) => line.size === 8);
      expect(eight?.demanded).toBe(2);
      expect(eight?.remaining).toBe(2);
      expect(eight?.placed).toBe(0);
    }
  });

  it("subtracts placed crates from remaining per mission", () => {
    const stops = [
      makeStop({
        id: "stop-1",
        routeAction: "pickup",
        locationSlug: "everus-harbor",
        cargo: [
          cargo("hydrogen-fuel", 8, {
            missionId: "mission-a",
            boxSizes: [8],
          }),
          cargo("hydrogen-fuel", 8, {
            missionId: "mission-b",
            boxSizes: [8],
          }),
        ],
      }),
    ];
    const placed = [
      placedBox({
        id: "a1",
        size: 8,
        commoditySlug: "hydrogen-fuel",
        missionId: "mission-a",
      }),
    ];
    const groups = manualBayInventory.remainingByMission(
      "stop-1",
      stops,
      placed,
      {
        missions: [
          missionStub("mission-a", "A"),
          missionStub("mission-b", "B"),
        ],
      },
    );
    const groupA = groups.find((group) => group.missionId === "mission-a");
    const groupB = groups.find((group) => group.missionId === "mission-b");
    expect(groupA?.lines[0]?.remaining).toBe(0);
    expect(groupB?.lines[0]?.remaining).toBe(1);
  });
});
