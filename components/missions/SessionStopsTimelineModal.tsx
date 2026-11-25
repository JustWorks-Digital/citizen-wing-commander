"use client";

import {
  useEffect,
  useId,
  useMemo,
  useState,
  type DragEvent,
} from "react";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { getLocationImageSrc } from "@/lib/fixtures";
import { formatDistanceToNext, type HaulingChecklistRow, type RouteAction } from "@/lib/missions/sessionChecklist";

import {
  isTripStarted,
  moveStopIdBefore,
} from "@/lib/missions/reorderStops";
import { buildRouteStopTimeline } from "@/lib/missions/routeStopTimeline";

export type SessionStopsTimelineModalProps = {
  open: boolean;
  rows: HaulingChecklistRow[];
  startLocationSlug?: string | null;
  /** Synthetic start → first-stop quantum marked done (counts start distance traveled). */
  isStartCompleted?: boolean;
  onClose: () => void;
  /** Clear stop completion so the trip can be reordered again (contracts stay). */
  onResetTrip?: () => void;
  /**
   * Persist a new stop order (row ids). Only offered before the trip starts
   * (no stop completed yet). Caller should run `reorderChecklistStops`.
   */
  onReorderStops?: (orderedIds: string[]) => void;
};

function routeActionLabel(kind: RouteAction | null): string | null {
  if (kind === "pickup") return "Pickup";
  if (kind === "delivery") return "Delivery";
  if (kind === "pickup_delivery") return "Pickup · Delivery";
  return null;
}

function StopReorderHandle({
  rowId,
  onDragStart,
  onDragEnd,
}: {
  rowId: string;
  onDragStart: (event: DragEvent<HTMLButtonElement>, rowId: string) => void;
  onDragEnd: () => void;
}) {
  return (
    <button
      type="button"
      draggable
      aria-label="Drag to reorder stop"
      title="Drag to reorder"
      onClick={(event) => event.stopPropagation()}
      onDragStart={(event) => {
        event.stopPropagation();
        onDragStart(event, rowId);
      }}
      onDragEnd={(event) => {
        event.stopPropagation();
        onDragEnd();
      }}
      className="inline-flex h-7 w-4 shrink-0 cursor-grab items-center justify-center rounded-rsi text-rsi-text-muted transition-colors hover:text-rsi-text active:cursor-grabbing"
    >
      <svg
        aria-hidden
        viewBox="0 0 12 16"
        className="h-3 w-2"
        fill="currentColor"
      >
        <circle cx="3" cy="3" r="1.25" />
        <circle cx="9" cy="3" r="1.25" />
        <circle cx="3" cy="8" r="1.25" />
        <circle cx="9" cy="8" r="1.25" />
        <circle cx="3" cy="13" r="1.25" />
        <circle cx="9" cy="13" r="1.25" />
      </svg>
    </button>
  );
}

/**
 * Stops modal (from Stops rail / mobile Stops section): compact route timeline with leg distances and
 * overview (stop count / total distance). Density scales with stop count so typical
 * routes fit without scrolling. Before the trip starts, stops can be
 * drag-reordered (Save / Cancel).
 */
export function SessionStopsTimelineModal({
  open,
  rows,
  startLocationSlug = null,
  isStartCompleted = false,
  onClose,
  onResetTrip,
  onReorderStops,
}: SessionStopsTimelineModalProps) {
  const titleId = useId();
  const tripStarted = isTripStarted(rows);
  const canReorder = Boolean(onReorderStops) && !tripStarted;
  const savedOrderIds = useMemo(() => rows.map((row) => row.id), [rows]);
  const [draftOrderIds, setDraftOrderIds] = useState<string[] | null>(null);
  const [draggingStopId, setDraggingStopId] = useState<string | null>(null);
  const [dragOverStopId, setDragOverStopId] = useState<string | null>(null);

  const displayRows = useMemo(() => {
    if (!draftOrderIds) return rows;
    const byId = new Map(rows.map((row) => [row.id, row]));
    const ordered: HaulingChecklistRow[] = [];
    for (const id of draftOrderIds) {
      const row = byId.get(id);
      if (row) ordered.push(row);
    }
    if (ordered.length !== rows.length) return rows;
    return ordered;
  }, [rows, draftOrderIds]);

  const timeline = useMemo(
    () =>
      buildRouteStopTimeline({
        rows: displayRows,
        startLocationSlug,
        isStartCompleted,
      }),
    [displayRows, startLocationSlug, isStartCompleted],
  );
  const nodeCount = timeline.nodes.length;
  const progressRatio =
    timeline.totalStopCount > 0
      ? timeline.completedStopCount / timeline.totalStopCount
      : 0;
  /** Tighter rows as the route grows so more stops fit in one screen. */
  const isDense = nodeCount >= 8;
  const isCompact = nodeCount >= 5;
  const orderDirty =
    draftOrderIds != null &&
    draftOrderIds.length === savedOrderIds.length &&
    draftOrderIds.some((id, index) => id !== savedOrderIds[index]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (orderDirty) {
          setDraftOrderIds(null);
          return;
        }
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, orderDirty]);

  useEffect(() => {
    if (!open) {
      setDraftOrderIds(null);
      setDraggingStopId(null);
      setDragOverStopId(null);
    }
  }, [open]);

  useEffect(() => {
    if (tripStarted || !draftOrderIds) {
      if (draftOrderIds) setDraftOrderIds(null);
      return;
    }
    const sameIds =
      draftOrderIds.length === savedOrderIds.length &&
      draftOrderIds.every((id) => savedOrderIds.includes(id));
    if (!sameIds) setDraftOrderIds(null);
  }, [tripStarted, savedOrderIds, draftOrderIds]);

  const beginOrUpdateDraftOrder = (fromId: string, toId: string) => {
    setDraftOrderIds((current) => {
      const base = current ?? savedOrderIds;
      return moveStopIdBefore(base, fromId, toId);
    });
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-rsi-bg-deep/85 px-4 pt-14 pb-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-lg">
        <ModalCloseButton label="Dismiss" onClick={onClose} />
        <div className="flex max-h-[min(42rem,92vh)] w-full flex-col overflow-hidden rounded-rsi border border-rsi-border bg-rsi-surface shadow-rsi-panel">
        <div className="flex shrink-0 items-center gap-3 border-b border-rsi-border px-4 py-2.5 sm:px-5">
          <h2
            id={titleId}
            className="min-w-0 flex-1 text-sm font-semibold tracking-wide text-rsi-text"
          >
            Stops
          </h2>
          <div className="flex shrink-0 items-center gap-1.5">
            {orderDirty ? (
              <>
                <button
                  type="button"
                  onClick={() => setDraftOrderIds(null)}
                  className="rounded-rsi border border-rsi-border px-2.5 py-1 font-mono text-[0.55rem] uppercase tracking-[0.14em] text-rsi-text-secondary transition-colors hover:border-rsi-border-strong hover:text-rsi-text"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!draftOrderIds || !onReorderStops) return;
                    onReorderStops(draftOrderIds);
                    setDraftOrderIds(null);
                  }}
                  className="rounded-rsi border border-rsi-accent/60 bg-rsi-accent-muted/40 px-2.5 py-1 font-mono text-[0.55rem] uppercase tracking-[0.14em] text-rsi-accent transition-colors hover:bg-rsi-accent-muted/60"
                >
                  Save order
                </button>
              </>
            ) : null}
            {onResetTrip ? (
              <button
                type="button"
                onClick={onResetTrip}
                title="Reset trip — clear stop completion to unlock reorder (contracts stay)"
                className="rounded-rsi border border-rsi-border px-2.5 py-1 font-mono text-[0.55rem] uppercase tracking-[0.14em] text-rsi-text-secondary transition-colors hover:border-rsi-border-strong hover:text-rsi-text"
              >
                Reset trip
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 py-2 sm:px-5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
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
                const role = routeActionLabel(node.routeAction);
                const meta =
                  node.kind === "start"
                    ? "Start"
                    : [`#${node.stopNumber}`, role].filter(Boolean).join(" · ");
                const imageSrc = getLocationImageSrc(node.locationSlug);
                const thumbClass = isDense
                  ? "size-8"
                  : isCompact
                    ? "size-9"
                    : "size-11";
                const isStop = node.kind === "stop";
                const isDragging = isStop && draggingStopId === node.id;
                const isDragOver =
                  isStop &&
                  dragOverStopId === node.id &&
                  draggingStopId !== node.id;
                return (
                  <li
                    key={node.id}
                    onDragOver={
                      canReorder && isStop
                        ? (event) => {
                            event.preventDefault();
                            event.dataTransfer.dropEffect = "move";
                            setDragOverStopId(node.id);
                          }
                        : undefined
                    }
                    onDrop={
                      canReorder && isStop
                        ? (event) => {
                            event.preventDefault();
                            const fromId =
                              event.dataTransfer.getData("text/plain") ||
                              draggingStopId;
                            if (fromId) beginOrUpdateDraftOrder(fromId, node.id);
                            setDraggingStopId(null);
                            setDragOverStopId(null);
                          }
                        : undefined
                    }
                    className={[
                      "relative flex min-h-0 items-center gap-2",
                      nodeCount >= 4 ? "flex-1" : "",
                      isDense ? "py-0.5" : isCompact ? "py-1" : "py-1.5",
                      isDragging ? "opacity-50" : "",
                      isDragOver ? "border-t-2 border-t-rsi-accent" : "",
                    ].join(" ")}
                  >
                    {canReorder ? (
                      <div className="flex w-4 shrink-0 items-center justify-center">
                        {isStop ? (
                          <StopReorderHandle
                            rowId={node.id}
                            onDragStart={(event, id) => {
                              event.dataTransfer.effectAllowed = "move";
                              event.dataTransfer.setData("text/plain", id);
                              setDraggingStopId(id);
                              if (!draftOrderIds) {
                                setDraftOrderIds(savedOrderIds);
                              }
                            }}
                            onDragEnd={() => {
                              setDraggingStopId(null);
                              setDragOverStopId(null);
                            }}
                          />
                        ) : null}
                      </div>
                    ) : null}
                    <div
                      className={[
                        "relative shrink-0 overflow-hidden rounded-full border border-rsi-border/80 bg-rsi-bg-deep/60",
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
                        ) : null}
                      </div>
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate font-mono text-[0.5rem] uppercase tracking-[0.12em] text-rsi-text-muted">
                          {meta}
                        </p>
                        {!isLast ? (
                          <p className="shrink-0 pr-1 font-mono text-[0.65rem] tabular-nums text-rsi-text-secondary">
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
          <div className="mb-1.5 flex items-baseline justify-between gap-2 font-mono text-[0.55rem] uppercase tracking-[0.14em]">
            <p className="min-w-0 tabular-nums text-rsi-text-muted">
              Stops{" "}
              <span className="text-rsi-text">{timeline.totalStopCount}</span>
            </p>
            {timeline.totalStopCount > 0 ? (
              <p
                className={[
                  "shrink-0 text-center",
                  progressRatio >= 1
                    ? "text-rsi-success"
                    : "text-rsi-text-secondary",
                ].join(" ")}
              >
                {progressRatio >= 1
                  ? "Complete"
                  : `Progress · ${Math.round(progressRatio * 100)}%`}
              </p>
            ) : (
              <span className="shrink-0" aria-hidden />
            )}
            <p className="min-w-0 text-right tabular-nums text-rsi-text-muted">
              Total{" "}
              <span className="text-rsi-text">
                {formatDistanceToNext(timeline.total)}
              </span>
            </p>
          </div>
          {timeline.totalStopCount > 0 ? (
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
          ) : null}
        </div>
        </div>
      </div>
    </div>
  );
}
