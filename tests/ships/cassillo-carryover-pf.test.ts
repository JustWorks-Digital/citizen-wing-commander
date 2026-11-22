import { describe, expect, it } from "vitest";
import type { HaulingChecklistRow } from "@/lib/missions/sessionChecklist";
import { cargoBay } from "@/lib/ships/cargoBay";
import type { PlacedCargoBox } from "@/lib/ships/cargoGridPlacement";
import { getCargoGridSketchBySlug } from "@/lib/ships/cargoGrids";
import { manualBayCarryover } from "@/lib/ships/manualBayCarryover";

function delivery(
  id: string,
  slug: string,
  name: string,
  cargo: { commoditySlug: string; commodityName: string; scu: number }[],
): HaulingChecklistRow {
  return {
    id,
    locationSlug: slug,
    locationName: name,
    routeAction: "delivery",
    isCompleted: false,
    cargoDeliveries: cargo.map((c) => ({
      ...c,
      shipStorageLocation: "front",
    })),
    scuTotal: cargo.reduce((s, c) => s + c.scu, 0),
    shipStorageLocation: "front",
    distanceToNext: null,
  } as HaulingChecklistRow;
}

function pickup(
  id: string,
  slug: string,
  name: string,
  cargo: { commoditySlug: string; commodityName: string; scu: number }[],
): HaulingChecklistRow {
  return {
    id,
    locationSlug: slug,
    locationName: name,
    routeAction: "pickup",
    isCompleted: false,
    cargoDeliveries: cargo.map((c) => ({
      ...c,
      shipStorageLocation: "front",
    })),
    scuTotal: cargo.reduce((s, c) => s + c.scu, 0),
    shipStorageLocation: "front",
    distanceToNext: null,
  } as HaulingChecklistRow;
}

function pfBox(
  id: string,
  origin: { x: number; y: number; z: number },
  size = 16,
): PlacedCargoBox {
  return {
    id,
    size,
    origin,
    footprint: { dx: 2, dy: 2, dz: 2 },
    commoditySlug: "processed-food",
    commodityName: "Processed Food",
    color: null,
    color2: null,
    cells: [{ x: origin.x, y: origin.y, z: origin.z }],
    action: undefined,
    missionId: "senior-ice-food",
  };
}

// Session 9a89783f… — Farnesway delivered 124 PF from doorward piles; Cassillo
// Transfer must not still show those poses — only the remaining ~130 PF.
describe("Cassillo Manual carryover after Farnesway PF drop", () => {
  it("keeps only remaining PF SCU from earlier full layout", () => {
    const rows = [
      pickup("leg-1", "everus-harbor", "Everus", [
        {
          commoditySlug: "processed-food",
          commodityName: "Processed Food",
          scu: 254,
        },
        {
          commoditySlug: "ship-ammunition",
          commodityName: "Ship Ammunition",
          scu: 126,
        },
      ]),
      delivery("leg-3", "hdpc-farnesway", "Farnesway", [
        {
          commoditySlug: "processed-food",
          commodityName: "Processed Food",
          scu: 124,
        },
      ]),
      delivery("leg-4", "hdpc-cassillo", "Cassillo", [
        {
          commoditySlug: "processed-food",
          commodityName: "Processed Food",
          scu: 130,
        },
        {
          commoditySlug: "ship-ammunition",
          commodityName: "Ship Ammunition",
          scu: 126,
        },
      ]),
    ];
    const sketch = getCargoGridSketchBySlug("galaxy")!;
    const atPickup = cargoBay.packAtStop("leg-1", sketch, rows, {
      packMode: "by-cargo-type",
      includeAboardCargo: true,
    });
    const atCassillo = cargoBay.packAtStop("leg-4", sketch, rows, {
      packMode: "by-cargo-type",
      includeAboardCargo: true,
    });
    const pfPickup = atPickup.boxes
      .filter((b) => b.commoditySlug === "processed-food")
      .reduce((s, b) => s + b.size, 0);
    const pfAuto = atCassillo.boxes
      .filter((b) => b.commoditySlug === "processed-food")
      .reduce((s, b) => s + b.size, 0);
    const pfAutoDelivery = atCassillo.boxes
      .filter(
        (b) =>
          b.commoditySlug === "processed-food" && b.action === "delivery",
      )
      .reduce((s, b) => s + b.size, 0);

    expect(pfPickup).toBe(254);
    expect(pfAuto).toBe(130);
    expect(pfAutoDelivery).toBe(130);

    const carried = manualBayCarryover.boxesAtStop(
      atCassillo.boxes,
      atPickup.boxes,
      {
        deckWidthCells: sketch.widthCells,
        rows,
        earlierStopId: "leg-1",
        currentStopId: "leg-4",
      },
    );
    const pfCarried = carried
      .filter((b) => b.commoditySlug === "processed-food")
      .reduce((s, b) => s + b.size, 0);
    // Whole crates only — may be slightly under 130 when sizes do not tile.
    expect(pfCarried).toBeLessThanOrEqual(130);
    expect(pfCarried).toBeGreaterThan(100);
    expect(pfCarried).toBeLessThan(254);

    const pfTransfer = carried
      .filter(
        (b) =>
          b.commoditySlug === "processed-food" && b.action === "delivery",
      )
      .reduce((s, b) => s + b.size, 0);
    expect(pfTransfer).toBe(pfCarried);
  });

  it("removes the doorward crates Farnesway would have unloaded, not a random back pile", () => {
    // 3×16 front + 3×16 back = 96; unload 48 → only front (high X) should go.
    const earlier: PlacedCargoBox[] = [
      pfBox("back-a", { x: 2, y: 8, z: 0 }),
      pfBox("back-b", { x: 2, y: 10, z: 0 }),
      pfBox("back-c", { x: 4, y: 8, z: 0 }),
      pfBox("front-a", { x: 12, y: 8, z: 0 }),
      pfBox("front-b", { x: 12, y: 10, z: 0 }),
      pfBox("front-c", { x: 14, y: 8, z: 0 }),
    ];
    const afterFarnesway = manualBayCarryover.removeDeliveredCrates(
      earlier,
      new Map([["processed-food", 48]]),
      { deckWidthCells: 18 },
    );
    const ids = afterFarnesway.map((box) => box.id).sort();
    expect(ids).toEqual(["back-a", "back-b", "back-c"]);
    expect(
      afterFarnesway.reduce((sum, box) => sum + box.size, 0),
    ).toBe(48);
  });
});
