import { describe, expect, it } from "vitest";
import { partitionBoxSizesAcrossScuAmounts } from "@/lib/missions/boxBreakdownOptions";
import type { CargoBoxScu } from "@/lib/ships/cargoBoxSizes";

describe("partitionBoxSizesAcrossScuAmounts", () => {
  it("assigns largest-first into the first bucket with room", () => {
    const boxes: CargoBoxScu[] = [8, 4, 4, 2];
    expect(partitionBoxSizesAcrossScuAmounts(boxes, [12, 6])).toEqual([
      [8, 4],
      [4, 2],
    ]);
  });

  it("returns null when crates cannot fill buckets exactly", () => {
    expect(partitionBoxSizesAcrossScuAmounts([8, 4], [10, 2])).toBeNull();
  });

  it("returns null for empty inputs", () => {
    expect(partitionBoxSizesAcrossScuAmounts([], [8])).toBeNull();
    expect(partitionBoxSizesAcrossScuAmounts([8], [])).toBeNull();
  });
});
