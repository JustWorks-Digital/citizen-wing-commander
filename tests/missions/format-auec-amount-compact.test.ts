import { describe, expect, it } from "vitest";
import { formatAuecAmountCompact } from "@/lib/missions/catalogMission";

describe("formatAuecAmountCompact", () => {
  it("keeps amounts under 1k as digits", () => {
    expect(formatAuecAmountCompact(850, { includeUnit: false })).toBe("850");
  });

  it("abbreviates thousands with k", () => {
    expect(formatAuecAmountCompact(42000, { includeUnit: false })).toBe("42k");
    expect(formatAuecAmountCompact(18500, { includeUnit: false })).toBe(
      "18.5k",
    );
  });

  it("abbreviates millions with M", () => {
    expect(formatAuecAmountCompact(1_300_000, { includeUnit: false })).toBe(
      "1.3M",
    );
  });
});
