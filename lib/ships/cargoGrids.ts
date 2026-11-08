/**
 * Working cargo-grid sketches for layout tooling.
 * Not synced from UEX — refine against in-game / community checks.
 *
 * Coordinate system (1 SCU cells): see `cargoGridCoords.ts`
 * - X nose → ramp, Y port → starboard, Z deck → ceiling
 */

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
   * C2 back bay is narrower than the front bay.
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
};

/**
 * C2: front bay 6 wide × 9 long × 4 = 216; back bay 8×15×4 = 480; total 696.
 * Mid gap 3; back centered on the wider front span when widths differ.
 */
export const c2HerculesCargoGridSketch: ShipCargoGridSketch = {
  shipSlug: "c2-hercules-starlifter",
  shipName: "C2 Hercules",
  widthCells: 8,
  heightCells: 4,
  zones: [
    {
      id: "forward",
      label: "Front bay",
      lengthCells: 9,
      widthCells: 6,
      kind: "cargo",
      storageLocation: "front",
    },
    {
      id: "mid-gap",
      label: "Gap",
      lengthCells: 3,
      widthCells: 8,
      kind: "gap",
    },
    {
      id: "rear",
      label: "Back bay",
      lengthCells: 15,
      widthCells: 8,
      kind: "cargo",
      storageLocation: "rear",
    },
  ],
  notes: [],
};

/**
 * Mk V Centaurus: one rectangular bay, no gaps.
 * 4×10×6 = 240 SCU.
 */
export const mkVCentaurusCargoGridSketch: ShipCargoGridSketch = {
  shipSlug: "constellation-mk-v-centaurus",
  shipName: "Constellation Mk V Centaurus",
  widthCells: 4,
  heightCells: 6,
  zones: [
    {
      id: "hold",
      label: "Bay",
      lengthCells: 10,
      widthCells: 4,
      kind: "cargo",
      storageLocation: "middle",
    },
  ],
  notes: [],
};

export const cargoGridSketches: ShipCargoGridSketch[] = [
  c2HerculesCargoGridSketch,
  mkVCentaurusCargoGridSketch,
];

export function getCargoGridSketchBySlug(
  shipSlug: string | null | undefined,
): ShipCargoGridSketch | null {
  if (!shipSlug) return null;
  return (
    cargoGridSketches.find((sketch) => sketch.shipSlug === shipSlug) ?? null
  );
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
