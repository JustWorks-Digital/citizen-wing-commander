import { describe, expect, it } from "vitest";
import {
  cargoBayViewHostZone,
  cargoGridZoneAtXY,
} from "@/lib/ships/cargoGridCoords";
import {
  cargoGridZoneSpans,
  getCargoGridSketchBySlug,
} from "@/lib/ships/cargoGrids";

/**
 * Old 3D buildCubes rule — whole footprint must sit in one zone.
 * That dropped Galaxy overflow straddles that 2D (origin-hosted) still drew.
 */
function wholeFootprintFitsZone(
  sketchSlug: string,
  origin: { x: number; y: number },
  footprint: { dx: number; dy: number },
): boolean {
  const sketch = getCargoGridSketchBySlug(sketchSlug)!;
  for (const span of cargoGridZoneSpans(sketch)) {
    if (span.zone.kind !== "cargo" && span.zone.kind !== "overflow") continue;
    if (
      origin.x >= span.xStart &&
      origin.x + footprint.dx <= span.xEnd &&
      origin.y >= span.yStart &&
      origin.y + footprint.dy <= span.yEnd
    ) {
      return true;
    }
  }
  return false;
}

describe("2D / 3D placement host zone", () => {
  it("hosts a Galaxy overflow straddle by origin (old 3D rule missed it)", () => {
    const sketch = getCargoGridSketchBySlug("galaxy")!;
    // hangar-narrow is x 19–25; origin near its nose edge with dx crossing into hangar-wide.
    const origin = { x: 23, y: 8 };
    const footprint = { dx: 4, dy: 2 };
    expect(cargoGridZoneAtXY(sketch, origin.x, origin.y)?.id).toBe(
      "hangar-narrow",
    );
    expect(wholeFootprintFitsZone("galaxy", origin, footprint)).toBe(false);
    expect(cargoBayViewHostZone(sketch, origin)?.id).toBe("hangar-narrow");
  });

  it("still hosts a crate fully inside hangar-wide", () => {
    const sketch = getCargoGridSketchBySlug("galaxy")!;
    const origin = { x: 26, y: 5 };
    expect(cargoBayViewHostZone(sketch, origin)?.id).toBe("hangar-wide");
    expect(
      wholeFootprintFitsZone("galaxy", origin, { dx: 2, dy: 2 }),
    ).toBe(true);
  });
});
