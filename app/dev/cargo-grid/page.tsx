"use client";

import { useEffect, useMemo, useState } from "react";
import { CargoGridSketch } from "@/components/ships/CargoGridSketch";
import {
  cargoGridSketches,
  cargoGridTotalLength,
  cargoGridZoneWidth,
  c2HerculesCargoGridSketch,
  type ShipCargoGridSketch,
} from "@/lib/ships/cargoGrids";
import {
  cargoGridCellAt,
  formatCargoGridCoord,
  suggestCargoGridCoords,
  type CargoGridCoord,
} from "@/lib/ships/cargoGridCoords";

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** Keep small footprints (Mk V) readable at a similar visual scale to C2. */
function suggestedCellPx(sketch: ShipCargoGridSketch): number {
  const length = Math.max(cargoGridTotalLength(sketch), 1);
  const width = Math.max(sketch.widthCells, 1);
  const byLength = Math.round(520 / length);
  const byWidth = Math.round(200 / width);
  return clampInt(Math.min(byLength, byWidth), 16, 40);
}

function zoneLength(
  sketch: ShipCargoGridSketch,
  id: string,
  fallback: number,
): number {
  return sketch.zones.find((zone) => zone.id === id)?.lengthCells ?? fallback;
}

function zoneWidthOr(
  sketch: ShipCargoGridSketch,
  id: string,
  fallback: number,
): number {
  const zone = sketch.zones.find((entry) => entry.id === id);
  if (!zone) return fallback;
  return cargoGridZoneWidth(sketch, zone);
}

function gapLengthOf(sketch: ShipCargoGridSketch): number {
  return sketch.zones.find((zone) => zone.kind === "gap")?.lengthCells ?? 0;
}

function CoordInspector({
  sketch,
  coord,
}: {
  sketch: ShipCargoGridSketch;
  coord: CargoGridCoord;
}) {
  const cell = cargoGridCellAt(sketch, coord);
  const sample = suggestCargoGridCoords(sketch, 4, {
    prefer: cell?.storageLocation ?? undefined,
  });

  return (
    <div className="mt-4 rounded-rsi border border-rsi-border bg-rsi-bg-deep/40 p-3 font-mono text-sm text-rsi-text-secondary">
      <p className="text-[0.65rem] uppercase tracking-[0.16em] text-rsi-text-muted">
        Assignment target
      </p>
      <p className="mt-1 tabular-nums text-rsi-text">
        {formatCargoGridCoord(coord)}
        {cell?.storageLocation ? ` · ${cell.storageLocation}` : ""}
        {cell ? ` · ${cell.zoneId}` : " · invalid"}
      </p>
      <p className="mt-2 text-[0.65rem] uppercase tracking-[0.14em] text-rsi-text-muted">
        Sample pack hint (4 SCU
        {cell?.storageLocation ? `, prefer ${cell.storageLocation}` : ""})
      </p>
      <p className="mt-1 tabular-nums text-rsi-text">
        {sample.map(formatCargoGridCoord).join(" · ") || "none"}
      </p>
    </div>
  );
}

export default function CargoGridDevPage() {
  const [shipSlug, setShipSlug] = useState(c2HerculesCargoGridSketch.shipSlug);
  const base =
    cargoGridSketches.find((sketch) => sketch.shipSlug === shipSlug) ??
    c2HerculesCargoGridSketch;

  const [heightCells, setHeightCells] = useState(base.heightCells);
  const [forwardWidth, setForwardWidth] = useState(
    zoneWidthOr(base, "forward", zoneWidthOr(base, "hold", base.widthCells)),
  );
  const [forwardLength, setForwardLength] = useState(
    zoneLength(base, "forward", zoneLength(base, "hold", 2)),
  );
  const [gapLength, setGapLength] = useState(gapLengthOf(base));
  const [rearWidth, setRearWidth] = useState(
    zoneWidthOr(base, "rear", base.widthCells),
  );
  const [rearLength, setRearLength] = useState(zoneLength(base, "rear", 0));
  const [cellPx, setCellPx] = useState(() => suggestedCellPx(base));
  const [selectedCoord, setSelectedCoord] = useState<CargoGridCoord | null>(
    null,
  );

  function selectShip(nextSlug: string) {
    const next =
      cargoGridSketches.find((sketch) => sketch.shipSlug === nextSlug) ??
      c2HerculesCargoGridSketch;
    setShipSlug(next.shipSlug);
    setHeightCells(next.heightCells);
    setForwardWidth(
      zoneWidthOr(next, "forward", zoneWidthOr(next, "hold", next.widthCells)),
    );
    setForwardLength(
      zoneLength(next, "forward", zoneLength(next, "hold", 2)),
    );
    setGapLength(gapLengthOf(next));
    setRearWidth(zoneWidthOr(next, "rear", next.widthCells));
    setRearLength(zoneLength(next, "rear", 0));
    setCellPx(suggestedCellPx(next));
    setSelectedCoord(null);
  }

  const sketch: ShipCargoGridSketch = useMemo(() => {
    const height = clampInt(heightCells, 1, 32);
    const frontW = clampInt(forwardWidth, 1, 24);
    const forward = clampInt(forwardLength, 1, 60);
    const gap = clampInt(gapLength, 0, 40);
    const backW = clampInt(rearWidth, 1, 24);
    const rear = clampInt(rearLength, 0, 60);
    const maxWidth = Math.max(frontW, rear > 0 ? backW : frontW);

    const zones: ShipCargoGridSketch["zones"] = [
      {
        id: rear > 0 ? "forward" : "hold",
        label: rear > 0 ? "Front bay" : "Bay",
        lengthCells: forward,
        widthCells: frontW,
        kind: "cargo",
        storageLocation: rear > 0 ? "front" : "middle",
      },
    ];
    if (gap > 0) {
      zones.push({
        id: "mid-gap",
        label: "Gap",
        lengthCells: gap,
        widthCells: maxWidth,
        kind: "gap",
      });
    }
    if (rear > 0) {
      zones.push({
        id: "rear",
        label: "Back bay",
        lengthCells: rear,
        widthCells: backW,
        kind: "cargo",
        storageLocation: "rear",
      });
    }

    return {
      shipSlug: base.shipSlug,
      shipName: base.shipName,
      widthCells: maxWidth,
      heightCells: height,
      zones,
      notes: [],
    };
  }, [
    base.shipName,
    base.shipSlug,
    forwardLength,
    forwardWidth,
    gapLength,
    heightCells,
    rearLength,
    rearWidth,
  ]);

  useEffect(() => {
    if (selectedCoord && !cargoGridCellAt(sketch, selectedCoord)) {
      setSelectedCoord(null);
    }
  }, [sketch, selectedCoord]);

  const fieldClass =
    "w-20 rounded-rsi border border-rsi-border bg-rsi-bg-deep/70 px-2 py-1.5 font-mono text-sm tabular-nums text-rsi-text";

  return (
    <main className="min-h-dvh bg-rsi-bg px-4 py-8 text-rsi-text sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div>
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-rsi-text-muted">
            Dev · layout workshop
          </p>
          <h1 className="mt-1 text-2xl font-medium tracking-wide">
            Ship cargo grid
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-rsi-text-secondary">
            Working sketches per ship. Click a cell for its X/Y/Z address
            (assignment target for pickup / delivery hints).
          </p>
        </div>

        <section className="rounded-rsi border border-rsi-border bg-rsi-surface/90 p-4 shadow-rsi-panel sm:p-5">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-rsi-text-muted">
            Ship
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {cargoGridSketches.map((option) => {
              const isActive = option.shipSlug === shipSlug;
              return (
                <button
                  key={option.shipSlug}
                  type="button"
                  onClick={() => {
                    selectShip(option.shipSlug);
                  }}
                  className={[
                    "rounded-rsi border px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-[0.14em] transition-colors",
                    isActive
                      ? "border-rsi-accent/50 bg-rsi-accent-muted text-rsi-accent"
                      : "border-rsi-border bg-rsi-bg-deep/60 text-rsi-text-secondary hover:border-rsi-border-strong hover:text-rsi-text",
                  ].join(" ")}
                >
                  {option.shipName}
                </button>
              );
            })}
          </div>

          <p className="mt-5 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-rsi-text-muted">
            Dimensions (1 SCU cells)
          </p>
          <div className="mt-3 flex flex-wrap gap-4">
            <label className="flex flex-col gap-1 text-xs text-rsi-text-secondary">
              Front / bay width
              <input
                type="number"
                min={1}
                max={24}
                value={forwardWidth}
                onChange={(event) => {
                  setForwardWidth(Number(event.target.value));
                }}
                className={fieldClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-rsi-text-secondary">
              Front / bay length
              <input
                type="number"
                min={1}
                max={60}
                value={forwardLength}
                onChange={(event) => {
                  setForwardLength(Number(event.target.value));
                }}
                className={fieldClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-rsi-text-secondary">
              Mid gap
              <input
                type="number"
                min={0}
                max={40}
                value={gapLength}
                onChange={(event) => {
                  setGapLength(Number(event.target.value));
                }}
                className={fieldClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-rsi-text-secondary">
              Back width
              <input
                type="number"
                min={1}
                max={24}
                value={rearWidth}
                onChange={(event) => {
                  setRearWidth(Number(event.target.value));
                }}
                className={fieldClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-rsi-text-secondary">
              Back length
              <input
                type="number"
                min={0}
                max={60}
                value={rearLength}
                onChange={(event) => {
                  setRearLength(Number(event.target.value));
                }}
                className={fieldClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-rsi-text-secondary">
              Height
              <input
                type="number"
                min={1}
                max={32}
                value={heightCells}
                onChange={(event) => {
                  setHeightCells(Number(event.target.value));
                }}
                className={fieldClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-rsi-text-secondary">
              Cell px
              <input
                type="number"
                min={10}
                max={40}
                value={cellPx}
                onChange={(event) => {
                  setCellPx(Number(event.target.value));
                }}
                className={fieldClass}
              />
            </label>
          </div>
        </section>

        <section className="rounded-rsi border border-rsi-border bg-rsi-surface/90 p-4 shadow-rsi-panel sm:p-5">
          <CargoGridSketch
            sketch={sketch}
            cellPx={clampInt(cellPx, 10, 40)}
            selectedCoord={selectedCoord}
            onSelectCoord={setSelectedCoord}
          />
          {selectedCoord ? (
            <CoordInspector sketch={sketch} coord={selectedCoord} />
          ) : null}
        </section>
      </div>
    </main>
  );
}
