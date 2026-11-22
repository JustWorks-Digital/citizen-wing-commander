import { describe, expect, it } from "vitest";
import {
  cargoGridOverflowScu,
  cargoGridOverflowZoneScu,
  cargoGridTotalLength,
  cargoGridTotalScu,
  cargoGridZoneScu,
  getCargoGridSketchBySlug,
} from "@/lib/ships/cargoGrids";
import { getShipBySlug } from "@/lib/fixtures";

describe("RSI Galaxy cargo grid", () => {
  it("uses cargo-module 720 SCU with lift + hangar-side zones", () => {
    const ship = getShipBySlug("galaxy");
    // Hangar 64 + cargo module 656 = 720 (UEX hull-only is 64).
    expect(ship?.cargoScu).toBe(720);

    const sketch = getCargoGridSketchBySlug("galaxy");
    expect(sketch).not.toBeNull();
    expect(cargoGridTotalScu(sketch!)).toBe(720);
    expect(cargoGridTotalLength(sketch!)).toBe(31);

    const byId = Object.fromEntries(
      sketch!.zones.map((zone) => [zone.id, zone]),
    );
    expect(cargoGridZoneScu(sketch!, byId["lift-l"]!)).toBe(256);
    expect(cargoGridZoneScu(sketch!, byId["lift-r"]!)).toBe(256);
    expect(cargoGridZoneScu(sketch!, byId["lift"]!)).toBe(144);
    expect(cargoGridZoneScu(sketch!, byId["hangar-l"]!)).toBe(32);
    expect(cargoGridZoneScu(sketch!, byId["hangar-r"]!)).toBe(32);
    // Hangar floor is overflow/unstable — not in ship SCU total.
    expect(cargoGridZoneScu(sketch!, byId["hangar-wide"]!)).toBe(0);
    expect(cargoGridZoneScu(sketch!, byId["hangar-narrow"]!)).toBe(0);
    expect(cargoGridOverflowZoneScu(sketch!, byId["hangar-wide"]!)).toBe(288);
    expect(cargoGridOverflowZoneScu(sketch!, byId["hangar-narrow"]!)).toBe(144);
    expect(cargoGridOverflowScu(sketch!)).toBe(432);

    const cargoZones = sketch!.zones.filter((zone) => zone.kind === "cargo");
    expect(cargoZones).toHaveLength(5);
    expect(byId["door"]?.kind).toBe("gap");
    expect(byId["hangar-wide"]?.kind).toBe("overflow");
    expect(byId["hangar-narrow"]?.kind).toBe("overflow");
  });
});
