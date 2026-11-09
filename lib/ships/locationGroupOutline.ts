import { cargoGridCoordKey, type CargoGridCoord } from "@/lib/ships/cargoGridCoords";
import type { CargoBoxFootprint } from "@/lib/ships/cargoBoxSizes";
import type { PlacedCargoBox } from "@/lib/ships/cargoGridPlacement";

export type GridFaceExposure = {
  /** −X */
  nx: boolean;
  /** +X */
  px: boolean;
  /** −Y */
  ny: boolean;
  /** +Y */
  py: boolean;
  /** −Z (below) */
  nz: boolean;
  /** +Z (above) */
  pz: boolean;
};

export type LocationGroupBoxOutline = {
  boxId: string;
  locationSlug: string;
  groupIndex: number;
  componentId: string;
  /** Boxes in this contiguous mission blob (same location). */
  componentSize: number;
  exposed: GridFaceExposure;
  /** True when this crate is alone — keep a full per-box outline. */
  isIsolated: boolean;
};

export type LocationOutlineBoxInput = {
  id: string;
  locationSlug: string;
  groupIndex: number;
  origin: CargoGridCoord;
  footprint: CargoBoxFootprint;
};

type CellOwner = {
  boxId: string;
  locationSlug: string;
};

function cellsForFootprint(
  origin: CargoGridCoord,
  footprint: CargoBoxFootprint,
): CargoGridCoord[] {
  const cells: CargoGridCoord[] = [];
  for (let dx = 0; dx < footprint.dx; dx += 1) {
    for (let dy = 0; dy < footprint.dy; dy += 1) {
      for (let dz = 0; dz < footprint.dz; dz += 1) {
        cells.push({
          x: origin.x + dx,
          y: origin.y + dy,
          z: origin.z + dz,
        });
      }
    }
  }
  return cells;
}

/**
 * Face-adjacent connectivity + outer-face exposure for mission-location crates.
 * Contiguous groups only outline exposed faces; isolated crates keep a full outline.
 * Prefer view-space boxes (after iso facing remap) so outlines match the camera.
 */
export function locationGroupBoxOutlinesFromViewBoxes(
  boxes: LocationOutlineBoxInput[],
): Map<string, LocationGroupBoxOutline> {
  const located = boxes.filter(
    (box) => box.locationSlug != null && box.groupIndex != null,
  );
  const result = new Map<string, LocationGroupBoxOutline>();
  if (located.length === 0) return result;

  const cellOwner = new Map<string, CellOwner>();
  const cellsByBox = new Map<string, CargoGridCoord[]>();
  for (const box of located) {
    const cells = cellsForFootprint(box.origin, box.footprint);
    cellsByBox.set(box.id, cells);
    for (const cell of cells) {
      cellOwner.set(cargoGridCoordKey(cell), {
        boxId: box.id,
        locationSlug: box.locationSlug,
      });
    }
  }

  const parent = new Map<string, string>();
  function find(id: string): string {
    let cur = id;
    while (parent.get(cur) !== cur) {
      const next = parent.get(cur) ?? cur;
      parent.set(cur, parent.get(next) ?? next);
      cur = next;
    }
    return cur;
  }
  function union(a: string, b: string) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  }

  for (const box of located) parent.set(box.id, box.id);

  const deltas: CargoGridCoord[] = [
    { x: -1, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 0, y: -1, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: 0, z: -1 },
    { x: 0, y: 0, z: 1 },
  ];

  for (const box of located) {
    const locationSlug = box.locationSlug;
    for (const cell of cellsByBox.get(box.id) ?? []) {
      for (const delta of deltas) {
        const neighbor = cellOwner.get(
          cargoGridCoordKey({
            x: cell.x + delta.x,
            y: cell.y + delta.y,
            z: cell.z + delta.z,
          }),
        );
        if (!neighbor || neighbor.locationSlug !== locationSlug) continue;
        if (neighbor.boxId !== box.id) union(box.id, neighbor.boxId);
      }
    }
  }

  const componentMembers = new Map<string, string[]>();
  for (const box of located) {
    const root = find(box.id);
    const list = componentMembers.get(root) ?? [];
    list.push(box.id);
    componentMembers.set(root, list);
  }

  for (const box of located) {
    const locationSlug = box.locationSlug;
    const groupIndex = box.groupIndex;
    const componentId = `${locationSlug}:${find(box.id)}`;
    const componentSize = componentMembers.get(find(box.id))?.length ?? 1;

    const exposed: GridFaceExposure = {
      nx: false,
      px: false,
      ny: false,
      py: false,
      nz: false,
      pz: false,
    };

    for (const cell of cellsByBox.get(box.id) ?? []) {
      const checks: Array<{ key: keyof GridFaceExposure; coord: CargoGridCoord }> =
        [
          { key: "nx", coord: { x: cell.x - 1, y: cell.y, z: cell.z } },
          { key: "px", coord: { x: cell.x + 1, y: cell.y, z: cell.z } },
          { key: "ny", coord: { x: cell.x, y: cell.y - 1, z: cell.z } },
          { key: "py", coord: { x: cell.x, y: cell.y + 1, z: cell.z } },
          { key: "nz", coord: { x: cell.x, y: cell.y, z: cell.z - 1 } },
          { key: "pz", coord: { x: cell.x, y: cell.y, z: cell.z + 1 } },
        ];
      for (const check of checks) {
        const neighbor = cellOwner.get(cargoGridCoordKey(check.coord));
        if (
          !neighbor ||
          neighbor.locationSlug !== locationSlug ||
          find(neighbor.boxId) !== find(box.id)
        ) {
          exposed[check.key] = true;
        }
      }
    }

    result.set(box.id, {
      boxId: box.id,
      locationSlug,
      groupIndex,
      componentId,
      componentSize,
      exposed,
      isIsolated: componentSize <= 1,
    });
  }

  return result;
}

/** Convenience for placement plans still in sketch space. */
export function locationGroupBoxOutlines(
  boxes: PlacedCargoBox[],
): Map<string, LocationGroupBoxOutline> {
  return locationGroupBoxOutlinesFromViewBoxes(
    boxes
      .filter(
        (box) =>
          box.deliveryLocationSlug != null && box.locationGroupIndex != null,
      )
      .map((box) => ({
        id: box.id,
        locationSlug: box.deliveryLocationSlug!,
        groupIndex: box.locationGroupIndex!,
        origin: box.origin,
        footprint: box.footprint,
      })),
  );
}
