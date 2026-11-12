import { describe, expect, it } from "vitest";
import {
  missionAuecAmount,
  sessionMissionsAuecProgress,
} from "@/lib/missions/sessionMissionObjectives";
import type { SessionMission } from "@/lib/missions/sessionMissions";

function mission(
  partial: Partial<SessionMission> & Pick<SessionMission, "id" | "title">,
): SessionMission {
  return {
    contractor: "Covalex",
    cargo: [],
    cargoSummary: "",
    from: [],
    to: [],
    screenshots: [],
    rewardAuec: 0,
    isCompleted: false,
    mobiglas: {
      tab: "Accepted",
      category: "Hauling - Local",
      title: partial.title,
      contractor: "Covalex",
      rewardAuec: partial.rewardAuec ?? 0,
      timeRemaining: null,
      details: "",
      objectives: [],
    },
    ...partial,
  };
}

describe("missionAuecAmount", () => {
  it("prefers rewardAuec over display text", () => {
    expect(
      missionAuecAmount(
        mission({
          id: "m1",
          title: "Junior Rank — Quartz",
          rewardAuec: 42000,
          rewardDisplay: "1 aUEC",
        }),
      ),
    ).toBe(42000);
  });

  it("parses rewardDisplay when rewardAuec is missing", () => {
    expect(
      missionAuecAmount(
        mission({
          id: "m1",
          title: "Junior Rank — Quartz",
          rewardDisplay: "80,000 aUEC",
        }),
      ),
    ).toBe(80000);
  });
});

describe("sessionMissionsAuecProgress", () => {
  it("sums projected payout and earned from completed contracts", () => {
    expect(
      sessionMissionsAuecProgress([
        mission({
          id: "m1",
          title: "Junior Rank — Quartz",
          rewardAuec: 40000,
          isCompleted: true,
        }),
        mission({
          id: "m2",
          title: "Member Rank — Stims",
          rewardAuec: 80000,
          isCompleted: false,
        }),
        mission({
          id: "m3",
          title: "Hidden",
          rewardAuec: 99999,
          isHidden: true,
        }),
      ]),
    ).toEqual({ auecEarned: 40000, auecProjected: 120000 });
  });
});
