"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  CargoGridSketch,
  type CargoGridViewTab,
} from "@/components/ships/CargoGridSketch";
import { useSessionCargoBayLayoutHeight } from "@/hooks/useSessionCargoBayLayoutHeight";
import type { HaulingChecklistRow } from "@/lib/missions/mockSession";
import {
  MAX_CARGO_BAY_LAYOUT_HEIGHT_PX,
  MIN_CARGO_BAY_LAYOUT_HEIGHT_PX,
} from "@/lib/sessions/cargoBayLayoutClientPrefs";
import {
  cargoBayPackModes,
  defaultCargoBayPackMode,
  planStopOccupancyAtStop,
  placementPlanLegend,
  placementPlanLocationLegend,
  placementPlanTints,
  upcomingDeliveryLocationSlugs,
  type CargoBayPackMode,
} from "@/lib/ships/cargoGridPlacement";
import { getCargoGridSketchBySlug } from "@/lib/ships/cargoGrids";
import { getShipBayPreferenceFixture } from "@/lib/ships/shipBayPreferences";

export type CargoBayLayoutProps = {
  rows: HaulingChecklistRow[];
  /** Active session ship — drives which cargo grid to show. */
  shipSlug?: string | null;
  /** Checklist stop to preview (completed or not). Defaults to next incomplete. */
  focusedStopId?: string | null;
  /** Session UUID — scopes browser-local layout height prefs. */
  sessionId?: string | null;
  /** Optional session stats — right of the Ship layout title. */
  headerAside?: ReactNode;
  className?: string;
};

/**
 * Session cargo layout: ship bay grid at the focused stop (top / 3D / split).
 * Memoized so modal open/close on the parent does not rebuild the grid.
 */
export const CargoBayLayout = memo(function CargoBayLayout({
  rows,
  shipSlug = null,
  focusedStopId = null,
  sessionId = null,
  headerAside = null,
  className,
}: CargoBayLayoutProps) {
  const sketch = useMemo(
    () => getCargoGridSketchBySlug(shipSlug),
    [shipSlug],
  );
  const [viewTab, setViewTab] = useState<CargoGridViewTab>("top");
  const [legendHidden, setLegendHidden] = useState(false);
  const [sortingHidden, setSortingHidden] = useState(false);
  const [packMode, setPackMode] = useState<CargoBayPackMode>(
    defaultCargoBayPackMode,
  );
  const [prioritized, setPrioritized] = useState(false);
  const { heightPx, setHeightPx, resetHeightPx } =
    useSessionCargoBayLayoutHeight(sessionId);
  const [isResizing, setIsResizing] = useState(false);
  const dragRef = useRef<{
    pointerId: number;
    startY: number;
    startHeight: number;
  } | null>(null);

  const shipBayPrefs = useMemo(
    () => getShipBayPreferenceFixture(shipSlug),
    [shipSlug],
  );
  const supportsPrioritized = Boolean(
    shipBayPrefs.missionPriorityPacking?.bias,
  );
  const showPrioritizedToggle =
    packMode === "by-cargo-type" && supportsPrioritized;

  const activeRow = useMemo(() => {
    if (focusedStopId) {
      const hit = rows.find((row) => row.id === focusedStopId);
      if (hit) return hit;
    }
    return rows.find((row) => !row.isCompleted) ?? rows[rows.length - 1] ?? null;
  }, [rows, focusedStopId]);

  const plan = useMemo(() => {
    if (!sketch || !activeRow) return null;
    return planStopOccupancyAtStop(sketch, rows, activeRow.id, {
      packMode,
      missionPrioritized:
        packMode === "by-cargo-type" && supportsPrioritized && prioritized,
    });
  }, [
    sketch,
    rows,
    activeRow,
    packMode,
    prioritized,
    supportsPrioritized,
  ]);

  const placementTints = useMemo(
    () => (plan ? placementPlanTints(plan) : []),
    [plan],
  );
  const legendItems = useMemo(
    () => (plan ? placementPlanLegend(plan) : []),
    [plan],
  );
  const locationLegendItems = useMemo(() => {
    if (!plan || !activeRow) return [];
    return placementPlanLocationLegend(plan, {
      locationOrder: upcomingDeliveryLocationSlugs(rows, activeRow.id),
    });
  }, [plan, rows, activeRow]);
  const showLocationOutlines = packMode === "by-mission-location";
  const showViewTabs = Boolean(sketch && plan && plan.boxes.length > 0);
  const showGrid = Boolean(sketch && plan && plan.boxes.length > 0);

  const onResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      dragRef.current = {
        pointerId: event.pointerId,
        startY: event.clientY,
        startHeight: heightPx,
      };
      setIsResizing(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [heightPx],
  );

  const onResizePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const delta = event.clientY - drag.startY;
      setHeightPx(drag.startHeight + delta, { persist: false });
    },
    [setHeightPx],
  );

  const endResize = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const finalHeight = drag.startHeight + (event.clientY - drag.startY);
      dragRef.current = null;
      setIsResizing(false);
      setHeightPx(finalHeight);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [setHeightPx],
  );

  useEffect(() => {
    if (!isResizing) return;
    const previous = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "ns-resize";
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.cursor = previous;
      document.body.style.userSelect = previousUserSelect;
    };
  }, [isResizing]);

  return (
    <div
      className={[
        "min-w-0 overflow-hidden rounded-rsi border border-rsi-border bg-rsi-surface/90 px-4 pt-4 shadow-rsi-panel",
        showGrid ? "pb-0" : "pb-4",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="mb-3 min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-rsi-accent">
              Ship layout
            </p>
            {sketch ? (
              <p className="mt-1 text-sm text-rsi-text-secondary">{sketch.shipName}</p>
            ) : null}
          </div>
          {headerAside ? (
            <div className="ml-auto min-w-0 shrink">{headerAside}</div>
          ) : null}
        </div>
      </div>

      {!sketch ? (
        <p className="py-6 text-center text-sm text-rsi-text-muted">
          Select a ship with a known cargo grid to see bay placement.
        </p>
      ) : showGrid ? (
        <div className="relative">
          {showViewTabs ? (
            <>
              <div className="pointer-events-none absolute top-2 right-14 left-14 z-20 flex justify-center">
                <div
                  role="tablist"
                  aria-label="Cargo grid projection"
                  className="pointer-events-auto inline-flex w-fit rounded-rsi border border-rsi-border bg-rsi-bg-deep/95 p-0.5 shadow-rsi-panel"
                >
                  {(
                    [
                      { id: "top", label: "2D" },
                      { id: "split", label: "Split" },
                      { id: "iso", label: "3D" },
                    ] as const
                  ).map((tab) => {
                    const selected = viewTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        aria-label={`${tab.label} view`}
                        onClick={() => setViewTab(tab.id)}
                        className={[
                          "rounded-[calc(var(--radius-rsi)-2px)] px-1.5 py-0.5 font-mono text-[0.5rem] uppercase tracking-[0.12em] transition-colors",
                          selected
                            ? "bg-rsi-accent-muted/50 text-rsi-accent"
                            : "text-rsi-text-muted hover:text-rsi-text",
                        ].join(" ")}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <button
                type="button"
                aria-pressed={!sortingHidden}
                aria-label={sortingHidden ? "Show sorting" : "Hide sorting"}
                onClick={() => setSortingHidden((value) => !value)}
                className={[
                  "pointer-events-auto absolute top-2 left-2 z-30 rounded-rsi border px-1.5 py-0.5 font-mono text-[0.5rem] uppercase tracking-[0.12em] shadow-rsi-panel transition-colors",
                  !sortingHidden
                    ? "border-rsi-accent/50 bg-rsi-accent-muted/40 text-rsi-accent"
                    : "border-rsi-border bg-rsi-bg-deep/95 text-rsi-text-secondary hover:border-rsi-border-strong hover:text-rsi-text",
                ].join(" ")}
              >
                Sorting
              </button>
              <button
                type="button"
                aria-pressed={!legendHidden}
                aria-label={legendHidden ? "Show legend" : "Hide legend"}
                onClick={() => setLegendHidden((value) => !value)}
                className={[
                  "pointer-events-auto absolute top-2 right-2 z-30 rounded-rsi border px-1.5 py-0.5 font-mono text-[0.5rem] uppercase tracking-[0.12em] shadow-rsi-panel transition-colors",
                  !legendHidden
                    ? "border-rsi-accent/50 bg-rsi-accent-muted/40 text-rsi-accent"
                    : "border-rsi-border bg-rsi-bg-deep/95 text-rsi-text-secondary hover:border-rsi-border-strong hover:text-rsi-text",
                ].join(" ")}
              >
                Legend
              </button>
              {!sortingHidden ? (
                <div
                  role="region"
                  aria-label="Cargo sorting"
                  className="pointer-events-auto absolute top-8 left-2 z-20 max-h-[calc(100%-3.5rem)] w-[16rem] space-y-2 overflow-y-auto overscroll-contain rounded-rsi border border-rsi-border/80 bg-rsi-bg-deep/95 px-2 py-1.5 shadow-rsi-panel"
                >
                  <p className="font-mono text-[0.55rem] uppercase tracking-[0.14em] text-rsi-text-muted">
                    Pack mode
                  </p>
                  <div
                    role="group"
                    aria-label="Cargo grouping"
                    className="flex flex-col gap-1"
                  >
                    {cargoBayPackModes.map((mode) => {
                      const selected = packMode === mode.id;
                      const showPrioritizedUnder =
                        mode.id === "by-cargo-type" && supportsPrioritized;
                      return (
                        <div key={mode.id} className="min-w-0">
                          <button
                            type="button"
                            aria-pressed={selected}
                            title={mode.summary}
                            onClick={() => setPackMode(mode.id)}
                            className={[
                              "flex w-full flex-col items-start gap-0.5 rounded-rsi border px-2 py-1.5 text-left transition-colors",
                              selected
                                ? "border-rsi-accent/50 bg-rsi-accent-muted/30 text-rsi-accent"
                                : "border-rsi-border/70 bg-rsi-bg-deep/40 text-rsi-text-secondary hover:border-rsi-border-strong hover:text-rsi-text",
                            ].join(" ")}
                          >
                            <span className="font-mono text-[0.55rem] uppercase tracking-[0.14em]">
                              {mode.label}
                            </span>
                            <span className="text-[0.65rem] leading-snug text-rsi-text-muted">
                              {mode.summary}
                            </span>
                          </button>
                          {showPrioritizedUnder ? (
                            <button
                              type="button"
                              aria-pressed={
                                showPrioritizedToggle && prioritized
                              }
                              title={
                                shipBayPrefs.missionPriorityPacking?.bias ===
                                "edges-first"
                                  ? "Early deliveries toward bay edges; later deliveries toward the center."
                                  : "Order cargo by upcoming delivery stops."
                              }
                              onClick={() => {
                                setPackMode("by-cargo-type");
                                setPrioritized((value) =>
                                  packMode === "by-cargo-type" ? !value : true,
                                );
                              }}
                              className={[
                                "mt-1 w-full rounded-rsi border px-2 py-1 font-mono text-[0.5rem] uppercase tracking-[0.12em] transition-colors",
                                showPrioritizedToggle && prioritized
                                  ? "border-rsi-accent/50 bg-rsi-accent-muted/40 text-rsi-accent"
                                  : "border-rsi-border/80 bg-rsi-bg-deep/50 text-rsi-text-muted hover:border-rsi-border-strong hover:text-rsi-text-secondary",
                              ].join(" ")}
                            >
                              Prioritized
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
          <CargoGridSketch
            sketch={sketch}
            cellPx={14}
            isoCellPx={16}
            compact
            views={viewTab}
            inlineTopLegend={viewTab === "top" || viewTab === "split"}
            hideLegend={legendHidden}
            legendToggleAbove
            panelHeightPx={heightPx}
            placementTints={placementTints}
            placementBoxes={plan!.boxes}
            legendItems={legendItems}
            locationLegendItems={locationLegendItems}
            showLocationOutlines={showLocationOutlines}
          />
          <p className="sr-only">
            Ship orientation: back (ramp) on the left, front (nose) on the
            right.
          </p>
          <div className="-mx-4 mt-2 border-t border-rsi-border/50">
            <button
              type="button"
              role="slider"
              aria-label="Ship layout height"
              aria-orientation="vertical"
              aria-valuemin={MIN_CARGO_BAY_LAYOUT_HEIGHT_PX}
              aria-valuemax={MAX_CARGO_BAY_LAYOUT_HEIGHT_PX}
              aria-valuenow={heightPx}
              title="Drag to resize · double-click to reset"
              onPointerDown={onResizePointerDown}
              onPointerMove={onResizePointerMove}
              onPointerUp={endResize}
              onPointerCancel={endResize}
              onDoubleClick={resetHeightPx}
              onKeyDown={(event) => {
                const step = event.shiftKey ? 48 : 16;
                if (event.key === "ArrowUp" || event.key === "ArrowRight") {
                  event.preventDefault();
                  setHeightPx(heightPx + step);
                } else if (
                  event.key === "ArrowDown" ||
                  event.key === "ArrowLeft"
                ) {
                  event.preventDefault();
                  setHeightPx(heightPx - step);
                } else if (event.key === "Home") {
                  event.preventDefault();
                  setHeightPx(MAX_CARGO_BAY_LAYOUT_HEIGHT_PX);
                } else if (event.key === "End") {
                  event.preventDefault();
                  setHeightPx(MIN_CARGO_BAY_LAYOUT_HEIGHT_PX);
                }
              }}
              className="group flex h-5 w-full cursor-ns-resize items-center justify-center hover:bg-rsi-bg-deep/40"
            >
              <span
                aria-hidden
                className="h-0.5 w-10 rounded-full bg-rsi-border-strong/80 group-hover:bg-rsi-accent"
              />
            </button>
          </div>
        </div>
      ) : (
        <p className="py-6 text-center text-sm text-rsi-text-muted">
          {activeRow
            ? packMode === "by-mission-location"
              ? "No upcoming delivery cargo to group by location."
              : "No cargo placed at this stop yet."
            : "No route stops yet."}
        </p>
      )}
    </div>
  );
});
