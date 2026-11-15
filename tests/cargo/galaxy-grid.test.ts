import { describe, expect, it } from "vitest";
import {
  cargoGridTotalScu,
  cargoGridZoneScu,
  getCargoGridSketchBySlug,
} from "@/lib/ships/cargoGrids";
import { getShipBySlug } from "@/lib/fixtures";

describe("RSI Galaxy cargo grid", () => {
  it("uses cargo-module total SCU with two equal front/rear zones", () => {
    const ship = getShipBySlug("galaxy");
    // Hangar 64 + cargo module 656 = 720 (UEX hull-only is 64).
    expect(ship?.cargoScu).toBe(720);

    const sketch = getCargoGridSketchBySlug("galaxy");
    expect(sketch).not.toBeNull();
    expect(cargoGridTotalScu(sketch!)).toBe(720);

    const cargoZones = sketch!.zones.filter((zone) => zone.kind === "cargo");
    expect(cargoZones).toHaveLength(2);
    expect(cargoZones.map((zone) => zone.storageLocation)).toEqual([
      "front",
      "rear",
    ]);
    expect(cargoGridZoneScu(sketch!, cargoZones[0]!)).toBe(360);
    expect(cargoGridZoneScu(sketch!, cargoZones[1]!)).toBe(360);
  });
});
