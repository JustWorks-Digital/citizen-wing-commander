import { describe, expect, it } from "vitest";
import {
  intakeContractFromSessionMission,
  normalizeSessionMissionRankFields,
  sessionMissionFromIntakeContract,
  type SessionMission,
} from "@/lib/missions/sessionMissions";
import { normalizeSessionChecklist } from "@/lib/missions/sessionChecklist";
import { resolveMissionRank } from "@/lib/missions/missionRank";

function baseMission(
  overrides: Partial<SessionMission> = {},
): SessionMission {
  return {
    id: "m1",
    title: "Experienced Rank - Small Cargo Haul",
    contractor: "Covalex Independent Contractors",
    rewardAuec: 1000,
    from: ["A"],
    to: ["B"],
    cargo: [{ commodity: "Stims", scu: 4 }],
    isCompleted: false,
    screenshots: [],
    mobiglas: {
      tab: "Accepted",
      category: "Hauling - Planetary",
      title: "Experienced Rank - Small Cargo Haul",
      contractor: "Covalex Independent Contractors",
      rewardAuec: 1000,
      timeRemaining: null,
      deadline: null,
      details: "",
      objectives: [],
    },
    ...overrides,
  };
}

describe("session mission rank field", () => {
  it("extracts rank from intake title into its own field", () => {
    const mission = sessionMissionFromIntakeContract(
      {
        title: "Experienced Rank - Small Cargo Haul",
        from: ["A"],
        to: ["B"],
        cargo: [{ commodity: "Stims", scu: 4 }],
      },
      0,
    );
    expect(mission.rank).toBe("Experienced");
    expect(mission.title).toBe("Small Cargo Haul");
    expect(mission.mobiglas.title).toBe("Small Cargo Haul");
  });

  it("keeps explicit intake rank and strips title", () => {
    const mission = sessionMissionFromIntakeContract(
      {
        title: "Junior Rank - Direct Medium Cargo Haul",
        rank: "Senior",
        from: ["A"],
        to: ["B"],
        cargo: [{ commodity: "Waste", scu: 8 }],
      },
      0,
    );
    expect(mission.rank).toBe("Senior");
    expect(mission.title).toBe("Direct Medium Cargo Haul");
  });

  it("normalizes legacy session JSON on checklist load", () => {
    const session = normalizeSessionChecklist({
      sessionName: "Trip",
      missionCount: 1,
      missions: [baseMission()],
      rows: [],
    });
    expect(session.missions[0]?.rank).toBe("Experienced");
    expect(session.missions[0]?.title).toBe("Small Cargo Haul");
    expect(resolveMissionRank(session.missions[0]!)).toBe("Experienced");
  });

  it("round-trips rank on intake export", () => {
    const mission = normalizeSessionMissionRankFields(baseMission());
    const contract = intakeContractFromSessionMission(mission);
    expect(contract.rank).toBe("Experienced");
    expect(contract.title).toBe("Small Cargo Haul");
  });
});
