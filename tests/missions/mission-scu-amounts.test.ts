import { describe, expect, it } from "vitest";
import { makeStop, cargo } from "../cargo/fixtures";
import { applySessionCompletionTiming, type SessionChecklist } from "@/lib/missions/sessionChecklist";

import { missionScuAmounts } from "@/lib/missions/missionScuAmounts";
import type { SessionMission } from "@/lib/missions/sessionMissions";

function sessionFixture(): SessionChecklist {
  const missions: SessionMission[] = [
    {
      id: "ice",
      title: "Ice run",
      contractor: "Galaxy",
      rewardAuec: 5000,
      from: ["Port Tressler"],
      to: ["Everus Harbor"],
      cargo: [{ commodity: "Pressurized Ice", scu: 32 }],
      scuSplits: [
        {
          kind: "deliver",
          fromLocationSlug: "port-tressler",
          toLocationSlug: "everus-harbor",
          commoditySlug: "pressurized-ice",
          commodityName: "Pressurized Ice",
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
    expect(mission?.scuSplits?.[0]?.scu).toBe(40);
    expect(result.session.rows[0]!.cargoDeliveries[0]!.scu).toBe(40);
    expect(result.session.rows[1]!.cargoDeliveries[0]!.scu).toBe(40);
  });

  it("updates a deliver location and keeps pickup aligned", () => {
    const result = missionScuAmounts.setLocationAmount(sessionFixture(), "ice", {
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

  it("lists collect and deliver location lines", () => {
    const session = sessionFixture();
    const lines = missionScuAmounts.locationLines(
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

  it("uses route deliveries only — no phantom even-splits for unused destinations", () => {
    const session = partialMultiDropSession();
    const draft = missionScuAmounts.draftFromMission(
      session.missions![0]!,
      session.rows,
    );
    expect(draft.commodities).toEqual([
      {
        commoditySlug: "quantum-fuel",
        commodity: "Quantum Fuel",
        scu: 8,
      },
    ]);
    expect(draft.deliveries).toEqual([
      {
        locationKey: "shubin-mining-facility-sm0-22",
        locationSlug: "shubin-mining-facility-sm0-22",
        locationLabel: expect.any(String),
        commoditySlug: "quantum-fuel",
        commodity: "Quantum Fuel",
        scu: 8,
        isUserCorrected: false,
      },
    ]);
    expect(missionScuAmounts.validateDraft(draft)).toEqual({ ok: true });
  });

  it("rebalances unlocked delivery locations after a player override", () => {
    const session = multiDeliverySession();
    let draft = missionScuAmounts.draftFromMission(
      session.missions![0]!,
      session.rows,
    );
    // Even 4/4/3 → force even 4/4/4 for a clean story (fixture may differ).
    const slug = draft.commodities[0]!.commoditySlug;
    draft = {
      ...draft,
      commodities: [{ ...draft.commodities[0]!, scu: 12 }],
      deliveries: draft.deliveries.map((line, index) => ({
        ...line,
        scu: 4,
        isUserCorrected: false,
        locationSlug: line.locationSlug || `stop-${index}`,
      })),
    };
    expect(draft.deliveries).toHaveLength(3);

    draft = missionScuAmounts.setDeliveryScuInDraft(
      draft,
      slug,
      draft.deliveries[0]!.locationSlug,
      2,
    );
    expect(draft.deliveries[0]!.scu).toBe(2);
    expect(draft.deliveries[0]!.isUserCorrected).toBe(true);
    expect(draft.deliveries[1]!.scu).toBe(5);
    expect(draft.deliveries[2]!.scu).toBe(5);
    expect(draft.deliveries[1]!.isUserCorrected).toBe(false);

    draft = missionScuAmounts.setDeliveryScuInDraft(
      draft,
      slug,
      draft.deliveries[1]!.locationSlug,
      8,
    );
    expect(draft.deliveries.map((line) => line.scu)).toEqual([2, 8, 2]);
    expect(draft.deliveries.map((line) => Boolean(line.isUserCorrected))).toEqual([
      true,
      true,
      false,
    ]);
    expect(missionScuAmounts.validateDraft(draft)).toEqual({ ok: true });
  });

  it("persists isUserCorrected on scuSplits when applying a draft", () => {
    const session = multiDeliverySession();
    let draft = missionScuAmounts.draftFromMission(
      session.missions![0]!,
      session.rows,
    );
    const slug = draft.commodities[0]!.commoditySlug;
    draft = {
      ...draft,
      commodities: [{ ...draft.commodities[0]!, scu: 12 }],
      deliveries: draft.deliveries.map((line) => ({
        ...line,
        scu: 4,
        isUserCorrected: false,
      })),
    };
    draft = missionScuAmounts.setDeliveryScuInDraft(
      draft,
      slug,
      draft.deliveries[0]!.locationSlug,
      2,
    );
    const result = missionScuAmounts.applyDraft(
      session,
      session.missions![0]!.id,
      draft,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const mission = result.session.missions?.[0];
    expect(mission?.scuSplits?.[0]?.isUserCorrected).toBe(true);
    expect(mission?.scuSplits?.[1]?.isUserCorrected).toBeFalsy();
  });

  it("rejects a draft when delivery locations do not sum to the commodity total", () => {
    const session = multiDeliverySession();
    const draft = missionScuAmounts.draftFromMission(
      session.missions![0]!,
      session.rows,
    );
    draft.deliveries[0]!.scu = 9;
    const check = missionScuAmounts.validateDraft(draft);
    expect(check.ok).toBe(false);
    if (check.ok) return;
    expect(check.error).toMatch(
      /delivery locations total 16 SCU but mission total is 11 SCU/,
    );

    const applied = missionScuAmounts.applyDraft(session, "food", draft);
    expect(applied.ok).toBe(false);
  });

  it("applies a balanced draft to mission cargo and delivery locations", () => {
    const session = multiDeliverySession();
    const draft = missionScuAmounts.draftFromMission(
      session.missions![0]!,
      session.rows,
    );
    draft.commodities[0]!.scu = 15;
    draft.deliveries[0]!.scu = 6;
    draft.deliveries[1]!.scu = 5;
    draft.deliveries[2]!.scu = 4;

    const result = missionScuAmounts.applyDraft(session, "food", draft);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const mission = result.session.missions?.find((entry) => entry.id === "food");
    expect(mission?.cargo[0]?.scu).toBe(15);
    expect(mission?.scuSplits?.map((split) => split.scu)).toEqual([6, 5, 4]);
    expect(mission?.scuTotalCertainty).toBe("known");
    expect(
      result.session.rows
        .filter((row) => row.routeAction === "delivery")
        .map((row) => row.cargoDeliveries[0]!.scu),
    ).toEqual([6, 5, 4]);
    expect(result.session.rows[0]!.cargoDeliveries[0]!.scu).toBe(15);
  });
});

/** Multi-destination mission whose route only drops one commodity at one stop. */
function partialMultiDropSession(): SessionChecklist {
  const missions: SessionMission[] = [
    {
      id: "fuel-ammo",
      title: "Fuel haul",
      contractor: "Covalex",
      rewardAuec: 1000,
      from: ["Covalex Distribution Centre S4DC05"],
      to: [
        "Shubin Mining Facility SM0-10",
        "Shubin Mining Facility SM0-13",
        "Shubin Mining Facility SM0-18",
        "Shubin Mining Facility SM0-22",
      ],
      cargo: [{ commodity: "Quantum Fuel", scu: 8 }],
      isCompleted: false,
      screenshots: [],
      mobiglas: {
        tab: "Accepted",
        category: "Hauling - Planetary",
        title: "Fuel haul",
        contractor: "Covalex",
        rewardAuec: 1000,
        timeRemaining: null,
        deadline: null,
        details: "",
        objectives: [],
      },
    },
  ];
  return applySessionCompletionTiming({
    id: "partial-drop",
    sessionName: "Partial drop",
    shipSlugs: ["galaxy"],
    startLocationSlug: "covalex-distribution-centre-s4dc05",
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
        locationSlug: "covalex-distribution-centre-s4dc05",
        cargo: [
          cargo("quantum-fuel", 8, {
            role: "pickup",
            missionId: "fuel-ammo",
          }),
        ],
      }),
      makeStop({
        id: "leg-2",
        routeAction: "both",
        locationSlug: "shubin-mining-facility-sm0-10",
        cargo: [
          cargo("stims", 2, { role: "delivery", missionId: "other" }),
        ],
      }),
      makeStop({
        id: "leg-5",
        routeAction: "both",
        locationSlug: "shubin-mining-facility-sm0-22",
        cargo: [
          cargo("quantum-fuel", 8, {
            role: "delivery",
            missionId: "fuel-ammo",
          }),
        ],
      }),
    ],
  });
}

function multiDeliverySession(): SessionChecklist {
  const missions: SessionMission[] = [
    {
      id: "food",
      title: "Processed Food",
      contractor: "Galaxy",
      rewardAuec: 5000,
      from: ["Port Tressler"],
      to: ["Everus Harbor", "Baijini Point", "Area 18"],
      cargo: [{ commodity: "Processed Food", scu: 11 }],
      scuSplits: [
        {
          kind: "deliver",
          fromLocationSlug: "port-tressler",
          toLocationSlug: "everus-harbor",
          commoditySlug: "processed-food",
          commodityName: "Processed Food",
          scu: 4,
        },
        {
          kind: "deliver",
          fromLocationSlug: "port-tressler",
          toLocationSlug: "baijini-point",
          commoditySlug: "processed-food",
          commodityName: "Processed Food",
          scu: 3,
        },
        {
          kind: "deliver",
          fromLocationSlug: "port-tressler",
          toLocationSlug: "area-18",
          commoditySlug: "processed-food",
          commodityName: "Processed Food",
          scu: 4,
        },
      ],
      isCompleted: false,
      screenshots: [],
      mobiglas: {
        tab: "Accepted",
        category: "Hauling - Stellar",
        title: "Processed Food",
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
    id: "scu-draft",
    sessionName: "SCU draft",
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
          cargo("processed-food", 11, { role: "pickup", missionId: "food" }),
        ],
      }),
      makeStop({
        id: "leg-2",
        routeAction: "delivery",
        locationSlug: "everus-harbor",
        cargo: [
          cargo("processed-food", 4, {
            role: "delivery",
            missionId: "food",
          }),
        ],
      }),
      makeStop({
        id: "leg-3",
        routeAction: "delivery",
        locationSlug: "baijini-point",
        cargo: [
          cargo("processed-food", 3, {
            role: "delivery",
            missionId: "food",
          }),
        ],
      }),
      makeStop({
        id: "leg-4",
        routeAction: "delivery",
        locationSlug: "area18",
        cargo: [
          cargo("processed-food", 4, {
            role: "delivery",
            missionId: "food",
          }),
        ],
      }),
    ],
  });
}
