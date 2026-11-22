import { describe, expect, it } from "vitest";
import { cargoBay } from "@/lib/ships/cargoBay";
import {
  placeCargoItemsInZone,
  type CargoPlacementItem,
  type PlacedCargoBox,
} from "@/lib/ships/cargoGridPlacement";
import { compileCargoTypePackProgram } from "@/lib/ships/cargoBayPackProgram";
import { cargoBayViewHostZone } from "@/lib/ships/cargoGridCoords";
import {
  getCargoGridSketchBySlug,
  type ShipCargoGridSketch,
} from "@/lib/ships/cargoGrids";
import { packBaysFromSketch } from "@/lib/ships/packBaysFromSketch";
import {
  CARGO_TYPE_INTERLEAVE_CHUNK,
  interleaveItemGroups,
  orderPackItemsByProgram,
} from "@/lib/ships/packItemOrder";
import { derivePackSlotPolicy } from "@/lib/ships/packSlotPolicy";
import { validateCargoTypePackClusters } from "@/lib/ships/cargoTypePackValidate";
import type { HaulingChecklistRow } from "@/lib/missions/sessionChecklist";

function galaxySketch() {
  const sketch = getCargoGridSketchBySlug("galaxy");
  if (!sketch) throw new Error("Missing galaxy cargo-grid fixture");
  return sketch;
}

function crate(
  slug: string,
  name: string,
  size: CargoPlacementItem["size"] = 8,
): CargoPlacementItem {
  return {
    size,
    commoditySlug: slug,
    commodityName: name,
    color: null,
    color2: null,
  };
}

function packEverusSizedGalaxy() {
  const sketch = galaxySketch();
  const program = compileCargoTypePackProgram({
    bays: packBaysFromSketch(sketch),
  });
  const policy = derivePackSlotPolicy(program);
  const mk = (slug: string, name: string, scu: number) =>
    Array.from({ length: Math.floor(scu / 8) }, () => crate(slug, name));
  const items = orderPackItemsByProgram(
    [
      ...mk("processed-food", "Processed Food", 254),
      ...mk("hydrogen-fuel", "Hydrogen Fuel", 155),
      ...mk("ship-ammunition", "Ship Ammunition", 126),
      ...mk("quantum-fuel", "Quantum Fuel", 61),
      ...mk("pressurized-ice", "Pressurized Ice", 21),
    ],
    program,
  );
  const plan = placeCargoItemsInZone(sketch, "front", items, {
    clusterByKey: true,
    packSlotPolicy: policy,
    itemsPreordered: true,
  });
  return { sketch, plan };
}

function cargoZoneId(
  sketch: ShipCargoGridSketch,
  origin: { x: number; y: number; z: number },
): string | null {
  const host = cargoBayViewHostZone(sketch, origin);
  if (host?.kind === "cargo" || host?.kind === "overflow") return host.id;
  return null;
}

function cargoZoneIdsForCommodity(
  sketch: ShipCargoGridSketch,
  boxes: PlacedCargoBox[],
  slug: string,
): string[] {
  const ids = new Set<string>();
  for (const box of boxes) {
    if (box.commoditySlug !== slug) continue;
    const id = cargoZoneId(sketch, box.origin);
    if (id) ids.add(id);
  }
  return [...ids].sort();
}

/** SCU per commodity inside one cargo zone. */
function zoneScuByCommodity(
  sketch: ShipCargoGridSketch,
  boxes: PlacedCargoBox[],
  zoneId: string,
): Record<string, number> {
  const by: Record<string, number> = {};
  for (const box of boxes) {
    if (cargoZoneId(sketch, box.origin) !== zoneId) continue;
    by[box.commoditySlug] = (by[box.commoditySlug] ?? 0) + box.size;
  }
  return by;
}

/**
 * Majority stacked on minority in the same XY column (covers / buries it).
 * Galaxy door is high-X — burying also includes minority deeper (lower X)
 * while majority sits toward the door in the same bay.
 * Side lifts have outer walls — minority further from ship center than
 * majority is buried against the wall behind aisle-side cargo.
 */
function majorityBuriedMinority(
  sketch: ShipCargoGridSketch,
  boxes: PlacedCargoBox[],
  zoneId: string,
): {
  stackedOnMinority: boolean;
  minorityBehindMajority: boolean;
  minorityAgainstOuterWall: boolean;
} {
  const inZone = boxes.filter((box) => cargoZoneId(sketch, box.origin) === zoneId);
  const scu = zoneScuByCommodity(sketch, boxes, zoneId);
  const slugs = Object.keys(scu);
  if (slugs.length < 2) {
    return {
      stackedOnMinority: false,
      minorityBehindMajority: false,
      minorityAgainstOuterWall: false,
    };
  }
  const majority = slugs.reduce((a, b) => ((scu[a] ?? 0) >= (scu[b] ?? 0) ? a : b));
  const minorities = slugs.filter((slug) => slug !== majority);
  const shipCy = (sketch.widthCells - 1) / 2;

  let stackedOnMinority = false;
  const columns = new Map<string, PlacedCargoBox[]>();
  for (const box of inZone) {
    for (let dx = 0; dx < box.footprint.dx; dx += 1) {
      for (let dy = 0; dy < box.footprint.dy; dy += 1) {
        const key = `${box.origin.x + dx},${box.origin.y + dy}`;
        const list = columns.get(key) ?? [];
        list.push(box);
        columns.set(key, list);
      }
    }
  }
  for (const column of columns.values()) {
    const sorted = [...column].sort((a, b) => a.origin.z - b.origin.z);
    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        const below = sorted[i]!;
        const above = sorted[j]!;
        if (
          minorities.includes(below.commoditySlug) &&
          above.commoditySlug === majority
        ) {
          stackedOnMinority = true;
        }
      }
    }
  }

  // Door / ramp side is high X on Galaxy front lifts — minority should not
  // sit deeper (lower X) while majority occupies the door-side of the bay.
  let minorityBehindMajority = false;
  let minorityAgainstOuterWall = false;
  for (const minority of minorities) {
    const majBoxes = inZone.filter((box) => box.commoditySlug === majority);
    const minBoxes = inZone.filter((box) => box.commoditySlug === minority);
    if (majBoxes.length === 0 || minBoxes.length === 0) continue;
    const majMaxX = Math.max(
      ...majBoxes.map((box) => box.origin.x + box.footprint.dx),
    );
    const minMaxX = Math.max(
      ...minBoxes.map((box) => box.origin.x + box.footprint.dx),
    );
    const majMinX = Math.min(...majBoxes.map((box) => box.origin.x));
    // Minority entirely deeper (lower X) than majority's door-side extent.
    if (minMaxX <= majMinX && majMaxX > minMaxX) {
      minorityBehindMajority = true;
    }

    const centerDist = (box: PlacedCargoBox) =>
      Math.abs(box.origin.y + (box.footprint.dy - 1) / 2 - shipCy);
    const majMinDist = Math.min(...majBoxes.map(centerDist));
    const minMinDist = Math.min(...minBoxes.map(centerDist));
    // Minority's nearest crate is further from ship center than majority's —
    // pressed against the outer wall behind aisle-side majority.
    if (minMinDist > majMinDist + 0.5) {
      minorityAgainstOuterWall = true;
    }
  }

  return {
    stackedOnMinority,
    minorityBehindMajority,
    minorityAgainstOuterWall,
  };
}

function deckBbox(
  boxes: {
    origin: { x: number; y: number; z: number };
    footprint: { dx: number; dy: number };
  }[],
) {
  const deck = boxes.filter((box) => box.origin.z === 0);
  expect(deck.length).toBeGreaterThan(0);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const box of deck) {
    minX = Math.min(minX, box.origin.x);
    minY = Math.min(minY, box.origin.y);
    maxX = Math.max(maxX, box.origin.x + box.footprint.dx);
    maxY = Math.max(maxY, box.origin.y + box.footprint.dy);
  }
  return {
    width: maxX - minX,
    length: maxY - minY,
    deckCount: deck.length,
  };
}

describe("Galaxy by-cargo-type compact clusters", () => {
  it("interleaves cargo types in chunks so each type can form a block", () => {
    const groups = [
      Array.from({ length: 6 }, () => crate("hydrogen-fuel", "Hydrogen Fuel")),
      Array.from({ length: 6 }, () => crate("processed-food", "Processed Food")),
    ];
    const order = interleaveItemGroups(groups)
      .map((item) => item.commoditySlug[0])
      .join("");
    expect(order).toBe("hhhhpppphhpp");
    expect(CARGO_TYPE_INTERLEAVE_CHUNK).toBe(4);
  });

  it("keeps each cargo type in one Galaxy lift until that bay is full", () => {
    const sketch = galaxySketch();
    const program = compileCargoTypePackProgram({
      bays: packBaysFromSketch(sketch),
    });
    const policy = derivePackSlotPolicy(program);
    const items = orderPackItemsByProgram(
      [
        ...Array.from({ length: 6 }, () =>
          crate("hydrogen-fuel", "Hydrogen Fuel"),
        ),
        ...Array.from({ length: 6 }, () =>
          crate("ship-ammunition", "Ship Ammunition"),
        ),
        ...Array.from({ length: 6 }, () =>
          crate("processed-food", "Processed Food"),
        ),
      ],
      program,
    );
    const plan = placeCargoItemsInZone(sketch, "front", items, {
      clusterByKey: true,
      packSlotPolicy: policy,
      itemsPreordered: true,
    });

    expect(
      cargoZoneIdsForCommodity(sketch, plan.boxes, "hydrogen-fuel"),
    ).toHaveLength(1);
    expect(
      cargoZoneIdsForCommodity(sketch, plan.boxes, "ship-ammunition"),
    ).toHaveLength(1);
    expect(
      cargoZoneIdsForCommodity(sketch, plan.boxes, "processed-food"),
    ).toHaveLength(1);
  });

  it("fills processed food alone in a lift before mixing other types into that bay", () => {
    // Everus-sized PF (~248 SCU) fits in Lift L/R (256). Must not share that
    // primary lift with quantum fuel / ammunition while PF still has room.
    const { sketch, plan } = packEverusSizedGalaxy();
    const pfZones = cargoZoneIdsForCommodity(
      sketch,
      plan.boxes,
      "processed-food",
    );
    expect(pfZones.length).toBeGreaterThanOrEqual(1);

    // Primary PF lift = the one holding the most PF SCU.
    let primaryZone = pfZones[0]!;
    let primaryScu = 0;
    for (const zoneId of pfZones) {
      const scu = zoneScuByCommodity(sketch, plan.boxes, zoneId)[
        "processed-food"
      ] ?? 0;
      if (scu > primaryScu) {
        primaryScu = scu;
        primaryZone = zoneId;
      }
    }
    const mix = zoneScuByCommodity(sketch, plan.boxes, primaryZone);
    expect(mix["processed-food"] ?? 0).toBeGreaterThan(0);
    // No other commodity in the primary PF bay — pack PF until the bay is full.
    const others = Object.keys(mix).filter((slug) => slug !== "processed-food");
    expect(others, `mixed into ${primaryZone}: ${JSON.stringify(mix)}`).toEqual(
      [],
    );
  });

  it("places minority cargo into residual bay space after primaries finish", () => {
    // Session-style Everus mix: QF/ice must not stay unplaced while lifts still
    // have free SCU after PF/HF/SA monopolies end.
    const { sketch, plan } = packEverusSizedGalaxy();
    const placedScu = (slug: string) =>
      plan.boxes
        .filter((box) => box.commoditySlug === slug)
        .reduce((sum, box) => sum + box.size, 0);
    expect(placedScu("quantum-fuel")).toBe(56);
    expect(placedScu("pressurized-ice")).toBe(16);
    expect(plan.unplaced).toHaveLength(0);
    void sketch;
  });

  it("does not bury minority cargo under or behind majority in a shared lift", () => {
    const { sketch, plan } = packEverusSizedGalaxy();
    expect(validateCargoTypePackClusters(plan.boxes).ok).toBe(true);
    // Outer-wall burial only applies to Galaxy Lift L/R (walled sides).
    const sideZones = new Set(["lift-l", "lift-r"]);
    for (const zoneId of ["lift-l", "lift", "lift-r"]) {
      const bury = majorityBuriedMinority(sketch, plan.boxes, zoneId);
      expect(
        bury.stackedOnMinority,
        `${zoneId} majority stacked on minority`,
      ).toBe(false);
      expect(
        bury.minorityBehindMajority,
        `${zoneId} minority buried behind majority toward nose`,
      ).toBe(false);
      if (sideZones.has(zoneId)) {
        expect(
          bury.minorityAgainstOuterWall,
          `${zoneId} minority against outer wall behind aisle-side majority`,
        ).toBe(false);
      }
    }
  });

  it("consolidates Everus-sized Galaxy loads into few lifts per commodity", () => {
    const { sketch, plan } = packEverusSizedGalaxy();
    for (const slug of [
      "processed-food",
      "hydrogen-fuel",
      "ship-ammunition",
      "quantum-fuel",
      "pressurized-ice",
    ]) {
      expect(
        cargoZoneIdsForCommodity(sketch, plan.boxes, slug).length,
        slug,
      ).toBeLessThanOrEqual(2);
    }
  });

  it("packs same types as compact multi-row blocks", () => {
    const sketch = galaxySketch();
    const program = compileCargoTypePackProgram({
      bays: packBaysFromSketch(sketch),
    });
    const policy = derivePackSlotPolicy(program);
    const items = orderPackItemsByProgram(
      [
        ...Array.from({ length: 6 }, () =>
          crate("hydrogen-fuel", "Hydrogen Fuel"),
        ),
        ...Array.from({ length: 6 }, () =>
          crate("processed-food", "Processed Food"),
        ),
      ],
      program,
    );
    const plan = placeCargoItemsInZone(sketch, "front", items, {
      clusterByKey: true,
      packSlotPolicy: policy,
      itemsPreordered: true,
    });

    const hydrogen = plan.boxes.filter(
      (box) => box.commoditySlug === "hydrogen-fuel",
    );
    const food = plan.boxes.filter(
      (box) => box.commoditySlug === "processed-food",
    );
    expect(hydrogen.length).toBe(6);
    expect(food.length).toBe(6);

    const hBbox = deckBbox(hydrogen);
    const fBbox = deckBbox(food);
    // Compact block: at least 2×4 (or 4×2 along the outer wall → aisle).
    for (const bbox of [hBbox, fBbox]) {
      expect(Math.min(bbox.width, bbox.length)).toBeGreaterThanOrEqual(2);
      expect(Math.max(bbox.width, bbox.length)).toBeGreaterThanOrEqual(4);
    }
  });

  it("cargoBay packAtStop by-cargo-type keeps multi-type Galaxy trips compact", () => {
    const sketch = galaxySketch();
    const stops: HaulingChecklistRow[] = [
      {
        id: "stop-galaxy-pickup",
        locationSlug: "everus-harbor",
        routeAction: "pickup",
        shipStorageLocation: "front",
        distanceToNext: null,
        isCompleted: false,
        cargoDeliveries: [
          {
            commoditySlug: "hydrogen-fuel",
            scu: 48,
            boxSizes: [8, 8, 8, 8, 8, 8],
            role: "pickup",
            shipStorageLocation: "front",
            missionId: "m1",
          },
          {
            commoditySlug: "processed-food",
            scu: 48,
            boxSizes: [8, 8, 8, 8, 8, 8],
            role: "pickup",
            shipStorageLocation: "front",
            missionId: "m2",
          },
        ],
      },
    ];

    const plan = cargoBay.packAtStop("stop-galaxy-pickup", sketch, stops, {
      packMode: "by-cargo-type",
      includeAboardCargo: true,
    });

    const hydrogen = plan.boxes.filter(
      (box) => box.commoditySlug === "hydrogen-fuel",
    );
    const food = plan.boxes.filter(
      (box) => box.commoditySlug === "processed-food",
    );
    expect(hydrogen.length).toBeGreaterThanOrEqual(4);
    expect(food.length).toBeGreaterThanOrEqual(4);
    expect(
      cargoZoneIdsForCommodity(sketch, plan.boxes, "hydrogen-fuel"),
    ).toHaveLength(1);
    expect(
      cargoZoneIdsForCommodity(sketch, plan.boxes, "processed-food"),
    ).toHaveLength(1);
  });
});
