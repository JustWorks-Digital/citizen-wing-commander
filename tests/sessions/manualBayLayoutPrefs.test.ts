import { describe, expect, it } from "vitest";
import {
  applyManualBayPoses,
  boxesFromManualPreset,
  placedBoxesFromStored,
  posesFromBoxes,
  storedBoxesFromPlaced,
  type ManualBayLayoutPreset,
} from "@/lib/sessions/manualBayLayoutPrefs";
import type { PlacedCargoBox } from "@/lib/ships/cargoGridPlacement";

function box(
  id: string,
  origin: { x: number; y: number; z: number },
  slug = "processed-food",
): PlacedCargoBox {
  return {
    id,
    size: 8,
    origin,
    footprint: { dx: 2, dy: 2, dz: 2 },
    commoditySlug: slug,
    commodityName: "Processed Food",
    color: null,
    color2: null,
    cells: [
      { x: origin.x, y: origin.y, z: origin.z },
      { x: origin.x + 1, y: origin.y, z: origin.z },
      { x: origin.x, y: origin.y + 1, z: origin.z },
      { x: origin.x + 1, y: origin.y + 1, z: origin.z },
    ],
    action: "pickup",
  };
}

describe("manualBayLayoutPrefs boxes snapshot", () => {
  it("round-trips stored boxes including Clear/Fill manual ids", () => {
    const manual = [
      box("manual-fill-lift-l-processed-food-0", { x: 0, y: 0, z: 0 }),
      box("manual-fill-lift-l-processed-food-1", { x: 2, y: 0, z: 0 }),
    ];
    const stored = storedBoxesFromPlaced(manual);
    const restored = placedBoxesFromStored(stored);
    expect(restored).toHaveLength(2);
    expect(restored[0]!.id).toBe(manual[0]!.id);
    expect(restored[0]!.origin).toEqual({ x: 0, y: 0, z: 0 });
    expect(restored[0]!.cells).toHaveLength(8);
  });

  it("restores snapshot when auto-pack box ids no longer match poses", () => {
    // User Clear + Fill → preset stores manual-* crates.
    const savedLayout = [
      box("manual-a", { x: 4, y: 14, z: 0 }, "ship-ammunition"),
      box("manual-b", { x: 6, y: 14, z: 0 }, "ship-ammunition"),
    ];
    const preset: ManualBayLayoutPreset = {
      id: "p1",
      name: "Manual 1",
      stopId: "stop-1",
      poses: posesFromBoxes(savedLayout),
      boxes: storedBoxesFromPlaced(savedLayout),
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    // Leaving Manual regenerates auto-pack with different ids.
    const autoPack = [
      box("front-0-8-processed-food-0-0-0", { x: 0, y: 0, z: 0 }),
      box("front-1-8-processed-food-2-0-0", { x: 2, y: 0, z: 0 }),
    ];
    // Pose-only restore fails (ids diverge).
    const poseOnly = applyManualBayPoses(autoPack, preset.poses);
    expect(poseOnly[0]!.origin).toEqual({ x: 0, y: 0, z: 0 });

    const restored = boxesFromManualPreset(preset, autoPack);
    expect(restored).toHaveLength(2);
    expect(restored.map((entry) => entry.id)).toEqual([
      "manual-a",
      "manual-b",
    ]);
    expect(restored[0]!.origin).toEqual({ x: 4, y: 14, z: 0 });
    expect(restored[0]!.commoditySlug).toBe("ship-ammunition");
  });

  it("falls back to pose overlay for legacy presets without boxes", () => {
    const autoPack = [box("auto-1", { x: 0, y: 0, z: 0 })];
    const preset: ManualBayLayoutPreset = {
      id: "legacy",
      name: "Manual 1",
      stopId: "stop-1",
      poses: [{ boxId: "auto-1", origin: { x: 8, y: 2, z: 0 } }],
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const restored = boxesFromManualPreset(preset, autoPack);
    expect(restored[0]!.origin).toEqual({ x: 8, y: 2, z: 0 });
  });
});
