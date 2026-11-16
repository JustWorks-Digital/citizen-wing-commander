import { describe, expect, it } from "vitest";
import {
  normalizeSessionMissionScuSplits,
  scuSplitsFromLegacyDeliverySplits,
} from "@/lib/missions/missionScuSplits";
import type { SessionMission } from "@/lib/missions/sessionMissions";

describe("missionScuSplits", () => {
  it("converts legacy deliverySplits into scuSplits", () => {
    const splits = scuSplitsFromLegacyDeliverySplits([
      {
        from: "Port Tressler",
        to: "Everus Harbor",
        commodity: "Pressurized Ice",
        scu: 16,
        isUserCorrected: true,
        scuAutoSelected: 10,
      },
    ]);
    expect(splits).toEqual([
      {
        kind: "deliver",
        fromLocationSlug: "port-tressler",
        toLocationSlug: "everus-harbor",
        commoditySlug: "pressurized-ice",
        commodityName: "Pressurized Ice",
        scu: 16,
        isUserCorrected: true,
        scuAutoSelected: 10,
      },
    ]);
  });

  it("normalizes a session mission off legacy deliverySplits", () => {
    const mission = {
      id: "ice",
      title: "Ice",
      contractor: "Galaxy",
      rewardAuec: 1,
      from: ["Port Tressler"],
      to: ["Everus Harbor"],
      cargo: [{ commodity: "Pressurized Ice", scu: 16 }],
      deliverySplits: [
        {
          from: "Port Tressler",
          to: "Everus Harbor",
          commodity: "Pressurized Ice",
          scu: 16,
        },
      ],
      isCompleted: false,
      screenshots: [],
      mobiglas: {
        tab: "Accepted",
        category: "Hauling - Stellar",
        title: "Ice",
        contractor: "Galaxy",
        rewardAuec: 1,
        timeRemaining: null,
        deadline: null,
        details: "",
        objectives: [],
      },
    } as SessionMission & {
      deliverySplits: Array<{
        from: string;
        to: string;
        commodity: string;
        scu: number;
      }>;
    };

    const next = normalizeSessionMissionScuSplits(mission);
    expect(next.scuSplits?.[0]?.fromLocationSlug).toBe("port-tressler");
    expect(next.scuSplits?.[0]?.toLocationSlug).toBe("everus-harbor");
    expect(
      (next as { deliverySplits?: unknown }).deliverySplits,
    ).toBeUndefined();
  });
});
