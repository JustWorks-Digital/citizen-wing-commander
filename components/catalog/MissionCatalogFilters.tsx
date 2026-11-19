"use client";

import { useMemo, useState } from "react";
import type { CatalogMission } from "@/db/schema";
import { CatalogColumnsMenu } from "@/components/catalog/CatalogColumnsMenu";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import {
  catalogFilterOptions,
  catalogTableFiltersAreActive,
  type CatalogTableFilterKey,
  type CatalogTableFilters,
} from "@/lib/missions/catalogMissionTableQuery";
import type { CatalogTableColumnKey } from "@/lib/missions/catalogTableColumnPrefs";
import { MISSION_RANKS } from "@/lib/missions/missionRank";

export type MissionCatalogFiltersProps = {
  /** All loaded missions — used to populate dropdown options. */
  missions: CatalogMission[];
  /** Global fuzzy search (title, locations, cargo, category, contractor). */
  query: string;
  onQueryChange: (query: string) => void;
  filters: CatalogTableFilters;
  onFiltersChange: (filters: CatalogTableFilters) => void;
  resultCount: number;
  totalCount: number;
  /** Visible table columns (UI only — does not affect search/filters). */
  visibleColumns?: CatalogTableColumnKey[];
  onVisibleColumnsChange?: (columns: CatalogTableColumnKey[]) => void;
};

const fieldInputClass = [
  "w-full rounded-rsi border border-rsi-border bg-rsi-bg-deep/60 px-2.5 py-1.5",
  "text-xs text-rsi-text placeholder:text-rsi-text-muted",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--rsi-ring)]",
].join(" ");

const DROPDOWN_FIELDS: Array<{
  key: CatalogTableFilterKey;
  label: string;
  multiple?: boolean;
}> = [
  { key: "route", label: "Route type", multiple: false },
  { key: "category", label: "Category" },
  { key: "rank", label: "Rank" },
  { key: "from", label: "From" },
  { key: "to", label: "To" },
  { key: "cargo", label: "Cargo" },
];

/**
 * Standalone catalog filters — search plus Route / Category / Rank / From / To / Cargo.
 */
export function MissionCatalogFilters({
  missions,
  query,
  onQueryChange,
  filters,
  onFiltersChange,
  resultCount,
  totalCount,
  visibleColumns,
  onVisibleColumnsChange,
}: MissionCatalogFiltersProps) {
  const canEditColumns =
    Array.isArray(visibleColumns) &&
    typeof onVisibleColumnsChange === "function";
  const optionsByKey = useMemo(() => {
    const map = {} as Record<CatalogTableFilterKey, string[]>;
    for (const field of DROPDOWN_FIELDS) {
      if (field.key === "rank") {
        const observed = catalogFilterOptions(missions, "rank");
        map.rank = observed.length > 0 ? observed : [...MISSION_RANKS];
        continue;
      }
      map[field.key] = catalogFilterOptions(missions, field.key);
    }
    return map;
  }, [missions]);

  const filtersActive = catalogTableFiltersAreActive(filters);
  const hasActive = Boolean(query.trim()) || filtersActive;
  const [filtersOpen, setFiltersOpen] = useState(true);
  const activeFilterFieldCount = DROPDOWN_FIELDS.filter(
    (field) => (filters[field.key] ?? []).length > 0,
  ).length;

  const activeBadges = useMemo(() => {
    const badges: Array<{
      key: string;
      fieldLabel: string;
      filterKey: CatalogTableFilterKey | "search";
      value: string;
    }> = [];
    const trimmedQuery = query.trim();
    if (trimmedQuery) {
      badges.push({
        key: `search:${trimmedQuery}`,
        fieldLabel: "Search",
        filterKey: "search",
        value: trimmedQuery,
      });
    }
    for (const field of DROPDOWN_FIELDS) {
      for (const value of filters[field.key] ?? []) {
        badges.push({
          key: `${field.key}:${value}`,
          fieldLabel: field.label,
          filterKey: field.key,
          value,
        });
      }
    }
    return badges;
  }, [filters, query]);

  const setFilter = (
    key: CatalogTableFilterKey,
    values: string[],
    multiple = true,
  ) => {
    const next = { ...filters };
    const normalized = multiple ? values : values.slice(0, 1);
    if (normalized.length === 0) {
      delete next[key];
    } else {
      next[key] = normalized;
    }
    onFiltersChange(next);
  };

  const removeBadge = (badge: (typeof activeBadges)[number]) => {
    if (badge.filterKey === "search") {
      onQueryChange("");
      return;
    }
    setFilter(
      badge.filterKey,
      (filters[badge.filterKey] ?? []).filter((entry) => entry !== badge.value),
    );
  };

  const clearAll = () => {
    onQueryChange("");
    onFiltersChange({});
  };

  return (
    <section
      aria-label="Catalog filters"
      className="rounded-rsi border border-rsi-border bg-rsi-surface/80 p-3 shadow-rsi-panel sm:p-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 w-full flex-1 sm:max-w-[22rem]">
          <input
            type="text"
            inputMode="search"
            aria-label="Search by keywords"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search by keywords"
            className={`${fieldInputClass}${query.trim() ? " pr-8" : ""}`}
          />
          {query.trim() ? (
            <button
              type="button"
              aria-label="Clear search"
              title="Clear search"
              onClick={() => onQueryChange("")}
              className={[
                "absolute top-1/2 right-2 inline-flex size-4 -translate-y-1/2 items-center justify-center rounded-sm text-rsi-text-muted transition-colors",
                "hover:bg-rsi-danger-muted hover:text-rsi-danger",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--rsi-ring)]",
              ].join(" ")}
            >
              <svg
                aria-hidden
                viewBox="0 0 16 16"
                className="size-2.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              >
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          ) : null}
        </div>
        <button
          type="button"
          aria-expanded={filtersOpen}
          aria-controls="catalog-filter-grid"
          onClick={() => setFiltersOpen((open) => !open)}
          className={[
            "inline-flex shrink-0 items-center gap-1.5 self-start rounded-rsi border border-rsi-border bg-rsi-bg-deep/50 px-2.5 py-1.5 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-rsi-text-secondary transition-colors",
            "hover:border-rsi-border-strong hover:text-rsi-text",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
            filtersOpen ? "border-rsi-accent/40 text-rsi-accent" : "",
          ].join(" ")}
        >
          <svg
            aria-hidden
            viewBox="0 0 20 20"
            className={[
              "size-3 shrink-0 transition-transform",
              filtersOpen ? "rotate-90" : "",
            ].join(" ")}
            fill="currentColor"
          >
            <path d="M7.05 4.55a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 1 1-1.06-1.06L10.69 10 7.05 6.36a.75.75 0 0 1 0-1.06Z" />
          </svg>
          Filters
          {activeFilterFieldCount > 0 ? (
            <span className="tabular-nums text-rsi-accent">
              {activeFilterFieldCount}
            </span>
          ) : null}
        </button>
      </div>

      <div
        id="catalog-filter-grid"
        hidden={!filtersOpen}
        className="mt-3 grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3"
      >
        {DROPDOWN_FIELDS.map((field) => (
          <SearchableSelect
            key={field.key}
            label={field.label}
            multiple={field.multiple !== false}
            values={filters[field.key] ?? []}
            options={optionsByKey[field.key]}
            placeholder={field.label}
            onChange={(values) =>
              setFilter(field.key, values, field.multiple !== false)
            }
          />
        ))}
      </div>

      {activeBadges.length > 0 ? (
        <div
          aria-label="Active filters"
          className="mt-3 flex flex-wrap gap-1.5 border-t border-rsi-divider/70 pt-3"
        >
          {activeBadges.map((badge) => (
            <span
              key={badge.key}
              className="group inline-flex max-w-full items-center gap-1 rounded-rsi border border-rsi-border bg-rsi-bg-deep/60 py-0.5 pl-2 pr-1 text-[0.65rem] text-rsi-text-secondary"
            >
              <span className="min-w-0 truncate">
                <span className="font-mono text-[0.55rem] uppercase tracking-[0.12em] text-rsi-text-muted">
                  {badge.fieldLabel}
                </span>
                <span className="mx-1 text-rsi-text-muted">·</span>
                <span className="text-rsi-text">{badge.value}</span>
              </span>
              <button
                type="button"
                aria-label={`Remove ${badge.fieldLabel} filter ${badge.value}`}
                title="Remove filter"
                onClick={() => removeBadge(badge)}
                className={[
                  "inline-flex size-4 shrink-0 items-center justify-center rounded-sm text-rsi-text-muted transition-colors",
                  "hover:bg-rsi-danger-muted hover:text-rsi-danger",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--rsi-ring)] focus-visible:text-rsi-danger",
                ].join(" ")}
              >
                <svg
                  aria-hidden
                  viewBox="0 0 16 16"
                  className="size-2.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                >
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-rsi-divider/70 pt-3">
        <p className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-rsi-text-muted">
          Showing {resultCount}
          {resultCount !== totalCount ? ` / ${totalCount}` : ""} contract
          {resultCount === 1 ? "" : "s"}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {canEditColumns && visibleColumns && onVisibleColumnsChange ? (
            <CatalogColumnsMenu
              visibleKeys={visibleColumns}
              onChange={onVisibleColumnsChange}
            />
          ) : null}
          {hasActive ? (
            <button
              type="button"
              onClick={clearAll}
              className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-rsi-text-muted transition-colors hover:text-rsi-accent"
            >
              Clear all
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
