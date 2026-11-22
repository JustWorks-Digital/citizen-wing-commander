import { describe, expect, it } from "vitest";
import { cargoBay } from "@/lib/ships/cargoBay";
import { getCargoGridSketchBySlug } from "@/lib/ships/cargoGrids";
import { manualBayCarryover } from "@/lib/ships/manualBayCarryover";
import { cargoGridCoordKey } from "@/lib/ships/cargoGridCoords";
import type { PlacedCargoBox } from "@/lib/ships/cargoGridPlacement";
import { loadSessionFixture } from "@/tests/sessions/loadSessionFixture";

// Fixture microtech-5-experienced-local-hauls-2026-11-16 (galaxy): stop-1 pickup,
// then stop-2 pickup/delivery. Player arranged stop-1 by cargo type (stims at the
// ramp edge, y=17); stop-2 Manual used to fall back to the Suggested auto-pack.
const pack = loadSessionFixture("microtech-5-experienced-local-hauls-2026-11-16");
const sketch = getCargoGridSketchBySlug("galaxy")!;
const rows = pack.session.rows;

const arrangedAtPickup = cargoBay.packAtStop("stop-1", sketch, rows, {
  packMode: "by-cargo-type",
  includeAboardCargo: true,
});
const autoAtDelivery = cargoBay.packAtStop("stop-2", sketch, rows, {
  packMode: "suggested",
  includeAboardCargo: true,
});

describe("manualBayCarryover.boxesAtStop", () => {
  it("keeps 2 SCU stims where the player arranged them at the pickup stop", () => {
    const stimsAutoOrigin = autoAtDelivery.boxes.find(
      (box) => box.commoditySlug === "stims" && box.size === 2,
    )!.origin;
    expect(stimsAutoOrigin).toEqual({ x: 0, y: 2, z: 0 });

    const carried = manualBayCarryover.boxesAtStop(
      autoAtDelivery.boxes,
      arrangedAtPickup.boxes,
    );

    const stimsOrigins = carried
      .filter((box) => box.commoditySlug === "stims" && box.size === 2)
      .map((box) => box.origin);
    expect(stimsOrigins).toContainEqual({ x: 0, y: 17, z: 0 });
    expect(stimsOrigins).not.toContainEqual({ x: 0, y: 2, z: 0 });
  });

  it("keeps each crate's stop action and never overlaps cells", () => {
    const carried = manualBayCarryover.boxesAtStop(
      autoAtDelivery.boxes,
      arrangedAtPickup.boxes,
    );
    const cellKeys = carried.flatMap((box) => box.cells.map(cargoGridCoordKey));
    expect(new Set(cellKeys).size).toBe(cellKeys.length);
    expect(carried.filter((box) => box.action === "delivery")).not.toHaveLength(
      0,
    );
  });

  it("returns the auto-pack unchanged when nothing was arranged earlier", () => {
    expect(manualBayCarryover.boxesAtStop(autoAtDelivery.boxes, [])).toEqual(
      autoAtDelivery.boxes,
    );
  });

  // Everus Harbor Manual: sides only → next stop must not invent a middle 4scu
  // from unmatched auto-pack crates (session 9a89783f… style).
  it("keeps earlier poses only — never auto-pack middle crates", () => {
    const sidesOnly: PlacedCargoBox[] = arrangedAtPickup.boxes.filter(
      (box) => box.origin.y === 0 || box.origin.y >= 14,
    );
    expect(sidesOnly.length).toBeGreaterThan(0);

    const carried = manualBayCarryover.boxesAtStop(
      autoAtDelivery.boxes,
      sidesOnly,
    );

    for (const box of carried) {
      expect(
        sidesOnly.some(
          (earlier) =>
            earlier.id === box.id &&
            earlier.origin.x === box.origin.x &&
            earlier.origin.y === box.origin.y &&
            earlier.origin.z === box.origin.z,
        ),
      ).toBe(true);
    }
  });

  // Session 9a89783f… Transfer at S1DC06 — HF stack: bottom tagged delivery,
  // top stay; Transfer should prefer the top crate (one move vs two).
  it("tags delivery on the top of a same-commodity stack, not the buried crate", () => {
    const bottom: PlacedCargoBox = {
      id: "hf-bottom",
      size: 1,
      origin: { x: 4, y: 2, z: 0 },
      footprint: { dx: 1, dy: 1, dz: 1 },
      commoditySlug: "hydrogen-fuel",
      commodityName: "Hydrogen Fuel",
      color: null,
      color2: null,
      cells: [{ x: 4, y: 2, z: 0 }],
      action: "delivery",
      missionId: "seniorfu",
      deliveryLocationSlug: "covalex-distribution-centre-s1dc06",
      deliveryLocationName: "S1DC06",
    };
    const top: PlacedCargoBox = {
      id: "hf-top",
      size: 1,
      origin: { x: 4, y: 2, z: 1 },
      footprint: { dx: 1, dy: 1, dz: 1 },
      commoditySlug: "hydrogen-fuel",
      commodityName: "Hydrogen Fuel",
      color: null,
      color2: null,
      cells: [{ x: 4, y: 2, z: 1 }],
      action: undefined,
      missionId: "seniorfu",
    };
    const retagged = manualBayCarryover.retagDeliveryPreferringTop([
      bottom,
      top,
    ]);
    expect(retagged.find((box) => box.id === "hf-top")?.action).toBe(
      "delivery",
    );
    expect(retagged.find((box) => box.id === "hf-bottom")?.action).toBe(
      undefined,
    );
  });

  // Same doorward X + equal aisle distance — clear the taller column before
  // skimming a top from the neighbor column.
  it("clears one stack column top-to-bottom before another column top", () => {
    const stackABottom: PlacedCargoBox = {
      id: "a-bottom",
      size: 1,
      origin: { x: 10, y: 7, z: 0 },
      footprint: { dx: 1, dy: 1, dz: 1 },
      commoditySlug: "hydrogen-fuel",
      commodityName: "Hydrogen Fuel",
      color: null,
      color2: null,
      cells: [{ x: 10, y: 7, z: 0 }],
      action: "delivery",
      missionId: "seniorfu",
      deliveryLocationSlug: "covalex-distribution-centre-s1dc06",
    };
    const stackATop: PlacedCargoBox = {
      id: "a-top",
      size: 1,
      origin: { x: 10, y: 7, z: 1 },
      footprint: { dx: 1, dy: 1, dz: 1 },
      commoditySlug: "hydrogen-fuel",
      commodityName: "Hydrogen Fuel",
      color: null,
      color2: null,
      cells: [{ x: 10, y: 7, z: 1 }],
      action: "delivery",
      missionId: "seniorfu",
      deliveryLocationSlug: "covalex-distribution-centre-s1dc06",
    };
    const stackBTop: PlacedCargoBox = {
      id: "b-top",
      size: 1,
      origin: { x: 10, y: 10, z: 1 },
      footprint: { dx: 1, dy: 1, dz: 1 },
      commoditySlug: "hydrogen-fuel",
      commodityName: "Hydrogen Fuel",
      color: null,
      color2: null,
      cells: [{ x: 10, y: 10, z: 1 }],
      action: undefined,
      missionId: "seniorfu",
    };
    // y=7 and y=10 are equally far from deck center 8.5 on an 18-wide Galaxy.
    const retagged = manualBayCarryover.retagDeliveryPreferringTop(
      [stackABottom, stackBTop, stackATop],
      { deckWidthCells: 18 },
    );
    expect(retagged.find((box) => box.id === "a-top")?.action).toBe("delivery");
    expect(retagged.find((box) => box.id === "a-bottom")?.action).toBe(
      "delivery",
    );
    expect(retagged.find((box) => box.id === "b-top")?.action).toBe(undefined);
  });

  // Galaxy door is high X — prefer front/doorward pile over back-of-bay.
  it("prefers doorward (high X) crates over back-of-bay for delivery", () => {
    const back: PlacedCargoBox = {
      id: "hf-back",
      size: 1,
      origin: { x: 2, y: 8, z: 0 },
      footprint: { dx: 1, dy: 1, dz: 1 },
      commoditySlug: "hydrogen-fuel",
      commodityName: "Hydrogen Fuel",
      color: null,
      color2: null,
      cells: [{ x: 2, y: 8, z: 0 }],
      action: "delivery",
      missionId: "seniorfu",
    };
    const front: PlacedCargoBox = {
      id: "hf-front",
      size: 1,
      origin: { x: 14, y: 8, z: 0 },
      footprint: { dx: 1, dy: 1, dz: 1 },
      commoditySlug: "hydrogen-fuel",
      commodityName: "Hydrogen Fuel",
      color: null,
      color2: null,
      cells: [{ x: 14, y: 8, z: 0 }],
      action: undefined,
      missionId: "seniorfu",
    };
    const retagged = manualBayCarryover.retagDeliveryPreferringTop(
      [back, front],
      { deckWidthCells: 18 },
    );
    expect(retagged.find((box) => box.id === "hf-front")?.action).toBe(
      "delivery",
    );
    expect(retagged.find((box) => box.id === "hf-back")?.action).toBe(
      undefined,
    );
  });

  // Galaxy Lift walls at Y edges — prefer aisle/inside over wall.
  it("prefers aisle (center Y) crates over wall-edge for delivery", () => {
    const wall: PlacedCargoBox = {
      id: "hf-wall",
      size: 1,
      origin: { x: 10, y: 0, z: 0 },
      footprint: { dx: 1, dy: 1, dz: 1 },
      commoditySlug: "hydrogen-fuel",
      commodityName: "Hydrogen Fuel",
      color: null,
      color2: null,
      cells: [{ x: 10, y: 0, z: 0 }],
      action: "delivery",
      missionId: "seniorfu",
    };
    const aisle: PlacedCargoBox = {
      id: "hf-aisle",
      size: 1,
      origin: { x: 10, y: 3, z: 0 },
      footprint: { dx: 1, dy: 1, dz: 1 },
      commoditySlug: "hydrogen-fuel",
      commodityName: "Hydrogen Fuel",
      color: null,
      color2: null,
      cells: [{ x: 10, y: 3, z: 0 }],
      action: undefined,
      missionId: "seniorfu",
    };
    const retagged = manualBayCarryover.retagDeliveryPreferringTop(
      [wall, aisle],
      { deckWidthCells: 18 },
    );
    expect(retagged.find((box) => box.id === "hf-aisle")?.action).toBe(
      "delivery",
    );
    expect(retagged.find((box) => box.id === "hf-wall")?.action).toBe(
      undefined,
    );
  });

  it("keeps earlier box sizes when the delivery stop re-splits SCU", () => {
    // Auto at delivery invents a 4scu that was never on the Manual pickup layout.
    const earlier: PlacedCargoBox[] = [
      {
        id: "manual-hf-16",
        size: 16,
        origin: { x: 0, y: 17, z: 0 },
        footprint: { dx: 4, dy: 2, dz: 2 },
        commoditySlug: "hydrogen-fuel",
        commodityName: "Hydrogen Fuel",
        color: null,
        color2: null,
        cells: [],
        action: "pickup",
        missionId: "m1",
      },
    ];
    earlier[0]!.cells = [
      { x: 0, y: 17, z: 0 },
      { x: 1, y: 17, z: 0 },
    ];
    const autoWithResplit: PlacedCargoBox[] = [
      {
        id: "auto-hf-4",
        size: 4,
        origin: { x: 8, y: 8, z: 0 },
        footprint: { dx: 2, dy: 2, dz: 1 },
        commoditySlug: "hydrogen-fuel",
        commodityName: "Hydrogen Fuel",
        color: null,
        color2: null,
        cells: [
          { x: 8, y: 8, z: 0 },
          { x: 9, y: 8, z: 0 },
        ],
        action: "delivery",
        missionId: "m1",
      },
      {
        id: "auto-hf-12",
        size: 8,
        origin: { x: 10, y: 8, z: 0 },
        footprint: { dx: 2, dy: 2, dz: 2 },
        commoditySlug: "hydrogen-fuel",
        commodityName: "Hydrogen Fuel",
        color: null,
        color2: null,
        cells: [{ x: 10, y: 8, z: 0 }],
        action: undefined,
        missionId: "m1",
      },
      {
        id: "auto-hf-4b",
        size: 4,
        origin: { x: 12, y: 8, z: 0 },
        footprint: { dx: 2, dy: 2, dz: 1 },
        commoditySlug: "hydrogen-fuel",
        commodityName: "Hydrogen Fuel",
        color: null,
        color2: null,
        cells: [{ x: 12, y: 8, z: 0 }],
        action: undefined,
        missionId: "m1",
      },
    ];
    // 4+8+4 = 16 SCU demand — earlier 16scu crate still fits (not re-split to middle).
    const carried = manualBayCarryover.boxesAtStop(autoWithResplit, earlier);
    expect(carried).toHaveLength(1);
    expect(carried[0]!.size).toBe(16);
    expect(carried[0]!.origin).toEqual({ x: 0, y: 17, z: 0 });
    expect(
      carried.some((box) => box.origin.x === 8 && box.origin.y === 8),
    ).toBe(false);
  });
});

