import { describe, expect, it } from "vitest";
import { formatDistanceToNext } from "@/lib/missions/sessionChecklist";

import {
  kmToDistanceToNext,
  sumDistanceToNext,
} from "@/lib/starmap/distance";

describe("distance precision", () => {
  it("keeps a hop that survives hundredth rounding visible on a Gm-scale total", () => {
    const base = kmToDistanceToNext(2_000_000); // 2 Gm
    const hop = kmToDistanceToNext(50_000); // 50 Mm = 0.05 Gm
    expect(base).toEqual({ value: 2, unit: "Gm" });
    expect(hop).toEqual({ value: 50, unit: "Mm" });

    const withHop = sumDistanceToNext([base, hop]);
    expect(withHop?.unit).toBe("Gm");
    expect(withHop?.value).toBeGreaterThan(2);
    expect(formatDistanceToNext(withHop)).toBe("2.05 Gm");
  });

  it("formats distances to the nearest hundredth", () => {
    expect(formatDistanceToNext({ value: 1.5, unit: "Mm" })).toBe("1.5 Mm");
    expect(formatDistanceToNext({ value: 1.5001, unit: "Mm" })).toBe("1.5 Mm");
    expect(formatDistanceToNext({ value: 12.3456, unit: "Mm" })).toBe(
      "12.35 Mm",
    );
    expect(formatDistanceToNext({ value: 125.67, unit: "Gm" })).toBe(
      "125.67 Gm",
    );
  });

  it("uses the same hundredth rounding when compact", () => {
    expect(
      formatDistanceToNext({ value: 1.5001, unit: "Mm" }, { compact: true }),
    ).toBe("1.5 Mm");
    expect(
      formatDistanceToNext({ value: 12.3456, unit: "Mm" }, { compact: true }),
    ).toBe("12.35 Mm");
    expect(
      formatDistanceToNext({ value: 125.67, unit: "Gm" }, { compact: true }),
    ).toBe("125.67 Gm");
  });
});
