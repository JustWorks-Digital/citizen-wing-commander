import { describe, expect, it } from "vitest";
import {
  applySessionCompletionTiming,
  finishSessionAsCrash,
  isSessionFinished,
  type SessionChecklist,
} from "@/lib/missions/sessionChecklist";

function baseSession(overrides: Partial<SessionChecklist> = {}): SessionChecklist {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    sessionName: "Crash test",
    shipSlugs: [],
    startLocationSlug: null,
    missionCount: 0,
    missionsCompleted: 0,
    missions: [],
    startedAt: "2026-11-16T00:00:00.000Z",
    completedAt: null,
    finishStatus: null,
    finishFeedback: null,
    updatedAt: "2026-11-16T00:00:00.000Z",
    rows: [
      {
        id: "leg-1",
        routeAction: "pickup",
        locationSlug: "area18",
        cargoDeliveries: [],
        shipStorageLocation: "front",
        distanceToNext: null,
        isCompleted: false,
      },
    ],
    ...overrides,
  };
}

describe("finishSessionAsCrash", () => {
  it("ends the trip as crash with incident notes without completing stops", () => {
    const now = new Date("2026-11-16T01:00:00.000Z");
    const next = finishSessionAsCrash(
      baseSession(),
      "  Soft-death near SM0-10  ",
      now,
    );
    expect(next.finishStatus).toBe("crash");
    expect(next.finishFeedback).toBe("Soft-death near SM0-10");
    expect(next.completedAt).toBe(now.toISOString());
    expect(next.rows[0]?.isCompleted).toBe(false);
    expect(isSessionFinished(next)).toBe(true);
  });

  it("keeps crash finish when later timing is reapplied", () => {
    const crashed = finishSessionAsCrash(baseSession(), "Disconnect");
    const again = applySessionCompletionTiming(crashed);
    expect(again.finishStatus).toBe("crash");
    expect(again.finishFeedback).toBe("Disconnect");
    expect(again.completedAt).toBeTruthy();
  });
});
