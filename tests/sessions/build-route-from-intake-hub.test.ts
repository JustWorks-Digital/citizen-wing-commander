import { describe, expect, it } from "vitest";
import { buildRouteFromIntake } from "@/lib/sessions/buildRouteFromIntake";
import { validateChecklistTripCargo } from "@/lib/missions/tripPlan";
import { resolveIncomingLeg } from "@/lib/sessions/resolveRefs";
import type { HaulingChecklistRow } from "@/lib/missions/sessionChecklist";
import type { HaulingContractsIntake } from "@/lib/missions/haulingIntake";

function resolveLegs(legs: ReturnType<typeof buildRouteFromIntake> extends {
  ok: true;
  legs: infer L;
}
  ? L
  : never): HaulingChecklistRow[] {
  const rows: HaulingChecklistRow[] = [];
  for (const [index, leg] of legs.entries()) {
    const resolved = resolveIncomingLeg(leg, index);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) throw new Error(resolved.error);
    rows.push(resolved.row);
  }
  return rows;
}

describe("buildRouteFromIntake hub return visits", () => {
  it("splits hub pickup and return delivery into two visits so cargo stays causal", () => {
    const built = buildRouteFromIntake({
      kind: "hauling_contracts_intake",
      version: 1,
      sessionName: "Hub crossed haul",
      startLocation: "Covalex Distribution Centre S4DC05",
      contracts: [
        {
          id: "outbound-stims",
          title: "Small Cargo Haul",
          from: ["Covalex Distribution Centre S4DC05"],
          to: ["Shubin Mining Facility SM0-10"],
          cargo: [{ commodity: "Stims", scu: 9 }],
        },
        {
          id: "return-waste",
          title: "Small Cargo Haul",
          from: ["Shubin Mining Facility SM0-10"],
          to: ["Covalex Distribution Centre S4DC05"],
          cargo: [{ commodity: "Waste", scu: 5 }],
        },
      ],
    });

    expect(built.ok).toBe(true);
    if (!built.ok) return;

    expect(built.legs[0]?.routeAction).toBe("pickup");
    expect(built.legs[built.legs.length - 1]?.routeAction).toBe("delivery");

    const mine = built.legs.find((leg) =>
      leg.location.toLowerCase().includes("sm0-10"),
    );
    // Mine keeps unload-then-load on one stop (not split into pickup then later delivery).
    expect(mine?.routeAction).toBe("pickup_delivery");

    const rows = resolveLegs(built.legs);
    const check = validateChecklistTripCargo(
      rows,
      "covalex-distribution-centre-s4dc05",
    );
    expect(check.ok).toBe(true);
    expect(check.issues).toHaveLength(0);
  });

  it("keeps Shubin unload/load merged and returns to hub only at the end", () => {
    const intake: HaulingContractsIntake = {
      kind: "hauling_contracts_intake",
      version: 1,
      sessionName: "microTech Covalex crossed haul",
      startLocation: "Covalex Distribution Centre S4DC05",
      contracts: [
        {
          id: "stims-9",
          title: "Small Cargo Haul",
          from: ["Covalex Distribution Centre S4DC05"],
          to: [
            "Shubin Mining Facility SM0-18",
            "Shubin Mining Facility SM0-13",
            "Shubin Mining Facility SM0-22",
            "Shubin Mining Facility SM0-10",
          ],
          cargo: [{ commodity: "Stims", scu: 9 }],
        },
        {
          id: "fuel-ammo-19",
          title: "Small Cargo Haul",
          from: ["Covalex Distribution Centre S4DC05"],
          to: [
            "Shubin Mining Facility SM0-13",
            "Shubin Mining Facility SM0-22",
            "Shubin Mining Facility SM0-10",
            "Shubin Mining Facility SM0-18",
          ],
          cargo: [
            { commodity: "Hydrogen Fuel", scu: 7 },
            { commodity: "Quantum Fuel", scu: 8 },
            { commodity: "Ship Ammunition", scu: 4 },
          ],
        },
        {
          id: "waste-scrap-10",
          title: "Small Cargo Haul",
          from: [
            "Shubin Mining Facility SM0-18",
            "Shubin Mining Facility SM0-13",
            "Shubin Mining Facility SM0-22",
            "Shubin Mining Facility SM0-10",
          ],
          to: ["Covalex Distribution Centre S4DC05"],
          cargo: [
            { commodity: "Waste", scu: 5 },
            { commodity: "Scrap", scu: 5 },
          ],
        },
        {
          id: "minerals-20",
          title: "Small Cargo Haul",
          from: [
            "Shubin Mining Facility SM0-13",
            "Shubin Mining Facility SM0-18",
            "Shubin Mining Facility SM0-22",
            "Shubin Mining Facility SM0-10",
          ],
          to: ["Covalex Distribution Centre S4DC05"],
          cargo: [
            { commodity: "Quartz (Raw)", scu: 10 },
            { commodity: "Corundum (Raw)", scu: 10 },
          ],
        },
        {
          id: "ice-food-19",
          title: "Small Cargo Haul",
          from: ["Covalex Distribution Centre S4DC05"],
          to: [
            "Shubin Mining Facility SM0-10",
            "Shubin Mining Facility SM0-22",
            "Shubin Mining Facility SM0-18",
            "Shubin Mining Facility SM0-13",
          ],
          cargo: [
            { commodity: "Pressurized Ice", scu: 8 },
            { commodity: "Processed Food", scu: 11 },
          ],
        },
      ],
    };

    const built = buildRouteFromIntake(intake);
    expect(built.ok).toBe(true);
    if (!built.ok) return;

    // Hub load → four mines (merged) → hub return. No orphan mine visits after hub.
    expect(built.legs).toHaveLength(6);
    expect(built.legs[0]?.routeAction).toBe("pickup");
    expect(built.legs[0]?.location.toLowerCase()).toContain("s4dc05");
    expect(built.legs[built.legs.length - 1]?.routeAction).toBe("delivery");
    expect(
      built.legs[built.legs.length - 1]?.location.toLowerCase(),
    ).toContain("s4dc05");

    const mineLegs = built.legs.slice(1, -1);
    expect(mineLegs).toHaveLength(4);
    for (const leg of mineLegs) {
      expect(leg.routeAction).toBe("pickup_delivery");
      expect(leg.location.toLowerCase()).toContain("shubin");
    }

    const rows = resolveLegs(built.legs);
    const check = validateChecklistTripCargo(
      rows,
      "covalex-distribution-centre-s4dc05",
    );
    expect(check.ok).toBe(true);
    expect(check.issues).toHaveLength(0);
  });
});
