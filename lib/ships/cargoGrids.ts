/**
 * Working cargo-grid sketches for layout tooling.
 * Source: `lib/fixtures/cargoGrids.json` — not synced from UEX.
 *
 * Coordinate system (1 SCU cells): see `cargoGridCoords.ts`
 * - X nose → ramp, Y port → starboard, Z deck → ceiling
 */

import cargoGridsFixture from "@/lib/fixtures/cargoGrids.json";

export type CargoGridZoneKind = "cargo" | "gap";

/** Coarse bay — mirrors checklist `ShipStorageLocation`. */
export type CargoGridStorageLocation = "front" | "middle" | "rear";

export type CargoGridZone = {
  id: string;
  label: string;
  /** Length along the bay (nose → ramp), in 1 SCU cells. */
  lengthCells: number;
  /**
   * Width (port ↔ starboard). Defaults to sketch `widthCells` when omitted.
   * Narrower zones are centered in Y within max width (C2 front bay is 6; back is 8).
   */
  widthCells?: number;
  /**
   * `cargo` counts toward SCU capacity.
   * `gap` is empty bay length between sections (walkways, structure, etc.).
   */
  kind: CargoGridZoneKind;
  /**
   * Coarse bay zone for checklist / path lines.
   * Only meaningful when `kind` is `cargo`.
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

export function cargoGridZoneWidth(
  sketch: ShipCargoGridSketch,
  zone: CargoGridZone,
): number {
  return zone.widthCells ?? sketch.widthCells;
}

export function cargoGridTotalLength(sketch: ShipCargoGridSketch): number {
  return sketch.zones.reduce((sum, zone) => sum + zone.lengthCells, 0);
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
  if (zone.kind !== "cargo") return 0;
  return (
    cargoGridZoneWidth(sketch, zone) * zone.lengthCells * sketch.heightCells
  );
}

export function cargoGridTotalScu(sketch: ShipCargoGridSketch): number {
  return sketch.zones.reduce(
    (sum, zone) => sum + cargoGridZoneScu(sketch, zone),
    0,
  );
}

export function cargoGridMaxWidth(sketch: ShipCargoGridSketch): number {
  return sketch.zones.reduce(
    (max, zone) => Math.max(max, cargoGridZoneWidth(sketch, zone)),
    sketch.widthCells,
  );
}
