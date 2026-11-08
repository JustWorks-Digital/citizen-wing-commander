"use client";

import { useEffect, useMemo } from "react";
import { CargoGridSketch } from "@/components/ships/CargoGridSketch";
import { Button } from "@/components/ui/Button";
import {
  placeCargoInZone,
  planZoneOccupancyAtStop,
  placementPlanLegend,
  placementPlanTints,
  type CargoPlacementSegment,
} from "@/lib/ships/cargoGridPlacement";
import {
  getCargoGridSketchBySlug,
  type CargoGridStorageLocation,
} from "@/lib/ships/cargoGrids";
import {
  shipStorageLocationLabels,
  type HaulingChecklistRow,
} from "@/lib/missions/mockSession";

export type CargoStorageGridModalProps = {
  open: boolean;
  onClose: () => void;
  shipSlug: string | null;
  zone: CargoGridStorageLocation;
  locationLabel: string;
  segments: CargoPlacementSegment[];
  /** Full checklist — used so cell coords stay unique across pickups/deliveries. */
  rows?: HaulingChecklistRow[];
  rowId?: string | null;
};

export function CargoStorageGridModal({
  open,
  onClose,
  shipSlug,
  zone,
  locationLabel,
  segments,
  rows = [],
  rowId = null,
}: CargoStorageGridModalProps) {
  const sketch = useMemo(
    () => getCargoGridSketchBySlug(shipSlug),
    [shipSlug],
  );

  const plan = useMemo(() => {
    if (!sketch) return null;
    if (rows.length > 0 && rowId) {
      return planZoneOccupancyAtStop(sketch, rows, rowId, zone);
    }
    return placeCargoInZone(sketch, zone, segments);
  }, [sketch, zone, segments, rows, rowId]);

  const placementTints = useMemo(
    () => (plan ? placementPlanTints(plan) : []),
    [plan],
  );
  const legendItems = useMemo(
    () => (plan ? placementPlanLegend(plan) : []),
    [plan],
  );

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const zoneLabel = shipStorageLocationLabels[zone];

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-rsi-bg-deep/80 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${zoneLabel} cargo grid`}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex h-[100dvh] w-full max-w-5xl flex-col overflow-hidden border-rsi-border bg-rsi-surface shadow-rsi-panel sm:h-auto sm:max-h-[90vh] sm:rounded-rsi sm:border">
        <header className="relative border-b border-rsi-divider px-4 py-3 pr-14 sm:px-5 sm:py-4 sm:pr-16">
          <div className="min-w-0">
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-rsi-accent">
              Storage grid · {zoneLabel}
            </p>
            <h2 className="truncate text-base font-semibold tracking-wide text-rsi-text sm:text-lg">
              {locationLabel}
            </h2>
            <p className="mt-0.5 text-sm text-rsi-text-secondary">
              {sketch?.shipName ?? "No cargo grid for this ship"}
            </p>
          </div>
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
              isoCellPx={10}
              compact
              placementTints={placementTints}
              legendItems={legendItems}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
