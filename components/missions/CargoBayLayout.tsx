"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  CargoGridSketch,
  type CargoGridViewTab,
} from "@/components/ships/CargoGridSketch";
import { getLocationBySlug } from "@/lib/fixtures";
import type { HaulingChecklistRow } from "@/lib/missions/mockSession";
import {
  planStopOccupancyAtStop,
  placementPlanLegend,
  placementPlanTints,
} from "@/lib/ships/cargoGridPlacement";
import { getCargoGridSketchBySlug } from "@/lib/ships/cargoGrids";

export type CargoBayLayoutProps = {
  rows: HaulingChecklistRow[];
  /** Active session ship — drives which cargo grid to show. */
  shipSlug?: string | null;
  /** Optional session stats — right of the Cargo layout title. */
  headerAside?: ReactNode;
  className?: string;
};

/**
 * Session cargo layout: ship bay grid at the active stop (top / 3D tabs).
 */
export function CargoBayLayout({
  rows,
  shipSlug = null,
  headerAside = null,
  className,
}: CargoBayLayoutProps) {
  const sketch = useMemo(
    () => getCargoGridSketchBySlug(shipSlug),
    [shipSlug],
  );
  const [viewTab, setViewTab] = useState<CargoGridViewTab>("top");

  const activeRow =
    rows.find((row) => !row.isCompleted) ?? rows[rows.length - 1] ?? null;

  const plan = useMemo(() => {
    if (!sketch || !activeRow) return null;
    return planStopOccupancyAtStop(sketch, rows, activeRow.id);
  }, [sketch, rows, activeRow]);

  const placementTints = useMemo(
    () => (plan ? placementPlanTints(plan) : []),
    [plan],
  );
  const legendItems = useMemo(
    () => (plan ? placementPlanLegend(plan) : []),
    [plan],
  );

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
        />
      ) : (
        <p className="py-6 text-center text-sm text-rsi-text-muted">
          {activeRow
            ? "No cargo placed at this stop yet."
            : "No route stops yet."}
        </p>
      )}
    </div>
  );
}
