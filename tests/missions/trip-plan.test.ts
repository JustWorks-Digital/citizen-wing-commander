import { describe, expect, it } from "vitest";
import {
  crossedHaulInvalidSession,
  crossedHaulInvalidTripCargoIssues,
} from "@/lib/fixtures/sessions/crossedHaulInvalid";
import { makeStop, cargo } from "../cargo/fixtures";
import {
  buildCandidatePlans,
  isSequenceLegal,
  optimizeTrip,
  scoreTrip,
  sequenceToPlan,
  validateChecklistTripCargo,
  validateTripCargo,
  type TripContractLeg,
} from "@/lib/missions/tripPlan";

const crossedHaul: TripContractLeg[] = [
  {
    id: "out",
    missionId: "out",
    fromLocationSlug: "covalex-distribution-centre-s4dc05",
    toLocationSlug: "shubin-mining-facility-sm0-10",
    commoditySlug: "hydrogen-fuel",
    scu: 20,
  },
  {
    id: "back",
    missionId: "back",
    fromLocationSlug: "shubin-mining-facility-sm0-10",
    toLocationSlug: "covalex-distribution-centre-s4dc05",
    commoditySlug: "scrap",
    scu: 10,
  },
];

describe("trip plan cargo validation", () => {
  it("flags delivery before pickup on a checklist walk", () => {
    const rows = [
      makeStop({
        id: "leg-1",
        routeAction: "both",
        locationSlug: "covalex-distribution-centre-s4dc05",
        cargo: [
          cargo("scrap", 10, { role: "delivery", missionId: "back" }),
          cargo("hydrogen-fuel", 20, { role: "pickup", missionId: "out" }),
        ],
      }),
      makeStop({
        id: "leg-2",
        routeAction: "both",
        locationSlug: "shubin-mining-facility-sm0-10",
        cargo: [
          cargo("hydrogen-fuel", 20, { role: "delivery", missionId: "out" }),
          cargo("scrap", 10, { role: "pickup", missionId: "back" }),
        ],
      }),
    ];
    const result = validateChecklistTripCargo(rows);
    expect(result.ok).toBe(false);
    expect(result.issues[0]).toMatchObject({
      stopId: "leg-1",
      locationSlug: "covalex-distribution-centre-s4dc05",
      shortfallScu: 10,
      missing: { commoditySlug: "scrap", missionId: "back" },
    });
  });

  it("accepts pickup then delivery", () => {
    const rows = [
      makeStop({
        id: "stop-1",
        routeAction: "pickup",
        locationSlug: "area18",
        cargo: [cargo("pressurized-ice", 16, { missionId: "m1" })],
      }),
      makeStop({
        id: "stop-2",
        routeAction: "delivery",
        locationSlug: "lorville",
        cargo: [cargo("pressurized-ice", 16, { missionId: "m1" })],
      }),
    ];
    expect(validateChecklistTripCargo(rows).ok).toBe(true);
  });

  it("flags the crossed-haul session fixture as invalid", () => {
    const result = validateChecklistTripCargo(
      crossedHaulInvalidSession.rows,
      crossedHaulInvalidSession.startLocationSlug,
    );
    expect(result.ok).toBe(false);
    expect(result.issues.length).toBe(crossedHaulInvalidTripCargoIssues.issueCount);
    expect(result.issues[0]).toMatchObject({
      stopId: "leg-1",
      locationSlug: "covalex-distribution-centre-s4dc05",
      missing: { commoditySlug: "waste" },
      shortfallScu: 8,
    });
  });
});

describe("trip plan sequences", () => {
  it("rejects a two-stop sequence for crossed hauls", () => {
    expect(
      isSequenceLegal(
        [
          "covalex-distribution-centre-s4dc05",
          "shubin-mining-facility-sm0-10",
        ],
        crossedHaul,
      ),
    ).toBe(false);
  });

  it("accepts a split-hub sequence for crossed hauls", () => {
    expect(
      isSequenceLegal(
        [
          "covalex-distribution-centre-s4dc05",
          "shubin-mining-facility-sm0-10",
          "covalex-distribution-centre-s4dc05",
        ],
        crossedHaul,
      ),
    ).toBe(true);
  });

  it("only materializes legal sequences as candidates", () => {
    const plans = buildCandidatePlans(crossedHaul, "everus-harbor");
    expect(plans.length).toBeGreaterThan(0);
    for (const plan of plans) {
      expect(validateTripCargo(plan).ok).toBe(true);
    }
  });

  it("optimizes crossed haul to a valid fewest-stop plan", () => {
    const result = optimizeTrip(crossedHaul, "everus-harbor");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.stops.length).toBe(3);
    expect(validateTripCargo(result.plan).ok).toBe(true);
    expect(scoreTrip(result.plan).stopCount).toBe(3);
  });

  it("sequenceToPlan assigns pickup before delivery indexes", () => {
    const plan = sequenceToPlan(
      [
        "covalex-distribution-centre-s4dc05",
        "shubin-mining-facility-sm0-10",
        "covalex-distribution-centre-s4dc05",
      ],
      crossedHaul,
      null,
    );
    expect(plan.stops).toHaveLength(3);
    expect(plan.stops[0]!.pickups).toEqual([
      {
        commoditySlug: "hydrogen-fuel",
        scu: 20,
        missionId: "out",
      },
    ]);
    expect(plan.stops[0]!.deliveries).toEqual([]);
    expect(plan.stops[2]!.deliveries).toEqual([
      {
        commoditySlug: "scrap",
        scu: 10,
        missionId: "back",
      },
    ]);
  });
});
