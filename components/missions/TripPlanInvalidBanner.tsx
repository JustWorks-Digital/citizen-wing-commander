"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { getLocationBySlug } from "@/lib/fixtures";
import type { TripCargoIssue } from "@/lib/missions/tripPlan";

export type TripPlanInvalidBannerProps = {
  issues: TripCargoIssue[];
  isRepairing?: boolean;
  repairError?: string | null;
  onRepair: () => void;
};

function locationLabel(slug: string): string {
  return getLocationBySlug(slug)?.name ?? slug;
}

function issueCargoLine(issue: TripCargoIssue): string {
  return `${issue.shortfallScu} SCU ${issue.missing.commoditySlug}`;
}

/** Prefer “Stop 1” over raw checklist ids like `leg-1`. */
function stopLabel(stopId: string): string {
  const match = stopId.trim().match(/^(?:leg|stop)-(\d+)$/i);
  if (match?.[1]) return `Stop ${match[1]}`;
  return stopId;
}

/** Warn that the planned route delivers cargo before it can be aboard. */
export function TripPlanInvalidBanner({
  issues,
  isRepairing = false,
  repairError = null,
  onRepair,
}: TripPlanInvalidBannerProps) {
  const first = issues[0];
  const summary = first
    ? `${locationLabel(first.locationSlug)}: need ${issueCargoLine(first)} not yet aboard`
    : "A stop delivers cargo that is not aboard yet.";

  const issuesByStop = useMemo(() => {
    const groups: Array<{
      stopId: string;
      locationSlug: string;
      issues: TripCargoIssue[];
    }> = [];
    const indexByStop = new Map<string, number>();
    for (const issue of issues) {
      const existing = indexByStop.get(issue.stopId);
      if (existing === undefined) {
        indexByStop.set(issue.stopId, groups.length);
        groups.push({
          stopId: issue.stopId,
          locationSlug: issue.locationSlug,
          issues: [issue],
        });
      } else {
        groups[existing]!.issues.push(issue);
      }
    }
    return groups;
  }, [issues]);

  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-rsi border border-rsi-warn/40 bg-rsi-warn/10 px-3 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-4"
    >
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-rsi-warn">
          Invalid trip plan
        </p>
        <p className="mt-1 text-sm text-rsi-text">
          This route schedules a drop-off before the cargo can be on the ship.
        </p>
        <p className="mt-1 truncate text-xs text-rsi-text-muted" title={summary}>
          {summary}
          {issues.length > 1
            ? ` · ${issues.length} issues across ${issuesByStop.length} stops`
            : ""}
        </p>
        {issues.length > 0 ? (
          <details className="mt-2 group">
            <summary className="cursor-pointer list-none font-mono text-[0.65rem] uppercase tracking-[0.14em] text-rsi-text-muted transition-colors hover:text-rsi-accent [&::-webkit-details-marker]:hidden">
              <span className="underline decoration-rsi-border underline-offset-2 group-open:text-rsi-accent">
                View details
              </span>
              <span className="ml-1 text-rsi-text-muted">
                ({issues.length})
              </span>
            </summary>
            <div className="mt-2 max-h-72 space-y-3 overflow-y-auto overscroll-contain border-t border-rsi-warn/25 pt-2 pr-1 text-xs leading-snug text-rsi-text-secondary [scrollbar-gutter:stable]">
              {issuesByStop.map((group) => (
                <div key={group.stopId}>
                  <p className="font-mono text-[0.55rem] uppercase tracking-[0.12em] text-rsi-text-muted">
                    {stopLabel(group.stopId)}
                    <span className="mx-1.5 text-rsi-border">·</span>
                    <span className="normal-case tracking-normal text-rsi-text-secondary">
                      {locationLabel(group.locationSlug)}
                    </span>
                  </p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4">
                    {group.issues.map((issue, index) => (
                      <li
                        key={`${issue.stopId}:${issue.missing.commoditySlug}:${issue.missing.missionId ?? ""}:${index}`}
                      >
                        Need {issueCargoLine(issue)} not yet aboard
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </details>
        ) : null}
        {repairError ? (
          <p className="mt-1 text-xs text-rsi-danger">{repairError}</p>
        ) : null}
      </div>
      <Button
        variant="secondary"
        className="shrink-0 px-3 py-1.5 text-[0.7rem]"
        disabled={isRepairing}
        onClick={onRepair}
      >
        {isRepairing ? "Repairing…" : "Repair route"}
      </Button>
    </div>
  );
}
