import { describe, expect, it } from "vitest";
import { reconcileMissionCompletionFromStops } from "@/lib/missions/expectedCompletions";
import type { HaulingChecklistRow } from "@/lib/missions/mockSession";
import type { SessionMission } from "@/lib/missions/sessionMissions";

function mission(
  overrides: Partial<SessionMission> & Pick<SessionMission, "id">,
): SessionMission {
  return {
    title: "Small Cargo Haul",
    contractor: "Covalex",
    rewardAuec: 1000,
    from: ["A"],
    to: ["B"],
    cargo: [{ commodity: "Stims", scu: 4 }],
    isCompleted: false,
    screenshots: [],
    mobiglas: {
      tab: "Accepted",
      category: "Hauling - Planetary",
      title: "Small Cargo Haul",
      contractor: "Covalex",
      rewardAuec: 1000,
      timeRemaining: null,
      deadline: null,
      details: "",
      objectives: [],
    },
    ...overrides,
  };
}

function deliveryStop(
  id: string,
  locationSlug: string,
  missionId: string,
  isCompleted = false,
): HaulingChecklistRow {
  return {
    id,
    routeAction: "delivery",
    locationSlug,
    cargoDeliveries: [
      {
        commoditySlug: "stims",
        commodityName: "Stims",
        scu: 4,
        role: "delivery",
        missionId,
      },
    ],
    shipStorageLocation: "front",
    distanceToNext: null,
    isCompleted,
  };
}

describe("reconcileMissionCompletionFromStops", () => {
  it("clears off-route completed contracts when every stop is open", () => {
    const missions = [
      mission({ id: "on-route", to: ["port-tressler"] }),
      mission({
        id: "stuck-done",
        isCompleted: true,
        to: ["hdms-stanhope"],
      }),
    ];
    const rows = [
      deliveryStop("stop-1", "port-tressler", "on-route", false),
    ];

    const next = reconcileMissionCompletionFromStops(missions, rows);
    expect(next.find((entry) => entry.id === "stuck-done")?.isCompleted).toBe(
      false,
    );
    expect(next.find((entry) => entry.id === "on-route")?.isCompleted).toBe(
      false,
    );
  });

  it("marks on-route contracts done when their final delivery stop is done", () => {
    const missions = [mission({ id: "m1", to: ["port-tressler"] })];
    const rows = [
      deliveryStop("stop-1", "port-tressler", "m1", true),
    ];

    const next = reconcileMissionCompletionFromStops(missions, rows);
    expect(next[0]?.isCompleted).toBe(true);
  });

  it("keeps off-route completed contracts while any stop is still done", () => {
    const missions = [
      mission({ id: "on-route", to: ["port-tressler"] }),
      mission({
        id: "finished-elsewhere",
        isCompleted: true,
        to: ["hdms-stanhope"],
      }),
    ];
    const rows = [
      deliveryStop("stop-1", "port-tressler", "on-route", true),
    ];

    const next = reconcileMissionCompletionFromStops(missions, rows);
    expect(
      next.find((entry) => entry.id === "finished-elsewhere")?.isCompleted,
    ).toBe(true);
  });
});
