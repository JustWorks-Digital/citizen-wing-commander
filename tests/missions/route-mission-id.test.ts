import { describe, expect, it } from "vitest";
import { buildRouteFromIntake } from "@/lib/sessions/buildRouteFromIntake";
import { resolveIncomingLeg } from "@/lib/sessions/resolveRefs";
import { rebuildRowsFromMissions } from "@/lib/missions/rebuildSessionRoute";
import { emptySessionChecklist } from "@/lib/missions/sessionChecklist";
import type { SessionMission } from "@/lib/missions/sessionMissions";

function stimsMission(
  id: string,
  scu: number,
): SessionMission {
  return {
    id,
    title: "Small Cargo Haul",
    contractor: "Covalex Independent Contractors",
    rewardAuec: 1000,
    from: ["Covalex Distribution Centre S4DC05"],
    to: ["Shubin Mining Facility SM0-10"],
    cargo: [{ commodity: "Stims", scu }],
    isCompleted: false,
    screenshots: [],
    mobiglas: {
      tab: "Accepted",
      category: "Hauling - Planetary",
      title: "Small Cargo Haul",
      contractor: "Covalex Independent Contractors",
      rewardAuec: 1000,
      timeRemaining: null,
      deadline: null,
      details: "",
      objectives: [],
    },
  };
}

describe("route missionId wiring", () => {
  it("keeps separate cargo lines for two contracts that share commodity and stops", () => {
    const built = buildRouteFromIntake({
      kind: "hauling_contracts_intake",
      version: 1,
      sessionName: "Overlap",
      contracts: [
        {
          id: "mission-a",
          title: "Small Cargo Haul",
          from: ["Covalex Distribution Centre S4DC05"],
          to: ["Shubin Mining Facility SM0-10"],
          cargo: [{ commodity: "Stims", scu: 11 }],
        },
        {
          id: "mission-b",
          title: "Small Cargo Haul",
          from: ["Covalex Distribution Centre S4DC05"],
          to: ["Shubin Mining Facility SM0-10"],
          cargo: [{ commodity: "Stims", scu: 9 }],
        },
      ],
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;

    const pickup = built.legs.find((leg) => leg.routeAction === "pickup");
    expect(pickup?.cargo).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          commodity: "stims",
          scu: 11,
          missionId: "mission-a",
        }),
        expect.objectContaining({
          commodity: "stims",
          scu: 9,
          missionId: "mission-b",
        }),
      ]),
    );

    const resolved = resolveIncomingLeg(pickup!, 0);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    const missionIds = new Set(
      resolved.row.cargoDeliveries.map((line) => line.missionId),
    );
    expect(missionIds).toEqual(new Set(["mission-a", "mission-b"]));
  });

  it("rebuilds session rows with every incomplete mission tagged on cargo", () => {
    const session = emptySessionChecklist({
      sessionName: "Overlap rebuild",
      startLocationSlug: "covalex-distribution-centre-s4dc05",
    });
    const rebuilt = rebuildRowsFromMissions(session, [
      stimsMission("mission-a", 11),
      stimsMission("mission-b", 9),
    ]);
    expect(rebuilt.ok).toBe(true);
    if (!rebuilt.ok) return;

    const tagged = new Set<string>();
    for (const row of rebuilt.session.rows) {
      for (const cargo of row.cargoDeliveries) {
        if (cargo.missionId) tagged.add(cargo.missionId);
      }
    }
    expect(tagged).toEqual(new Set(["mission-a", "mission-b"]));
    expect(rebuilt.session.missionCount).toBe(2);
  });

  it("repair rebuild keeps completed contracts on the route as Done stops", () => {
    const session = emptySessionChecklist({
      sessionName: "Repair keeps done",
      startLocationSlug: "covalex-distribution-centre-s4dc05",
    });
    const missions = [
      { ...stimsMission("mission-a", 11), isCompleted: true },
      stimsMission("mission-b", 9),
    ];
    const withoutCompleted = rebuildRowsFromMissions(session, missions);
    expect(withoutCompleted.ok).toBe(true);
    if (!withoutCompleted.ok) return;
    const taggedOpen = new Set<string>();
    for (const row of withoutCompleted.session.rows) {
      for (const cargo of row.cargoDeliveries) {
        if (cargo.missionId) taggedOpen.add(cargo.missionId);
      }
    }
    expect(taggedOpen).toEqual(new Set(["mission-b"]));

    const withCompleted = rebuildRowsFromMissions(session, missions, {
      includeCompleted: true,
    });
    expect(withCompleted.ok).toBe(true);
    if (!withCompleted.ok) return;
    const taggedAll = new Set<string>();
    for (const row of withCompleted.session.rows) {
      for (const cargo of row.cargoDeliveries) {
        if (cargo.missionId) taggedAll.add(cargo.missionId);
      }
    }
    expect(taggedAll).toEqual(new Set(["mission-a", "mission-b"]));
  });

  it("marks stops Done when every cargo mission on the stop is completed", () => {
    const session = emptySessionChecklist({
      sessionName: "All done stops",
      startLocationSlug: "covalex-distribution-centre-s4dc05",
    });
    const missions = [
      { ...stimsMission("mission-a", 11), isCompleted: true },
      { ...stimsMission("mission-b", 9), isCompleted: true },
    ];
    const rebuilt = rebuildRowsFromMissions(session, missions, {
      includeCompleted: true,
    });
    expect(rebuilt.ok).toBe(true);
    if (!rebuilt.ok) return;
    expect(rebuilt.session.rows.length).toBeGreaterThan(0);
    expect(rebuilt.session.rows.every((row) => row.isCompleted)).toBe(true);
  });
});
