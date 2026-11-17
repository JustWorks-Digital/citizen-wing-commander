import { describe, expect, it } from "vitest";
import { buildRouteFromIntake } from "@/lib/sessions/buildRouteFromIntake";
import { validateChecklistTripCargo } from "@/lib/missions/tripPlan";
import { resolveIncomingLeg } from "@/lib/sessions/resolveRefs";
import type { HaulingChecklistRow } from "@/lib/missions/sessionChecklist";

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

    const hubLegs = built.legs.filter(
      (leg) =>
        resolveIncomingLeg(leg, 0).ok &&
        (leg.location.toLowerCase().includes("s4dc05") ||
          leg.location.toLowerCase().includes("covalex")),
    );
    // Pickup visit then later return delivery — not one combined first stop.
    expect(built.legs[0]?.routeAction).toBe("pickup");
    expect(built.legs[built.legs.length - 1]?.routeAction).toBe("delivery");
    expect(hubLegs.length).toBeGreaterThanOrEqual(2);

    const rows: HaulingChecklistRow[] = [];
    for (const [index, leg] of built.legs.entries()) {
      const resolved = resolveIncomingLeg(leg, index);
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) return;
      rows.push(resolved.row);
    }

    const check = validateChecklistTripCargo(
      rows,
      "covalex-distribution-centre-s4dc05",
    );
    expect(check.ok).toBe(true);
    expect(check.issues).toHaveLength(0);
  });
});
