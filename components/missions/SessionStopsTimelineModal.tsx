"use client";

import { useEffect, useId, useMemo } from "react";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { getLocationImageSrc } from "@/lib/fixtures";
import {
  formatDistanceToNext,
  type HaulingChecklistRow,
  type LegKind,
} from "@/lib/missions/mockSession";
import { buildRouteStopTimeline } from "@/lib/missions/routeStopTimeline";

export type SessionStopsTimelineModalProps = {
  open: boolean;
  rows: HaulingChecklistRow[];
  startLocationSlug?: string | null;
  onClose: () => void;
};

function legKindLabel(kind: LegKind | null): string | null {
  if (kind === "pickup") return "Pickup";
  if (kind === "delivery") return "Delivery";
  if (kind === "both") return "Pickup · Delivery";
  return null;
}

/**
 * Sticky-header Stops modal: compact route timeline with leg distances and
 * traveled / remaining / total. Density scales with stop count so typical
 * routes fit without scrolling.
 */
export function SessionStopsTimelineModal({
  open,
  rows,
  startLocationSlug = null,
  onClose,
}: SessionStopsTimelineModalProps) {
  const titleId = useId();
  const timeline = useMemo(
    () => buildRouteStopTimeline({ rows, startLocationSlug }),
    [rows, startLocationSlug],
  );
  const nodeCount = timeline.nodes.length;
  const progressRatio =
    timeline.totalStopCount > 0
      ? timeline.completedStopCount / timeline.totalStopCount
      : 0;
  /** Tighter rows as the route grows so more stops fit in one screen. */
  const isDense = nodeCount >= 8;
  const isCompact = nodeCount >= 5;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-rsi-bg-deep/85 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="relative flex max-h-[min(42rem,92vh)] w-full max-w-lg flex-col overflow-hidden rounded-rsi border border-rsi-border bg-rsi-surface shadow-rsi-panel">
        <div className="relative flex shrink-0 items-baseline gap-3 border-b border-rsi-border px-4 py-2.5 pr-12 sm:px-5 sm:pr-14">
          <ModalCloseButton label="Dismiss" onClick={onClose} />
          <div className="min-w-0">
            <p className="font-mono text-[0.55rem] uppercase tracking-[0.2em] text-rsi-accent">
              Route
            </p>
            <h2
              id={titleId}
              className="text-sm font-semibold tracking-wide text-rsi-text"
            >
              Stops
              <span className="ml-1.5 font-mono text-[0.65rem] font-normal tabular-nums tracking-wide text-rsi-text-secondary">
                - {timeline.completedStopCount}/{timeline.totalStopCount}{" "}
                complete
              </span>
            </h2>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-3 py-2 sm:px-4">
          {timeline.nodes.length === 0 ? (
            <p className="py-6 text-center text-sm text-rsi-text-muted">
              No route stops yet.
            </p>
          ) : (
            <ol
              className={[
                "flex min-h-0 w-full flex-col",
                // Share height evenly so longer routes still fill the panel.
                nodeCount >= 4 ? "flex-1" : "",
              ].join(" ")}
            >
              {timeline.nodes.map((node, index) => {
                const isLast = index === timeline.nodes.length - 1;
                const role = legKindLabel(node.legKind);
                const meta =
                  node.kind === "start"
                    ? "Start"
                    : [`#${node.stopNumber}`, role].filter(Boolean).join(" · ");
                const imageSrc = getLocationImageSrc(node.locationSlug);
                const thumbClass = isDense
                  ? "h-8 w-12"
                  : isCompact
                    ? "h-9 w-14"
                    : "h-11 w-16";
                return (
                  <li
                    key={node.id}
                    className={[
                      "relative flex min-h-0 items-center gap-2.5",
                      nodeCount >= 4 ? "flex-1" : "",
                      isDense ? "py-0.5" : isCompact ? "py-1" : "py-1.5",
                    ].join(" ")}
                  >
                    <div
                      className={[
                        "relative shrink-0 overflow-hidden rounded-md border border-rsi-border/80 bg-rsi-bg-deep/60",
                        thumbClass,
                        node.isCompleted ? "opacity-70" : "",
                        node.isNext
                          ? "ring-1 ring-rsi-accent/55"
                          : "",
                      ].join(" ")}
                    >
                      {imageSrc ? (
                        // eslint-disable-next-line @next/next/no-img-element -- fixture static assets
                        <img
                          src={imageSrc}
                          alt=""
                          className="size-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <div className="size-full bg-rsi-bg-deep/40" aria-hidden />
                      )}
                    </div>

                    <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-center gap-0.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <p
                          className={[
                            "min-w-0 truncate font-medium tracking-wide",
                            isDense ? "text-xs" : "text-sm",
                            node.isCompleted
                              ? "text-rsi-text-muted line-through"
                              : node.isNext
                                ? "text-rsi-text"
                                : "text-rsi-text-secondary",
                          ].join(" ")}
                          title={node.locationName}
                        >
                          {node.locationName}
                        </p>
                        {node.isCompleted ? (
                          <span className="shrink-0 font-mono text-[0.45rem] uppercase tracking-[0.12em] text-rsi-success">
                            Done
                          </span>
                        ) : node.isNext ? (
                          <span className="shrink-0 font-mono text-[0.45rem] uppercase tracking-[0.12em] text-rsi-accent">
                            Next
                          </span>
                        ) : node.kind === "stop" ? (
                          <span className="shrink-0 font-mono text-[0.45rem] uppercase tracking-[0.12em] text-rsi-text-muted">
                            Ahead
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate font-mono text-[0.5rem] uppercase tracking-[0.12em] text-rsi-text-muted">
                          {meta}
                        </p>
                        {!isLast ? (
                          <p className="shrink-0 font-mono text-[0.65rem] tabular-nums text-rsi-text-secondary">
                            {formatDistanceToNext(node.distanceToNext)}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <div className="shrink-0 border-t border-rsi-border bg-rsi-bg-deep/40 px-4 py-2 sm:px-5">
          {timeline.totalStopCount > 0 ? (
            <div className="mb-2">
              <p
                className={[
                  "mb-1.5 text-center font-mono text-[0.55rem] uppercase tracking-[0.16em]",
                  progressRatio >= 1
                    ? "text-rsi-success"
                    : "text-rsi-text-secondary",
                ].join(" ")}
              >
                {progressRatio >= 1
                  ? "Complete"
                  : `Progress · ${Math.round(progressRatio * 100)}%`}
              </p>
              <div
                className="h-1.5 w-full overflow-hidden rounded-full bg-rsi-bg-deep"
                role="progressbar"
                aria-label="Route stop completion"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progressRatio * 100)}
                aria-valuetext={
                  progressRatio >= 1
                    ? "Complete"
                    : `${timeline.completedStopCount} of ${timeline.totalStopCount} stops complete`
                }
              >
                <div
                  className="h-full rounded-full bg-rsi-success transition-[width] duration-300 ease-out"
                  style={{ width: `${Math.min(100, progressRatio * 100)}%` }}
                />
              </div>
            </div>
          ) : null}
          <div className="grid grid-cols-3 gap-2">
          <div>
            <p className="font-mono text-[0.45rem] uppercase tracking-[0.14em] text-rsi-text-muted">
              Traveled
            </p>
            <p className="mt-0.5 font-mono text-sm tabular-nums text-rsi-text">
              {formatDistanceToNext(timeline.traveled)}
            </p>
          </div>
          <div>
            <p className="font-mono text-[0.45rem] uppercase tracking-[0.14em] text-rsi-text-muted">
              Remaining
            </p>
            <p className="mt-0.5 font-mono text-sm tabular-nums text-rsi-text">
              {formatDistanceToNext(timeline.remaining)}
            </p>
          </div>
          <div>
            <p className="font-mono text-[0.45rem] uppercase tracking-[0.14em] text-rsi-text-muted">
              Total
            </p>
            <p className="mt-0.5 font-mono text-sm tabular-nums text-rsi-text">
              {formatDistanceToNext(timeline.total)}
            </p>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
