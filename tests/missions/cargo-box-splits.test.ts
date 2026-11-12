import { describe, expect, it } from "vitest";
import { cargo, makeStop } from "../cargo/fixtures";
import { cargoBoxSplits } from "@/lib/missions/cargoBoxSplits";
import type { SessionChecklistModel } from "@/lib/missions/mockSession";
import {
  restampAllMissionBoxSizes,
  setMissionScuBoxSplits,
} from "@/lib/missions/rebuildSessionRoute";
import type { SessionMission } from "@/lib/missions/sessionMissions";

function mission(
  partial: Partial<SessionMission> & Pick<SessionMission, "cargo">,
): SessionMission {
  return {
    id: "m1",
    title: "Junior Rank - Small Cargo Haul",
    contractor: "Covalex Independent Contractors",
    rewardAuec: 50000,
    from: ["A"],
    to: ["B"],
    cargoSummary: "",
    isCompleted: false,
    screenshots: [],
    maxContainerScu: 4,
    mobiglas: {
      tab: "Accepted",
      category: "Hauling - Local",
      title: "Junior Rank - Small Cargo Haul",
      contractor: "Covalex",
      rewardAuec: 50000,
      timeRemaining: null,
      deadline: null,
      details: "",
      objectives: [],
    },
    ...partial,
  };
}

function multiCargoSession(): SessionChecklistModel {
  const m = mission({
    cargo: [
      { commodity: "Silicon", scu: 12 },
      { commodity: "Titanium", scu: 8 },
    ],
  });
  const ready = cargoBoxSplits.withDefaults(m);
  const withTitaniumOverride = cargoBoxSplits.setCommodity(ready, "titanium", {
    scuOne: 0,
    scuTwo: 4,
    scuFour: 0,
    scuEight: 0,
    scuSixteen: 0,
    scuThirtyTwo: 0,
  });

  return restampAllMissionBoxSizes({
    id: "s1",
    sessionName: "Test",
    shipSlugs: [],
    startLocationSlug: null,
    missionCount: 1,
    missionsCompleted: 0,
    missions: [withTitaniumOverride],
    startedAt: new Date().toISOString(),
    completedAt: null,
    updatedAt: new Date().toISOString(),
    rows: [
      makeStop({
        id: "leg-1",
        routeAction: "pickup",
        locationSlug: "area18",
        shipStorageLocation: "rear",
        cargo: [
          cargo("silicon", 12, {
            role: "pickup",
            missionId: "m1",
            shipStorageLocation: "rear",
          }),
          cargo("titanium", 8, {
            role: "pickup",
            missionId: "m1",
            shipStorageLocation: "rear",
          }),
        ],
      }),
      makeStop({
        id: "leg-2",
        routeAction: "delivery",
        locationSlug: "port-tressler",
        shipStorageLocation: "front",
        cargo: [
          cargo("silicon", 12, {
            role: "delivery",
            missionId: "m1",
            shipStorageLocation: "front",
          }),
          cargo("titanium", 8, {
            role: "delivery",
            missionId: "m1",
            shipStorageLocation: "front",
          }),
        ],
      }),
    ],
  });
}

describe("cargoBoxSplits.withDefaults", () => {
  it("builds per-commodity autos for multi-cargo missions", () => {
    const ready = cargoBoxSplits.withDefaults(
      mission({
        cargo: [
          { commodity: "Silicon", scu: 12 },
          { commodity: "Titanium", scu: 8 },
        ],
      }),
    );
    expect(ready.scuCargoBoxSplitsAutoSelected?.silicon).toEqual({
      scuOne: 0,
      scuTwo: 0,
      scuFour: 3,
      scuEight: 0,
      scuSixteen: 0,
      scuThirtyTwo: 0,
    });
    expect(ready.scuCargoBoxSplitsAutoSelected?.titanium).toEqual({
      scuOne: 0,
      scuTwo: 0,
      scuFour: 2,
      scuEight: 0,
      scuSixteen: 0,
      scuThirtyTwo: 0,
    });
    expect(ready.scuBoxSplits).toEqual({
      scuOne: 0,
      scuTwo: 0,
      scuFour: 5,
      scuEight: 0,
      scuSixteen: 0,
      scuThirtyTwo: 0,
    });
  });

  it("copies legacy mission-level splits onto a single cargo line", () => {
    const ready = cargoBoxSplits.withDefaults(
      mission({
        cargo: [{ commodity: "Scrap", scu: 10 }],
        scuBoxSplits: {
          scuOne: 0,
          scuTwo: 1,
          scuFour: 2,
          scuEight: 0,
          scuSixteen: 0,
          scuThirtyTwo: 0,
        },
      }),
    );
    expect(ready.scuCargoBoxSplits?.scrap).toEqual({
      scuOne: 0,
      scuTwo: 1,
      scuFour: 2,
      scuEight: 0,
      scuSixteen: 0,
      scuThirtyTwo: 0,
    });
  });
});

describe("cargoBoxSplits.setCommodity", () => {
  it("overrides one commodity without changing the other", () => {
    const base = cargoBoxSplits.withDefaults(
      mission({
        cargo: [
          { commodity: "Silicon", scu: 12 },
          { commodity: "Titanium", scu: 8 },
        ],
      }),
    );
    const next = cargoBoxSplits.setCommodity(base, "titanium", {
      scuOne: 0,
      scuTwo: 4,
      scuFour: 0,
      scuEight: 0,
      scuSixteen: 0,
      scuThirtyTwo: 0,
    });
    expect(next.scuCargoBoxSplits?.silicon).toEqual(
      base.scuCargoBoxSplits?.silicon,
    );
    expect(next.scuCargoBoxSplits?.titanium).toEqual({
      scuOne: 0,
      scuTwo: 4,
      scuFour: 0,
      scuEight: 0,
      scuSixteen: 0,
      scuThirtyTwo: 0,
    });
    expect(next.scuBoxSplits?.scuTwo).toBe(4);
    expect(next.scuBoxSplits?.scuFour).toBe(3);
  });
});

describe("cargoBoxSplits.propagatePreferredMax", () => {
  it("re-greedies other lines from the source mix preferred max", () => {
    const base = cargoBoxSplits.withDefaults(
      mission({
        cargo: [
          { commodity: "Silicon", scu: 12 },
          { commodity: "Titanium", scu: 8 },
        ],
        maxContainerScu: 8,
      }),
    );
    const withSilicon = cargoBoxSplits.setCommodity(base, "silicon", {
      scuOne: 0,
      scuTwo: 2,
      scuFour: 0,
      scuEight: 1,
      scuSixteen: 0,
      scuThirtyTwo: 0,
    });
    expect(cargoBoxSplits.preferredMaxFromSplits(withSilicon.scuCargoBoxSplits?.silicon)).toBe(
      8,
    );

    const withTwos = cargoBoxSplits.setCommodity(withSilicon, "silicon", {
      scuOne: 0,
      scuTwo: 6,
      scuFour: 0,
      scuEight: 0,
      scuSixteen: 0,
      scuThirtyTwo: 0,
    });
    const next = cargoBoxSplits.propagatePreferredMax(withTwos, "silicon", {
      onlyUncorrected: false,
    });
    expect(next.scuCargoBoxSplits?.titanium).toEqual({
      scuOne: 0,
      scuTwo: 4,
      scuFour: 0,
      scuEight: 0,
      scuSixteen: 0,
      scuThirtyTwo: 0,
    });
  });

  it("skips already-corrected lines when onlyUncorrected is true", () => {
    const base = cargoBoxSplits.withDefaults(
      mission({
        cargo: [
          { commodity: "Silicon", scu: 12 },
          { commodity: "Titanium", scu: 8 },
        ],
        maxContainerScu: 8,
      }),
    );
    const titaniumManual = cargoBoxSplits.setCommodity(base, "titanium", {
      scuOne: 0,
      scuTwo: 0,
      scuFour: 2,
      scuEight: 0,
      scuSixteen: 0,
      scuThirtyTwo: 0,
    });
    const siliconTwos = cargoBoxSplits.setCommodity(titaniumManual, "silicon", {
      scuOne: 0,
      scuTwo: 6,
      scuFour: 0,
      scuEight: 0,
      scuSixteen: 0,
      scuThirtyTwo: 0,
    });
    const next = cargoBoxSplits.propagatePreferredMax(siliconTwos, "silicon");
    expect(next.scuCargoBoxSplits?.titanium).toEqual({
      scuOne: 0,
      scuTwo: 0,
      scuFour: 2,
      scuEight: 0,
      scuSixteen: 0,
      scuThirtyTwo: 0,
    });
  });
});

describe("setMissionScuBoxSplits restamp", () => {
  it("stamps independent boxSizes per commodity on the route", () => {
    const session = multiCargoSession();
    const siliconPickup = session.rows
      .flatMap((row) => row.cargoDeliveries)
      .find(
        (entry) =>
          entry.commoditySlug === "silicon" && entry.role === "pickup",
      );
    const titaniumPickup = session.rows
      .flatMap((row) => row.cargoDeliveries)
      .find(
        (entry) =>
          entry.commoditySlug === "titanium" && entry.role === "pickup",
      );

    expect(siliconPickup?.boxSizes).toEqual([4, 4, 4]);
    expect(titaniumPickup?.boxSizes).toEqual([2, 2, 2, 2]);
  });

  it("requires commodity when the mission has multiple cargo types", () => {
    const session = multiCargoSession();
    const withoutCommodity = setMissionScuBoxSplits(session, "m1", {
      scuOne: 0,
      scuTwo: 0,
      scuFour: 3,
      scuEight: 0,
      scuSixteen: 0,
      scuThirtyTwo: 0,
    });
    expect(withoutCommodity.ok).toBe(false);
    if (withoutCommodity.ok) return;
    expect(withoutCommodity.error).toMatch(/multiple cargo types/i);
  });

  it("applies preferred max to remaining cargo in one persist", () => {
    const session = multiCargoSession();
    const result = setMissionScuBoxSplits(
      session,
      "m1",
      {
        scuOne: 0,
        scuTwo: 6,
        scuFour: 0,
        scuEight: 0,
        scuSixteen: 0,
        scuThirtyTwo: 0,
      },
      "silicon",
      { applyPreferredMaxToRemaining: true, onlyUncorrected: false },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const updated = result.session.missions?.[0];
    expect(updated?.scuCargoBoxSplits?.silicon).toEqual({
      scuOne: 0,
      scuTwo: 6,
      scuFour: 0,
      scuEight: 0,
      scuSixteen: 0,
      scuThirtyTwo: 0,
    });
    expect(updated?.scuCargoBoxSplits?.titanium).toEqual({
      scuOne: 0,
      scuTwo: 4,
      scuFour: 0,
      scuEight: 0,
      scuSixteen: 0,
      scuThirtyTwo: 0,
    });
    const titaniumPickup = result.session.rows
      .flatMap((row) => row.cargoDeliveries)
      .find(
        (entry) =>
          entry.commoditySlug === "titanium" && entry.role === "pickup",
      );
    expect(titaniumPickup?.boxSizes).toEqual([2, 2, 2, 2]);
  });
});
