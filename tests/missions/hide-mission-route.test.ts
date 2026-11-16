import { describe, expect, it } from "vitest";
import { makeStop, cargo } from "../cargo/fixtures";
import { applySessionCompletionTiming, type SessionChecklist } from "@/lib/missions/sessionChecklist";

import type { SessionMission } from "@/lib/missions/sessionMissions";
import {
  setMissionHiddenAndRebuildRoute,
} from "@/lib/missions/rebuildSessionRoute";
import { validateChecklistTripCargo } from "@/lib/missions/tripPlan";

function mission(
  overrides: Partial<SessionMission> &
    Pick<SessionMission, "id" | "from" | "to">,
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
function crossedHaulSession(): SessionChecklist {
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
    id: "hide-mission-fixture",
    sessionName: "Hide mission fixture",
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

describe("setMissionHiddenAndRebuildRoute", () => {
  it("keeps a legal crossed haul valid when hiding the outbound contract", () => {
    const session = crossedHaulSession();
    expect(
      validateChecklistTripCargo(session.rows, session.startLocationSlug).ok,
    ).toBe(true);

    const result = setMissionHiddenAndRebuildRoute(session, "out", true);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.session.missions?.find((m) => m.id === "out")?.isHidden).toBe(
      true,
    );
    expect(
      validateChecklistTripCargo(
        result.session.rows,
        result.session.startLocationSlug,
      ).ok,
    ).toBe(true);
    expect(
      result.session.rows.flatMap((row) =>
        row.cargoDeliveries.map((c) => c.missionId),
      ),
    ).not.toContain("out");
    expect(
      result.session.rows.flatMap((row) =>
        row.cargoDeliveries.map((c) => c.missionId),
      ),
    ).toContain("back");
  });

  it("keeps a legal crossed haul valid when hiding the return contract", () => {
    const session = crossedHaulSession();
    const result = setMissionHiddenAndRebuildRoute(session, "back", true);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(
      validateChecklistTripCargo(
        result.session.rows,
        result.session.startLocationSlug,
      ).ok,
    ).toBe(true);
    expect(
      result.session.rows.map((row) => row.locationSlug),
    ).toEqual([
      "covalex-distribution-centre-s4dc05",
      "shubin-mining-facility-sm0-10",
    ]);
  });

  it("does not replace a legal route when hiding a completed contract already off the table", () => {
    const base = crossedHaulSession();
    const session = applySessionCompletionTiming({
      ...base,
      missions: [
        ...(base.missions ?? []),
        mission({
          id: "galaxy-done",
          from: ["Port Tressler"],
          to: ["Everus Harbor"],
          cargo: [{ commodity: "Pressurized Ice", scu: 32 }],
          isCompleted: true,
        }),
      ],
      missionCount: 3,
      missionsCompleted: 1,
    });
    const beforeSlugs = session.rows.map((row) => row.locationSlug);

    const result = setMissionHiddenAndRebuildRoute(
      session,
      "galaxy-done",
      true,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.session.rows.map((row) => row.locationSlug)).toEqual(
      beforeSlugs,
    );
    expect(
      validateChecklistTripCargo(
        result.session.rows,
        result.session.startLocationSlug,
      ).ok,
    ).toBe(true);
  });

  it("repairs an illegal intake-merge order when hide must rebuild", () => {
    // Same contracts as crossed haul but illegal single-pass order (deliver scrap first).
    const session = crossedHaulSession();
    const illegal = applySessionCompletionTiming({
      ...session,
      rows: [
        makeStop({
          id: "leg-1",
          routeAction: "both",
          locationSlug: "covalex-distribution-centre-s4dc05",
          cargo: [
            cargo("scrap", 6, { role: "delivery", missionId: "back" }),
            cargo("hydrogen-fuel", 8, { role: "pickup", missionId: "out" }),
          ],
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
      ],
    });
    expect(
      validateChecklistTripCargo(illegal.rows, illegal.startLocationSlug).ok,
    ).toBe(false);

    // Hide a third phantom is not needed — hide nothing on table by marking
    // a no-op hide of a missing id falls through… instead hide one contract
    // so prune leaves the other half illegal, forcing rebuild+optimize.
    // Actually: hide nothing useful — prune of "out" from illegal leaves
    // scrap delivery before pickup → still invalid → rebuild remaining "back".
    const result = setMissionHiddenAndRebuildRoute(illegal, "out", true);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(
      validateChecklistTripCargo(
        result.session.rows,
        result.session.startLocationSlug,
      ).ok,
    ).toBe(true);
  });
});
