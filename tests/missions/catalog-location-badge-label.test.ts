import { describe, expect, it } from "vitest";
import { catalogLocationBadgeLabel } from "@/lib/missions/catalogMissionDisplay";

describe("catalogLocationBadgeLabel", () => {
  it("uses fixture shortName for the badge label", () => {
    const item = catalogLocationBadgeLabel("port-tressler");
    expect(item.name).toBe("Port Tressler");
    expect(item.label).toBe("Tressler");
  });

  it("falls back to full name when shortName matches name", () => {
    const item = catalogLocationBadgeLabel("area18");
    expect(item.label).toBe(item.name);
  });
});
