"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  CargoGridSketch,
  type CargoGridViewTab,
} from "@/components/ships/CargoGridSketch";
import { getLocationBySlug } from "@/lib/fixtures";
import type { HaulingChecklistRow } from "@/lib/missions/mockSession";
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
  /** Optional session stats — right of the Cargo layout title. */
  headerAside?: ReactNode;
  className?: string;
};

/**
 * Session cargo layout: ship bay grid at the focused stop (top / 3D tabs).
 */
export function CargoBayLayout({
  rows,
  shipSlug = null,
  focusedStopId = null,
  headerAside = null,
  className,
}: CargoBayLayoutProps) {
  const sketch = useMemo(
    () => getCargoGridSketchBySlug(shipSlug),
    [shipSlug],
  );
  const [viewTab, setViewTab] = useState<CargoGridViewTab>("top");
  const [packMode, setPackMode] = useState<CargoBayPackMode>(
    defaultCargoBayPackMode,
  );
  const [prioritized, setPrioritized] = useState(false);

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

  const locationLabel = activeRow
    ? (getLocationBySlug(activeRow.locationSlug)?.name ??
      activeRow.locationSlug)
    : null;
  const showViewTabs = Boolean(sketch && plan && plan.boxes.length > 0);

  return (
    <div
      className={[
        "min-w-0 overflow-hidden rounded-rsi border border-rsi-border bg-rsi-surface/90 p-4 shadow-rsi-panel",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="mb-3 min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-rsi-accent">
              Cargo layout
            </p>
            {sketch ? (
              <p className="mt-1 text-sm text-rsi-text-secondary">{sketch.shipName}</p>
            ) : null}
            {locationLabel ? (
              <p
                className={[
                  "text-sm text-rsi-text-muted",
                  sketch ? "mt-0.5" : "mt-1",
                ].join(" ")}
              >
                {locationLabel}
              </p>
            ) : null}
          </div>
          {headerAside ? (
            <div className="ml-auto min-w-0 shrink">{headerAside}</div>
          ) : null}
        </div>
        {showViewTabs ? (
          <div
            role="tablist"
            aria-label="Cargo grid projection"
            className="mt-3 inline-flex w-fit shrink-0 rounded-rsi border border-rsi-border bg-rsi-bg-deep/60 p-0.5"
          >
            {(
              [
                { id: "top", label: "Top view" },
                { id: "iso", label: "3D view" },
              ] as const
            ).map((tab) => {
              const selected = viewTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setViewTab(tab.id)}
                  className={[
                    "rounded-[calc(var(--radius-rsi)-2px)] px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-[0.14em] transition-colors",
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
        ) : null}
      </div>

      {!sketch ? (
        <p className="py-6 text-center text-sm text-rsi-text-muted">
          Select a ship with a known cargo grid to see bay placement.
        </p>
      ) : plan && plan.boxes.length > 0 ? (
        <div className="relative">
          <CargoGridSketch
            sketch={sketch}
            cellPx={14}
            isoCellPx={16}
            compact
            views={viewTab}
            inlineTopLegend={viewTab === "top"}
            placementTints={placementTints}
            placementBoxes={plan.boxes}
            legendItems={legendItems}
            locationLegendItems={locationLegendItems}
            showLocationOutlines={showLocationOutlines}
            isoToolbarBelow={
              <div
                role="group"
                aria-label="Cargo grouping"
                className="inline-flex w-fit max-w-full items-start gap-0.5 rounded-rsi border border-rsi-border bg-rsi-bg-deep/60 p-0.5"
              >
                {cargoBayPackModes.map((mode) => {
                  const selected = packMode === mode.id;
                  const showPrioritizedUnder =
                    mode.id === "by-cargo-type" && supportsPrioritized;
                  return (
                    <div
                      key={mode.id}
                      className="flex min-w-0 flex-col items-stretch"
                    >
                      <button
                        type="button"
                        aria-pressed={selected}
                        title={mode.summary}
                        onClick={() => setPackMode(mode.id)}
                        className={[
                          "rounded-[calc(var(--radius-rsi)-2px)] px-1.5 py-0.5 font-mono text-[0.5rem] uppercase tracking-[0.12em] transition-colors",
                          selected
                            ? "bg-rsi-accent-muted/50 text-rsi-accent"
                            : "text-rsi-text-muted hover:text-rsi-text",
                        ].join(" ")}
                      >
                        {mode.label}
                      </button>
                      {showPrioritizedUnder ? (
                        <button
                          type="button"
                          aria-pressed={showPrioritizedToggle && prioritized}
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
                            "mt-0.5 w-full rounded-[calc(var(--radius-rsi)-2px)] border px-1 py-px font-mono text-[0.4rem] uppercase leading-tight tracking-[0.1em] transition-colors",
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
            }
          />
          <p className="sr-only">
            Ship orientation: back (ramp) on the left, front (nose) on the
            right.
          </p>
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
}
