import { appApi } from "@/lib/api/appRoutes";
import type { CatalogMission } from "@/db/schema";

export type CatalogMissionListResponse = {
  count: number;
  missions: CatalogMission[];
};

export type FetchCatalogMissionsOptions = {
  limit?: number;
  offerLocation?: string;
};

/** List recent catalog missions (planning store, not live checklist). */
export async function fetchCatalogMissions(
  options: FetchCatalogMissionsOptions = {},
): Promise<CatalogMission[]> {
  const url = new URL(appApi.catalogMissions, "http://local");
  url.searchParams.set("limit", String(options.limit ?? 200));
  if (options.offerLocation?.trim()) {
    url.searchParams.set("offerLocation", options.offerLocation.trim());
  }
  const res = await fetch(`${url.pathname}${url.search}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to load catalog missions (${res.status})`);
  }
  const data = (await res.json()) as CatalogMissionListResponse;
  return data.missions ?? [];
}

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
