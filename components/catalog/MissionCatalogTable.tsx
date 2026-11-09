"use client";

import type { CatalogMission } from "@/db/schema";
import {
  catalogCargoSummary,
  catalogRewardLabel,
  catalogRouteSummary,
  locationDisplayName,
} from "@/lib/missions/catalogMissionDisplay";
import { screenshotUrlFromLogicalPath } from "@/lib/missions/catalogScreenshotUrl";

export type MissionCatalogTableProps = {
  missions: CatalogMission[];
  selectedId?: string | null;
  onSelect: (mission: CatalogMission) => void;
  onViewSource?: (mission: CatalogMission) => void;
};

const thClass =
  "px-3 py-3 text-left font-mono text-[0.65rem] font-medium uppercase tracking-[0.18em] text-rsi-text-muted sm:px-4";

const tdClass = "px-3 py-3 align-top text-sm text-rsi-text-secondary sm:px-4";

export function MissionCatalogTable({
  missions,
  selectedId = null,
  onSelect,
  onViewSource,
}: MissionCatalogTableProps) {
  return (
    <div className="overflow-x-auto rounded-rsi border border-rsi-border bg-rsi-surface/90 shadow-rsi-panel">
      <table className="w-full min-w-[56rem] border-collapse text-left">
        <thead>
          <tr className="border-b border-rsi-divider bg-rsi-bg-deep/50">
            <th scope="col" className={thClass}>
              Title
            </th>
            <th scope="col" className={thClass}>
              Offer
            </th>
            <th scope="col" className={thClass}>
              From
            </th>
            <th scope="col" className={thClass}>
              To
            </th>
            <th scope="col" className={thClass}>
              Cargo
            </th>
            <th
              scope="col"
              className={`${thClass} text-right tabular-nums`}
            >
              SCU
            </th>
            <th
              scope="col"
              className={`${thClass} text-right tabular-nums`}
            >
              Reward
            </th>
            <th scope="col" className={thClass}>
              Source
            </th>
          </tr>
        </thead>
        <tbody>
          {missions.map((mission) => {
            const route = catalogRouteSummary(mission);
            const sourceUrl = screenshotUrlFromLogicalPath(
              mission.latestScreenshotPath,
            );
            const isSelected = selectedId === mission.id;
            return (
              <tr
                key={mission.id}
                className={[
                  "border-b border-rsi-divider/80 last:border-b-0",
                  "cursor-pointer transition-colors",
                  isSelected
                    ? "bg-rsi-accent/10"
                    : "hover:bg-rsi-bg-deep/40",
                ].join(" ")}
                onClick={() => onSelect(mission)}
                aria-selected={isSelected}
              >
                <td className={tdClass}>
                  <p className="font-semibold tracking-wide text-rsi-text">
                    {mission.title}
                  </p>
                  {mission.contractor ? (
                    <p className="mt-0.5 text-xs text-rsi-text-muted">
                      {mission.contractor}
                    </p>
                  ) : null}
                </td>
                <td className={tdClass}>
                  {locationDisplayName(mission.offerLocationSlug)}
                </td>
                <td className={tdClass}>
                  <span className="line-clamp-2">
                    {route.from.join(" · ") || "—"}
                  </span>
                </td>
                <td className={tdClass}>
                  <span className="line-clamp-2">
                    {route.to.join(" · ") || "—"}
                  </span>
                </td>
                <td className={`${tdClass} font-mono text-[0.8rem] tabular-nums`}>
                  <span className="line-clamp-2">
                    {catalogCargoSummary(mission)}
                  </span>
                </td>
                <td
                  className={`${tdClass} text-right font-mono text-[0.8rem] tabular-nums text-rsi-text`}
                >
                  {mission.totalScu}
                </td>
                <td
                  className={`${tdClass} text-right font-mono text-[0.8rem] tabular-nums text-rsi-accent`}
                >
                  {catalogRewardLabel(mission)}
                </td>
                <td className={tdClass} onClick={(event) => event.stopPropagation()}>
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
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
