import { describe, expect, it } from "vitest";
import { makeStop, cargo } from "../cargo/fixtures";
import {
  applySessionCompletionTiming,
  type SessionChecklistModel,
} from "@/lib/missions/mockSession";
import { missionScuAmounts } from "@/lib/missions/missionScuAmounts";
import type { SessionMission } from "@/lib/missions/sessionMissions";

function sessionFixture(): SessionChecklistModel {
  const missions: SessionMission[] = [
    {
      id: "ice",
      title: "Ice run",
      contractor: "Galaxy",
      rewardAuec: 5000,
      from: ["Port Tressler"],
      to: ["Everus Harbor"],
      cargo: [{ commodity: "Pressurized Ice", scu: 32 }],
      deliverySplits: [
        {
          from: "Port Tressler",
          to: "Everus Harbor",
          commodity: "Pressurized Ice",
          scu: 32,
        },
      ],
      isCompleted: false,
      screenshots: [],
      mobiglas: {
        tab: "Accepted",
        category: "Hauling - Stellar",
        title: "Ice run",
        contractor: "Galaxy",
        rewardAuec: 5000,
        timeRemaining: null,
        deadline: null,
        details: "",
        objectives: [],
      },
    },
  ];
  return applySessionCompletionTiming({
    id: "scu-amounts",
    sessionName: "SCU amounts",
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
          cargo("pressurized-ice", 32, { role: "pickup", missionId: "ice" }),
        ],
      }),
      makeStop({
        id: "leg-2",
        routeAction: "delivery",
        locationSlug: "everus-harbor",
        cargo: [
          cargo("pressurized-ice", 32, {
            role: "delivery",
            missionId: "ice",
          }),
        ],
      }),
    ],
  });
}

describe("missionScuAmounts", () => {
  it("updates mission total and scales route cargo", () => {
    const result = missionScuAmounts.setCommodityTotal(
      sessionFixture(),
      "ice",
      "pressurized-ice",
      40,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const mission = result.session.missions?.find((entry) => entry.id === "ice");
    expect(mission?.cargo[0]?.scu).toBe(40);
    expect(mission?.scuTotalCertainty).toBe("known");
    expect(mission?.deliverySplits?.[0]?.scu).toBe(40);
    expect(result.session.rows[0]!.cargoDeliveries[0]!.scu).toBe(40);
    expect(result.session.rows[1]!.cargoDeliveries[0]!.scu).toBe(40);
  });

  it("updates a deliver station and keeps pickup aligned", () => {
    const result = missionScuAmounts.setStationAmount(sessionFixture(), "ice", {
      role: "delivery",
      locationKey: "Everus Harbor",
      commoditySlug: "pressurized-ice",
      scu: 24,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const mission = result.session.missions?.find((entry) => entry.id === "ice");
    expect(mission?.cargo[0]?.scu).toBe(24);
    expect(mission?.scuTotalCertainty).toBe("known");
    expect(result.session.rows[1]!.cargoDeliveries[0]!.scu).toBe(24);
    expect(result.session.rows[0]!.cargoDeliveries[0]!.scu).toBe(24);
  });

  it("lists collect and deliver station lines", () => {
    const session = sessionFixture();
    const lines = missionScuAmounts.stationLines(
      session.missions![0]!,
      session.rows,
    );
    expect(lines.some((line) => line.role === "pickup" && line.scu === 32)).toBe(
      true,
    );
    expect(
      lines.some((line) => line.role === "delivery" && line.scu === 32),
    ).toBe(true);
  });
});
