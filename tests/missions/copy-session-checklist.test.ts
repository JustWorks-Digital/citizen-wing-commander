import { describe, expect, it } from "vitest";
import { mockSessionChecklist } from "@/lib/missions/mockSession";
import {
  copySessionChecklist,
  sessionNameForCopy,
  shortCopyId,
} from "@/lib/missions/copySessionChecklist";

describe("copySessionChecklist", () => {
  it("builds a copy name with a short id marker", () => {
    expect(shortCopyId("a7f3b2c1-0000-4000-8000-000000000001")).toBe("a7f3");
    expect(sessionNameForCopy("Hurston haul", "a7f3b2c1-0000-4000-8000-000000000001")).toBe(
      "Hurston haul · a7f3",
    );
    expect(
      sessionNameForCopy("Hurston haul · dead", "beef0000-0000-4000-8000-000000000001"),
    ).toBe("Hurston haul · beef");
  });

  it("copies route config and box mixes with a new id and cleared progress", () => {
    const source = {
      ...mockSessionChecklist,
      sessionName: "Template run",
      missionsCompleted: 1,
      completedAt: "2026-11-14T12:00:00.000Z",
      rows: mockSessionChecklist.rows.map((row, index) =>
        index === 0
          ? {
              ...row,
              isCompleted: true,
              cargoDeliveries: row.cargoDeliveries.map((cargo) => ({
                ...cargo,
                isHandled: true,
              })),
            }
          : row,
      ),
      missions: mockSessionChecklist.missions.map((mission, index) =>
        index === 0 ? { ...mission, isCompleted: true } : mission,
      ),
    };
    const copy = copySessionChecklist(source, {
      now: new Date("2026-11-15T05:00:00.000Z"),
    });

    expect(copy.id).not.toBe(source.id);
    expect(copy.sessionName).toMatch(/^Template run · [a-f0-9]{4}$/i);
    expect(copy.shipSlugs).toEqual(source.shipSlugs);
    expect(copy.startLocationSlug).toBe(source.startLocationSlug);
    expect(copy.rows).toHaveLength(source.rows.length);
    expect(copy.rows.every((row) => row.isCompleted === false)).toBe(true);
    expect(
      copy.rows.every((row) =>
        row.cargoDeliveries.every((cargo) => cargo.isHandled !== true),
      ),
    ).toBe(true);
    expect(copy.missions.every((mission) => mission.isCompleted === false)).toBe(
      true,
    );
    expect(copy.missions.map((mission) => mission.title)).toEqual(
      source.missions.map((mission) => mission.title),
    );
    expect(copy.missions[0]?.scuBoxSplits).toBeTruthy();
    expect(copy.missionsCompleted).toBe(0);
    expect(copy.completedAt).toBeNull();
    expect(copy.startedAt).toBe("2026-11-15T05:00:00.000Z");
  });
});
