import { describe, expect, it } from "vitest";
import {
  isScuCertainty,
  normalizeScuCertainty,
} from "@/lib/missions/scuCertainty";
import { makeStop, cargo } from "../cargo/fixtures";
import {
  applySessionCompletionTiming,
  type SessionChecklistModel,
} from "@/lib/missions/mockSession";
import type { SessionMission } from "@/lib/missions/sessionMissions";
import { setMissionScuBoxSplits } from "@/lib/missions/rebuildSessionRoute";

function sessionWithMission(): SessionChecklistModel {
  const missions: SessionMission[] = [
    {
      id: "ice",
      title: "Ice",
      contractor: "Galaxy",
      rewardAuec: 1000,
      from: ["Port Tressler"],
      to: ["Everus Harbor"],
      cargo: [{ commodity: "Pressurized Ice", scu: 8 }],
      isCompleted: false,
      screenshots: [],
      mobiglas: {
        tab: "Accepted",
        category: "Hauling - Stellar",
        title: "Ice",
        contractor: "Galaxy",
        rewardAuec: 1000,
        timeRemaining: null,
        deadline: null,
        details: "",
        objectives: [],
      },
    },
  ];
  return applySessionCompletionTiming({
    id: "scu-certainty-fixture",
    sessionName: "Certainty",
    shipSlugs: ["c2-hercules-starlifter"],
    startLocationSlug: "port-tressler",
    missionCount: 1,
    missionsCompleted: 0,
    missions,
    startedAt: "2026-11-15T00:00:00.000Z",
    completedAt: null,
    updatedAt: "2026-11-15T00:00:00.000Z",
    rows: [
      makeStop({
        id: "leg-1",
        routeAction: "pickup",
        locationSlug: "port-tressler",
        cargo: [
          cargo("pressurized-ice", 8, { role: "pickup", missionId: "ice" }),
        ],
      }),
      makeStop({
        id: "leg-2",
        routeAction: "delivery",
        locationSlug: "everus-harbor",
        cargo: [
          cargo("pressurized-ice", 8, {
            role: "delivery",
            missionId: "ice",
          }),
        ],
      }),
    ],
  });
}

describe("scuCertainty", () => {
  it("normalizes known estimated unknown", () => {
    expect(normalizeScuCertainty("known")).toBe("known");
    expect(normalizeScuCertainty("Estimated")).toBe("estimated");
    expect(normalizeScuCertainty("UNKNOWN")).toBe("unknown");
    expect(normalizeScuCertainty("maybe")).toBeNull();
    expect(normalizeScuCertainty(null)).toBeNull();
    expect(isScuCertainty("known")).toBe(true);
    expect(isScuCertainty("fuzzy")).toBe(false);
  });

  it("stamps certainty onto a session mission via setMissionScuBoxSplits", () => {
    const session = sessionWithMission();
    const result = setMissionScuBoxSplits(
      session,
      "ice",
      {
        scuOne: 0,
        scuTwo: 0,
        scuFour: 2,
        scuEight: 0,
        scuSixteen: 0,
        scuThirtyTwo: 0,
      },
      "pressurized-ice",
      { scuBoxSplitsCertainty: "known", scuTotalCertainty: "estimated" },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const mission = result.session.missions?.find((entry) => entry.id === "ice");
    expect(mission?.scuBoxSplitsCertainty).toBe("known");
    expect(mission?.scuTotalCertainty).toBe("estimated");
  });

  it("leaves certainty unchanged when options omit it", () => {
    const base = sessionWithMission();
    const stamped = setMissionScuBoxSplits(
      base,
      "ice",
      {
        scuOne: 0,
        scuTwo: 0,
        scuFour: 2,
        scuEight: 0,
        scuSixteen: 0,
        scuThirtyTwo: 0,
      },
      null,
      { scuBoxSplitsCertainty: "known" },
    );
    expect(stamped.ok).toBe(true);
    if (!stamped.ok) return;

    const next = setMissionScuBoxSplits(
      stamped.session,
      "ice",
      {
        scuOne: 0,
        scuTwo: 4,
        scuFour: 0,
        scuEight: 0,
        scuSixteen: 0,
        scuThirtyTwo: 0,
      },
      null,
    );
    expect(next.ok).toBe(true);
    if (!next.ok) return;
    expect(
      next.session.missions?.find((entry) => entry.id === "ice")
        ?.scuBoxSplitsCertainty,
    ).toBe("known");
  });
});
