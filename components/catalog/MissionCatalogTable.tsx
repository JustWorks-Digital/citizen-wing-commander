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
import { screenshotUrlFromLogicalPath } from "@/lib/missions/catalogScreenshotUrl";

export type MissionCatalogTableProps = {
  missions: CatalogMission[];
  selectedId?: string | null;
  onSelect: (mission: CatalogMission) => void;
  onViewSource?: (mission: CatalogMission) => void;
  onViewObject?: (mission: CatalogMission) => void;
  /** Controlled sort — headers cycle when provided. */
  sort?: CatalogTableSort;
  onSortChange?: (sort: CatalogTableSort) => void;
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
}> = [
  { key: "id", label: "ID", className: "w-[7.5rem]" },
  { key: "title", label: "Title", className: "w-[26%]" },
  { key: "rank", label: "Rank", className: "w-[6.5rem]" },
  {
    key: "reward",
    label: "Reward",
    className: "w-[7rem]",
    align: "right",
  },
  { key: "scu", label: "SCU", className: "w-[3.5rem]", align: "right" },
  { key: "from", label: "From", className: "w-[14%]" },
  { key: "to", label: "To", className: "w-[14%]" },
  { key: "cargo", label: "Cargo", className: "w-[12%]" },
];

function SourceIcon() {
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
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10.5" r="1.5" />
      <path d="m21 16-5.5-5.5L9 17" />
    </svg>
  );
}

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
  if (items.length === 1) {
    return <span>{items[0]}</span>;
  }
  return (
    <ul className="list-disc space-y-0.5 pl-3 text-[0.7rem] leading-snug">
      {items.map((item, index) => (
        <li key={`${item}-${index}`}>{item}</li>
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
  return (
    <span
      aria-hidden
      className={[
        "inline-flex flex-col text-[0.45rem] leading-none",
        active ? "text-rsi-accent" : "text-rsi-text-muted/70",
      ].join(" ")}
    >
      <span className={dir === "asc" ? "text-rsi-accent" : ""}>▲</span>
      <span className={dir === "desc" ? "text-rsi-accent" : ""}>▼</span>
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
}: MissionCatalogTableProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const canSort = typeof onSortChange === "function";

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
      <table className="w-full min-w-[64rem] table-fixed border-collapse text-left">
        <thead>
          <tr className="border-b border-rsi-divider bg-rsi-bg-deep/50">
            {COLUMNS.map((column) => {
              const isActive = sort?.key === column.key;
              const alignRight = column.align === "right";
              const headerInner = (
                <>
                  <span>{column.label}</span>
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
                colSpan={COLUMNS.length}
                className={`${tdClass} py-8 text-center text-rsi-text-muted`}
              >
                No missions to show.
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
                  <td className={tdClass}>
                    <div className="flex flex-col gap-1.5">
                      <button
                        type="button"
                        title={isCopied ? "Copied" : `Copy ${mission.id}`}
                        aria-label={`Copy mission ID ${mission.id}`}
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
                    <p className="text-xs font-semibold tracking-wide text-rsi-text">
                      {mission.title}
                    </p>
                    {mission.contractorSlug ? (
                      <p className="mt-0.5 text-[0.65rem] text-rsi-text-muted">
                        {contractorDisplayName(mission.contractorSlug)}
                      </p>
                    ) : null}
                  </td>
                  <td className={tdClass}>{mission.rank ?? "—"}</td>
                  <td
                    className={`${tdClass} text-right font-mono text-[0.7rem] tabular-nums text-rsi-accent`}
                  >
                    {catalogRewardLabel(mission)}
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
