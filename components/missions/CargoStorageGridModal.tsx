"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CargoGridSketch,
  type CargoGridViewTab,
} from "@/components/ships/CargoGridSketch";
import { Button } from "@/components/ui/Button";
import {
  placeCargoInZone,
  planStopOccupancyAtStop,
  placementPlanLegend,
  placementPlanTints,
  type CargoPlacementSegment,
} from "@/lib/ships/cargoGridPlacement";
import { getCargoGridSketchBySlug } from "@/lib/ships/cargoGrids";
import type { HaulingChecklistRow } from "@/lib/missions/mockSession";

export type CargoStorageGridModalProps = {
  open: boolean;
  onClose: () => void;
  shipSlug: string | null;
  locationLabel: string;
  /** Fallback segments when checklist rows are unavailable. */
  segments?: CargoPlacementSegment[];
  /** Full checklist — used so cell coords stay unique across pickups/deliveries. */
  rows?: HaulingChecklistRow[];
  rowId?: string | null;
  /** Commodity to emphasize when opening (others start dimmed if set). */
  focusCommoditySlug?: string | null;
};

export function CargoStorageGridModal({
  open,
  onClose,
  shipSlug,
  locationLabel,
  segments = [],
  rows = [],
  rowId = null,
  focusCommoditySlug = null,
}: CargoStorageGridModalProps) {
  const sketch = useMemo(
    () => getCargoGridSketchBySlug(shipSlug),
    [shipSlug],
  );

  const plan = useMemo(() => {
    if (!sketch) return null;
    if (rows.length > 0 && rowId) {
      return planStopOccupancyAtStop(sketch, rows, rowId);
    }
    if (segments.length === 0) return null;
    // Dev / story fallback: pack segments into front bay only.
    return placeCargoInZone(sketch, "front", segments);
  }, [sketch, segments, rows, rowId]);

  const placementTints = useMemo(
    () => (plan ? placementPlanTints(plan) : []),
    [plan],
  );
  const legendItems = useMemo(
    () => (plan ? placementPlanLegend(plan) : []),
    [plan],
  );
  const [viewTab, setViewTab] = useState<CargoGridViewTab>("top");
  const showViewTabs = Boolean(sketch && plan);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) setViewTab("top");
  }, [open, rowId]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-rsi-bg-deep/80 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Cargo grid · ${locationLabel}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex h-[100dvh] w-full max-w-5xl flex-col overflow-hidden border-rsi-border bg-rsi-surface shadow-rsi-panel sm:h-auto sm:max-h-[90vh] sm:rounded-rsi sm:border">
        <header className="relative shrink-0 border-b border-rsi-divider px-4 py-3 pr-14 sm:px-5 sm:py-4 sm:pr-16">
          <div className="min-w-0">
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-rsi-accent">
              Storage grid
            </p>
            <h2 className="truncate text-base font-semibold tracking-wide text-rsi-text sm:text-lg">
              {locationLabel}
            </h2>
            <p className="mt-0.5 text-sm text-rsi-text-secondary">
              {sketch?.shipName ?? "No cargo grid for this ship"}
            </p>
          </div>
          {showViewTabs ? (
            <div
              role="tablist"
              aria-label="Cargo grid projection"
              className="mt-3 inline-flex w-fit rounded-rsi border border-rsi-border bg-rsi-bg-deep/60 p-0.5"
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
          <Button
            variant="ghost"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-2 right-2 size-11 px-0 text-3xl leading-none sm:top-3 sm:right-3 sm:size-12 sm:text-4xl"
          >
            ×
          </Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {!sketch ? (
            <p className="text-sm text-rsi-text-muted">
              Select a ship with a known cargo grid (C2 or Mk V Centaurus) to
              see precise bay coordinates.
            </p>
          ) : plan ? (
            <CargoGridSketch
              sketch={sketch}
              cellPx={16}
              isoCellPx={16}
              compact
              views={viewTab}
              inlineTopLegend={viewTab === "top"}
              placementTints={placementTints}
              placementBoxes={plan.boxes}
              legendItems={legendItems}
              focusCommoditySlug={focusCommoditySlug}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
