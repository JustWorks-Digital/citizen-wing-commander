import type { CatalogMission } from "@/db/schema";
import { auecFromRewards } from "@/lib/missions/catalogMission";
import {
  catalogCargoLines,
  catalogPayload,
  catalogRouteSummary,
  contractorDisplayName,
} from "@/lib/missions/catalogMissionDisplay";
import {
  catalogRouteFilterTags,
  catalogRouteFlagsFromLocationSplits,
  CATALOG_ROUTE_FILTER_VALUES,
  type CatalogRouteFlags,
} from "@/lib/missions/catalogRouteFlags";
import {
  MISSION_RANK_ORDER,
  type MissionRank,
} from "@/lib/missions/missionRank";

export type CatalogTableSortKey =
  | "id"
  | "title"
  | "rank"
  | "reward"
  | "scu"
  | "from"
  | "to"
  | "cargo";

export type CatalogTableSortDir = "asc" | "desc";

/** Dropdown filters managed outside the table. */
export type CatalogTableFilterKey =
  | "from"
  | "to"
  | "cargo"
  | "rank"
  | "route";

export type CatalogTableFilters = Partial<
  Record<CatalogTableFilterKey, string[]>
>;

export type CatalogTableSort = {
  key: CatalogTableSortKey;
  dir: CatalogTableSortDir;
} | null;

export const CATALOG_TABLE_FILTER_KEYS: CatalogTableFilterKey[] = [
  "route",
  "from",
  "to",
  "cargo",
  "rank",
];

/** Prefer live derivation from splits so UI stays correct before/without backfill. */
export function missionRouteFlags(mission: CatalogMission): CatalogRouteFlags {
  const payload = catalogPayload(mission);
  return catalogRouteFlagsFromLocationSplits(
    mission.scuLocationSplits ?? payload?.scuLocationSplits,
    {
      fromSlugs: payload?.fromLocationSlugs,
      toSlugs: payload?.toLocationSlugs,
    },
  );
}

export function catalogTableFiltersAreActive(
  filters: CatalogTableFilters,
): boolean {
  return CATALOG_TABLE_FILTER_KEYS.some(
    (key) => (filters[key] ?? []).length > 0,
  );
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function missionRewardAmount(mission: CatalogMission): number {
  const rewards =
    mission.rewards?.length
      ? mission.rewards
      : catalogPayload(mission)?.rewards ?? [];
  return auecFromRewards(rewards);
}

function missionRank(mission: CatalogMission): string {
  return (
    mission.rank ??
    catalogPayload(mission)?.rank ??
    ""
  );
}

function missionSortValue(
  mission: CatalogMission,
  key: CatalogTableSortKey,
): string | number {
  const route = catalogRouteSummary(mission);
  switch (key) {
    case "id":
      return mission.id;
    case "title": {
      const contractor = mission.contractorSlug
        ? contractorDisplayName(mission.contractorSlug)
        : "";
      return `${mission.title} ${contractor}`.trim();
    }
    case "rank": {
      const rank = missionRank(mission) as MissionRank | "";
      return rank ? (MISSION_RANK_ORDER[rank as MissionRank] ?? 99) : 99;
    }
    case "reward":
      return missionRewardAmount(mission);
    case "scu":
      return mission.scuTotal ?? 0;
    case "from":
      return route.from.join(" ").toLowerCase();
    case "to":
      return route.to.join(" ").toLowerCase();
    case "cargo":
      return catalogCargoLines(mission).join(" ").toLowerCase();
  }
}

function missionFieldValues(
  mission: CatalogMission,
  key: CatalogTableFilterKey,
): string[] {
  if (key === "route") {
    return catalogRouteFilterTags(missionRouteFlags(mission));
  }
  if (key === "rank") {
    const rank = missionRank(mission);
    return rank ? [rank] : [];
  }
  if (key === "from") return catalogRouteSummary(mission).from;
  if (key === "to") return catalogRouteSummary(mission).to;
  return catalogCargoLines(mission);
}

/** Within a field, any selected value matches (OR). Fields AND together. */
function matchesFilter(
  mission: CatalogMission,
  key: CatalogTableFilterKey,
  selected: string[],
): boolean {
  if (selected.length === 0) return true;
  const needles = new Set(selected.map(normalize).filter(Boolean));
  if (needles.size === 0) return true;
  return missionFieldValues(mission, key).some((name) =>
    needles.has(normalize(name)),
  );
}

export function filterCatalogMissions(
  missions: CatalogMission[],
  filters: CatalogTableFilters,
): CatalogMission[] {
  const active = (Object.entries(filters) as Array<
    [CatalogTableFilterKey, string[]]
  >).filter(([, value]) => (value ?? []).length > 0);
  if (active.length === 0) return missions;

  return missions.filter((mission) =>
    active.every(([key, value]) => matchesFilter(mission, key, value)),
  );
}

export function sortCatalogMissions(
  missions: CatalogMission[],
  sort: CatalogTableSort,
): CatalogMission[] {
  if (!sort) return missions;
  const { key, dir } = sort;
  const factor = dir === "asc" ? 1 : -1;
  return [...missions].sort((a, b) => {
    const left = missionSortValue(a, key);
    const right = missionSortValue(b, key);
    if (typeof left === "number" && typeof right === "number") {
      if (left === right) return 0;
      return left < right ? -factor : factor;
    }
    const cmp = String(left).localeCompare(String(right), undefined, {
      sensitivity: "base",
      numeric: true,
    });
    return cmp * factor;
  });
}

export function filterAndSortCatalogMissions(
  missions: CatalogMission[],
  filters: CatalogTableFilters,
  sort: CatalogTableSort,
): CatalogMission[] {
  return sortCatalogMissions(filterCatalogMissions(missions, filters), sort);
}

/** Cycle: none → asc → desc → none when clicking the same key. */
export function nextCatalogTableSort(
  current: CatalogTableSort,
  key: CatalogTableSortKey,
): CatalogTableSort {
  if (!current || current.key !== key) {
    return { key, dir: "asc" };
  }
  if (current.dir === "asc") {
    return { key, dir: "desc" };
  }
  return null;
}

/** Unique sorted labels for a dropdown filter, derived from mission rows. */
export function catalogFilterOptions(
  missions: CatalogMission[],
  key: CatalogTableFilterKey,
): string[] {
  if (key === "route") {
    return [...CATALOG_ROUTE_FILTER_VALUES];
  }

  const values = new Set<string>();
  for (const mission of missions) {
    if (key === "rank") {
      const rank = missionRank(mission);
      if (rank) values.add(rank);
      continue;
    }
    if (key === "from") {
      for (const name of catalogRouteSummary(mission).from) {
        if (name && name !== "—") values.add(name);
      }
      continue;
    }
    if (key === "to") {
      for (const name of catalogRouteSummary(mission).to) {
        if (name && name !== "—") values.add(name);
      }
      continue;
    }
    for (const name of catalogCargoLines(mission)) {
      if (name) values.add(name);
    }
  }

  const list = [...values];
  if (key === "rank") {
    list.sort(
      (a, b) =>
        (MISSION_RANK_ORDER[a as MissionRank] ?? 99) -
        (MISSION_RANK_ORDER[b as MissionRank] ?? 99),
    );
    return list;
  }
  list.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  return list;
}
