"use client";

import { useMemo, useState } from "react";
import { resolveCommodityColorHex } from "@/lib/fixtures/commodityColors";
import {
  cargoGridMaxWidth,
  cargoGridTotalLength,
  cargoGridZoneWidth,
  type ShipCargoGridSketch,
} from "@/lib/ships/cargoGrids";
import {
  cargoGridCoordKey,
  formatCargoGridCoord,
  sameCargoGridCoord,
  type CargoGridCoord,
} from "@/lib/ships/cargoGridCoords";
import type { CargoGridPlacementTint } from "@/lib/ships/cargoGridPlacement";

export type CargoGridIsoLegendItem = {
  commoditySlug: string;
  commodityName: string;
  color: string | null;
  color2: string | null;
  scu?: number;
};

export type CargoGridIsoViewProps = {
  sketch: ShipCargoGridSketch;
  /** Isometric cell edge in px. */
  cellPx?: number;
  selectedCoord?: CargoGridCoord | null;
  onSelectCoord?: (coord: CargoGridCoord | null) => void;
  highlightedCoords?: CargoGridCoord[];
  /** Per-cell commodity colors (placement mode). */
  placementTints?: CargoGridPlacementTint[];
  /** Legend entries (top-right); derived from tints when omitted. */
  legendItems?: CargoGridIsoLegendItem[];
  /**
   * `placement`: keep only the Z=0 floor grid + cubes for highlighted cargo.
   * Empty upper cells are omitted.
   */
  mode?: "full" | "placement";
};

type CubeFaceColors = { top: string; left: string; right: string };

function facesFromCommodityHex(hex: string): CubeFaceColors {
  return {
    top: hex,
    left: `color-mix(in srgb, ${hex} 55%, black)`,
    right: `color-mix(in srgb, ${hex} 68%, black)`,
  };
}

const FALLBACK_PLACEMENT_HEX = "#54a0f7";

type IsoCube = {
  key: string;
  coord: CargoGridCoord;
  lx: number;
  wy: number;
  hz: number;
  zoneId: string;
  /** floor = deck pad; cargo = placed crate; placeholder = hidden support under stacked cargo */
  kind: "floor" | "cargo" | "placeholder";
};

const ZONE_FACE = [
  {
    top: "color-mix(in srgb, var(--rsi-accent) 45%, var(--rsi-surface))",
    left: "color-mix(in srgb, var(--rsi-accent) 28%, var(--rsi-bg-deep))",
    right: "color-mix(in srgb, var(--rsi-accent) 35%, var(--rsi-bg))",
  },
  {
    top: "color-mix(in srgb, var(--rsi-warn) 40%, var(--rsi-surface))",
    left: "color-mix(in srgb, var(--rsi-warn) 24%, var(--rsi-bg-deep))",
    right: "color-mix(in srgb, var(--rsi-warn) 30%, var(--rsi-bg))",
  },
] as const;

const SELECTED_FACE: CubeFaceColors = {
  top: "color-mix(in srgb, var(--rsi-accent) 75%, white)",
  left: "color-mix(in srgb, var(--rsi-accent) 55%, var(--rsi-bg-deep))",
  right: "color-mix(in srgb, var(--rsi-accent) 65%, var(--rsi-bg))",
};

const HIGHLIGHT_FACE: CubeFaceColors = {
  top: "color-mix(in srgb, var(--rsi-accent) 65%, white)",
  left: "color-mix(in srgb, var(--rsi-accent) 45%, var(--rsi-bg-deep))",
  right: "color-mix(in srgb, var(--rsi-accent) 55%, var(--rsi-bg))",
};

const FLOOR_FACE: CubeFaceColors = {
  top: "color-mix(in srgb, var(--rsi-surface) 70%, var(--rsi-bg-deep))",
  left: "color-mix(in srgb, var(--rsi-bg-deep) 80%, black)",
  right: "color-mix(in srgb, var(--rsi-bg) 75%, black)",
};

/** Ghost crates under elevated cargo when lower stock is filtered out. */
const PLACEHOLDER_FACE: CubeFaceColors = {
  top: "color-mix(in srgb, var(--rsi-text-muted) 28%, var(--rsi-bg-deep))",
  left: "color-mix(in srgb, var(--rsi-text-muted) 18%, var(--rsi-bg-deep))",
  right: "color-mix(in srgb, var(--rsi-text-muted) 22%, var(--rsi-bg-deep))",
};

function kindSortRank(kind: IsoCube["kind"]): number {
  if (kind === "floor") return 0;
  if (kind === "placeholder") return 1;
  return 2;
}

function project(lx: number, wy: number, hz: number, size: number) {
  const cos = Math.cos(Math.PI / 6);
  const sin = Math.sin(Math.PI / 6);
  return {
    x: (lx - wy) * size * cos,
    y: (lx + wy) * size * sin - hz * size,
  };
}

function cubeFaces(lx: number, wy: number, hz: number, size: number) {
  const p = (x: number, y: number, z: number) => project(x, y, z, size);
  const a = p(lx, wy, hz + 1);
  const b = p(lx + 1, wy, hz + 1);
  const c = p(lx + 1, wy + 1, hz + 1);
  const d = p(lx, wy + 1, hz + 1);
  const e = p(lx, wy, hz);
  const f = p(lx + 1, wy, hz);
  const g = p(lx + 1, wy + 1, hz);
  const h = p(lx, wy + 1, hz);
  return {
    top: `${a.x},${a.y} ${b.x},${b.y} ${c.x},${c.y} ${d.x},${d.y}`,
    // South face (+Y) — left side of the iso cube
    left: `${d.x},${d.y} ${c.x},${c.y} ${g.x},${g.y} ${h.x},${h.y}`,
    // East face (+X) — right side toward ramp / bay gap (must be solid, not open)
    right: `${b.x},${b.y} ${c.x},${c.y} ${g.x},${g.y} ${f.x},${f.y}`,
  };
}

/** Deck tile on Z=0 — top face only. */
function floorFaces(lx: number, wy: number, size: number) {
  const p = (x: number, y: number, z: number) => project(x, y, z, size);
  const a = p(lx, wy, 0);
  const b = p(lx + 1, wy, 0);
  const c = p(lx + 1, wy + 1, 0);
  const d = p(lx, wy + 1, 0);
  const top = `${a.x},${a.y} ${b.x},${b.y} ${c.x},${c.y} ${d.x},${d.y}`;
  return { top, left: top, right: top };
}

function buildCubes(
  sketch: ShipCargoGridSketch,
  mode: "full" | "placement",
  highlightKeys: Set<string>,
): IsoCube[] {
  const maxWidth = cargoGridMaxWidth(sketch);
  const cubes: IsoCube[] = [];
  let lengthOffset = 0;

  for (const zone of sketch.zones) {
    const zoneWidth = cargoGridZoneWidth(sketch, zone);
    const widthOffset = Math.floor((maxWidth - zoneWidth) / 2);

    if (mode === "placement") {
      // Gaps stay empty — only advance length so bay spacing is preserved.
      if (zone.kind === "cargo") {
        // Deck floor under cargo bays (even where crates sit).
        for (let lx = 0; lx < zone.lengthCells; lx += 1) {
          for (let wy = 0; wy < zoneWidth; wy += 1) {
            const coord = {
              x: lengthOffset + lx,
              y: widthOffset + wy,
              z: 0,
            };
            cubes.push({
              key: `floor-${zone.id}-${coord.x}-${coord.y}`,
              coord,
              lx: lengthOffset + lx,
              wy: widthOffset + wy,
              hz: 0,
              zoneId: zone.id,
              kind: "floor",
            });
          }
        }
        // Only the cargo being added (highlighted cells), any Z.
        // When a crate sits above other stock (filtered out), fill lower Z
        // with placeholder cubes so stack height / Z is still readable.
        const placeholderKeys = new Set<string>();
        for (let lx = 0; lx < zone.lengthCells; lx += 1) {
          for (let wy = 0; wy < zoneWidth; wy += 1) {
            for (let hz = 0; hz < sketch.heightCells; hz += 1) {
              const coord = {
                x: lengthOffset + lx,
                y: widthOffset + wy,
                z: hz,
              };
              if (!highlightKeys.has(cargoGridCoordKey(coord))) continue;
              cubes.push({
                key: `cargo-${zone.id}-${coord.x}-${coord.y}-${coord.z}`,
                coord,
                lx: lengthOffset + lx,
                wy: widthOffset + wy,
                hz,
                zoneId: zone.id,
                kind: "cargo",
              });
              for (let below = 0; below < hz; below += 1) {
                const support = {
                  x: coord.x,
                  y: coord.y,
                  z: below,
                };
                const supportKey = cargoGridCoordKey(support);
                if (highlightKeys.has(supportKey)) continue;
                if (placeholderKeys.has(supportKey)) continue;
                placeholderKeys.add(supportKey);
                cubes.push({
                  key: `placeholder-${zone.id}-${support.x}-${support.y}-${support.z}`,
                  coord: support,
                  lx: lengthOffset + lx,
                  wy: widthOffset + wy,
                  hz: below,
                  zoneId: zone.id,
                  kind: "placeholder",
                });
              }
            }
          }
        }
      }
    } else if (zone.kind === "cargo") {
      for (let lx = 0; lx < zone.lengthCells; lx += 1) {
        for (let wy = 0; wy < zoneWidth; wy += 1) {
          for (let hz = 0; hz < sketch.heightCells; hz += 1) {
            const coord = {
              x: lengthOffset + lx,
              y: widthOffset + wy,
              z: hz,
            };
            cubes.push({
              key: `${zone.id}-${coord.x}-${coord.y}-${coord.z}`,
              coord,
              lx: lengthOffset + lx,
              wy: widthOffset + wy,
              hz,
              zoneId: zone.id,
              kind: "cargo",
            });
          }
        }
      }
    }

    lengthOffset += zone.lengthCells;
  }

  // Floor → placeholders → cargo; within each, far → near.
  cubes.sort((a, b) => {
    const kindDelta = kindSortRank(a.kind) - kindSortRank(b.kind);
    if (kindDelta !== 0) return kindDelta;
    return a.lx + a.wy + a.hz - (b.lx + b.wy + b.hz);
  });

  return cubes;
}

/**
 * Isometric 3D cargo grid — SCU cubes stacked on Z (height).
 */
/** Extra empty cells inserted between Z layers when peel is on. */
const PEEL_GAP = 0.85;

function visualHz(hz: number, peelStack: boolean): number {
  if (!peelStack || hz <= 0) return hz;
  return hz + hz * PEEL_GAP;
}

export function CargoGridIsoView({
  sketch,
  cellPx = 14,
  selectedCoord = null,
  onSelectCoord,
  highlightedCoords = [],
  placementTints = [],
  legendItems,
  mode = "full",
}: CargoGridIsoViewProps) {
  const [peelStack, setPeelStack] = useState(false);

  const tintByKey = useMemo(() => {
    const map = new Map<string, CargoGridPlacementTint>();
    for (const tint of placementTints) {
      map.set(cargoGridCoordKey(tint.coord), tint);
    }
    return map;
  }, [placementTints]);

  const highlightKeys = useMemo(() => {
    if (placementTints.length > 0) {
      return new Set(placementTints.map((tint) => cargoGridCoordKey(tint.coord)));
    }
    return new Set(highlightedCoords.map((coord) => cargoGridCoordKey(coord)));
  }, [highlightedCoords, placementTints]);

  const cubes = useMemo(() => {
    const built = buildCubes(sketch, mode, highlightKeys);
    if (!peelStack) return built;
    // Re-sort by peeled visual height so upper layers stay in front.
    return [...built].sort((a, b) => {
      const kindDelta = kindSortRank(a.kind) - kindSortRank(b.kind);
      if (kindDelta !== 0) return kindDelta;
      const aHz = visualHz(a.hz, true);
      const bHz = visualHz(b.hz, true);
      return a.lx + a.wy + aHz - (b.lx + b.wy + bHz);
    });
  }, [sketch, mode, highlightKeys, peelStack]);
  const totalLength = cargoGridTotalLength(sketch);
  const maxWidth = cargoGridMaxWidth(sketch);
  const height = sketch.heightCells;
  const placedCoords =
    placementTints.length > 0
      ? placementTints.map((tint) => tint.coord)
      : highlightedCoords;
  const maxPlacedZ = placedCoords.reduce(
    (max, coord) => Math.max(max, coord.z),
    0,
  );
  // Keep full span height so empty gap regions stay visible as space.
  const viewHeight =
    mode === "placement"
      ? visualHz(
          Math.max(height, maxPlacedZ + 1),
          peelStack,
        )
      : visualHz(height, peelStack);

  const legend = useMemo(() => {
    const items: CargoGridIsoLegendItem[] = [];
    if (legendItems && legendItems.length > 0) {
      items.push(...legendItems);
    } else {
      const map = new Map<string, CargoGridIsoLegendItem>();
      for (const tint of placementTints) {
        if (map.has(tint.commoditySlug)) continue;
        map.set(tint.commoditySlug, {
          commoditySlug: tint.commoditySlug,
          commodityName: tint.commodityName,
          color: tint.color,
          color2: tint.color2,
        });
      }
      items.push(...map.values());
    }
    return items;
  }, [legendItems, placementTints]);

  const bounds = useMemo(() => {
    const corners = [
      project(0, 0, 0, cellPx),
      project(totalLength, 0, 0, cellPx),
      project(0, maxWidth, 0, cellPx),
      project(totalLength, maxWidth, 0, cellPx),
      project(0, 0, viewHeight, cellPx),
      project(totalLength, 0, viewHeight, cellPx),
      project(0, maxWidth, viewHeight, cellPx),
      project(totalLength, maxWidth, viewHeight, cellPx),
    ];
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const point of corners) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }
    const pad = cellPx * 2;
    return {
      minX: minX - pad,
      minY: minY - pad,
      width: maxX - minX + pad * 2,
      height: maxY - minY + pad * 2,
    };
  }, [cellPx, viewHeight, maxWidth, totalLength]);

  const zoneColorIndex = useMemo(() => {
    const map = new Map<string, number>();
    let index = 0;
    for (const zone of sketch.zones) {
      if (zone.kind === "cargo") {
        map.set(zone.id, index);
        index += 1;
      }
    }
    return map;
  }, [sketch.zones]);

  const showPeel = mode === "placement" && maxPlacedZ > 0;
  const hasPickup = placementTints.some((tint) => tint.action === "pickup");
  const hasDelivery = placementTints.some(
    (tint) => tint.action === "delivery",
  );
  const showActionKey = hasPickup || hasDelivery;

  return (
    <div className="relative overflow-x-auto rounded-rsi border border-rsi-border bg-rsi-bg-deep/50 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2 pr-[15rem]">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-rsi-text-muted">
          3D view
          {mode === "placement" ? null : ` · height ${height}`}
        </p>
        {showPeel ? (
          <button
            type="button"
            aria-pressed={peelStack}
            onClick={() => setPeelStack((value) => !value)}
            className={[
              "rounded-rsi border px-2 py-1 font-mono text-[0.6rem] uppercase tracking-[0.14em] transition-colors",
              peelStack
                ? "border-rsi-accent/50 bg-rsi-accent-muted/40 text-rsi-accent"
                : "border-rsi-border bg-rsi-bg-deep/70 text-rsi-text-secondary hover:border-rsi-border-strong hover:text-rsi-text",
            ].join(" ")}
          >
            Peel stack
          </button>
        ) : null}
      </div>

      {legend.length > 0 || showActionKey ? (
        <ul
          className="absolute top-3 right-3 z-10 max-w-[13rem] space-y-1 rounded-rsi border border-rsi-border/80 bg-rsi-bg-deep/95 px-2.5 py-2 shadow-rsi-panel"
          aria-label="Cargo color legend"
        >
          {legend.length > 0 ? (
            <li className="font-mono text-[0.55rem] uppercase tracking-[0.16em] text-rsi-text-muted">
              Legend
            </li>
          ) : null}
          {legend.map((item) => {
            const hex =
              resolveCommodityColorHex(
                item.color,
                item.color2,
                item.commoditySlug,
              ) ?? FALLBACK_PLACEMENT_HEX;
            return (
              <li
                key={item.commoditySlug}
                className="flex items-center gap-2 text-left"
              >
                <span
                  className="size-2.5 shrink-0 rounded-[2px] border border-rsi-border-strong/80"
                  style={{ backgroundColor: hex }}
                  aria-hidden
                />
                <span className="min-w-0 truncate text-[0.7rem] leading-tight text-rsi-text">
                  {item.commodityName}
                  {item.scu != null ? (
                    <span className="font-mono text-rsi-text-muted">
                      {" "}
                      · {item.scu} SCU
                    </span>
                  ) : null}
                </span>
              </li>
            );
          })}
          {showActionKey ? (
            <>
              <li className="pt-1 font-mono text-[0.55rem] uppercase tracking-[0.16em] text-rsi-text-muted">
                Action
              </li>
              {hasPickup ? (
                <li className="flex items-center gap-2 text-left">
                  <span
                    className="size-2.5 shrink-0 rounded-[2px] border border-solid border-rsi-accent/55 bg-transparent"
                    aria-hidden
                  />
                  <span className="text-[0.7rem] leading-tight text-rsi-text">
                    Pickup
                  </span>
                </li>
              ) : null}
              {hasDelivery ? (
                <li className="flex items-center gap-2 text-left">
                  <span
                    className="size-2.5 shrink-0 rounded-[2px] border border-dashed border-rsi-success/75 bg-transparent"
                    aria-hidden
                  />
                  <span className="text-[0.7rem] leading-tight text-rsi-text">
                    Delivery
                  </span>
                </li>
              ) : null}
            </>
          ) : null}
        </ul>
      ) : null}

      <svg
        role="img"
        aria-label={`${sketch.shipName} isometric cargo grid, ${cubes.length} cubes`}
        viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
        className="mx-auto block h-auto w-full max-w-4xl"
        style={{ minHeight: 280 }}
      >
        {cubes.map((cube) => {
          const isFloor = cube.kind === "floor";
          const isPlaceholder = cube.kind === "placeholder";
          const drawHz = isFloor ? 0 : visualHz(cube.hz, peelStack);
          const faces = isFloor
            ? floorFaces(cube.lx, cube.wy, cellPx)
            : cubeFaces(cube.lx, cube.wy, drawHz, cellPx);
          const isSelected =
            cube.kind === "cargo" &&
            selectedCoord != null &&
            sameCargoGridCoord(selectedCoord, cube.coord);
          const tint = tintByKey.get(cargoGridCoordKey(cube.coord));
          const commodityHex = tint
            ? resolveCommodityColorHex(
                tint.color,
                tint.color2,
                tint.commoditySlug,
              )
            : null;
          const isHighlighted =
            cube.kind === "cargo" &&
            highlightKeys.has(cargoGridCoordKey(cube.coord));
          const colors: CubeFaceColors = isFloor
            ? FLOOR_FACE
            : isPlaceholder
              ? PLACEHOLDER_FACE
              : isSelected
                ? SELECTED_FACE
                : commodityHex
                  ? facesFromCommodityHex(commodityHex)
                  : isHighlighted
                    ? HIGHLIGHT_FACE
                    : mode === "placement"
                      ? facesFromCommodityHex(FALLBACK_PLACEMENT_HEX)
                      : (ZONE_FACE[zoneColorIndex.get(cube.zoneId) ?? 0] ??
                        ZONE_FACE[0]);
          const canSelect = Boolean(onSelectCoord) && cube.kind === "cargo";
          const action = cube.kind === "cargo" ? tint?.action : undefined;
          const actionStroke =
            action === "pickup"
              ? "color-mix(in srgb, var(--rsi-accent) 55%, var(--rsi-border-strong))"
              : action === "delivery"
                ? "color-mix(in srgb, var(--rsi-success) 75%, var(--rsi-border-strong))"
                : null;
          const actionDash =
            action === "delivery"
              ? "2.5 2"
              : isPlaceholder
                ? "2 2"
                : undefined;
          const sideStroke = actionStroke ?? "var(--rsi-border)";
          const topStroke = isSelected
            ? "var(--rsi-accent)"
            : actionStroke
              ? actionStroke
              : isPlaceholder
                ? "var(--rsi-border)"
                : "var(--rsi-border-strong)";
          const topStrokeWidth = isSelected ? 1.4 : actionStroke ? 0.85 : 0.7;
          const sideStrokeWidth = actionStroke ? 0.65 : 0.5;
          const actionLabel =
            action === "pickup"
              ? "Pickup"
              : action === "delivery"
                ? "Delivery"
                : null;
          return (
            <g
              key={cube.key}
              role={canSelect ? "button" : undefined}
              tabIndex={canSelect ? 0 : undefined}
              style={{ cursor: canSelect ? "pointer" : undefined }}
              onClick={() => {
                if (!canSelect || !onSelectCoord) return;
                if (isSelected) onSelectCoord(null);
                else onSelectCoord(cube.coord);
              }}
              onKeyDown={(event) => {
                if (!canSelect || !onSelectCoord) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  if (isSelected) onSelectCoord(null);
                  else onSelectCoord(cube.coord);
                }
              }}
            >
              <title>
                {cube.kind === "cargo"
                  ? `${actionLabel ? `${actionLabel} · ` : ""}${tint?.commodityName ? `${tint.commodityName} · ` : ""}${formatCargoGridCoord(cube.coord)}`
                  : cube.kind === "placeholder"
                    ? `Support · ${formatCargoGridCoord(cube.coord)}`
                    : `Floor ${formatCargoGridCoord(cube.coord)}`}
              </title>
              {isFloor ? (
                <polygon
                  points={faces.top}
                  fill={colors.top}
                  stroke="var(--rsi-border)"
                  strokeWidth={0.4}
                  opacity={0.9}
                />
              ) : (
                <g opacity={isPlaceholder ? 0.45 : 1}>
                  <polygon
                    points={faces.left}
                    fill={colors.left}
                    stroke={sideStroke}
                    strokeWidth={sideStrokeWidth}
                    strokeDasharray={actionDash}
                  />
                  <polygon
                    points={faces.right}
                    fill={colors.right}
                    stroke={sideStroke}
                    strokeWidth={sideStrokeWidth}
                    strokeDasharray={actionDash}
                  />
                  <polygon
                    points={faces.top}
                    fill={colors.top}
                    stroke={topStroke}
                    strokeWidth={topStrokeWidth}
                    strokeDasharray={actionDash}
                  />
                </g>
              )}
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex justify-between font-mono text-[0.6rem] uppercase tracking-[0.14em] text-rsi-text-muted">
        <span>Nose · X0</span>
        <span>Ramp · X{Math.max(totalLength - 1, 0)}</span>
      </div>
    </div>
  );
}
