/**
 * Working cargo-grid sketches for layout tooling.
 * Source: `lib/fixtures/cargoGrids.json` — not synced from UEX.
 *
 * Coordinate system (1 SCU cells): see `cargoGridCoords.ts`
 * - X nose → ramp, Y port → starboard, Z deck → ceiling
 */

import cargoGridsFixture from "@/lib/fixtures/cargoGrids.json";

export type CargoGridZoneKind = "cargo" | "gap" | "empty" | "overflow";

/** Coarse bay — mirrors checklist `ShipStorageLocation`. */
export type CargoGridStorageLocation = "front" | "middle" | "rear";

export type CargoGridZone = {
  id: string;
  label: string;
  /** Length along the bay (nose → ramp), in 1 SCU cells. */
  lengthCells: number;
  /**
   * Width (port ↔ starboard). Defaults to sketch `widthCells` when omitted.
   * Narrower zones are centered in Y within max width unless `yStartCells` is set.
   */
  widthCells?: number;
  /**
   * Stack height for this zone. Defaults to sketch `heightCells`.
   * Use when holds differ (e.g. Galaxy lift is 2, hangar sides are 4).
   */
  heightCells?: number;
  /**
   * Absolute nose→ramp origin. When any zone sets this, length is the max
   * occupied X rather than a simple sum (side-by-side / overlapping X spans).
   */
  xStartCells?: number;
  /**
   * Absolute port→starboard origin. When omitted, the zone is centered in Y.
   */
  yStartCells?: number;
  /**
   * `cargo` counts toward SCU capacity and is packable (snapped grids).
   * `gap` is walkway / door / structure (not packable).
   * `empty` draws a floor grid but is not packable and has 0 SCU.
   * `overflow` is packable unstable reserve — not counted in ship SCU total
   * (e.g. Galaxy hangar floor). Crates here are low-risk loose storage.
   */
  kind: CargoGridZoneKind;
  /**
   * Coarse bay zone for checklist / path lines.
   * Meaningful for `cargo` and `overflow`.
   */
  storageLocation?: CargoGridStorageLocation;
};

/**
 * Per-view base scale for the cargo UI (independent of the user’s zoom %).
 * `1` = default; `2` = twice as large at 100% zoom.
 */
export type ShipCargoGridViewScale = {
  top?: number;
  iso?: number;
};

export type ShipCargoGridSketch = {
  shipSlug: string;
  shipName: string;
  /** Default / max width when a zone omits `widthCells`. */
  widthCells: number;
  /** Stack height in 1 SCU cells. */
  heightCells: number;
  /** Nose → ramp segments. */
  zones: CargoGridZone[];
  notes: string[];
  /** Optional per-ship top / 3D display scale (defaults to 1). */
  viewScale?: ShipCargoGridViewScale;
};

type CargoGridsFixtureFile = {
  items: ShipCargoGridSketch[];
};

const fixture = cargoGridsFixture as CargoGridsFixtureFile;

export const cargoGridSketches: ShipCargoGridSketch[] = fixture.items;

const sketchesBySlug = new Map(
  cargoGridSketches.map((sketch) => [sketch.shipSlug, sketch] as const),
);

export const c2HerculesCargoGridSketch =
  sketchesBySlug.get("c2-hercules-starlifter")!;

export const mkVCentaurusCargoGridSketch =
  sketchesBySlug.get("constellation-mk-v-centaurus")!;

export const galaxyCargoGridSketch = sketchesBySlug.get("galaxy")!;

export function getCargoGridSketchBySlug(
  shipSlug: string | null | undefined,
): ShipCargoGridSketch | null {
  if (!shipSlug) return null;
  return sketchesBySlug.get(shipSlug) ?? null;
}

/** Display scale for a ship’s cargo grid UI. Missing values default to 1. */
export function getCargoGridViewScale(
  shipSlug: string | null | undefined,
): Required<ShipCargoGridViewScale> {
  const sketch = getCargoGridSketchBySlug(shipSlug);
  return {
    top: sketch?.viewScale?.top ?? 1,
    iso: sketch?.viewScale?.iso ?? 1,
  };
}

export function isCargoGridZone(zone: CargoGridZone): boolean {
  return zone.kind === "cargo";
}

/** Unstable reserve grids — packable but excluded from ship SCU capacity. */
export function isOverflowGridZone(zone: CargoGridZone): boolean {
  return zone.kind === "overflow";
}

/** Cells that can hold crates (stable cargo or overflow). */
export function isPackableGridZone(zone: CargoGridZone): boolean {
  return zone.kind === "cargo" || zone.kind === "overflow";
}

export function cargoGridZoneWidth(
  sketch: ShipCargoGridSketch,
  zone: CargoGridZone,
): number {
  return zone.widthCells ?? sketch.widthCells;
}

export function cargoGridZoneHeight(
  sketch: ShipCargoGridSketch,
  zone: CargoGridZone,
): number {
  return zone.heightCells ?? sketch.heightCells;
}

/** True when zones use absolute X/Y (side-by-side bays, tapered hangar, etc.). */
export function cargoGridHasExplicitPlacement(
  sketch: ShipCargoGridSketch,
): boolean {
  return sketch.zones.some(
    (zone) => zone.xStartCells != null || zone.yStartCells != null,
  );
}

export type CargoGridZoneSpan = {
  zone: CargoGridZone;
  xStart: number;
  xEnd: number;
  yStart: number;
  yEnd: number;
  zEnd: number;
};

/**
 * Resolve each zone’s floor rectangle. Sequential sketches advance X;
 * explicit `xStartCells` / `yStartCells` allow side-by-side layout.
 */
export function cargoGridZoneSpans(
  sketch: ShipCargoGridSketch,
): CargoGridZoneSpan[] {
  const maxWidth = cargoGridMaxWidth(sketch);
  const spans: CargoGridZoneSpan[] = [];
  let autoX = 0;
  for (const zone of sketch.zones) {
    const width = cargoGridZoneWidth(sketch, zone);
    const xStart = zone.xStartCells ?? autoX;
    const yStart =
      zone.yStartCells ?? Math.floor((maxWidth - width) / 2);
    const xEnd = xStart + zone.lengthCells;
    spans.push({
      zone,
      xStart,
      xEnd,
      yStart,
      yEnd: yStart + width,
      zEnd: cargoGridZoneHeight(sketch, zone),
    });
    autoX = zone.xStartCells == null ? xEnd : Math.max(autoX, xEnd);
  }
  return spans;
}

export function cargoGridTotalLength(sketch: ShipCargoGridSketch): number {
  return cargoGridZoneSpans(sketch).reduce(
    (max, span) => Math.max(max, span.xEnd),
    0,
  );
}

export function cargoGridCargoLength(sketch: ShipCargoGridSketch): number {
  return sketch.zones
    .filter(isCargoGridZone)
    .reduce((sum, zone) => sum + zone.lengthCells, 0);
}

export function cargoGridZoneScu(
  sketch: ShipCargoGridSketch,
  zone: CargoGridZone,
): number {
  // Overflow is packable but never counted toward official ship capacity.
  if (zone.kind !== "cargo") return 0;
  return (
    cargoGridZoneWidth(sketch, zone) *
    zone.lengthCells *
    cargoGridZoneHeight(sketch, zone)
  );
}

/** Geometric SCU of an overflow zone (unstable reserve; not in total). */
export function cargoGridOverflowZoneScu(
  sketch: ShipCargoGridSketch,
  zone: CargoGridZone,
): number {
  if (zone.kind !== "overflow") return 0;
  return (
    cargoGridZoneWidth(sketch, zone) *
    zone.lengthCells *
    cargoGridZoneHeight(sketch, zone)
  );
}

export function cargoGridTotalScu(sketch: ShipCargoGridSketch): number {
  return sketch.zones.reduce(
    (sum, zone) => sum + cargoGridZoneScu(sketch, zone),
    0,
  );
}

/** Sum of overflow/unstable reserve SCU (separate from `cargoGridTotalScu`). */
export function cargoGridOverflowScu(sketch: ShipCargoGridSketch): number {
  return sketch.zones.reduce(
    (sum, zone) => sum + cargoGridOverflowZoneScu(sketch, zone),
    0,
  );
}

export function cargoGridMaxWidth(sketch: ShipCargoGridSketch): number {
  let max = sketch.widthCells;
  for (const zone of sketch.zones) {
    const width = cargoGridZoneWidth(sketch, zone);
    max = Math.max(max, width);
    if (zone.yStartCells != null) {
      max = Math.max(max, zone.yStartCells + width);
    }
  }
  return max;
}
