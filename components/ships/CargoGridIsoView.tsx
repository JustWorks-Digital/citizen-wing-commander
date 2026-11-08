"use client";

import { useMemo, useState, type ReactNode } from "react";
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
import type {
  CargoGridBoxAction,
  CargoGridPlacementTint,
  PlacedCargoBox,
} from "@/lib/ships/cargoGridPlacement";
import type { CargoBoxFootprint } from "@/lib/ships/cargoBoxSizes";
import { CargoBoxCountIcons } from "@/components/ships/CargoBoxSizeIcon";

export type CargoGridIsoLegendItem = {
  commoditySlug: string;
  commodityName: string;
  color: string | null;
  color2: string | null;
  scu?: number;
  /** Physical crate breakdown, e.g. twelve 8-SCU boxes → [{ size: 8, count: 12 }]. */
  boxCounts?: Array<{ size: number; count: number }>;
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
  /**
   * Whole crates (8/4/2/1 footprints). When set in placement mode, draw solid
   * boxes instead of one cube per SCU cell.
   */
  placementBoxes?: PlacedCargoBox[];
  /** Legend entries (top-right); derived from tints when omitted. */
  legendItems?: CargoGridIsoLegendItem[];
  /** Commodities currently dimmed via legend toggles. */
  hiddenCommodities?: ReadonlySet<string>;
  onToggleCommodity?: (commoditySlug: string) => void;
  /** Pickup / delivery actions currently dimmed via legend toggles. */
  hiddenActions?: ReadonlySet<CargoGridBoxAction>;
  onToggleAction?: (action: CargoGridBoxAction) => void;
  /**
   * `placement`: keep only the Z=0 floor grid + cubes for highlighted cargo.
   * Empty upper cells are omitted.
   */
  mode?: "full" | "placement";
  /** Extra toolbar controls (e.g. zoom) shown beside peel / height. */
  toolbarExtra?: ReactNode;
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
  /** Physical crate size in cells (defaults to 1×1×1). */
  footprint: CargoBoxFootprint;
  commoditySlug?: string;
  commodityName?: string;
  color?: string | null;
  color2?: string | null;
  action?: CargoGridBoxAction;
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

function boxFaces(
  lx: number,
  wy: number,
  hz: number,
  footprint: CargoBoxFootprint,
  size: number,
) {
  const { dx, dy, dz } = footprint;
  const p = (x: number, y: number, z: number) => project(x, y, z, size);
  const a = p(lx, wy, hz + dz);
  const b = p(lx + dx, wy, hz + dz);
  const c = p(lx + dx, wy + dy, hz + dz);
  const d = p(lx, wy + dy, hz + dz);
  const f = p(lx + dx, wy, hz);
  const g = p(lx + dx, wy + dy, hz);
  const h = p(lx, wy + dy, hz);
  return {
    top: `${a.x},${a.y} ${b.x},${b.y} ${c.x},${c.y} ${d.x},${d.y}`,
    // South face (+Y) — left side of the iso box
    left: `${d.x},${d.y} ${c.x},${c.y} ${g.x},${g.y} ${h.x},${h.y}`,
    // East face (+X) — right side toward ramp / bay gap (must be solid, not open)
    right: `${b.x},${b.y} ${c.x},${c.y} ${g.x},${g.y} ${f.x},${f.y}`,
  };
}

function cubeFaces(lx: number, wy: number, hz: number, size: number) {
  return boxFaces(lx, wy, hz, { dx: 1, dy: 1, dz: 1 }, size);
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

const UNIT_FOOTPRINT: CargoBoxFootprint = { dx: 1, dy: 1, dz: 1 };

function buildCubes(
  sketch: ShipCargoGridSketch,
  mode: "full" | "placement",
  highlightKeys: Set<string>,
  placementBoxes: PlacedCargoBox[] = [],
): IsoCube[] {
  const maxWidth = cargoGridMaxWidth(sketch);
  const cubes: IsoCube[] = [];
  let lengthOffset = 0;

  for (const zone of sketch.zones) {
    const zoneWidth = cargoGridZoneWidth(sketch, zone);
    const widthOffset = Math.floor((maxWidth - zoneWidth) / 2);
    const zoneX0 = lengthOffset;
    const zoneX1 = lengthOffset + zone.lengthCells;
    const zoneY0 = widthOffset;
    const zoneY1 = widthOffset + zoneWidth;

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
              footprint: UNIT_FOOTPRINT,
            });
          }
        }

        if (placementBoxes.length > 0) {
          const occupiedKeys = new Set(
            placementBoxes.flatMap((box) =>
              box.cells.map((cell) => cargoGridCoordKey(cell)),
            ),
          );
          const placeholderKeys = new Set<string>();
          for (const box of placementBoxes) {
            const { origin, footprint } = box;
            if (
              origin.x < zoneX0 ||
              origin.x >= zoneX1 ||
              origin.y < zoneY0 ||
              origin.y >= zoneY1
            ) {
              continue;
            }
            cubes.push({
              key: `cargo-${box.id}`,
              coord: origin,
              lx: origin.x,
              wy: origin.y,
              hz: origin.z,
              zoneId: zone.id,
              kind: "cargo",
              footprint,
              commoditySlug: box.commoditySlug,
              commodityName: box.commodityName,
              color: box.color,
              color2: box.color2,
              action: box.action,
            });
            // Ghost pads under elevated crates so stack height stays readable.
            for (let ox = 0; ox < footprint.dx; ox += 1) {
              for (let oy = 0; oy < footprint.dy; oy += 1) {
                for (let below = 0; below < origin.z; below += 1) {
                  const support = {
                    x: origin.x + ox,
                    y: origin.y + oy,
                    z: below,
                  };
                  const supportKey = cargoGridCoordKey(support);
                  if (occupiedKeys.has(supportKey)) continue;
                  if (placeholderKeys.has(supportKey)) continue;
                  placeholderKeys.add(supportKey);
                  cubes.push({
                    key: `placeholder-${zone.id}-${support.x}-${support.y}-${support.z}`,
                    coord: support,
                    lx: support.x,
                    wy: support.y,
                    hz: below,
                    zoneId: zone.id,
                    kind: "placeholder",
                    footprint: UNIT_FOOTPRINT,
                  });
                }
              }
            }
          }
        } else {
          // Fallback: one cube per highlighted cell.
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
                  footprint: UNIT_FOOTPRINT,
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
                    footprint: UNIT_FOOTPRINT,
                  });
                }
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
              footprint: UNIT_FOOTPRINT,
            });
          }
        }
      }
    }

    lengthOffset += zone.lengthCells;
  }

  // Mirror length so the front bay faces the opposite way (ramp←nose visual).
  const totalLength = cargoGridTotalLength(sketch);
  for (const cube of cubes) {
    cube.lx = totalLength - cube.lx - cube.footprint.dx;
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

/** Dimmed (layer toggled off) but still visible. */
const LAYER_OFF_OPACITY = 0.2;

export function CargoGridIsoView({
  sketch,
  cellPx = 14,
  selectedCoord = null,
  onSelectCoord,
  highlightedCoords = [],
  placementTints = [],
  placementBoxes = [],
  legendItems,
  hiddenCommodities = new Set(),
  onToggleCommodity,
  hiddenActions = new Set(),
  onToggleAction,
  mode = "full",
  toolbarExtra = null,
}: CargoGridIsoViewProps) {
  const [peelStack, setPeelStack] = useState(false);
  const [hiddenLayers, setHiddenLayers] = useState<ReadonlySet<number>>(
    () => new Set(),
  );

  const tintByKey = useMemo(() => {
    const map = new Map<string, CargoGridPlacementTint>();
    for (const tint of placementTints) {
      map.set(cargoGridCoordKey(tint.coord), tint);
    }
    return map;
  }, [placementTints]);

  const highlightKeys = useMemo(() => {
    if (placementBoxes.length > 0) {
      return new Set(
        placementBoxes.flatMap((box) =>
          box.cells.map((cell) => cargoGridCoordKey(cell)),
        ),
      );
    }
    if (placementTints.length > 0) {
      return new Set(placementTints.map((tint) => cargoGridCoordKey(tint.coord)));
    }
    return new Set(highlightedCoords.map((coord) => cargoGridCoordKey(coord)));
  }, [highlightedCoords, placementBoxes, placementTints]);

  const cubes = useMemo(() => {
    const built = buildCubes(sketch, mode, highlightKeys, placementBoxes);
    if (!peelStack) return built;
    // Re-sort by peeled visual height so upper layers stay in front.
    return [...built].sort((a, b) => {
      const kindDelta = kindSortRank(a.kind) - kindSortRank(b.kind);
      if (kindDelta !== 0) return kindDelta;
      const aHz = visualHz(a.hz, true);
      const bHz = visualHz(b.hz, true);
      return a.lx + a.wy + aHz - (b.lx + b.wy + bHz);
    });
  }, [sketch, mode, highlightKeys, peelStack, placementBoxes]);
  const totalLength = cargoGridTotalLength(sketch);
  const maxWidth = cargoGridMaxWidth(sketch);
  const height = sketch.heightCells;
  const maxPlacedZ = (() => {
    if (placementBoxes.length > 0) {
      return placementBoxes.reduce(
        (max, box) =>
          Math.max(max, box.origin.z + box.footprint.dz - 1, box.origin.z),
        0,
      );
    }
    const placedCoords =
      placementTints.length > 0
        ? placementTints.map((tint) => tint.coord)
        : highlightedCoords;
    return placedCoords.reduce((max, coord) => Math.max(max, coord.z), 0);
  })();
  // Placement: fit the used stack height (not empty ceiling space).
  const viewHeight =
    mode === "placement"
      ? visualHz(Math.max(1, maxPlacedZ + 1), peelStack)
      : visualHz(height, peelStack);

  /**
   * Layers are numbered 1 = deck … N = highest used cell.
   * Legend lists low→high (e.g. 1, 2, 3, 4). An 8 SCU crate (dz=2) occupies
   * two layers and dims when either is toggled off.
   */
  const layerOptions = useMemo(() => {
    if (mode !== "placement") return [];
    const occupied = new Set<number>();
    if (placementBoxes.length > 0) {
      for (const box of placementBoxes) {
        for (let offset = 0; offset < box.footprint.dz; offset += 1) {
          occupied.add(box.origin.z + offset);
        }
      }
    } else {
      for (let z = 0; z <= maxPlacedZ; z += 1) occupied.add(z);
      if (maxPlacedZ < 0) occupied.clear();
    }
    return [...occupied].sort((a, b) => a - b);
  }, [mode, maxPlacedZ, placementBoxes]);

  function layerNumber(z: number): number {
    return z + 1;
  }

  function toggleLayer(z: number) {
    setHiddenLayers((prev) => {
      const next = new Set(prev);
      if (next.has(z)) next.delete(z);
      else next.add(z);
      return next;
    });
  }

  const legend = useMemo(() => {
    if (legendItems && legendItems.length > 0) return legendItems;
    if (placementBoxes.length > 0) {
      const map = new Map<
        string,
        CargoGridIsoLegendItem & { sizeTallies: Map<number, number> }
      >();
      for (const box of placementBoxes) {
        const existing = map.get(box.commoditySlug);
        if (existing) {
          existing.scu = (existing.scu ?? 0) + box.size;
          existing.sizeTallies.set(
            box.size,
            (existing.sizeTallies.get(box.size) ?? 0) + 1,
          );
          continue;
        }
        map.set(box.commoditySlug, {
          commoditySlug: box.commoditySlug,
          commodityName: box.commodityName,
          color: box.color,
          color2: box.color2,
          scu: box.size,
          sizeTallies: new Map([[box.size, 1]]),
        });
      }
      return [...map.values()].map((entry) => ({
        commoditySlug: entry.commoditySlug,
        commodityName: entry.commodityName,
        color: entry.color,
        color2: entry.color2,
        scu: entry.scu,
        boxCounts: [...entry.sizeTallies.entries()]
          .sort((a, b) => b[0] - a[0])
          .map(([size, count]) => ({ size, count })),
      }));
    }
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
    return [...map.values()];
  }, [legendItems, placementBoxes, placementTints]);

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
    const padX = cellPx;
    const padTop = cellPx * 0.25;
    const padBottom = cellPx * 0.85;
    return {
      minX: minX - padX,
      minY: minY - padTop,
      width: maxX - minX + padX * 2,
      height: maxY - minY + padTop + padBottom,
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
  const showLayers = layerOptions.length > 0;
  const hasPickup = placementTints.some((tint) => tint.action === "pickup");
  const hasDelivery = placementTints.some(
    (tint) => tint.action === "delivery",
  );
  const showActionKey = hasPickup || hasDelivery;
  const showLegend =
    legend.length > 0 || showActionKey || showLayers;

  const showToolbar = showPeel || mode !== "placement";

  return (
    <div className="relative flex h-[26rem] flex-col overflow-hidden rounded-rsi border border-rsi-border bg-rsi-bg-deep/50 px-3 pt-1.5 pb-3">
      {showToolbar ? (
        <div className="mb-1 flex shrink-0 flex-wrap items-center gap-2 pr-[14rem]">
          {mode === "placement" ? (
            <span className="sr-only">3D cargo grid</span>
          ) : (
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-rsi-text-muted">
              Height {height}
            </p>
          )}
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
      ) : (
        <span className="sr-only">3D cargo grid</span>
      )}
      {toolbarExtra ? (
        <div className="pointer-events-auto absolute right-2 bottom-2 z-20">
          {toolbarExtra}
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="flex min-w-full justify-center pb-9">

      {showLegend ? (
        <div
          className="absolute top-2 right-2 z-10 w-[13rem] space-y-1.5 rounded-rsi border border-rsi-border/80 bg-rsi-bg-deep/95 px-2 py-1.5 shadow-rsi-panel"
          aria-label="Cargo color legend"
        >
          {legend.length > 0 ? (
            <ul className="space-y-0.5">
              {legend.map((item) => {
                const hex =
                  resolveCommodityColorHex(
                    item.color,
                    item.color2,
                    item.commoditySlug,
                  ) ?? FALLBACK_PLACEMENT_HEX;
                const isOn = !hiddenCommodities.has(item.commoditySlug);
                const canToggle = Boolean(onToggleCommodity);
                const hasBoxIcons =
                  item.boxCounts != null && item.boxCounts.length > 0;
                const row = (
                  <span
                    className={[
                      "flex min-w-0 flex-1 items-center gap-1.5",
                      isOn ? "" : "opacity-55",
                    ].join(" ")}
                  >
                    <span
                      className="size-2 shrink-0 rounded-[2px] border border-rsi-border-strong/80"
                      style={{ backgroundColor: hex }}
                      aria-hidden
                    />
                    <span
                      className={[
                        "min-w-0 flex-1 truncate text-left text-[0.7rem] leading-none",
                        isOn ? "text-rsi-text" : "text-rsi-text-muted",
                      ].join(" ")}
                    >
                      {item.commodityName}
                    </span>
                    {hasBoxIcons ? (
                      <CargoBoxCountIcons
                        boxCounts={item.boxCounts!}
                        color={hex}
                        className="ml-auto shrink-0 justify-end gap-x-1 [&_svg]:size-3.5 [&_span]:text-[0.55rem]"
                      />
                    ) : item.scu != null ? (
                      <span className="ml-auto shrink-0 font-mono text-[0.55rem] tabular-nums text-rsi-text-muted">
                        {item.scu}
                      </span>
                    ) : null}
                  </span>
                );
                return (
                  <li key={item.commoditySlug}>
                    {canToggle ? (
                      <button
                        type="button"
                        aria-pressed={isOn}
                        onClick={() => onToggleCommodity?.(item.commoditySlug)}
                        className="flex w-full cursor-pointer text-left"
                      >
                        {row}
                      </button>
                    ) : (
                      <div className="flex text-left">{row}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : null}
          {showActionKey ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-rsi-border/60 pt-1.5">
              {hasPickup ? (
                <button
                  type="button"
                  aria-pressed={!hiddenActions.has("pickup")}
                  onClick={() => onToggleAction?.("pickup")}
                  className={[
                    "inline-flex items-center gap-1 text-[0.6rem]",
                    hiddenActions.has("pickup")
                      ? "text-rsi-text-muted opacity-55"
                      : "text-rsi-text-secondary",
                    onToggleAction ? "cursor-pointer" : "cursor-default",
                  ].join(" ")}
                >
                  <span
                    className="size-2 shrink-0 rounded-[2px] border border-solid border-rsi-accent/55 bg-transparent"
                    aria-hidden
                  />
                  Pickup
                </button>
              ) : null}
              {hasDelivery ? (
                <button
                  type="button"
                  aria-pressed={!hiddenActions.has("delivery")}
                  onClick={() => onToggleAction?.("delivery")}
                  className={[
                    "inline-flex items-center gap-1 text-[0.6rem]",
                    hiddenActions.has("delivery")
                      ? "text-rsi-text-muted opacity-55"
                      : "text-rsi-text-secondary",
                    onToggleAction ? "cursor-pointer" : "cursor-default",
                  ].join(" ")}
                >
                  <span
                    className="size-2 shrink-0 rounded-[2px] border border-dashed border-rsi-success/75 bg-transparent"
                    aria-hidden
                  />
                  Delivery
                </button>
              ) : null}
            </div>
          ) : null}
          {showLayers ? (
            <div
              className={[
                "flex flex-wrap items-center gap-1",
                showActionKey || legend.length > 0
                  ? "border-t border-rsi-border/60 pt-1.5"
                  : "",
              ].join(" ")}
            >
              {layerOptions.map((z) => {
                const isOn = !hiddenLayers.has(z);
                const number = layerNumber(z);
                return (
                  <button
                    key={`layer-${z}`}
                    type="button"
                    aria-pressed={isOn}
                    aria-label={`Layer ${number}`}
                    onClick={() => toggleLayer(z)}
                    className={[
                      "inline-flex size-5 items-center justify-center rounded-[3px] border font-mono text-[0.55rem] tabular-nums transition-colors",
                      isOn
                        ? "border-rsi-accent/50 bg-rsi-accent-muted/35 text-rsi-accent"
                        : "border-rsi-border bg-rsi-bg-deep/40 text-rsi-text-muted",
                    ].join(" ")}
                  >
                    {number}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      <svg
        role="img"
        aria-label={`${sketch.shipName} isometric cargo grid, ${cubes.length} cubes`}
        viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
        width={bounds.width}
        height={bounds.height}
        className="block max-w-none shrink-0"
      >
        {cubes.map((cube) => {
          const isFloor = cube.kind === "floor";
          const isPlaceholder = cube.kind === "placeholder";
          const drawHz = isFloor ? 0 : visualHz(cube.hz, peelStack);
          const faces = isFloor
            ? floorFaces(cube.lx, cube.wy, cellPx)
            : boxFaces(cube.lx, cube.wy, drawHz, cube.footprint, cellPx);
          const layerDimmed =
            !isFloor &&
            Array.from(
              { length: cube.footprint.dz },
              (_, offset) => cube.hz + offset,
            ).some((z) => hiddenLayers.has(z));
          const isSelected =
            cube.kind === "cargo" &&
            selectedCoord != null &&
            sameCargoGridCoord(selectedCoord, cube.coord);
          const tint = tintByKey.get(cargoGridCoordKey(cube.coord));
          const commoditySlug =
            cube.commoditySlug ?? tint?.commoditySlug ?? null;
          const commodityName =
            cube.commodityName ?? tint?.commodityName ?? null;
          const commodityDimmed =
            !isFloor &&
            commoditySlug != null &&
            hiddenCommodities.has(commoditySlug);
          const commodityHex = resolveCommodityColorHex(
            cube.color ?? tint?.color ?? null,
            cube.color2 ?? tint?.color2 ?? null,
            commoditySlug,
          );
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
          const action =
            cube.kind === "cargo" ? (cube.action ?? tint?.action) : undefined;
          const actionDimmed =
            !isFloor && action != null && hiddenActions.has(action);
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
                  ? `${actionLabel ? `${actionLabel} · ` : ""}${commodityName ? `${commodityName} · ` : ""}${cube.footprint.dx * cube.footprint.dy * cube.footprint.dz} SCU · ${formatCargoGridCoord(cube.coord)}`
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
                <g
                  opacity={
                    layerDimmed || commodityDimmed || actionDimmed
                      ? LAYER_OFF_OPACITY
                      : isPlaceholder
                        ? 0.45
                        : 1
                  }
                >
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
        </div>
      </div>
    </div>
  );
}
