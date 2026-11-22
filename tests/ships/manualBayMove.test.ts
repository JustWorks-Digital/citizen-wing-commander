import { describe, expect, it } from "vitest";
import type { PlacedCargoBox } from "@/lib/ships/cargoGridPlacement";
import {
  cargoGridZoneSpans,
  getCargoGridSketchBySlug,
  type ShipCargoGridSketch,
} from "@/lib/ships/cargoGrids";
import {
  canPlaceManualBayBox,
  estimateManualBayBulkFillFootprint,
  layoutManualBayBulkFillPreview,
  previewManualBayDrop,
  previewManualBayZoneFill,
  tryDropManualBayBox,
  tryFillManualBayZoneWithCargoType,
  tryFillManualBayZoneWithMission,
  tryMoveManualBayBox,
} from "@/lib/ships/manualBayMove";

/** Minimal 6×4 cargo sketch (no gaps) for drop tests. */
function toySketch(): ShipCargoGridSketch {
  return {
    shipSlug: "toy",
    shipName: "Toy",
    widthCells: 4,
    heightCells: 2,
    notes: [],
    zones: [
      {
        id: "main",
        label: "Main",
        kind: "cargo",
        lengthCells: 6,
        widthCells: 4,
        xStartCells: 0,
        yStartCells: 0,
      },
    ],
  };
}

function boxAt(
  id: string,
  x: number,
  y: number,
  dx = 1,
  dy = 1,
): PlacedCargoBox {
  const cells = [];
  for (let ox = 0; ox < dx; ox += 1) {
    for (let oy = 0; oy < dy; oy += 1) {
      cells.push({ x: x + ox, y: y + oy, z: 0 });
    }
  }
  return {
    id,
    size: dx * dy,
    origin: { x, y, z: 0 },
    footprint: { dx, dy, dz: 1 },
    commoditySlug: "processed-food",
    commodityName: "Processed Food",
    color: null,
    color2: null,
    cells,
    action: "pickup",
  };
}

describe("tryDropManualBayBox", () => {
  it("moves by grab offset onto a clear cargo cell", () => {
    const sketch = toySketch();
    const boxes = [boxAt("a", 0, 0, 2, 2)];
    // Grabbed the +1,+1 corner of the 2×2; drop that corner on (4,2).
    const next = tryDropManualBayBox(
      sketch,
      boxes,
      "a",
      { x: 4, y: 2, z: 0 },
      { dx: 1, dy: 1 },
    );
    expect(next).not.toBeNull();
    expect(next![0]!.origin).toEqual({ x: 3, y: 1, z: 0 });
  });

  it("returns null when the drop footprint leaves the bay", () => {
    const sketch = toySketch();
    const boxes = [boxAt("a", 0, 0, 2, 2)];
    const next = tryDropManualBayBox(
      sketch,
      boxes,
      "a",
      { x: 5, y: 3, z: 0 },
      { dx: 0, dy: 0 },
    );
    expect(next).toBeNull();
  });

  it("returns null when colliding with another crate", () => {
    const sketch = toySketch();
    const boxes = [boxAt("a", 0, 0), boxAt("b", 2, 0)];
    const next = tryDropManualBayBox(
      sketch,
      boxes,
      "a",
      { x: 2, y: 0, z: 0 },
      { dx: 0, dy: 0 },
    );
    expect(next).toBeNull();
    expect(canPlaceManualBayBox(sketch, boxes, "a", { x: 2, y: 0, z: 0 })).toBe(
      false,
    );
  });
});

describe("tryMoveManualBayBox", () => {
  it("still moves by cell delta when legal", () => {
    const sketch = toySketch();
    const boxes = [boxAt("a", 0, 0)];
    const next = tryMoveManualBayBox(sketch, boxes, "a", 2, 1);
    expect(next?.[0]?.origin).toEqual({ x: 2, y: 1, z: 0 });
  });
});

describe("previewManualBayDrop", () => {
  it("marks a clear footprint as fits", () => {
    const sketch = toySketch();
    const boxes = [boxAt("a", 0, 0, 2, 2)];
    const preview = previewManualBayDrop(
      sketch,
      boxes,
      "a",
      { x: 4, y: 2, z: 0 },
      { dx: 1, dy: 1 },
    );
    expect(preview?.fits).toBe(true);
    expect(preview?.origin).toEqual({ x: 3, y: 1, z: 0 });
    expect(preview?.cells).toHaveLength(4);
  });

  it("marks an out-of-bay footprint as not fitting", () => {
    const sketch = toySketch();
    const boxes = [boxAt("a", 0, 0, 2, 2)];
    const preview = previewManualBayDrop(
      sketch,
      boxes,
      "a",
      { x: 5, y: 3, z: 0 },
      { dx: 0, dy: 0 },
    );
    expect(preview?.fits).toBe(false);
  });
});

describe("estimateManualBayBulkFillFootprint", () => {
  it("sizes a small fill smaller than a large fill", () => {
    const ice = estimateManualBayBulkFillFootprint(
      [{ size: 4, count: 5 }],
      4,
    );
    const food = estimateManualBayBulkFillFootprint(
      [{ size: 8, count: 30 }],
      4,
    );
    expect(ice.totalScu).toBe(20);
    expect(food.totalScu).toBe(240);
    expect(ice.deckCells).toBeLessThan(food.deckCells);
    expect(ice.dx * ice.dy).toBeGreaterThanOrEqual(ice.deckCells);
    expect(food.dx * food.dy).toBeGreaterThanOrEqual(food.deckCells);
  });
});

describe("layoutManualBayBulkFillPreview", () => {
  const liftR = { xStart: 0, xEnd: 16, yStart: 14, yEnd: 18 };

  it("keeps a small fill entirely inside the hovered bay", () => {
    const layout = layoutManualBayBulkFillPreview(
      liftR,
      { x: 4, y: 15, z: 0 },
      12,
    );
    expect(layout.origin.x).toBeGreaterThanOrEqual(liftR.xStart);
    expect(layout.origin.y).toBeGreaterThanOrEqual(liftR.yStart);
    expect(layout.origin.x + layout.dx).toBeLessThanOrEqual(liftR.xEnd);
    expect(layout.origin.y + layout.dy).toBeLessThanOrEqual(liftR.yEnd);
  });

  it("covers the hovered bay first when the load exceeds that bay", () => {
    const layout = layoutManualBayBulkFillPreview(
      liftR,
      { x: 2, y: 15, z: 0 },
      200,
    );
    expect(layout.origin).toEqual({ x: 0, y: 14, z: 0 });
    expect(layout.dy).toBe(4);
    expect(layout.dx).toBeGreaterThan(16);
  });
});

describe("previewManualBayZoneFill", () => {
  it("anchors Galaxy Lift R preview so most cells stay in that lift", () => {
    const sketch = getCargoGridSketchBySlug("galaxy");
    if (!sketch) throw new Error("Missing galaxy cargo-grid fixture");
    const preview = previewManualBayZoneFill(
      sketch,
      { x: 2, y: 15, z: 0 },
      { crates: [{ size: 8, count: 10 }] },
    );
    expect(preview).not.toBeNull();
    expect(preview!.zoneId).toBe("lift-r");
    const inLiftR = preview!.cells.filter(
      (cell) => cell.y >= 14 && cell.y < 18 && cell.x >= 0 && cell.x < 16,
    );
    expect(inLiftR.length).toBeGreaterThan(preview!.cells.length / 2);
  });

  // Session Galaxy Manual Fill — preview XY/Z must match stacked drop, not a flat deck rect.
  it("matches the stacked drop footprint for Galaxy Lift R", () => {
    const sketch = getCargoGridSketchBySlug("galaxy");
    if (!sketch) throw new Error("Missing galaxy cargo-grid fixture");
    const dropCell = { x: 2, y: 15, z: 0 };
    const crates = [{ size: 8 as const, count: 10 }];
    const preview = previewManualBayZoneFill(sketch, dropCell, { crates });
    const drop = tryFillManualBayZoneWithCargoType(sketch, [], dropCell, {
      missionId: "m1",
      commoditySlug: "processed-food",
      commodityName: "Processed Food",
      color: null,
      color2: null,
      crates,
    });
    expect(preview).not.toBeNull();
    expect(drop).not.toBeNull();
    expect(preview!.cells.length).toBe(
      drop!.boxes.reduce((sum, box) => sum + box.cells.length, 0),
    );
    expect(preview!.footprint).toEqual({
      dx: 10,
      dy: 2,
      origin: expect.objectContaining({ z: 0 }),
    });
    expect(Math.max(...preview!.cells.map((cell) => cell.z))).toBeGreaterThan(0);
  });
});

describe("tryFillManualBayZoneWithCargoType", () => {
  it("places largest crates first and leaves overflow in unplacedCount", () => {
    const sketch = toySketch();
    // 6×4×2 = 48 SCU capacity; 8×8 + smalls overflow.
    const result = tryFillManualBayZoneWithCargoType(
      sketch,
      [],
      { x: 0, y: 0, z: 0 },
      {
        missionId: "m1",
        commoditySlug: "processed-food",
        commodityName: "Processed Food",
        color: null,
        color2: null,
        crates: [
          { size: 8, count: 8 },
          { size: 2, count: 4 },
          { size: 1, count: 4 },
        ],
      },
    );
    expect(result).not.toBeNull();
    expect(result!.placedCount).toBeGreaterThan(0);
    expect(result!.unplacedCount).toBeGreaterThan(0);
    // Largest-first: every placed 2/1 appears only after all placeable 8s.
    const sizes = result!.boxes.map((box) => box.size);
    const firstSmall = sizes.findIndex((size) => size < 8);
    if (firstSmall >= 0) {
      expect(sizes.slice(0, firstSmall).every((size) => size === 8)).toBe(true);
    }
    expect(sizes.filter((size) => size === 8).length).toBeGreaterThan(0);
  });

  it("mission Fill packs all cargo types together sorted by type SCU", () => {
    const sketch = toySketch();
    const result = tryFillManualBayZoneWithMission(
      sketch,
      [],
      { x: 0, y: 0, z: 0 },
      {
        missionId: "m1",
        missionTitle: "Ice and Food",
        commodities: [
          {
            missionId: "m1",
            commoditySlug: "pressurized-ice",
            commodityName: "Pressurized Ice",
            color: null,
            color2: null,
            crates: [{ size: 4, count: 2 }],
          },
          {
            missionId: "m1",
            commoditySlug: "processed-food",
            commodityName: "Processed Food",
            color: null,
            color2: null,
            crates: [{ size: 8, count: 3 }],
          },
        ],
      },
    );
    expect(result).not.toBeNull();
    expect(result!.placedCount).toBe(5);
    expect(result!.unplacedCount).toBe(0);
    // Largest cargo type (PF 24 SCU) places before minority ice (8 SCU).
    const first = result!.boxes[0]!;
    expect(first.commoditySlug).toBe("processed-food");
    const types = [...new Set(result!.boxes.map((box) => box.commoditySlug))];
    expect(types).toEqual(["processed-food", "pressurized-ice"]);
  });

  // C2 Hercules rear is one large zone — Fill must seed near the drop cell so
  // players can pack different blocks (ramp-side vs nose-side) of the same bay.
  it("Hercules rear Fill seeds near the drop cell not only one bay corner", () => {
    const sketch = getCargoGridSketchBySlug("c2-hercules-starlifter");
    if (!sketch) throw new Error("Missing C2 Hercules cargo-grid fixture");
    const rear = cargoGridZoneSpans(sketch).find(
      (entry) => entry.zone.id === "rear",
    );
    if (!rear) throw new Error("Missing Hercules rear zone");

    const rampDrop = {
      x: rear.xEnd - 2,
      y: rear.yStart + 1,
      z: 0,
    };
    const noseDrop = {
      x: rear.xStart + 1,
      y: rear.yEnd - 2,
      z: 0,
    };

    const rampFill = tryFillManualBayZoneWithCargoType(
      sketch,
      [],
      rampDrop,
      {
        missionId: "m1",
        commoditySlug: "processed-food",
        commodityName: "Processed Food",
        color: null,
        color2: null,
        crates: [{ size: 8, count: 4 }],
      },
    );
    expect(rampFill).not.toBeNull();
    expect(rampFill!.placedCount).toBe(4);
    const rampMeanX =
      rampFill!.boxes.reduce((sum, box) => sum + box.origin.x, 0) /
      rampFill!.boxes.length;

    const noseFill = tryFillManualBayZoneWithCargoType(
      sketch,
      [],
      noseDrop,
      {
        missionId: "m1",
        commoditySlug: "processed-food",
        commodityName: "Processed Food",
        color: null,
        color2: null,
        crates: [{ size: 8, count: 4 }],
      },
    );
    expect(noseFill).not.toBeNull();
    expect(noseFill!.placedCount).toBe(4);
    const noseMeanX =
      noseFill!.boxes.reduce((sum, box) => sum + box.origin.x, 0) /
      noseFill!.boxes.length;

    // Ramp-side drop (high X) packs farther aft than nose-side drop (low X).
    expect(rampMeanX).toBeGreaterThan(noseMeanX + 2);

    // Second Fill into the same rear on the opposite corner starts a second block.
    const second = tryFillManualBayZoneWithCargoType(
      sketch,
      rampFill!.boxes,
      noseDrop,
      {
        missionId: "m1",
        commoditySlug: "ship-ammunition",
        commodityName: "Ship Ammunition",
        color: null,
        color2: null,
        crates: [{ size: 8, count: 4 }],
      },
    );
    expect(second).not.toBeNull();
    expect(second!.placedCount).toBe(4);
    const saBoxes = second!.boxes.filter(
      (box) => box.commoditySlug === "ship-ammunition",
    );
    const saMeanX =
      saBoxes.reduce((sum, box) => sum + box.origin.x, 0) / saBoxes.length;
    expect(saMeanX).toBeLessThan(rampMeanX - 2);
  });

  it("Galaxy Lift L/R leave open deck cells toward the aisle not the outer wall", () => {
    // Manual Fill screenshot: PF (Lift L) open toward gap = right; SA (Lift R)
    // must also open toward the gap — outer wall flips by side.
    const sketch = getCargoGridSketchBySlug("galaxy");
    if (!sketch) throw new Error("Missing galaxy cargo-grid fixture");
    const shipCy = (sketch.widthCells - 1) / 2;

    for (const zoneId of ["lift-l", "lift-r"] as const) {
      const span = cargoGridZoneSpans(sketch).find(
        (entry) => entry.zone.id === zoneId,
      );
      if (!span) throw new Error(`Missing ${zoneId}`);
      // Drop on the outer wall so Fill seeds wall→aisle (Lift L low-Y, Lift R high-Y).
      const wallY =
        zoneId === "lift-l" ? span.yStart : span.yEnd - 1;
      // Partial fill — enough to leave open deck cells.
      const result = tryFillManualBayZoneWithCargoType(
        sketch,
        [],
        { x: span.xStart, y: wallY, z: 0 },
        {
          missionId: "m1",
          commoditySlug: "ship-ammunition",
          commodityName: "Ship Ammunition",
          color: null,
          color2: null,
          crates: [{ size: 8, count: 10 }],
        },
      );
      expect(result, zoneId).not.toBeNull();
      expect(result!.placedCount, zoneId).toBeGreaterThan(0);
      expect(result!.unplacedCount, zoneId).toBe(0);

      const occupied = new Set(
        result!.boxes.flatMap((box) =>
          box.cells
            .filter((cell) => cell.z === 0)
            .map((cell) => `${cell.x},${cell.y}`),
        ),
      );
      const occupiedDists: number[] = [];
      const emptyDists: number[] = [];
      for (let x = span.xStart; x < span.xEnd; x += 1) {
        for (let y = span.yStart; y < span.yEnd; y += 1) {
          const dist = Math.abs(y - shipCy);
          if (occupied.has(`${x},${y}`)) occupiedDists.push(dist);
          else emptyDists.push(dist);
        }
      }
      expect(emptyDists.length, `${zoneId} has open deck`).toBeGreaterThan(0);
      const mean = (values: number[]) =>
        values.reduce((sum, value) => sum + value, 0) / values.length;
      // Open cells closer to ship middle (aisle) than cargo against the wall.
      expect(
        mean(emptyDists),
        `${zoneId} open cells should be toward aisle (middle)`,
      ).toBeLessThan(mean(occupiedDists));
    }
  });
});
