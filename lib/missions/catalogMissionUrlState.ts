import {
  CATALOG_TABLE_FILTER_KEYS,
  type CatalogTableFilterKey,
  type CatalogTableFilters,
  type CatalogTableSort,
  type CatalogTableSortDir,
  type CatalogTableSortKey,
} from "@/lib/missions/catalogMissionTableQuery";

const SORT_KEYS = new Set<CatalogTableSortKey>([
  "id",
  "title",
  "rank",
  "reward",
  "scu",
  "from",
  "to",
  "cargo",
]);

const SORT_DIRS = new Set<CatalogTableSortDir>(["asc", "desc"]);

export type CatalogMissionUrlState = {
  query: string;
  filters: CatalogTableFilters;
  sort: CatalogTableSort;
};

export function parseCatalogMissionUrlState(
  params: URLSearchParams,
): CatalogMissionUrlState {
  const query = params.get("q")?.trim() ?? "";
  const filters: CatalogTableFilters = {};
  for (const key of CATALOG_TABLE_FILTER_KEYS) {
    const values = params
      .getAll(key)
      .map((value) => value.trim())
      .filter(Boolean);
    if (values.length > 0) {
      filters[key] = key === "route" ? values.slice(0, 1) : values;
    }
  }

  const sortKeyRaw = params.get("sort");
  const sortDirRaw = params.get("dir");
  let sort: CatalogTableSort = null;
  if (
    sortKeyRaw &&
    SORT_KEYS.has(sortKeyRaw as CatalogTableSortKey) &&
    sortDirRaw &&
    SORT_DIRS.has(sortDirRaw as CatalogTableSortDir)
  ) {
    sort = {
      key: sortKeyRaw as CatalogTableSortKey,
      dir: sortDirRaw as CatalogTableSortDir,
    };
  }

  return { query, filters, sort };
}

/** Build search params for catalog UI state. Omits empty keys. */
export function buildCatalogMissionSearchParams(state: CatalogMissionUrlState): URLSearchParams {
  const params = new URLSearchParams();
  const trimmed = state.query.trim();
  if (trimmed) params.set("q", trimmed);

  for (const key of CATALOG_TABLE_FILTER_KEYS) {
    const values = state.filters[key] ?? [];
    for (const value of values) {
      const trimmedValue = value.trim();
      if (trimmedValue) params.append(key, trimmedValue);
    }
  }

  if (state.sort) {
    params.set("sort", state.sort.key);
    params.set("dir", state.sort.dir);
  }

  return params;
}

export function catalogMissionSearchParamsEqual(
  a: URLSearchParams,
  b: URLSearchParams,
): boolean {
  return a.toString() === b.toString();
}

export type { CatalogTableFilterKey };
