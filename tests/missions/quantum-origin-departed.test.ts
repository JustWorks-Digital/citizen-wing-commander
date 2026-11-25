import { describe, expect, it } from "vitest";
import {
  emptySessionChecklist,
  normalizeSessionChecklist,
} from "@/lib/missions/sessionChecklist";
import { resetTripProgress } from "@/lib/missions/reorderStops";

describe("quantumOriginDeparted persistence", () => {
  it("round-trips through normalizeSessionChecklist", () => {
    const session = normalizeSessionChecklist({
      ...emptySessionChecklist(),
      quantumOriginDeparted: true,
    });
    expect(session.quantumOriginDeparted).toBe(true);
    expect(
      normalizeSessionChecklist({
        ...session,
        quantumOriginDeparted: false,
      }).quantumOriginDeparted,
    ).toBe(false);
  });

  it("clears on resetTripProgress", () => {
    const session = normalizeSessionChecklist({
      ...emptySessionChecklist({
        rows: [
          {
            id: "leg-1",
            routeAction: "pickup",
            locationSlug: "area18",
            cargoDeliveries: [],
            shipStorageLocation: "front",
            distanceToNext: null,
            isCompleted: true,
          },
        ],
      }),
      quantumOriginDeparted: true,
    });
    expect(resetTripProgress(session).quantumOriginDeparted).toBe(false);
  });
});
