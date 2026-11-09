import { appApi } from "@/lib/api/appRoutes";
import type { CatalogMission } from "@/db/schema";

export type CatalogMissionListResponse = {
  count: number;
  missions: CatalogMission[];
};

/** Load catalog missions by id (for session modal enrichment). */
export async function fetchCatalogMissionsByIds(
  ids: string[],
): Promise<CatalogMission[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return [];
  const url = new URL(appApi.catalogMissions, "http://local");
  url.searchParams.set("ids", unique.join(","));
  const res = await fetch(`${url.pathname}${url.search}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to load catalog missions (${res.status})`);
  }
  const data = (await res.json()) as CatalogMissionListResponse;
  return data.missions ?? [];
}
