"use client";

import type { CatalogMission } from "@/db/schema";
import {
  catalogCargoSummary,
  catalogRewardLabel,
  catalogRouteSummary,
  locationDisplayName,
} from "@/lib/missions/catalogMissionDisplay";
import { screenshotUrlFromLogicalPath } from "@/lib/missions/catalogScreenshotUrl";

export type MissionCatalogCardProps = {
  mission: CatalogMission;
  isSelected?: boolean;
  onSelect: (mission: CatalogMission) => void;
  onViewSource?: (mission: CatalogMission) => void;
};

export function MissionCatalogCard({
  mission,
  isSelected = false,
  onSelect,
  onViewSource,
}: MissionCatalogCardProps) {
  const route = catalogRouteSummary(mission);
  const sourceUrl = screenshotUrlFromLogicalPath(mission.latestScreenshotPath);
  const fromLabel = route.from.join(" · ") || "—";
  const toLabel = route.to.join(" · ") || "—";

  return (
    <article
      className={[
        "flex flex-col rounded-rsi border bg-rsi-surface/90 shadow-rsi-panel",
        "transition-colors",
        isSelected
          ? "border-rsi-accent/70 ring-1 ring-rsi-accent/40"
          : "border-rsi-border hover:border-rsi-border-strong",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={() => onSelect(mission)}
        className="flex flex-1 flex-col px-4 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-rsi-bg"
      >
        <p className="font-mono text-[0.55rem] uppercase tracking-[0.18em] text-rsi-accent">
          {mission.type}
          {mission.offerLocationSlug ? (
            <>
              {" · "}
              {locationDisplayName(mission.offerLocationSlug)}
            </>
          ) : null}
        </p>
        <h3 className="mt-1 line-clamp-2 text-base font-semibold tracking-wide text-rsi-text">
          {mission.title}
        </h3>
        {mission.contractor ? (
          <p className="mt-1 truncate text-xs text-rsi-text-muted">
            {mission.contractor}
          </p>
        ) : null}

        <dl className="mt-3 space-y-1.5 text-sm">
          <div className="flex gap-2">
            <dt className="shrink-0 font-mono text-[0.55rem] uppercase tracking-[0.14em] text-rsi-text-muted">
              From
            </dt>
            <dd className="min-w-0 truncate text-rsi-text-secondary">{fromLabel}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 font-mono text-[0.55rem] uppercase tracking-[0.14em] text-rsi-text-muted">
              To
            </dt>
            <dd className="min-w-0 truncate text-rsi-text-secondary">{toLabel}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 font-mono text-[0.55rem] uppercase tracking-[0.14em] text-rsi-text-muted">
              Cargo
            </dt>
            <dd className="min-w-0 line-clamp-2 font-mono text-[0.8rem] tabular-nums text-rsi-text-secondary">
              {catalogCargoSummary(mission)}
            </dd>
          </div>
        </dl>

        <div className="mt-auto flex items-end justify-between gap-2 pt-4">
          <p className="font-mono text-sm tabular-nums text-rsi-accent">
            {catalogRewardLabel(mission)}
          </p>
          <p className="font-mono text-[0.65rem] tabular-nums text-rsi-text-muted">
            {mission.totalScu} SCU
          </p>
        </div>
      </button>

      <div className="border-t border-rsi-divider px-4 py-2.5">
        <button
          type="button"
          disabled={!sourceUrl}
          title={
            sourceUrl
              ? "Open contract source screenshot"
              : "No source screenshot on file"
          }
          aria-label="View source"
          onClick={() => onViewSource?.(mission)}
          className={[
            "rounded-rsi border px-2.5 py-1.5 font-mono text-[0.6rem] uppercase tracking-[0.16em] transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
            sourceUrl
              ? "border-rsi-border bg-rsi-surface text-rsi-text-secondary hover:border-rsi-accent/50 hover:text-rsi-accent"
              : "cursor-not-allowed border-rsi-border/50 text-rsi-text-muted opacity-50",
          ].join(" ")}
        >
          View source
        </button>
      </div>
    </article>
  );
}
