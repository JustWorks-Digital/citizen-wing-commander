"use client";

import { useState } from "react";
import type { CatalogMission } from "@/db/schema";
import {
  catalogCargoLines,
  catalogRewardLabel,
  catalogRouteSummary,
  contractorDisplayName,
} from "@/lib/missions/catalogMissionDisplay";
import {
  nextCatalogTableSort,
  type CatalogTableSort,
  type CatalogTableSortKey,
} from "@/lib/missions/catalogMissionTableQuery";
import { SourceIcon } from "@/components/ui/SourceIcon";
import { screenshotUrlFromLogicalPath } from "@/lib/missions/catalogScreenshotUrl";
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
};

const thClass =
  "px-2.5 py-2 text-left font-mono text-[0.55rem] font-medium uppercase tracking-[0.16em] text-rsi-text-muted sm:px-3";

const tdClass =
  "px-2.5 py-2 align-top text-xs leading-snug text-rsi-text-secondary sm:px-3";

const iconBtnClass = [
  "inline-flex size-5 items-center justify-center rounded-rsi border transition-colors",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
].join(" ");

const COLUMNS: Array<{
  key: CatalogTableSortKey;
  label: string;
  className: string;
  align?: "left" | "right";
  title?: string;
}> = [
  { key: "id", label: "ID", className: "w-[5.5rem]" },
  { key: "title", label: "Title", className: "w-[24%] min-w-0" },
  { key: "rank", label: "Rank", className: "w-[5.25rem]" },
  {
    key: "reward",
    label: "Reward",
    className: "w-[5.5rem]",
    align: "right",
  },
  {
    key: "scu",
    label: "SCU",
    className: "w-[3rem]",
    align: "right",
    title: SCU_TITLE,
  },
  { key: "from", label: "From", className: "w-[14%] min-w-0" },
  { key: "to", label: "To", className: "w-[14%] min-w-0" },
  { key: "cargo", label: "Cargo", className: "w-[12%] min-w-0" },
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

function BulletList({ items }: { items: string[] }) {
  if (items.length === 0) return <span>—</span>;
  return (
    <ul className="list-disc space-y-0.5 pl-3 text-[0.7rem] leading-snug">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="break-words">
          {item}
        </li>
      ))}
    </ul>
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
        <svg
          viewBox="0 0 10 6"
          className="size-2.5"
          fill="currentColor"
        >
          <path d="M5 0.5 9.5 5.5H0.5Z" />
        </svg>
      ) : null}
      {showDown ? (
        <svg
          viewBox="0 0 10 6"
          className="size-2.5"
          fill="currentColor"
        >
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
}: MissionCatalogTableProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
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
    <div className="overflow-x-auto rounded-rsi border border-rsi-border bg-rsi-surface/90 shadow-rsi-panel">
      {/*
        min-w keeps a usable layout under ~1000px without forcing scroll on
        typical smaller desktops; overflow-x-auto still allows scroll below that.
      */}
      <table className="w-full min-w-[52rem] table-fixed border-collapse text-left">
        <thead>
          <tr className="border-b border-rsi-divider bg-rsi-bg-deep/50">
            {canCheck ? (
              <th scope="col" className={`${thClass} w-10`}>
                <input
                  type="checkbox"
                  checked={allVisibleChecked}
                  ref={(el) => {
                    if (el) el.indeterminate = someVisibleChecked && !allVisibleChecked;
                  }}
                  onChange={toggleAllVisible}
                  aria-label="Select all visible contracts"
                  className="size-3.5 accent-[var(--rsi-accent)]"
                />
              </th>
            ) : null}
            {COLUMNS.map((column) => {
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
                  className={`${thClass} ${column.className} ${alignRight ? "text-right" : ""}`}
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
                colSpan={COLUMNS.length + (canCheck ? 1 : 0)}
                className={`${tdClass} py-8 text-center text-rsi-text-muted`}
              >
                No contracts to show.
              </td>
            </tr>
          ) : (
            missions.map((mission) => {
              const route = catalogRouteSummary(mission);
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
                    "border-b border-rsi-divider/80 last:border-b-0 transition-colors",
                    isSelected
                      ? "bg-rsi-accent/10"
                      : "hover:bg-rsi-bg-deep/40",
                  ].join(" ")}
                  aria-selected={isSelected}
                >
                  {canCheck ? (
                    <td className={tdClass}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleChecked(mission.id)}
                        aria-label={`Select ${mission.title}`}
                        className="size-3.5 accent-[var(--rsi-accent)]"
                      />
                    </td>
                  ) : null}
                  <td className={tdClass}>
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
                  <td className={tdClass}>{mission.rank ?? "—"}</td>
                  <td
                    className={`${tdClass} text-right font-mono text-[0.7rem] tabular-nums text-rsi-accent`}
                  >
                    {catalogRewardLabel(mission, { includeAuecUnit: false })}
                  </td>
                  <td
                    className={`${tdClass} text-right font-mono text-[0.7rem] tabular-nums text-rsi-text`}
                  >
                    {mission.scuTotal}
                  </td>
                  <td className={tdClass}>
                    <BulletList items={route.from} />
                  </td>
                  <td className={tdClass}>
                    <BulletList items={route.to} />
                  </td>
                  <td className={tdClass}>
                    <BulletList items={catalogCargoLines(mission)} />
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
