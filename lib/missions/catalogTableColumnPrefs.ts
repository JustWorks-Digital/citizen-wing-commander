import type { CatalogTableSortKey } from "@/lib/missions/catalogMissionTableQuery";

/** Columns that can be shown/hidden in the contracts catalog table. */
export type CatalogTableColumnKey = CatalogTableSortKey;

export const CATALOG_TABLE_COLUMN_KEYS: CatalogTableColumnKey[] = [
  "id",
  "title",
  "category",
  "rank",
  "reward",
  "scu",
  "from",
  "to",
  "cargo",
];

export const CATALOG_TABLE_COLUMN_LABELS: Record<CatalogTableColumnKey, string> =
  {
    id: "ID",
    title: "Title",
    category: "Category",
    rank: "Rank",
    reward: "Reward",
    scu: "SCU",
    from: "From",
    to: "To",
    cargo: "Cargo",
  };

/** Default: every column visible. */
export const DEFAULT_CATALOG_TABLE_VISIBLE_COLUMNS: CatalogTableColumnKey[] = [
  ...CATALOG_TABLE_COLUMN_KEYS,
];

const STORAGE_KEY = "cwc.catalogTable.visibleColumns";

function isCatalogTableColumnKey(value: unknown): value is CatalogTableColumnKey {
  return (
    typeof value === "string" &&
    (CATALOG_TABLE_COLUMN_KEYS as string[]).includes(value)
  );
}

export function normalizeCatalogTableVisibleColumns(
  value: unknown,
): CatalogTableColumnKey[] {
  if (!Array.isArray(value)) {
    return [...DEFAULT_CATALOG_TABLE_VISIBLE_COLUMNS];
  }
  const seen = new Set<CatalogTableColumnKey>();
  const next: CatalogTableColumnKey[] = [];
  for (const entry of value) {
    if (!isCatalogTableColumnKey(entry) || seen.has(entry)) continue;
    seen.add(entry);
    next.push(entry);
  }
  if (next.length === 0) {
    return [...DEFAULT_CATALOG_TABLE_VISIBLE_COLUMNS];
  }
  // Preserve catalog column order, not storage order.
  return CATALOG_TABLE_COLUMN_KEYS.filter((key) => seen.has(key));
}

export function readCatalogTableVisibleColumns(): CatalogTableColumnKey[] {
  if (typeof window === "undefined") {
    return [...DEFAULT_CATALOG_TABLE_VISIBLE_COLUMNS];
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw == null) return [...DEFAULT_CATALOG_TABLE_VISIBLE_COLUMNS];
    return normalizeCatalogTableVisibleColumns(JSON.parse(raw) as unknown);
  } catch {
    return [...DEFAULT_CATALOG_TABLE_VISIBLE_COLUMNS];
  }
}

export function writeCatalogTableVisibleColumns(
  columns: CatalogTableColumnKey[],
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(normalizeCatalogTableVisibleColumns(columns)),
    );
  } catch {
    // Quota / private mode — ignore.
  }
}

/**
 * Toggle a column. Always keeps at least one data column visible.
 * Returns the next visibility list (or the previous list if the toggle
 * would hide the last column).
 */
export function toggleCatalogTableColumn(
  visible: CatalogTableColumnKey[],
  key: CatalogTableColumnKey,
): CatalogTableColumnKey[] {
  const current = new Set(normalizeCatalogTableVisibleColumns(visible));
  if (current.has(key)) {
    if (current.size <= 1) return normalizeCatalogTableVisibleColumns(visible);
    current.delete(key);
  } else {
    current.add(key);
  }
  return CATALOG_TABLE_COLUMN_KEYS.filter((column) => current.has(column));
}
