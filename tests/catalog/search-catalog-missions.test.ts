import { describe, expect, it } from "vitest";
import { sampleCatalogMissions } from "@/components/catalog/missionCatalogFixtures";
import { searchCatalogMissions } from "@/lib/missions/searchCatalogMissions";

describe("searchCatalogMissions", () => {
  it("matches hauling category short labels like local and planetary", () => {
    const local = sampleCatalogMissions.map((mission) => {
      if (mission.id !== sampleCatalogMissions[0]!.id) return mission;
      return {
        ...mission,
        payload: {
          ...mission.payload,
          category: "Hauling - Local" as const,
        },
      };
    });

    const hits = searchCatalogMissions(local, "local");
    expect(hits.map((mission) => mission.id)).toContain(
      sampleCatalogMissions[0]!.id,
    );
  });
});
