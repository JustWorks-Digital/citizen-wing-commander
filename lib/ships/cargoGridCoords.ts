import {
  cargoGridMaxWidth,
  cargoGridTotalLength,
  cargoGridZoneSpans,
  type CargoGridStorageLocation,
  type CargoGridZone,
  type ShipCargoGridSketch,
} from "@/lib/ships/cargoGrids";

/**
 * Ship-local 1 SCU cell address.
 *
 * - **x** — nose → ramp (length), `0` at nose
 * - **y** — port → starboard (width), `0` at port edge of the max bay span
 * - **z** — deck → ceiling (height), `0` at deck
 *
 * Narrower zones are centered in Y unless `yStartCells` is set on the zone.
 */
export type CargoGridCoord = {
  x: number;
  y: number;
  z: number;
};

/** One occupyable cargo cell with its coarse bay zone (when known). */
export type CargoGridCell = {
  coord: CargoGridCoord;
  zoneId: string;
  storageLocation: CargoGridStorageLocation | null;
};

export type CargoGridBounds = {
  xMax: number;
  yMax: number;
  zMax: number;
};

export function formatCargoGridCoord(coord: CargoGridCoord): string {
  return `X${coord.x} Y${coord.y} Z${coord.z}`;
}

export function cargoGridCoordKey(coord: CargoGridCoord): string {
  return `${coord.x},${coord.y},${coord.z}`;
}

export function sameCargoGridCoord(
  a: CargoGridCoord,
  b: CargoGridCoord,
): boolean {
  return a.x === b.x && a.y === b.y && a.z === b.z;
}

export function cargoGridBounds(sketch: ShipCargoGridSketch): CargoGridBounds {
  return {
    xMax: cargoGridTotalLength(sketch),
    yMax: cargoGridMaxWidth(sketch),
    zMax: sketch.heightCells,
  };
}

/**
 * Map sketch zone → coarse front/middle/rear used by checklist UI.
 * Gaps and unknown ids return null (not placeable as bay zones).
 */
export function cargoGridZoneStorageLocation(
  zone: CargoGridZone,
): CargoGridStorageLocation | null {
  if (zone.kind !== "cargo") return null;
  if (zone.storageLocation) return zone.storageLocation;
  switch (zone.id) {
    case "forward":
      return "front";
    case "rear":
      return "rear";
    case "hold":
    case "middle":
      return "middle";
    default:
      return "middle";
  }
}

function spanContainsXY(
  span: { xStart: number; xEnd: number; yStart: number; yEnd: number },
  x: number,
  y: number,
): boolean {
  return (
    x >= span.xStart &&
    x < span.xEnd &&
    y >= span.yStart &&
    y < span.yEnd
  );
}

/** Resolve which zone owns an (x,y) floor cell, if any. */
export function cargoGridZoneAtXY(
  sketch: ShipCargoGridSketch,
  x: number,
  y: number,
): CargoGridZone | null {
  // Prefer cargo over empty/gap when rectangles overlap (shouldn’t, but be safe).
  const spans = cargoGridZoneSpans(sketch);
  let fallback: CargoGridZone | null = null;
  for (const span of spans) {
    if (!spanContainsXY(span, x, y)) continue;
    if (span.zone.kind === "cargo") return span.zone;
    fallback ??= span.zone;
  }
  return fallback;
}

export function isValidCargoGridCoord(
  sketch: ShipCargoGridSketch,
  coord: CargoGridCoord,
): boolean {
  if (
    !Number.isInteger(coord.x) ||
    !Number.isInteger(coord.y) ||
    !Number.isInteger(coord.z)
  ) {
    return false;
  }
  if (coord.z < 0) return false;
  const spans = cargoGridZoneSpans(sketch);
  for (const span of spans) {
    if (!spanContainsXY(span, coord.x, coord.y)) continue;
    if (span.zone.kind !== "cargo") return false;
    return coord.z < span.zEnd;
  }
  return false;
}

export function cargoGridCellAt(
  sketch: ShipCargoGridSketch,
  coord: CargoGridCoord,
): CargoGridCell | null {
  if (!isValidCargoGridCoord(sketch, coord)) return null;
  const zone = cargoGridZoneAtXY(sketch, coord.x, coord.y);
  if (!zone || zone.kind !== "cargo") return null;
  return {
    coord,
    zoneId: zone.id,
    storageLocation: cargoGridZoneStorageLocation(zone),
  };
}

/** All placeable 1 SCU cells (cargo zones only; gaps excluded). */
export function cargoGridEnumerateCells(
  sketch: ShipCargoGridSketch,
): CargoGridCell[] {
  const cells: CargoGridCell[] = [];
  for (const span of cargoGridZoneSpans(sketch)) {
    if (span.zone.kind !== "cargo") continue;
    const storageLocation = cargoGridZoneStorageLocation(span.zone);
    for (let x = span.xStart; x < span.xEnd; x += 1) {
      for (let y = span.yStart; y < span.yEnd; y += 1) {
        for (let z = 0; z < span.zEnd; z += 1) {
          cells.push({
            coord: { x, y, z },
            zoneId: span.zone.id,
            storageLocation,
          });
        }
      }
    }
  }
  return cells;
}

/**
 * Suggest a contiguous block of `scu` cells for packing.
 * Prefer a specific bay when `prefer` is set; fill low Z first, then Y, then X.
 */
export function suggestCargoGridCoords(
  sketch: ShipCargoGridSketch,
  scu: number,
  options?: {
    prefer?: CargoGridStorageLocation;
    occupied?: Iterable<CargoGridCoord>;
  },
): CargoGridCoord[] {
  if (scu <= 0) return [];
  const occupied = new Set(
    [...(options?.occupied ?? [])].map(cargoGridCoordKey),
  );
  const prefer = options?.prefer;

  const free = cargoGridEnumerateCells(sketch).filter((cell) => {
    if (occupied.has(cargoGridCoordKey(cell.coord))) return false;
    if (prefer && cell.storageLocation !== prefer) return false;
    return true;
  });

  free.sort((a, b) => {
    if (a.coord.z !== b.coord.z) return a.coord.z - b.coord.z;
    if (a.coord.x !== b.coord.x) return a.coord.x - b.coord.x;
    return a.coord.y - b.coord.y;
  });

  return free.slice(0, scu).map((cell) => cell.coord);
}

/** Coarse bay for a coordinate (checklist / path-line compatibility). */
export function cargoGridCoordStorageLocation(
  sketch: ShipCargoGridSketch,
  coord: CargoGridCoord,
): CargoGridStorageLocation | null {
  return cargoGridCellAt(sketch, coord)?.storageLocation ?? null;
}
