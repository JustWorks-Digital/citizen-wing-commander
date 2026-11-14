import { describe, expect, it } from "vitest";
import type { HaulingChecklistRow } from "@/lib/missions/mockSession";
import { mockSessionChecklist } from "@/lib/missions/mockSession";
import {
  isTripStarted,
  moveStopIdBefore,
  reorderChecklistStops,
  resetTripProgress,
} from "@/lib/missions/reorderStops";

function stop(
  id: string,
  locationSlug: string,
  isCompleted = false,
): HaulingChecklistRow {
  return {
    id,
    routeAction: "pickup",
    locationSlug,
    cargoDeliveries: [],
    shipStorageLocation: "front",
    distanceToNext: null,
    isCompleted,
  };
}

describe("isTripStarted", () => {
  it("is false when every stop is incomplete", () => {
    expect(
      isTripStarted([stop("a", "area18"), stop("b", "baijini")]),
    ).toBe(false);
  });

  it("is true when any stop is complete", () => {
    expect(
      isTripStarted([
        stop("a", "area18", true),
        stop("b", "baijini"),
      ]),
    ).toBe(true);
  });
});

describe("reorderChecklistStops", () => {
  it("permutes stops and refuses after trip start", () => {
    const rows = [stop("a", "area18"), stop("b", "baijini"), stop("c", "tressler")];
    const ok = reorderChecklistStops(rows, ["c", "a", "b"]);
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(ok.rows.map((row) => row.id)).toEqual(["c", "a", "b"]);

    const locked = reorderChecklistStops(
      [stop("a", "area18", true), stop("b", "baijini")],
      ["b", "a"],
    );
    expect(locked.ok).toBe(false);
  });
});

describe("moveStopIdBefore", () => {
  it("moves a stop before another", () => {
    expect(moveStopIdBefore(["a", "b", "c"], "c", "a")).toEqual([
      "c",
      "a",
      "b",
    ]);
    expect(moveStopIdBefore(["a", "b", "c"], "a", "c")).toEqual([
      "b",
      "a",
      "c",
    ]);
  });
});

describe("resetTripProgress", () => {
  it("clears stop and contract completion so reorder unlocks", () => {
    const started = {
      ...mockSessionChecklist,
      rows: mockSessionChecklist.rows.map((row, index) => ({
        ...row,
        isCompleted: index === 0,
        cargoDeliveries: row.cargoDeliveries.map((cargo, cargoIndex) => ({
          ...cargo,
          isHandled: index === 0 && cargoIndex === 0,
        })),
      })),
      missions: mockSessionChecklist.missions.map((mission, index) => ({
        ...mission,
        isCompleted: index === 0,
      })),
      missionsCompleted: 1,
    };
    expect(isTripStarted(started.rows)).toBe(true);
    const reset = resetTripProgress(started);
    expect(isTripStarted(reset.rows)).toBe(false);
    expect(reset.rows.every((row) => !row.isCompleted)).toBe(true);
    expect(reset.missions.every((mission) => !mission.isCompleted)).toBe(true);
    expect(reset.missionsCompleted).toBe(0);
  });
});
