import { describe, expect, it } from "vitest";
import type { CatalogMission } from "@/db/schema";
import { emptyScuBoxSplits } from "@/lib/missions/catalogMission";
import { applyCatalogRanksToSessionMissions } from "@/lib/missions/applyCatalogRanksToSessionMissions";
import { sessionMissionFromCatalog } from "@/lib/missions/sessionMissionFromCatalog";
import type { SessionMission } from "@/lib/missions/sessionMissions";

function catalogStub(
  overrides: Partial<CatalogMission> & {
    payload: CatalogMission["payload"];
  },
): CatalogMission {
  return {
    id: "cat-1",
    type: "hauling",
    fingerprint: "fp",
    variantGroupId: "vg",
    variantFamilyKey: "vf",
    title: "Small Cargo Haul",
    rank: "Experienced",
    contractorSlug: "covalex-independent-contractors",
    rewards: [{ kind: "auec", amount: 1000 }],
    offerLocationSlug: "everus-harbor",
    offerStarSystemSlug: null,
    scuTotal: 8,
    scuMaxContainerSize: 4,
    scuBoxSplits: emptyScuBoxSplits(),
    scuLocationSplits: null,
    isDirect: true,
    isOnePickup: true,
    isOneDelivery: true,
    latestScreenshotPath: null,
    missionRunCount: 0,
    missionTotalDurationMs: 0,
    missionAvgDurationMs: null,
    lastObservedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("session mission rank from catalog", () => {
  it("copies catalog rank onto session missions", () => {
    const catalog = catalogStub({
      payload: {
        kind: "hauling",
        version: 1,
        title: "Small Cargo Haul",
        rank: "Experienced",
        category: "Hauling - Planetary",
        contractorSlug: "covalex-independent-contractors",
        rewards: [{ kind: "auec", amount: 1000 }],
        offerLocationSlug: "everus-harbor",
        offerStarSystemSlug: null,
        fromLocationSlugs: ["hdpc-farnesway"],
        toLocationSlugs: ["hdms-stanhope"],
        cargo: [
          { commoditySlug: "stims", commodityName: "Stims", scu: 8 },
        ],
        scuTotal: 8,
        scuMaxContainerSize: 4,
        scuBoxSplits: {
          scuOne: 0,
          scuTwo: 0,
          scuFour: 2,
          scuEight: 0,
          scuSixteen: 0,
          scuThirtyTwo: 0,
        },
        latestScreenshotPath: null,
      },
    });

    const mission = sessionMissionFromCatalog(catalog);
    expect(mission.rank).toBe("Experienced");
    expect(mission.title).toBe("Small Cargo Haul");
  });

  it("backfills missing session ranks from linked catalog rows", () => {
    const catalog = catalogStub({
      id: "cat-2",
      rank: "Junior",
      payload: {
        kind: "hauling",
        version: 1,
        title: "Direct Medium Cargo Haul",
        rank: "Junior",
        category: "Hauling - Planetary",
        contractorSlug: "covalex-independent-contractors",
        rewards: [],
        offerLocationSlug: null,
        offerStarSystemSlug: null,
        fromLocationSlugs: ["a"],
        toLocationSlugs: ["b"],
        cargo: [
          { commoditySlug: "waste", commodityName: "Waste", scu: 16 },
        ],
        scuTotal: 16,
        scuMaxContainerSize: null,
        scuBoxSplits: {
          scuOne: 0,
          scuTwo: 0,
          scuFour: 0,
          scuEight: 2,
          scuSixteen: 0,
          scuThirtyTwo: 0,
        },
        latestScreenshotPath: null,
      },
    });
    const mission: SessionMission = {
      id: "m1",
      catalogMissionId: "cat-2",
      title: "Direct Medium Cargo Haul",
      rank: null,
      contractor: "Covalex",
      rewardAuec: 0,
      from: ["A"],
      to: ["B"],
      cargo: [{ commodity: "Waste", scu: 16 }],
      isCompleted: false,
      screenshots: [],
      mobiglas: {
        tab: "Accepted",
        category: "Hauling - Planetary",
        title: "Direct Medium Cargo Haul",
        contractor: "Covalex",
        rewardAuec: 0,
        timeRemaining: null,
        deadline: null,
        details: "",
        objectives: [],
      },
    };

    const result = applyCatalogRanksToSessionMissions(
      [mission],
      new Map([["cat-2", catalog]]),
    );
    expect(result.changed).toBe(true);
    expect(result.missions[0]?.rank).toBe("Junior");
  });
});
