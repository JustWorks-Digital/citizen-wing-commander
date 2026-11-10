import type { ScuBoxSplits } from "@/lib/missions/catalogMission";
import {
  emptyScuBoxSplits,
  scuBoxSplitsForScu,
  normalizeScuBoxSplits,
} from "@/lib/missions/catalogMission";
import {
  CARGO_BOX_SCU,
  type CargoBoxScu,
} from "@/lib/ships/cargoBoxSizes";

export type BoxBreakdownOption = {
  id: string;
  breakdown: ScuBoxSplits;
  /** Total physical crates. */
  boxCount: number;
  boxCounts: Array<{ size: CargoBoxScu; count: number }>;
  label: string;
  isDefault: boolean;
};

function breakdownBoxCount(breakdown: ScuBoxSplits): number {
  const b = normalizeScuBoxSplits(breakdown);
  return b.scuOne + b.scuTwo + b.scuFour + b.scuEight;
}

function breakdownKey(breakdown: ScuBoxSplits): string {
  const b = normalizeScuBoxSplits(breakdown);
  return `8:${b.scuEight}|4:${b.scuFour}|2:${b.scuTwo}|1:${b.scuOne}`;
}

export function boxCountsFromBreakdown(
  breakdown: ScuBoxSplits,
): Array<{ size: CargoBoxScu; count: number }> {
  const b = normalizeScuBoxSplits(breakdown);
  const counts: Array<{ size: CargoBoxScu; count: number }> = [];
  if (b.scuEight > 0) counts.push({ size: 8, count: b.scuEight });
  if (b.scuFour > 0) counts.push({ size: 4, count: b.scuFour });
  if (b.scuTwo > 0) counts.push({ size: 2, count: b.scuTwo });
  if (b.scuOne > 0) counts.push({ size: 1, count: b.scuOne });
  return counts;
}

export function expandBreakdownToBoxSizes(
  breakdown: ScuBoxSplits,
): CargoBoxScu[] {
  const b = normalizeScuBoxSplits(breakdown);
  const boxes: CargoBoxScu[] = [];
  for (let i = 0; i < b.scuEight; i += 1) boxes.push(8);
  for (let i = 0; i < b.scuFour; i += 1) boxes.push(4);
  for (let i = 0; i < b.scuTwo; i += 1) boxes.push(2);
  for (let i = 0; i < b.scuOne; i += 1) boxes.push(1);
  return boxes;
}

export function breakdownFromBoxSizes(boxes: CargoBoxScu[]): ScuBoxSplits {
  const counts = emptyScuBoxSplits();
  for (const size of boxes) {
    if (size === 1) counts.scuOne += 1;
    else if (size === 2) counts.scuTwo += 1;
    else if (size === 4) counts.scuFour += 1;
    else if (size === 8) counts.scuEight += 1;
  }
  return counts;
}

export function formatBreakdownLabel(breakdown: ScuBoxSplits): string {
  const parts = boxCountsFromBreakdown(breakdown).map(
    ({ size, count }) => `${count}×${size}`,
  );
  return parts.length > 0 ? parts.join(" + ") : "empty";
}

/**
 * All ways to fill `scu` with crates of size ≤ maxContainer (from {8,4,2,1}).
 * Sorted fewest crates first; capped for UI.
 */
export function enumerateBoxBreakdowns(
  scu: number,
  maxContainerScu?: number | null,
  limit = 10,
): BoxBreakdownOption[] {
  const total = Math.max(0, Math.floor(scu));
  if (total === 0) return [];

  const maxAllowed =
    typeof maxContainerScu === "number" && maxContainerScu > 0
      ? Math.max(
          ...CARGO_BOX_SCU.filter((size) => size <= maxContainerScu),
          1,
        )
      : 8;

  const sizes = CARGO_BOX_SCU.filter((size) => size <= maxAllowed);
  const found: ScuBoxSplits[] = [];

  function walk(remaining: number, startIndex: number, current: ScuBoxSplits) {
    if (remaining === 0) {
      found.push({ ...current });
      return;
    }
    for (let i = startIndex; i < sizes.length; i += 1) {
      const size = sizes[i]!;
      if (size > remaining) continue;
      const next = { ...current };
      if (size === 8) next.scuEight += 1;
      else if (size === 4) next.scuFour += 1;
      else if (size === 2) next.scuTwo += 1;
      else next.scuOne += 1;
      walk(remaining - size, i, next);
    }
  }

  walk(total, 0, emptyScuBoxSplits());

  const defaultBreakdown = scuBoxSplitsForScu(total, maxContainerScu);
  const defaultKey = breakdownKey(defaultBreakdown);

  found.sort((a, b) => {
    const countDelta = breakdownBoxCount(a) - breakdownBoxCount(b);
    if (countDelta !== 0) return countDelta;
    if (a.scuOne !== b.scuOne) return a.scuOne - b.scuOne;
    if (a.scuTwo !== b.scuTwo) return a.scuTwo - b.scuTwo;
    return a.scuFour - b.scuFour;
  });

  const capped = found.slice(0, Math.max(1, limit));
  // Ensure greedy default is present even if beyond the cap.
  if (!capped.some((row) => breakdownKey(row) === defaultKey)) {
    capped.unshift(defaultBreakdown);
  }

  return capped.map((breakdown) => {
    const boxCounts = boxCountsFromBreakdown(breakdown);
    return {
      id: breakdownKey(breakdown),
      breakdown,
      boxCount: breakdownBoxCount(breakdown),
      boxCounts,
      label: formatBreakdownLabel(breakdown),
      isDefault: breakdownKey(breakdown) === defaultKey,
    };
  });
}

/**
 * Pull an exact set of crates summing to `lineScu` from a shared pool
 * (largest first). Returns null if the pool cannot make that total.
 */
export function takeBoxesForScu(
  pool: CargoBoxScu[],
  lineScu: number,
): CargoBoxScu[] | null {
  const need = Math.max(0, Math.floor(lineScu));
  if (need === 0) return [];
  const remaining = [...pool];
  const taken: CargoBoxScu[] = [];
  let sum = 0;

  // Prefer exact subset greedy: largest that still fits.
  while (sum < need) {
    const nextIndex = remaining.findIndex((size) => size <= need - sum);
    if (nextIndex < 0) return null;
    const [size] = remaining.splice(nextIndex, 1);
    if (size == null) return null;
    taken.push(size);
    sum += size;
  }
  if (sum !== need) return null;

  // Mutate caller's pool to match remaining.
  pool.length = 0;
  pool.push(...remaining);
  return taken;
}

/** Assign explicit crate sizes to each cargo line from a mission breakdown. */
export function assignBoxSizesFromBreakdown(
  cargoLines: Array<{ commoditySlug: string; scu: number }>,
  breakdown: ScuBoxSplits,
): Array<{ commoditySlug: string; scu: number; boxSizes: CargoBoxScu[] }> {
  const pool = expandBreakdownToBoxSizes(breakdown);
  const out: Array<{
    commoditySlug: string;
    scu: number;
    boxSizes: CargoBoxScu[];
  }> = [];

  for (const line of cargoLines) {
    const taken = takeBoxesForScu(pool, line.scu);
    out.push({
      commoditySlug: line.commoditySlug,
      scu: line.scu,
      boxSizes: taken ?? [],
    });
  }
  return out;
}

/**
 * Partition mission crate sizes across delivery SCU chunks (route order).
 * Largest-first into the first chunk that still has room. Null if exact
 * fill is impossible (caller should fall back to greedy per chunk).
 */
export function partitionBoxSizesAcrossScuAmounts(
  boxSizes: CargoBoxScu[],
  amounts: number[],
): CargoBoxScu[][] | null {
  if (boxSizes.length === 0 || amounts.length === 0) return null;
  const ordered = [...boxSizes].sort((a, b) => b - a);
  const alloc = amounts.map((scu) => ({
    remaining: Math.max(0, Math.floor(scu)),
    sizes: [] as CargoBoxScu[],
  }));
  for (const box of ordered) {
    const hit = alloc.find((entry) => entry.remaining >= box);
    if (!hit) return null;
    hit.sizes.push(box);
    hit.remaining -= box;
  }
  if (alloc.some((entry) => entry.remaining !== 0)) return null;
  return alloc.map((entry) => entry.sizes);
}
