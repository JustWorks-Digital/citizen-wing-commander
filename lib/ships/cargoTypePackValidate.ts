import type { PlacedCargoBox } from "@/lib/ships/cargoGridPlacement";

export type CargoTypePackIssue = {
  /** XY column key `x,y`. */
  column: string;
  commodities: string[];
};

export type CargoTypePackValidation = {
  ok: boolean;
  /** Columns where two+ commodities share the same XY (stacked mix). */
  mixedColumns: CargoTypePackIssue[];
};

/**
 * Cargo-type packs must not stack different commodities in the same XY column.
 * Side-by-side mixes in a bay are allowed; burying one type under another is not.
 */
export function validateCargoTypePackClusters(
  boxes: readonly PlacedCargoBox[],
): CargoTypePackValidation {
  const columns = new Map<string, Set<string>>();
  for (const box of boxes) {
    const slug = box.commoditySlug?.trim() || "?";
    for (let dx = 0; dx < box.footprint.dx; dx += 1) {
      for (let dy = 0; dy < box.footprint.dy; dy += 1) {
        const key = `${box.origin.x + dx},${box.origin.y + dy}`;
        const set = columns.get(key) ?? new Set<string>();
        set.add(slug);
        columns.set(key, set);
      }
    }
  }

  const mixedColumns: CargoTypePackIssue[] = [];
  for (const [column, set] of columns) {
    if (set.size < 2) continue;
    mixedColumns.push({
      column,
      commodities: [...set].sort(),
    });
  }
  mixedColumns.sort((a, b) => a.column.localeCompare(b.column));

  return {
    ok: mixedColumns.length === 0,
    mixedColumns,
  };
}
