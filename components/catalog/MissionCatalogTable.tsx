"use client";

import { useMemo, useState } from "react";
import type { CatalogMission } from "@/db/schema";
import {
  CatalogCargoBadges,
  CatalogLocationBadges,
} from "@/components/catalog/CatalogRouteBadges";
import {
  catalogPayload,
  catalogRewardLabel,
  catalogRouteBadgeItems,
  contractorDisplayName,
} from "@/lib/missions/catalogMissionDisplay";
import {
  nextCatalogTableSort,
  type CatalogTableSort,
  type CatalogTableSortKey,
} from "@/lib/missions/catalogMissionTableQuery";
import {
  CATALOG_TABLE_COLUMN_KEYS,
  type CatalogTableColumnKey,
} from "@/lib/missions/catalogTableColumnPrefs";
import { SourceIcon } from "@/components/ui/SourceIcon";
import { screenshotUrlFromLogicalPath } from "@/lib/missions/catalogScreenshotUrl";
import { haulingCategoryShortLabel } from "@/lib/missions/haulingCategory";
import { missionRankAbbrevLabel } from "@/lib/missions/missionRank";
import { SCU_TITLE } from "@/lib/ui/abbrevTitles";

export type MissionCatalogTableProps = {
  missions: CatalogMission[];
  selectedId?: string | null;
  onSelect: (mission: CatalogMission) => void;
  onViewSource?: (mission: CatalogMission) => void;
  onViewObject?: (mission: CatalogMission) => void;
  /** Controlled sort — headers cycle when provided. */
  sort?: CatalogTableSort;
  onSortChange?: (sort: CatalogTableSort) => void;
  /** Row ids checked for bulk “add to session”. */
  checkedIds?: string[];
  onCheckedIdsChange?: (ids: string[]) => void;
  /**
   * Visible columns (from Filters → Columns). Defaults to all.
   * Does not affect search/filters — display only.
   */
  visibleColumns?: CatalogTableColumnKey[];
  /** Fill parent height and scroll inside (modal embed). Sticky header. */
  fillHeight?: boolean;
};

const thClass = [
  "sticky top-0 z-10 px-2.5 py-2 text-left font-mono text-[0.55rem] font-medium uppercase tracking-[0.16em] text-rsi-text-muted sm:px-3",
  "border-b border-rsi-divider bg-rsi-bg-deep",
].join(" ");

const tdClass =
  "px-2.5 py-2 align-top text-xs leading-snug text-rsi-text-secondary sm:px-3";

const iconBtnClass = [
  "inline-flex size-5 items-center justify-center rounded-rsi border transition-colors",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
].join(" ");

type ColumnDef = {
  key: CatalogTableSortKey;
  label: string;
  /** Width on `<col>` (table-fixed). Omit so the column absorbs leftover space. */
  colClass?: string;
  /** Wider `<col>` when Title is hidden. */
  expandedColClass?: string;
  align?: "left" | "right";
  title?: string;
};

const COLUMNS: ColumnDef[] = [
  { key: "id", label: "ID", colClass: "w-[5.5rem]" },
  { key: "title", label: "Title", colClass: "w-[20%]" },
  { key: "category", label: "Category", colClass: "w-[5.75rem]" },
  // Header “Rank” + sort glyph; cells are short abbrevs — pin so leftover goes to Cargo.
  { key: "rank", label: "Rank", colClass: "w-[3.25rem]" },
  {
    key: "reward",
    label: "Reward",
    colClass: "w-[4.75rem]",
    align: "right",
  },
  {
    key: "scu",
    label: "SCU",
    colClass: "w-[3rem]",
    align: "right",
    title: SCU_TITLE,
  },
  {
    key: "from",
    label: "From",
    colClass: "w-[14%]",
    expandedColClass: "w-[20%]",
  },
  {
    key: "to",
    label: "To",
    colClass: "w-[14%]",
    expandedColClass: "w-[20%]",
  },
  // No fixed width — takes remaining table space after pinned / % columns.
  { key: "cargo", label: "Cargo" },
];

function ObjectIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="size-3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 4H6a2 2 0 0 0-2 2v3c0 1-.6 2-2 2 1.4 0 2 1 2 2v3a2 2 0 0 0 2 2h2" />
      <path d="M16 4h2a2 2 0 0 1 2 2v3c0 1 .6 2 2 2-1.4 0-2 1-2 2v3a2 2 0 0 1-2 2h-2" />
    </svg>
  );
}

function SortGlyph({
  active,
  dir,
}: {
  active: boolean;
  dir: "asc" | "desc" | null;
}) {
  const showUp = !active || dir === "asc";
  const showDown = !active || dir === "desc";
  return (
    <span
      aria-hidden
      className={[
        "inline-flex flex-col items-center leading-none",
        !active ? "-space-y-0.5" : "",
        active ? "text-rsi-accent" : "text-rsi-text-muted/45",
      ].join(" ")}
      title={
        active && dir === "asc"
          ? "Sorted ascending"
          : active && dir === "desc"
            ? "Sorted descending"
            : "Not sorted"
      }
    >
      {showUp ? (
        <svg viewBox="0 0 10 6" className="size-2.5" fill="currentColor">
          <path d="M5 0.5 9.5 5.5H0.5Z" />
        </svg>
      ) : null}
      {showDown ? (
        <svg viewBox="0 0 10 6" className="size-2.5" fill="currentColor">
          <path d="M5 5.5 0.5 0.5h9Z" />
        </svg>
      ) : null}
    </span>
  );
}

/** Presentational missions catalog table. Filtering lives in MissionCatalogFilters. */
export function MissionCatalogTable({
  missions,
  selectedId = null,
  onSelect,
  onViewSource,
  onViewObject,
  sort = null,
  onSortChange,
  checkedIds,
  onCheckedIdsChange,
  visibleColumns: visibleColumnsProp,
  fillHeight = false,
}: MissionCatalogTableProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const visibleKeys = visibleColumnsProp?.length
    ? visibleColumnsProp
    : CATALOG_TABLE_COLUMN_KEYS;
  const visibleSet = useMemo(() => new Set(visibleKeys), [visibleKeys]);
  const visibleColumns = useMemo(
    () => COLUMNS.filter((column) => visibleSet.has(column.key)),
    [visibleSet],
  );
  const titleHidden = !visibleSet.has("title");

  const canSort = typeof onSortChange === "function";
  const canCheck = typeof onCheckedIdsChange === "function";
  const checkedSet = new Set(checkedIds ?? []);
  const allVisibleChecked =
    canCheck &&
    missions.length > 0 &&
    missions.every((mission) => checkedSet.has(mission.id));
  const someVisibleChecked =
    canCheck && missions.some((mission) => checkedSet.has(mission.id));

  const toggleChecked = (missionId: string) => {
    if (!canCheck) return;
    const next = new Set(checkedIds ?? []);
    if (next.has(missionId)) next.delete(missionId);
    else next.add(missionId);
    onCheckedIdsChange([...next]);
  };

  const toggleAllVisible = () => {
    if (!canCheck) return;
    if (allVisibleChecked) {
      const visible = new Set(missions.map((mission) => mission.id));
      onCheckedIdsChange(
        (checkedIds ?? []).filter((id) => !visible.has(id)),
      );
      return;
    }
    const next = new Set(checkedIds ?? []);
    for (const mission of missions) next.add(mission.id);
    onCheckedIdsChange([...next]);
  };

  const copyMissionId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(id);
      window.setTimeout(() => {
        setCopiedId((current) => (current === id ? null : current));
      }, 1500);
    } catch {
      // Clipboard may be blocked; leave cell unchanged.
    }
  };

  return (
    <div
      className={[
        "rounded-rsi border border-rsi-border bg-rsi-surface/90 shadow-rsi-panel",
        fillHeight
          ? "h-full min-h-0 overflow-auto overscroll-contain"
          : "overflow-x-auto",
      ].join(" ")}
    >
      {/*
        min-w keeps a usable layout under ~1000px without forcing scroll on
        typical smaller desktops; overflow-x-auto still allows scroll below that.
      */}
      <table
        className={[
          "w-full table-fixed border-collapse text-left",
          titleHidden ? "min-w-[42rem]" : "min-w-[52rem]",
        ].join(" ")}
      >
        <colgroup>
          {canCheck ? <col className="w-8" /> : null}
          {visibleColumns.map((column) => {
            const colClass =
              titleHidden && column.expandedColClass
                ? column.expandedColClass
                : column.colClass;
            return (
              <col
                key={column.key}
                className={colClass ?? "min-w-0"}
              />
            );
          })}
        </colgroup>
        <thead>
          <tr>
            {canCheck ? (
              <th scope="col" className={`${thClass} px-2 sm:px-2`}>
                <input
                  type="checkbox"
                  checked={allVisibleChecked}
                  ref={(el) => {
                    if (el)
                      el.indeterminate =
                        someVisibleChecked && !allVisibleChecked;
                  }}
                  onChange={toggleAllVisible}
                  aria-label="Select all visible contracts"
                  className="size-3.5 accent-[var(--rsi-accent)]"
                />
              </th>
            ) : null}
            {visibleColumns.map((column) => {
              const isActive = sort?.key === column.key;
              const alignRight = column.align === "right";
              const headerInner = (
                <>
                  <span title={column.title}>{column.label}</span>
                  {canSort ? (
                    <SortGlyph
                      active={Boolean(isActive)}
                      dir={isActive ? sort!.dir : null}
                    />
                  ) : null}
                </>
              );

              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={
                    isActive
                      ? sort!.dir === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                  className={`${thClass} ${alignRight ? "text-right" : ""}`}
                >
                  {canSort ? (
                    <button
                      type="button"
                      onClick={() =>
                        onSortChange(nextCatalogTableSort(sort, column.key))
                      }
                      className={[
                        "inline-flex w-full items-center gap-1 uppercase",
                        alignRight ? "justify-end" : "justify-start",
                        isActive ? "text-rsi-accent" : "hover:text-rsi-text",
                      ].join(" ")}
                    >
                      {headerInner}
                    </button>
                  ) : (
                    <span
                      className={[
                        "inline-flex items-center gap-1 uppercase",
                        alignRight ? "justify-end" : "",
                        isActive ? "text-rsi-accent" : "",
                      ].join(" ")}
                    >
                      {headerInner}
                    </span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {missions.length === 0 ? (
            <tr>
              <td
                colSpan={visibleColumns.length + (canCheck ? 1 : 0) || 1}
                className={`${tdClass} py-8 text-center text-rsi-text-muted`}
              >
                No contracts to show.
              </td>
            </tr>
          ) : (
            missions.map((mission) => {
              const route = catalogRouteBadgeItems(mission);
              const sourceUrl = screenshotUrlFromLogicalPath(
                mission.latestScreenshotPath,
              );
              const isSelected = selectedId === mission.id;
              const isCopied = copiedId === mission.id;
              const isChecked = checkedSet.has(mission.id);
              return (
                <tr
                  key={mission.id}
                  className={[
                    "[content-visibility:auto] [contain-intrinsic-size:auto_3.25rem]",
                    "border-b border-rsi-divider/80 last:border-b-0 transition-colors",
                    isSelected
                      ? "bg-rsi-accent/10"
                      : "hover:bg-rsi-bg-deep/40",
                  ].join(" ")}
                  aria-selected={isSelected}
                >
                  {canCheck ? (
                    <td className={`${tdClass} px-2 sm:px-2`}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleChecked(mission.id)}
                        aria-label={`Select ${mission.title}`}
                        className="size-3.5 accent-[var(--rsi-accent)]"
                      />
                    </td>
                  ) : null}
                  {visibleSet.has("id") ? (
                    <td className={`${tdClass}`}>
                      <div className="flex flex-col gap-1.5">
                        <button
                          type="button"
                          title={isCopied ? "Copied" : `Copy ${mission.id}`}
                          aria-label={`Copy contract ID ${mission.id}`}
                          onClick={() => void copyMissionId(mission.id)}
                          className={[
                            "rounded-rsi text-left font-mono text-[0.65rem] tabular-nums transition-colors",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
                            isCopied
                              ? "text-rsi-accent"
                              : "text-rsi-text-muted hover:text-rsi-accent",
                          ].join(" ")}
                        >
                          {isCopied ? "Copied" : mission.id.slice(0, 8)}
                        </button>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={!sourceUrl}
                            title={
                              sourceUrl
                                ? "View source screenshot"
                                : "No source screenshot on file"
                            }
                            aria-label="View source"
                            onClick={() => onViewSource?.(mission)}
                            className={[
                              iconBtnClass,
                              sourceUrl
                                ? "border-rsi-border bg-rsi-surface text-rsi-text-secondary hover:border-rsi-accent/50 hover:text-rsi-accent"
                                : "cursor-not-allowed border-rsi-border/50 text-rsi-text-muted opacity-40",
                            ].join(" ")}
                          >
                            <SourceIcon />
                          </button>
                          <button
                            type="button"
                            title="View object JSON"
                            aria-label="View object"
                            onClick={() => onViewObject?.(mission)}
                            className={[
                              iconBtnClass,
                              "border-rsi-border bg-rsi-surface text-rsi-text-secondary hover:border-rsi-accent/50 hover:text-rsi-accent",
                            ].join(" ")}
                          >
                            <ObjectIcon />
                          </button>
                        </div>
                      </div>
                    </td>
                  ) : null}
                  {visibleSet.has("title") ? (
                    <td
                      className={`${tdClass} cursor-pointer`}
                      onClick={() => onSelect(mission)}
                    >
                      <p className="truncate text-xs font-semibold tracking-wide text-rsi-text-secondary">
                        {mission.title}
                      </p>
                      {mission.contractorSlug ? (
                        <p className="mt-0.5 truncate text-[0.65rem] text-rsi-text-muted">
                          {contractorDisplayName(mission.contractorSlug)}
                        </p>
                      ) : null}
                    </td>
                  ) : null}
                  {visibleSet.has("category") ? (
                    <td className={`${tdClass}`}>
                      {haulingCategoryShortLabel(
                        catalogPayload(mission)?.category,
                      ) ?? "—"}
                    </td>
                  ) : null}
                  {visibleSet.has("rank") ? (
                    <td
                      className={`${tdClass} font-mono text-[0.65rem]`}
                      title={mission.rank ?? undefined}
                    >
                      {missionRankAbbrevLabel(mission.rank) ?? "—"}
                    </td>
                  ) : null}
                  {visibleSet.has("reward") ? (
                    <td
                      className={`${tdClass} text-right font-mono text-[0.7rem] tabular-nums text-rsi-accent`}
                      title={catalogRewardLabel(mission, {
                        includeAuecUnit: true,
                      })}
                    >
                      {catalogRewardLabel(mission, {
                        includeAuecUnit: false,
                        compact: true,
                      })}
                    </td>
                  ) : null}
                  {visibleSet.has("scu") ? (
                    <td
                      className={`${tdClass} text-right font-mono text-[0.7rem] tabular-nums text-rsi-text`}
                    >
                      {mission.scuTotal}
                    </td>
                  ) : null}
                  {visibleSet.has("from") ? (
                    <td
                      className={`${tdClass} cursor-pointer`}
                      onClick={() => onSelect(mission)}
                    >
                      <CatalogLocationBadges items={route.from} tone="from" />
                    </td>
                  ) : null}
                  {visibleSet.has("to") ? (
                    <td
                      className={`${tdClass} cursor-pointer`}
                      onClick={() => onSelect(mission)}
                    >
                      <CatalogLocationBadges items={route.to} tone="to" />
                    </td>
                  ) : null}
                  {visibleSet.has("cargo") ? (
                    <td
                      className={`${tdClass} cursor-pointer`}
                      onClick={() => onSelect(mission)}
                    >
                      <CatalogCargoBadges mission={mission} />
                    </td>
                  ) : null}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
