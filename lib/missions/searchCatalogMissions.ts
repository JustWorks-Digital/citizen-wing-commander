import type { CatalogMission } from "@/db/schema";
import { getContractorBySlug, getLocationBySlug } from "@/lib/fixtures";
import type { HaulingCatalogMissionPayload } from "@/lib/missions/catalogMission";

function normalize(value: string | null | undefined): string {
  if (value == null) return "";
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function scoreField(haystack: string, needle: string): number {
  if (!haystack || !needle) return 0;
  if (haystack === needle) return 100;
  if (haystack.startsWith(needle)) return 80;
  if (haystack.includes(needle)) return 55;
  return 0;
}

function payloadFields(mission: CatalogMission): string[] {
  const payload = mission.payload as HaulingCatalogMissionPayload | null;
  if (!payload || payload.kind !== "hauling") return [];
  const fromNames = (payload.fromLocationSlugs ?? []).map(
    (slug) => getLocationBySlug(slug)?.name ?? slug,
  );
  const toNames = (payload.toLocationSlugs ?? []).map(
    (slug) => getLocationBySlug(slug)?.name ?? slug,
  );
  const cargo = (payload.cargo ?? []).flatMap((line) => [
    line.commodityName,
    line.commoditySlug,
  ]);
  return [...fromNames, ...toNames, ...cargo];
}

/** Client-side fuzzy rank over catalog mission title, places, cargo, contractor. */
export function searchCatalogMissions(
  missions: CatalogMission[],
  query: string,
): CatalogMission[] {
  const needle = normalize(query);
  if (!needle) return missions;

  const scored: { mission: CatalogMission; score: number }[] = [];
  for (const mission of missions) {
    const offerName = mission.offerLocationSlug
      ? (getLocationBySlug(mission.offerLocationSlug)?.name ??
        mission.offerLocationSlug)
      : "";
    const contractorName = mission.contractorSlug
      ? (getContractorBySlug(mission.contractorSlug)?.name ??
        mission.contractorSlug)
      : "";
    const fields = [
      mission.title,
      contractorName,
      mission.contractorSlug ?? "",
      offerName,
      mission.offerLocationSlug ?? "",
      JSON.stringify(mission.rewards ?? []),
      String(mission.scuTotal ?? ""),
      ...payloadFields(mission),
    ];

    let score = 0;
    for (const field of fields) {
      score = Math.max(score, scoreField(normalize(field), needle));
    }
    if (score > 0) scored.push({ mission, score });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (
      new Date(b.mission.lastObservedAt).getTime() -
      new Date(a.mission.lastObservedAt).getTime()
    );
  });
  return scored.map((row) => row.mission);
}
