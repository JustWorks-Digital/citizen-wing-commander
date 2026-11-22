import { describe, expect, it } from "vitest";
import {
  BOX_BREAKDOWN_SEARCH_CAP,
  breakdownKey,
  enumerateBoxBreakdowns,
} from "@/lib/missions/boxBreakdownOptions";

describe("enumerateBoxBreakdowns", () => {
  it("includes 5×4 + 1 for 21 SCU even when the display limit is small", () => {
    // Session 9a89783f-95d5-4a4e-a556-1efd545487d6 — Pressurized Ice 21 SCU;
    // box-types filter “6” was missing five 4 SCU + one 1 SCU. Largest-first
    // DFS used to stop at the UI `limit` before mixes that skip 8 SCU crates.
    const options = enumerateBoxBreakdowns(21, 8, BOX_BREAKDOWN_SEARCH_CAP);
    const hit = options.find(
      (option) =>
        option.boxCount === 6 &&
        option.breakdown.scuFour === 5 &&
        option.breakdown.scuOne === 1 &&
        option.breakdown.scuTwo === 0 &&
        option.breakdown.scuEight === 0,
    );
    expect(hit).toEqual(
      expect.objectContaining({
        boxCount: 6,
        label: "5×4 + 1×1",
        breakdown: expect.objectContaining({
          scuFour: 5,
          scuOne: 1,
          scuTwo: 0,
          scuEight: 0,
          scuSixteen: 0,
          scuThirtyTwo: 0,
        }),
      }),
    );
  });

  it("still returns a short list when limit is small after a full search", () => {
    const options = enumerateBoxBreakdowns(21, 8, 10);
    expect(options).toHaveLength(10);
    // Fewest crates first — min for 21 with max 8 is 4 boxes (2×8 + 4 + 1).
    expect(options[0]?.boxCount).toBeLessThanOrEqual(4);
    const keys = new Set(options.map((option) => breakdownKey(option.breakdown)));
    expect(keys.size).toBe(10);
  });

  it("marks the greedy default and keeps it in the list", () => {
    const options = enumerateBoxBreakdowns(21, 8, 10);
    const defaults = options.filter((option) => option.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0]?.breakdown.scuEight).toBeGreaterThan(0);
  });
});
