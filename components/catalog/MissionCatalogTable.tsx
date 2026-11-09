"use client";

import { useState } from "react";
import type { CatalogMission } from "@/db/schema";
import {
  catalogCargoSummary,
  catalogRewardLabel,
  catalogRouteSummary,
  contractorDisplayName,
  locationDisplayName,
} from "@/lib/missions/catalogMissionDisplay";
import { screenshotUrlFromLogicalPath } from "@/lib/missions/catalogScreenshotUrl";

export type MissionCatalogTableProps = {
  missions: CatalogMission[];
  selectedId?: string | null;
  onSelect: (mission: CatalogMission) => void;
  onViewSource?: (mission: CatalogMission) => void;
  onViewObject?: (mission: CatalogMission) => void;
};

const actionBtnClass = [
  "rounded-rsi border px-2.5 py-1.5 font-mono text-[0.6rem] uppercase tracking-[0.16em] transition-colors",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
].join(" ");

const actionBtnEnabled =
  "border-rsi-border bg-rsi-surface text-rsi-text-secondary hover:border-rsi-accent/50 hover:text-rsi-accent";

const actionBtnDisabled =
  "cursor-not-allowed border-rsi-border/50 text-rsi-text-muted opacity-50";

const thClass =
  "px-3 py-3 text-left font-mono text-[0.65rem] font-medium uppercase tracking-[0.18em] text-rsi-text-muted sm:px-4";

const tdClass = "px-3 py-3 align-top text-sm text-rsi-text-secondary sm:px-4";

export function MissionCatalogTable({
  missions,
  selectedId = null,
  onSelect,
  onViewSource,
  onViewObject,
}: MissionCatalogTableProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
      <table className="w-full min-w-[64rem] border-collapse text-left">
        <thead>
          <tr className="border-b border-rsi-divider bg-rsi-bg-deep/50">
            <th scope="col" className={thClass}>
              ID
            </th>
            <th scope="col" className={`${thClass} min-w-[20rem] w-[28%]`}>
              Title
            </th>
            <th
              scope="col"
              className={`${thClass} text-right tabular-nums`}
            >
              Reward
            </th>
            <th
              scope="col"
              className={`${thClass} text-right tabular-nums`}
            >
              SCU
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
            <th scope="col" className={thClass}>
              Actions
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
                  <button
                    type="button"
                    title={isCopied ? "Copied" : `Copy ${mission.id}`}
                    aria-label={`Copy mission ID ${mission.id}`}
                    onClick={() => void copyMissionId(mission.id)}
                    className={[
                      "rounded-rsi font-mono text-[0.7rem] tabular-nums transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
                      isCopied
                        ? "text-rsi-accent"
                        : "text-rsi-text-muted hover:text-rsi-accent",
                    ].join(" ")}
                  >
                    {isCopied ? "Copied" : mission.id.slice(0, 8)}
                  </button>
                </td>
                <td
                  className={`${tdClass} min-w-[20rem] w-[28%] cursor-pointer`}
                  onClick={() => onSelect(mission)}
                >
                  <p className="font-semibold tracking-wide text-rsi-text">
                    {mission.title}
                  </p>
                  {mission.contractorSlug ? (
                    <p className="mt-0.5 text-xs text-rsi-text-muted">
                      {contractorDisplayName(mission.contractorSlug)}
                    </p>
                  ) : null}
                </td>
                <td
                  className={`${tdClass} text-right font-mono text-[0.8rem] tabular-nums text-rsi-accent`}
                >
                  {catalogRewardLabel(mission)}
                </td>
                <td
                  className={`${tdClass} text-right font-mono text-[0.8rem] tabular-nums text-rsi-text`}
                >
                  {mission.scuTotal}
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
                <td className={tdClass}>
                  <span className="line-clamp-2">
                    {catalogCargoSummary(mission)}
                  </span>
                </td>
                <td className={tdClass}>
                  <div className="flex flex-wrap gap-2">
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
                        actionBtnClass,
                        sourceUrl ? actionBtnEnabled : actionBtnDisabled,
                      ].join(" ")}
                    >
                      View source
                    </button>
                    <button
                      type="button"
                      title="View stored catalog JSON"
                      aria-label="View object"
                      onClick={() => onViewObject?.(mission)}
                      className={`${actionBtnClass} ${actionBtnEnabled}`}
                    >
                      View object
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
