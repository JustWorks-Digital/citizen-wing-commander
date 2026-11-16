import { describe, expect, it } from "vitest";
import { makeStop, cargo } from "../cargo/fixtures";
import {
  applySessionCompletionTiming,
  type SessionChecklistModel,
} from "@/lib/missions/mockSession";
import type { SessionMission } from "@/lib/missions/sessionMissions";
import { toggleStopCompletion } from "@/lib/missions/toggleStopCompletion";
import {
  rebuildRowsFromMissions,
} from "@/lib/missions/rebuildSessionRoute";
import { validateChecklistTripCargo } from "@/lib/missions/tripPlan";

function mission(
  overrides: Partial<SessionMission> & Pick<SessionMission, "id" | "from" | "to">,
): SessionMission {
  return {
    title: "Small Cargo Haul",
    contractor: "Covalex",
    rewardAuec: 1000,
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

/** Legal Covalex ↔ Shubin crossed haul (pickup first, then both, then return). */
function crossedHaulSession(): SessionChecklistModel {
  const missions = [
    mission({
      id: "out",
      from: ["Covalex Distribution Centre S4DC05"],
      to: ["Shubin Mining Facility SM0-10"],
      cargo: [{ commodity: "Hydrogen Fuel", scu: 8 }],
    }),
    mission({
      id: "back",
      from: ["Shubin Mining Facility SM0-10"],
      to: ["Covalex Distribution Centre S4DC05"],
      cargo: [{ commodity: "Scrap", scu: 6 }],
    }),
  ];
  const rows = [
    makeStop({
      id: "leg-1",
      routeAction: "pickup",
      locationSlug: "covalex-distribution-centre-s4dc05",
      cargo: [cargo("hydrogen-fuel", 8, { role: "pickup", missionId: "out" })],
    }),
    makeStop({
      id: "leg-2",
      routeAction: "both",
      locationSlug: "shubin-mining-facility-sm0-10",
      cargo: [
        cargo("hydrogen-fuel", 8, { role: "delivery", missionId: "out" }),
        cargo("scrap", 6, { role: "pickup", missionId: "back" }),
      ],
    }),
    makeStop({
      id: "leg-3",
      routeAction: "delivery",
      locationSlug: "covalex-distribution-centre-s4dc05",
      cargo: [cargo("scrap", 6, { role: "delivery", missionId: "back" })],
    }),
  ];
  return applySessionCompletionTiming({
    id: "toggle-stop-fixture",
    sessionName: "Toggle stop fixture",
    shipSlugs: ["c2-hercules-starlifter"],
    startLocationSlug: "port-tressler",
    missionCount: 2,
    missionsCompleted: 0,
    missions,
    startedAt: "2026-11-15T00:00:00.000Z",
    completedAt: null,
    updatedAt: "2026-11-15T00:00:00.000Z",
    rows,
  });
}

describe("toggleStopCompletion", () => {
  it("keeps a legal route valid when completing then unchecking bottom to top", () => {
    let session = crossedHaulSession();
    expect(
      validateChecklistTripCargo(session.rows, session.startLocationSlug).ok,
    ).toBe(true);

    for (const row of session.rows) {
      const next = toggleStopCompletion(session, row.id);
      expect(next).not.toBeNull();
      session = next!;
    }
    expect(session.rows.every((row) => row.isCompleted)).toBe(true);
    expect(session.missions?.every((mission) => mission.isCompleted)).toBe(
      true,
    );

    for (const row of [...session.rows].reverse()) {
      const next = toggleStopCompletion(session, row.id);
      expect(next).not.toBeNull();
      session = next!;
      expect(
        validateChecklistTripCargo(session.rows, session.startLocationSlug).ok,
      ).toBe(true);
    }

    expect(session.rows.every((row) => !row.isCompleted)).toBe(true);
    expect(session.missions?.every((mission) => !mission.isCompleted)).toBe(
      true,
    );
  });

  it("does not replace legs the way a reopen rebuild can for crossed hauls", () => {
    const session = crossedHaulSession();
    const allDone = applySessionCompletionTiming({
      ...session,
      rows: session.rows.map((row) => ({ ...row, isCompleted: true })),
      missions: (session.missions ?? []).map((mission) => ({
        ...mission,
        isCompleted: true,
      })),
      missionsCompleted: 2,
    });

    // Reopen only the return contract (final stop) — same trigger as uncheck.
    const reopened = (allDone.missions ?? []).map((mission) =>
      mission.id === "back" ? { ...mission, isCompleted: false } : mission,
    );
    const rebuilt = rebuildRowsFromMissions(allDone, reopened);
    expect(rebuilt.ok).toBe(true);
    if (!rebuilt.ok) return;

    // Intake rebuild for the reopened subset alone is a different shape than
    // the full optimized crossed haul the pilot was flying.
    expect(rebuilt.session.rows.map((row) => row.locationSlug)).not.toEqual(
      session.rows.map((row) => row.locationSlug),
    );

    // Toggle path must keep the original legs.
    const toggled = toggleStopCompletion(allDone, "leg-3");
    expect(toggled?.rows.map((row) => row.id)).toEqual(
      session.rows.map((row) => row.id),
    );
    expect(
      validateChecklistTripCargo(
        toggled!.rows,
        toggled!.startLocationSlug,
      ).ok,
    ).toBe(true);
  });
});
