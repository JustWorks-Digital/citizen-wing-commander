"use client";

import { useState } from "react";
import {
  cargoGridCargoLength,
  cargoGridMaxWidth,
  cargoGridTotalLength,
  cargoGridTotalScu,
  cargoGridZoneScu,
  cargoGridZoneWidth,
  type CargoGridZone,
  type ShipCargoGridSketch,
} from "@/lib/ships/cargoGrids";
import { resolveCommodityColorHex } from "@/lib/fixtures/commodityColors";
import {
  cargoGridCoordKey,
  formatCargoGridCoord,
  type CargoGridCoord,
} from "@/lib/ships/cargoGridCoords";
import type {
  CargoGridPlacementTint,
} from "@/lib/ships/cargoGridPlacement";
import {
  CargoGridIsoView,
  type CargoGridIsoLegendItem,
} from "./CargoGridIsoView";

export type CargoGridSketchProps = {
  sketch: ShipCargoGridSketch;
  /** Highlight cell size in px for the overhead map. */
  cellPx?: number;
  /** Isometric cell size for the 3D view. */
  isoCellPx?: number;
  /** Currently selected cell (for assignment / inspection). */
  selectedCoord?: CargoGridCoord | null;
  onSelectCoord?: (coord: CargoGridCoord | null) => void;
  /** Placement / suggestion cells to emphasize (any Z). */
  highlightedCoords?: CargoGridCoord[];
  /** Per-cell commodity colors for placement view. */
  placementTints?: CargoGridPlacementTint[];
  legendItems?: CargoGridIsoLegendItem[];
  /** Hide sketch chrome when embedded in a placement modal. */
  compact?: boolean;
};

const CARGO_ZONE_FILL = [
  "bg-rsi-accent/20 border-rsi-accent/60",
  "bg-rsi-warn/15 border-rsi-warn/50",
  "bg-rsi-success/15 border-rsi-success/50",
] as const;

function zoneFillClass(zone: CargoGridZone, cargoIndex: number): string {
  if (zone.kind === "gap") {
    return "border-dashed border-rsi-border-strong bg-rsi-bg/50";
  }
  return CARGO_ZONE_FILL[cargoIndex % CARGO_ZONE_FILL.length] ?? CARGO_ZONE_FILL[0];
}

/**
 * Cargo-grid sketch: top (overhead) + 3D isometric stacked cubes.
 * Click a cell to select its X/Y/Z address for cargo assignment.
 */
export function CargoGridSketch({
  sketch,
  cellPx = 20,
  isoCellPx = 12,
  selectedCoord = null,
  onSelectCoord,
  highlightedCoords = [],
  placementTints = [],
  legendItems,
  compact = false,
}: CargoGridSketchProps) {
  const totalLength = cargoGridTotalLength(sketch);
  const cargoLength = cargoGridCargoLength(sketch);
  const totalScu = cargoGridTotalScu(sketch);
  const maxWidth = cargoGridMaxWidth(sketch);
  const [activeZ, setActiveZ] = useState(0);
  let cargoIndex = 0;
  let lengthOffset = 0;

  const z = Math.min(Math.max(activeZ, 0), sketch.heightCells - 1);
  const tintByKey = new Map(
    placementTints.map((tint) => [cargoGridCoordKey(tint.coord), tint]),
  );
  const highlightKeys = new Set(
    placementTints.length > 0
      ? placementTints.map((tint) => cargoGridCoordKey(tint.coord))
      : highlightedCoords.map((coord) => cargoGridCoordKey(coord)),
  );
  const highlightXY = new Set(
    [...highlightKeys].map((key) => {
      const [x, y] = key.split(",");
      return `${x},${y}`;
    }),
  );
  const isPlacementView =
    compact && (highlightedCoords.length > 0 || placementTints.length > 0);

  function selectCell(coord: CargoGridCoord) {
    if (!onSelectCoord) return;
    if (
      selectedCoord &&
      selectedCoord.x === coord.x &&
      selectedCoord.y === coord.y &&
      selectedCoord.z === coord.z
    ) {
      onSelectCoord(null);
      return;
    }
    onSelectCoord(coord);
  }

  return (
    <div className="flex flex-col gap-4">
      {compact ? null : (
        <>
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-rsi-text-muted">
                Cargo grid sketch
              </p>
              <h1 className="text-lg font-medium text-rsi-text">
                {sketch.shipName}
              </h1>
            </div>
            <dl className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-rsi-text-secondary">
              <div>
                <dt className="inline text-rsi-text-muted">Bay span </dt>
                <dd className="inline tabular-nums text-rsi-text">
                  {maxWidth}×{totalLength}×{sketch.heightCells}
                </dd>
              </div>
              <div>
                <dt className="inline text-rsi-text-muted">Cargo len </dt>
                <dd className="inline tabular-nums text-rsi-text">
                  {cargoLength}
                </dd>
              </div>
              <div>
                <dt className="inline text-rsi-text-muted">Total </dt>
                <dd className="inline tabular-nums text-rsi-text">
                  {totalScu} SCU
                </dd>
              </div>
            </dl>
          </header>

          <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-rsi-text-muted">
            Axes · X nose→ramp · Y port→starboard · Z deck→ceiling
          </p>
        </>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <CargoGridIsoView
            sketch={sketch}
            cellPx={isoCellPx}
            selectedCoord={selectedCoord}
            onSelectCoord={onSelectCoord}
            highlightedCoords={highlightedCoords}
            placementTints={placementTints}
            legendItems={legendItems}
            mode={isPlacementView ? "placement" : "full"}
          />

          <div className="overflow-x-auto rounded-rsi border border-rsi-border bg-rsi-bg-deep/50 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-rsi-text-muted">
                Top view · Z layer
              </p>
              <label className="flex items-center gap-2 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-rsi-text-secondary">
                Z
                <select
                  value={z}
                  onChange={(event) =>
                    setActiveZ(Number(event.target.value) || 0)
                  }
                  className="rounded-rsi border border-rsi-border bg-rsi-surface px-2 py-1 text-rsi-text"
                >
                  {Array.from({ length: sketch.heightCells }, (_, layer) => (
                    <option key={layer} value={layer}>
                      {layer}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div
              className="flex items-center"
              style={{ minHeight: maxWidth * cellPx }}
              role="img"
              aria-label={`${sketch.shipName} top-view cargo grid, ${totalScu} SCU`}
            >
              {sketch.zones.map((zone) => {
                const zoneWidth = cargoGridZoneWidth(sketch, zone);
                const yOffset = Math.floor((maxWidth - zoneWidth) / 2);
                const zoneX0 = lengthOffset;
                lengthOffset += zone.lengthCells;
                const fillClass = zoneFillClass(
                  zone,
                  zone.kind === "cargo" ? cargoIndex++ : 0,
                );
                const cells: { x: number; y: number; localIndex: number }[] =
                  [];
                for (let localY = 0; localY < zoneWidth; localY += 1) {
                  for (let localX = 0; localX < zone.lengthCells; localX += 1) {
                    cells.push({
                      x: zoneX0 + localX,
                      y: yOffset + localY,
                      localIndex: localY * zone.lengthCells + localX,
                    });
                  }
                }

                return (
                  <div
                    key={zone.id}
                    className={["relative grid border-2", fillClass].join(" ")}
                    style={{
                      gridTemplateColumns: `repeat(${zone.lengthCells}, ${cellPx}px)`,
                      gridTemplateRows: `repeat(${zoneWidth}, ${cellPx}px)`,
                    }}
                  >
                    {cells.map((cell) => {
                      const isSelected =
                        selectedCoord != null &&
                        selectedCoord.x === cell.x &&
                        selectedCoord.y === cell.y &&
                        selectedCoord.z === z;
                      const isSameColumn =
                        selectedCoord != null &&
                        selectedCoord.x === cell.x &&
                        selectedCoord.y === cell.y;
                      const coordKey = cargoGridCoordKey({
                        x: cell.x,
                        y: cell.y,
                        z,
                      });
                      const tint = tintByKey.get(coordKey);
                      const tintHex = tint
                        ? resolveCommodityColorHex(
                            tint.color,
                            tint.color2,
                            tint.commoditySlug,
                          )
                        : null;
                      const isHighlightExact = highlightKeys.has(coordKey);
                      const isHighlightColumn = highlightXY.has(
                        `${cell.x},${cell.y}`,
                      );
                      const canSelect = zone.kind === "cargo" && onSelectCoord;
                      return (
                        <button
                          key={`${zone.id}-${cell.localIndex}`}
                          type="button"
                          disabled={!canSelect}
                          title={
                            zone.kind === "gap"
                              ? "Grid break"
                              : tint
                                ? `${tint.action === "pickup" ? "Pickup · " : tint.action === "delivery" ? "Delivery · " : ""}${tint.commodityName} · ${formatCargoGridCoord({
                                    x: cell.x,
                                    y: cell.y,
                                    z,
                                  })}`
                                : formatCargoGridCoord({
                                    x: cell.x,
                                    y: cell.y,
                                    z,
                                  })
                          }
                          onClick={() =>
                            selectCell({ x: cell.x, y: cell.y, z })
                          }
                          className={[
                            "box-border border",
                            zone.kind === "gap"
                              ? "border-dashed border-rsi-border-strong/70 bg-rsi-bg-deep/40"
                              : "border-rsi-border-strong/70 bg-rsi-surface-sunken/30",
                            canSelect
                              ? "cursor-pointer hover:bg-rsi-accent/25"
                              : "cursor-default",
                            isSelected
                              ? "ring-2 ring-inset ring-rsi-accent"
                              : tint?.action === "pickup" && isHighlightExact
                                ? "ring-1 ring-inset ring-rsi-accent/50"
                                : isHighlightExact && !tint?.action
                                  ? "ring-1 ring-inset ring-rsi-accent/80"
                                  : isHighlightColumn
                                    ? ""
                                    : isSameColumn
                                      ? "bg-rsi-accent/20"
                                      : "",
                          ].join(" ")}
                          style={
                            tintHex && isHighlightExact
                              ? {
                                  backgroundColor: tintHex,
                                  ...(tint?.action === "delivery"
                                    ? {
                                        outline:
                                          "1.5px dashed color-mix(in srgb, var(--rsi-success) 75%, var(--rsi-border-strong))",
                                        outlineOffset: "-1px",
                                      }
                                    : {}),
                                }
                              : tintHex && isHighlightColumn
                                ? {
                                    backgroundColor: `color-mix(in srgb, ${tintHex} 35%, transparent)`,
                                  }
                                : undefined
                          }
                          aria-label={
                            zone.kind === "gap"
                              ? `${zone.label} grid break`
                              : formatCargoGridCoord({
                                  x: cell.x,
                                  y: cell.y,
                                  z,
                                })
                          }
                        />
                      );
                    })}
                    <span
                      className={[
                        "pointer-events-none absolute inset-0 z-10 flex items-center justify-center font-mono text-[0.65rem] uppercase tracking-[0.16em]",
                        zone.kind === "gap"
                          ? "text-rsi-text-muted"
                          : "text-rsi-text",
                      ].join(" ")}
                    >
                      <span className="rounded-sm bg-rsi-bg-deep/75 px-1.5 py-0.5">
                        {zone.label}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex justify-between font-mono text-[0.6rem] uppercase tracking-[0.14em] text-rsi-text-muted">
              <span>Nose · X0</span>
              <span>Ramp · X{Math.max(totalLength - 1, 0)}</span>
            </div>
          </div>
        </div>

        {compact ? null : (
          <aside className="min-w-[14rem] space-y-3 text-sm text-rsi-text-secondary">
            <div>
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-rsi-text-muted">
                Selected cell
              </p>
              {selectedCoord ? (
                <p className="mt-1 font-mono tabular-nums text-rsi-text">
                  {formatCargoGridCoord(selectedCoord)}
                </p>
              ) : (
                <p className="mt-1 text-rsi-text-muted">
                  Click a cargo cell to set X/Y/Z.
                </p>
              )}
            </div>
            <div>
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-rsi-text-muted">
                Sections
              </p>
              <ul className="mt-1 space-y-1">
                {sketch.zones.map((zone) => {
                  const zoneWidth = cargoGridZoneWidth(sketch, zone);
                  const scu = cargoGridZoneScu(sketch, zone);
                  return (
                    <li key={zone.id} className="tabular-nums">
                      {zone.label}
                      {zone.kind === "gap" ? " (gap)" : ""}: {zoneWidth}×
                      {zone.lengthCells}
                      {zone.kind === "cargo"
                        ? `×${sketch.heightCells} = ${scu} SCU`
                        : " · 0 SCU"}
                    </li>
                  );
                })}
              </ul>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
