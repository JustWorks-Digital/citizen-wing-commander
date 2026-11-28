import { describe, expect, it } from "vitest";
import {
  defaultFocusedStopId,
  QUANTUM_ORIGIN_ROW_ID,
} from "@/components/missions/checklist/MissionChecklistTable";
import {
  emptySessionChecklist,
  normalizeSessionChecklist,
  type HaulingChecklistRow,
} from "@/lib/missions/sessionChecklist";
import { resetTripProgress } from "@/lib/missions/reorderStops";

/** Orison → Area18 first stop; QT origin needed until departed. */
const pickupAtArea18: HaulingChecklistRow = {
  id: "leg-1",
  routeAction: "pickup",
  locationSlug: "area18",
  cargoDeliveries: [],
  shipStorageLocation: "front",
  distanceToNext: null,
  isCompleted: false,
};

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
            ...pickupAtArea18,
            isCompleted: true,
          },
        ],
      }),
      quantumOriginDeparted: true,
    });
    expect(resetTripProgress(session).quantumOriginDeparted).toBe(false);
  });
});

describe("defaultFocusedStopId after QT origin departure", () => {
  // Hide history keys off openActiveId !== QT; departed QT must not stay default focus.
  it("returns first incomplete stop when quantum origin has departed", () => {
    expect(
      defaultFocusedStopId([pickupAtArea18], "orison", true),
    ).toBe("leg-1");
  });

  it("returns quantum origin when start differs and not departed", () => {
    expect(
      defaultFocusedStopId([pickupAtArea18], "orison", false),
    ).toBe(QUANTUM_ORIGIN_ROW_ID);
  });
});
