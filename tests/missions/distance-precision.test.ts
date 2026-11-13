import { describe, expect, it } from "vitest";
import { formatDistanceToNext } from "@/lib/missions/mockSession";
import {
  kmToDistanceToNext,
  sumDistanceToNext,
} from "@/lib/starmap/distance";

describe("distance precision", () => {
  it("keeps a 1.5 Mm hop visible on a Gm-scale total", () => {
    const base = kmToDistanceToNext(2_000_000); // 2 Gm
    const hop = kmToDistanceToNext(1_500); // 1.5 Mm
    expect(base).toEqual({ value: 2, unit: "Gm" });
    expect(hop).toEqual({ value: 1.5, unit: "Mm" });

    const withHop = sumDistanceToNext([base, hop]);
    expect(withHop?.unit).toBe("Gm");
    expect(withHop?.value).toBeGreaterThan(2);
    expect(formatDistanceToNext(withHop)).not.toBe(formatDistanceToNext(base));
  });

  it("formats small Mm values with readable decimals", () => {
    expect(formatDistanceToNext({ value: 1.5, unit: "Mm" })).toBe("1.5 Mm");
    expect(formatDistanceToNext({ value: 1.5001, unit: "Mm" })).toBe(
      "1.5001 Mm",
    );
  });
});
