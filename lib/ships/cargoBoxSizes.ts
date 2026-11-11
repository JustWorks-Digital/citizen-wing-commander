/**
 * Physical cargo crate sizes used for bay packing hints.
 * Prefer largest first (greedy) — e.g. 12 → 8+4, 13 → 8+4+1, 7 → 4+2+1.
 * 16 / 32 only when the contract max container size allows them.
 */

export const CARGO_BOX_SCU = [32, 16, 8, 4, 2, 1] as const;

export type CargoBoxScu = (typeof CARGO_BOX_SCU)[number];

/** Default largest crate when no contract max is set (legacy hauling mix). */
export const DEFAULT_MAX_CARGO_BOX_SCU: CargoBoxScu = 8;

/** Axis-aligned box size in 1 SCU cells (X length, Y width, Z height). */
export type CargoBoxFootprint = {
  dx: number;
  dy: number;
  dz: number;
};

/**
 * Decompose an SCU total into crate sizes (largest first within the cap).
 * Odd totals always include a 1 SCU crate.
 * `maxBoxScu` caps the largest crate (e.g. contract max container size).
 */
export function decomposeScuIntoBoxes(
  scu: number,
  maxBoxScu: CargoBoxScu = DEFAULT_MAX_CARGO_BOX_SCU,
): CargoBoxScu[] {
  const boxes: CargoBoxScu[] = [];
  let remaining = Math.max(0, Math.floor(scu));
  const largest = CARGO_BOX_SCU[0]!;
  const max = Math.max(
    1,
    Math.min(largest, Math.floor(maxBoxScu)),
  ) as CargoBoxScu;
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
  if (!boxSizes || boxSizes.length === 0) return DEFAULT_MAX_CARGO_BOX_SCU;
  const max = Math.max(...boxSizes);
  for (const size of CARGO_BOX_SCU) {
    if (max >= size) return size;
  }
  return 1;
}

/** Snap a raw max-container number to an allowed crate size (or null). */
export function clampToCargoBoxScu(
  raw: number | null | undefined,
): CargoBoxScu | null {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) return null;
  const floor = Math.floor(raw);
  for (const size of CARGO_BOX_SCU) {
    if (floor >= size) return size;
  }
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
    // Two 8 SCU (2×2×2) side-by-side; same height as one 8.
    case 16:
      return [
        { dx: 4, dy: 2, dz: 2 },
        { dx: 2, dy: 4, dz: 2 },
      ];
    // Four 8 SCU in a row (two 16s); same height as one 8.
    case 32:
      return [
        { dx: 8, dy: 2, dz: 2 },
        { dx: 2, dy: 8, dz: 2 },
      ];
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
