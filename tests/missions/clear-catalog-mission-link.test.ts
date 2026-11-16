import { describe, expect, it } from "vitest";
import {
  clearCatalogMissionLink,
  isCatalogMissionNotFoundError,
} from "@/lib/missions/clearCatalogMissionLink";
import type { SessionChecklist } from "@/lib/missions/sessionChecklist";

import type { SessionMission } from "@/lib/missions/sessionMissions";

function mission(partial: Partial<SessionMission> & { id: string }): SessionMission {
  return {
    title: "Test",
    contractor: "Galaxy",
    rewardAuec: 0,
    from: [],
    to: [],
    cargo: [],
    isCompleted: false,
    screenshots: [],
    mobiglas: {
      tab: "Accepted",
      category: "Hauling - Local",
      title: "Test",
      contractor: "Galaxy",
      rewardAuec: 0,
      timeRemaining: null,
      deadline: null,
      details: "",
      objectives: [],
    },
    ...partial,
  };
}

describe("clearCatalogMissionLink", () => {
  it("nulls catalogMissionId on the matching mission", () => {
    const session = {
      id: "s1",
      sessionName: "Trip",
      shipSlugs: [],
      startLocationSlug: null,
      missionCount: 1,
      missionsCompleted: 0,
      missions: [
        mission({ id: "ice", catalogMissionId: "dead-uuid" }),
        mission({ id: "other", catalogMissionId: "keep-me" }),
      ],
      startedAt: "2026-11-16T00:00:00.000Z",
      completedAt: null,
      updatedAt: "2026-11-16T00:00:00.000Z",
      rows: [],
    } satisfies SessionChecklist;

    const next = clearCatalogMissionLink(session, "ice");
    expect(next.missions?.[0]?.catalogMissionId).toBeNull();
    expect(next.missions?.[1]?.catalogMissionId).toBe("keep-me");
  });

  it("detects not-found catalog errors", () => {
    expect(
      isCatalogMissionNotFoundError(
        new Error("Catalog mission not found: abc"),
      ),
    ).toBe(true);
    expect(isCatalogMissionNotFoundError(new Error("timeout"))).toBe(false);
  });
});
