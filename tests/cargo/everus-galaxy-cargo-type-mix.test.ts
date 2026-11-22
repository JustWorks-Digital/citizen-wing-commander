import { describe, expect, it } from "vitest";
import { cargoBay } from "@/lib/ships/cargoBay";
import { getCargoGridSketchBySlug } from "@/lib/ships/cargoGrids";
import { validateCargoTypePackClusters } from "@/lib/ships/cargoTypePackValidate";
import type { HaulingChecklistRow } from "@/lib/missions/sessionChecklist";
import { cargo, makeStop } from "./fixtures";

/**
 * Session 6ff09a56-6d0c-4a97-83da-e79c8f7314ef — Everus Harbor pickup on RSI
 * Galaxy, pack mode Cargo Type. Production UI mixed HF/PI/PF in the same
 * columns (burying one commodity under another).
 */
function everusHarborPickupStop(): HaulingChecklistRow {
  return makeStop({
    id: "leg-1",
    routeAction: "pickup",
    locationSlug: "everus-harbor",
    shipStorageLocation: "middle",
    cargo: [
      cargo("quantum-fuel", 50, {
        role: "pickup",
        shipStorageLocation: "middle",
        missionId: "f6d79de6-904a-480e-8afa-b28f0b39e59d",
        boxSizes: [16, 16, 16, 2],
      }),
      cargo("hydrogen-fuel", 190, {
        role: "pickup",
        shipStorageLocation: "middle",
        missionId: "f6d79de6-904a-480e-8afa-b28f0b39e59d",
        boxSizes: [16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 8, 4, 2],
      }),
      cargo("ship-ammunition", 128, {
        role: "pickup",
        shipStorageLocation: "middle",
        missionId: "f6d79de6-904a-480e-8afa-b28f0b39e59d",
        boxSizes: [16, 16, 16, 16, 16, 16, 16, 16],
      }),
      cargo("pressurized-ice", 13, {
        role: "pickup",
        shipStorageLocation: "middle",
        missionId: "3cd7b729-c8d2-4c51-9fe2-f65c834806ae",
        boxSizes: [8, 4, 1],
      }),
      cargo("processed-food", 346, {
        role: "pickup",
        shipStorageLocation: "middle",
        missionId: "3cd7b729-c8d2-4c51-9fe2-f65c834806ae",
        boxSizes: [
          16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16,
          16, 16, 16, 16, 8, 2,
        ],
      }),
    ],
  });
}

describe("Everus Harbor Galaxy cargo-type pack (session 6ff09a56)", () => {
  it("does not stack different commodities in the same XY column", () => {
    const sketch = getCargoGridSketchBySlug("galaxy");
    expect(sketch).toBeTruthy();
    const stop = everusHarborPickupStop();
    const plan = cargoBay.packAtStop(stop.id, sketch!, [stop], {
      packMode: "by-cargo-type",
      includeAboardCargo: true,
    });

    expect(plan.cargoTypeClusters?.ok).toBe(true);
    const validation = validateCargoTypePackClusters(plan.boxes);
    expect(
      validation.ok,
      `mixed columns: ${JSON.stringify(validation.mixedColumns.slice(0, 8))}`,
    ).toBe(true);

    const placedScu = (slug: string) =>
      plan.boxes
        .filter((box) => box.commoditySlug === slug)
        .reduce((sum, box) => sum + box.size, 0);
    // All pickup SCU should land (overflow bay OK); no mixed stacks.
    expect(placedScu("processed-food")).toBe(346);
    expect(placedScu("hydrogen-fuel")).toBe(190);
    expect(placedScu("ship-ammunition")).toBe(128);
    expect(placedScu("quantum-fuel")).toBe(50);
    expect(placedScu("pressurized-ice")).toBe(13);
    expect(plan.unplaced).toHaveLength(0);
  });
});
