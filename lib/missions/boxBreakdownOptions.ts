import type { CargoBoxBreakdown } from "@/lib/missions/catalogMission";
import {
  emptyBoxBreakdown,
  boxBreakdownForScu,
} from "@/lib/missions/catalogMission";
import {
  CARGO_BOX_SCU,
  type CargoBoxScu,
} from "@/lib/ships/cargoBoxSizes";

export type BoxBreakdownOption = {
  id: string;
  breakdown: CargoBoxBreakdown;
  /** Total physical crates. */
  boxCount: number;
  boxCounts: Array<{ size: CargoBoxScu; count: number }>;
  label: string;
  isDefault: boolean;
};

function breakdownBoxCount(breakdown: CargoBoxBreakdown): number {
  return (
    breakdown.size1 + breakdown.size2 + breakdown.size4 + breakdown.size8
  );
}

function breakdownKey(breakdown: CargoBoxBreakdown): string {
  return `8:${breakdown.size8}|4:${breakdown.size4}|2:${breakdown.size2}|1:${breakdown.size1}`;
}

export function boxCountsFromBreakdown(
  breakdown: CargoBoxBreakdown,
): Array<{ size: CargoBoxScu; count: number }> {
  const counts: Array<{ size: CargoBoxScu; count: number }> = [];
  if (breakdown.size8 > 0) counts.push({ size: 8, count: breakdown.size8 });
  if (breakdown.size4 > 0) counts.push({ size: 4, count: breakdown.size4 });
  if (breakdown.size2 > 0) counts.push({ size: 2, count: breakdown.size2 });
  if (breakdown.size1 > 0) counts.push({ size: 1, count: breakdown.size1 });
  return counts;
}

export function expandBreakdownToBoxSizes(
  breakdown: CargoBoxBreakdown,
): CargoBoxScu[] {
  const boxes: CargoBoxScu[] = [];
  for (let i = 0; i < breakdown.size8; i += 1) boxes.push(8);
  for (let i = 0; i < breakdown.size4; i += 1) boxes.push(4);
  for (let i = 0; i < breakdown.size2; i += 1) boxes.push(2);
  for (let i = 0; i < breakdown.size1; i += 1) boxes.push(1);
  return boxes;
}

export function breakdownFromBoxSizes(boxes: CargoBoxScu[]): CargoBoxBreakdown {
  const counts = emptyBoxBreakdown();
  for (const size of boxes) {
    if (size === 1) counts.size1 += 1;
    else if (size === 2) counts.size2 += 1;
    else if (size === 4) counts.size4 += 1;
    else if (size === 8) counts.size8 += 1;
  }
  return counts;
}

export function formatBreakdownLabel(breakdown: CargoBoxBreakdown): string {
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
  const found: CargoBoxBreakdown[] = [];

  function walk(remaining: number, startIndex: number, current: CargoBoxBreakdown) {
    if (remaining === 0) {
      found.push({ ...current });
      return;
    }
    for (let i = startIndex; i < sizes.length; i += 1) {
      const size = sizes[i]!;
      if (size > remaining) continue;
      const next = { ...current };
      if (size === 8) next.size8 += 1;
      else if (size === 4) next.size4 += 1;
      else if (size === 2) next.size2 += 1;
      else next.size1 += 1;
      walk(remaining - size, i, next);
    }
  }

  walk(total, 0, emptyBoxBreakdown());

  const defaultBreakdown = boxBreakdownForScu(total, maxContainerScu);
  const defaultKey = breakdownKey(defaultBreakdown);

  found.sort((a, b) => {
    const countDelta = breakdownBoxCount(a) - breakdownBoxCount(b);
    if (countDelta !== 0) return countDelta;
    if (a.size1 !== b.size1) return a.size1 - b.size1;
    if (a.size2 !== b.size2) return a.size2 - b.size2;
    return a.size4 - b.size4;
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
  breakdown: CargoBoxBreakdown,
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
