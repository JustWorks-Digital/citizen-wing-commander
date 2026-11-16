import { describe, expect, it } from "vitest";
import {
  normalizeSessionMission,
  normalizeSessionMissionRewards,
  type SessionMission,
} from "@/lib/missions/sessionMissions";
import { missionAuecAmount, missionRewardLabel } from "@/lib/missions/sessionMissionObjectives";

function bareMission(
  partial: Partial<SessionMission> & Pick<SessionMission, "rewardAuec">,
): SessionMission {
  return {
    id: "m1",
    title: "Test haul",
    contractor: "Covalex",
    from: ["Area18"],
    to: ["Baijini Point"],
    cargo: [{ commodity: "Scrap", scu: 8 }],
    isCompleted: false,
    screenshots: [],
    mobiglas: {
      tab: "Accepted",
      category: "Hauling - Planetary",
      title: "Test haul",
      contractor: "Covalex",
      rewardAuec: partial.rewardAuec,
      timeRemaining: null,
      deadline: null,
      details: "",
      objectives: [],
    },
    ...partial,
  };
}

describe("session mission rewards", () => {
  it("hydrates rewards from rewardAuec on normalize", () => {
    const next = normalizeSessionMissionRewards(
      bareMission({ rewardAuec: 12_500 }),
    );
    expect(next.rewards).toEqual([{ kind: "auec", amount: 12_500 }]);
    expect(next.rewardAuec).toBe(12_500);
    expect(next.rewardDisplay).toBe("12,500 aUEC");
  });

  it("keeps blueprint lines and syncs aUEC from rewards", () => {
    const next = normalizeSessionMission(
      bareMission({
        rewardAuec: 0,
        rewards: [
          { kind: "auec", amount: 4_000 },
          { kind: "blueprint", name: "Cutter Scout" },
        ],
      }),
    );
    expect(next.rewardAuec).toBe(4_000);
    expect(missionAuecAmount(next)).toBe(4_000);
    expect(missionRewardLabel(next)).toBe("4,000 aUEC · Cutter Scout");
  });
});
