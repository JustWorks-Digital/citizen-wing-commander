/**
 * Physical cargo crate sizes used for bay packing hints.
 * Prefer largest first (greedy) — e.g. 12 → 8+4, 13 → 8+4+1, 7 → 4+2+1.
 */

export const CARGO_BOX_SCU = [8, 4, 2, 1] as const;

export type CargoBoxScu = (typeof CARGO_BOX_SCU)[number];

/** Axis-aligned box size in 1 SCU cells (X length, Y width, Z height). */
export type CargoBoxFootprint = {
  dx: number;
  dy: number;
  dz: number;
};

/**
 * Decompose an SCU total into crate sizes 8 → 4 → 2 → 1.
 * Odd totals always include a 1 SCU crate.
 * `maxBoxScu` caps the largest crate (e.g. contract max container size).
 */
export function decomposeScuIntoBoxes(
  scu: number,
  maxBoxScu: CargoBoxScu = 8,
): CargoBoxScu[] {
  const boxes: CargoBoxScu[] = [];
  let remaining = Math.max(0, Math.floor(scu));
  const max = Math.max(1, Math.min(8, Math.floor(maxBoxScu))) as CargoBoxScu;
  for (const size of CARGO_BOX_SCU) {
    if (size > max) continue;
    while (remaining >= size) {
      boxes.push(size);
      remaining -= size;
    }
  }
  return boxes;
}

/** Largest crate size present in an explicit mix (default 8). */
export function maxCargoBoxScu(
  boxSizes: readonly number[] | null | undefined,
): CargoBoxScu {
  if (!boxSizes || boxSizes.length === 0) return 8;
  const max = Math.max(...boxSizes);
  if (max >= 8) return 8;
  if (max >= 4) return 4;
  if (max >= 2) return 2;
  return 1;
}

/** Allowed orientations for each crate size (volume = size). */
export function cargoBoxOrientations(size: CargoBoxScu): CargoBoxFootprint[] {
  switch (size) {
    case 1:
      return [{ dx: 1, dy: 1, dz: 1 }];
    case 2:
      return [
        { dx: 2, dy: 1, dz: 1 },
        { dx: 1, dy: 2, dz: 1 },
      ];
    case 4:
      return [{ dx: 2, dy: 2, dz: 1 }];
    case 8:
      return [{ dx: 2, dy: 2, dz: 2 }];
    default: {
      const _exhaustive: never = size;
      return _exhaustive;
    }
  }
}

export function formatCargoBoxList(boxes: CargoBoxScu[]): string {
  if (boxes.length === 0) return "none";
  return boxes.map((size) => `${size}`).join("+") + " SCU";
}
