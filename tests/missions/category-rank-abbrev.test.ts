import { describe, expect, it } from "vitest";
import { missionRankAbbrevLabel } from "@/lib/missions/missionRank";

describe("missionRankAbbrevLabel", () => {
  it("uses hard-coded table abbrevs", () => {
    expect(missionRankAbbrevLabel("Experienced")).toBe("Exp");
    expect(missionRankAbbrevLabel("Junior")).toBe("Jr");
  });
});
