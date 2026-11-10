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
  PlacementLocationLegendItem,
  PlacedCargoBox,
} from "@/lib/ships/cargoGridPlacement";
import { locationGroupStroke } from "@/lib/ships/cargoGridPlacement";
import {
  locationGroupBoxOutlinesFromViewBoxes,
  type LocationGroupBoxOutline,
} from "@/lib/ships/locationGroupOutline";
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
  /** Delivery location groups for the legend / show-hide filter. */
  locationLegendItems?: PlacementLocationLegendItem[];
  /**
   * When true, draw mission-location perimeter outlines + number badges.
   * Location filter toggles still work when false.
   */
  showLocationOutlines?: boolean;
  /** Delivery locations hidden via legend toggles. */
  hiddenLocations?: ReadonlySet<string>;
  onToggleLocation?: (locationSlug: string) => void;
  /** Commodities hidden via legend toggles (omit from the graph). */
  hiddenCommodities?: ReadonlySet<string>;
  onToggleCommodity?: (commoditySlug: string) => void;
  /** Pickup / delivery actions hidden via legend toggles. */
  hiddenActions?: ReadonlySet<CargoGridBoxAction>;
  onToggleAction?: (action: CargoGridBoxAction) => void;
  /**
   * `placement`: keep only the Z=0 floor grid + cubes for highlighted cargo.
   * Empty upper cells are omitted.
   */
  mode?: "full" | "placement";
  /** Extra toolbar controls (e.g. zoom) shown in the bottom-right corner. */
  toolbarExtra?: ReactNode;
  /** Controls stacked above Peel (e.g. cargo grouping). */
  toolbarBelow?: ReactNode;
  /**
   * Bottom-left Up / Down / Left / Right facing pad.
   * On for cargo-layout 3D; off for other embeds if needed.
   */
  showFacingPad?: boolean;
  /**
   * Drop the outer border / rounded frame when nested in a shared split container.
   */
  embedded?: boolean;
  /** Hide the built-in legend (e.g. shared split legend lives outside). */
  hideLegend?: boolean;
  /** Leave room under a top-right Legend toggle hosted by the parent. */
  legendToggleAbove?: boolean;
  /** Hide Peel (e.g. host Peel on the split top panel). */
  hidePeel?: boolean;
  /** Controlled peel; falls back to internal state when omitted. */
  peelStack?: boolean;
  onPeelStackChange?: (value: boolean) => void;
  /** Controlled 3D layer visibility; falls back to internal state when omitted. */
  hiddenLayers?: ReadonlySet<number>;
  onToggleLayer?: (z: number) => void;
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
  /** PlacedCargoBox.id when kind is cargo from placement boxes. */
  boxId?: string;
  deliveryLocationSlug?: string;
  locationGroupIndex?: number;
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

/**
 * Compass pad for bay 3D view.
 * Home / Left = classic SE iso (same angle). Right = that view turned 180° (opposite).
 * Down = 15° CCW + X-mirrored left-facing variant; Up is that projection turned 180°.
 */
export type CargoGridIsoFacing = "home" | "down" | "up" | "left" | "right";

export const defaultCargoGridIsoFacing: CargoGridIsoFacing = "home";

/** Fine yaw used only for the Down facing (positive = counterclockwise). */
const DOWN_YAW_CCW_DEG = 15;
const DOWN_YAW_RAD = (DOWN_YAW_CCW_DEG * Math.PI) / 180;

type IsoProjectStyle = {
  yawRad: number;
  mirrorX: boolean;
};

function projectStyleForFacing(facing: CargoGridIsoFacing): IsoProjectStyle {
  // Down and its opposite (up) share the angled left-facing projection.
  if (facing === "down" || facing === "up") {
    return { yawRad: DOWN_YAW_RAD, mirrorX: true };
  }
  // Home / Left / Right: classic SE (Right only differs by 180° orient).
  return { yawRad: 0, mirrorX: false };
}

function yawPoint(
  lx: number,
  wy: number,
  cx: number,
  cy: number,
  radians: number,
): { x: number; y: number } {
  const dx = lx - cx;
  const dy = wy - cy;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  };
}

/** Classic 30°/30° isometric projection, optional fine yaw + X mirror. */
function project(
  lx: number,
  wy: number,
  hz: number,
  size: number,
  cx: number,
  cy: number,
  style: IsoProjectStyle,
) {
  const spun =
    style.yawRad === 0
      ? { x: lx, y: wy }
      : yawPoint(lx, wy, cx, cy, style.yawRad);
  const cos = Math.cos(Math.PI / 6);
  const sin = Math.sin(Math.PI / 6);
  const x = (spun.x - spun.y) * size * cos;
  return {
    x: style.mirrorX ? -x : x,
    y: (spun.x + spun.y) * size * sin - hz * size,
  };
}

/** Remap bay coords into view space for compass facings. */
function orientCube(
  cube: IsoCube,
  facing: CargoGridIsoFacing,
  length: number,
  width: number,
): IsoCube {
  const { lx, wy, footprint } = cube;
  const { dx, dy } = footprint;
  switch (facing) {
    case "home":
    case "left":
    case "down":
      // Left matches Home’s classic angle.
      return cube;
    case "right":
    case "up":
      // Right = opposite of Home/Left; Up = opposite of Down.
      return {
        ...cube,
        lx: length - lx - dx,
        wy: width - wy - dy,
      };
  }
}

function viewExtents(
  _facing: CargoGridIsoFacing,
  length: number,
  width: number,
): { viewLength: number; viewWidth: number } {
  return { viewLength: length, viewWidth: width };
}

/** Same length/width flip as `orientCube` for a point (no footprint). */
function orientBayPoint(
  lx: number,
  wy: number,
  facing: CargoGridIsoFacing,
  length: number,
  width: number,
): { lx: number; wy: number } {
  if (facing === "right" || facing === "up") {
    return { lx: length - lx, wy: width - wy };
  }
  return { lx, wy };
}

function readableIsoLabelAngle(deg: number): number {
  let a = deg;
  while (a > 90) a -= 180;
  while (a < -90) a += 180;
  return a;
}

/**
 * Front / Rear sit just outside the bay end edges, text parallel to that
 * edge (matches the floor line). Bay space is post-`buildCubes` mirror:
 * lx=0 rear, lx=L front.
 */
function bayEndLabelAnchors(
  facing: CargoGridIsoFacing,
  viewLength: number,
  viewWidth: number,
  cellPx: number,
  cx: number,
  cy: number,
  style: IsoProjectStyle,
): {
  front: { x: number; y: number; angle: number };
  rear: { x: number; y: number; angle: number };
} {
  const map = (lx: number, wy: number) => {
    const o = orientBayPoint(lx, wy, facing, viewLength, viewWidth);
    return project(o.lx, o.wy, 0, cellPx, cx, cy, style);
  };
  const rearA = map(0, 0);
  const rearB = map(0, viewWidth);
  const frontA = map(viewLength, 0);
  const frontB = map(viewLength, viewWidth);
  const rearMid = {
    x: (rearA.x + rearB.x) / 2,
    y: (rearA.y + rearB.y) / 2,
  };
  const frontMid = {
    x: (frontA.x + frontB.x) / 2,
    y: (frontA.y + frontB.y) / 2,
  };
  const center = map(viewLength / 2, viewWidth / 2);

  const edgeAngle = (
    a: { x: number; y: number },
    b: { x: number; y: number },
  ) =>
    readableIsoLabelAngle(
      (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
    );

  const outward = (
    mid: { x: number; y: number },
    distance: number,
  ): { x: number; y: number } => {
    const dx = mid.x - center.x;
    const dy = mid.y - center.y;
    const len = Math.hypot(dx, dy) || 1;
    return {
      x: mid.x + (dx / len) * distance,
      y: mid.y + (dy / len) * distance,
    };
  };

  // Clear of stacked crates — aft needs more room than the open fore tip.
  const frontPos = outward(frontMid, cellPx * 2.0);
  const rearPos = outward(rearMid, cellPx * 3.2);

  return {
    front: {
      ...frontPos,
      angle: edgeAngle(frontA, frontB),
    },
    rear: {
      ...rearPos,
      angle: edgeAngle(rearA, rearB),
    },
  };
}

function boxFaces(
  lx: number,
  wy: number,
  hz: number,
  footprint: CargoBoxFootprint,
  size: number,
  cx: number,
  cy: number,
  style: IsoProjectStyle,
) {
  const { dx, dy, dz } = footprint;
  const p = (x: number, y: number, z: number) =>
    project(x, y, z, size, cx, cy, style);
  const a = p(lx, wy, hz + dz);
  const b = p(lx + dx, wy, hz + dz);
  const c = p(lx + dx, wy + dy, hz + dz);
  const d = p(lx, wy + dy, hz + dz);
  const e = p(lx, wy, hz);
  const f = p(lx + dx, wy, hz);
  const g = p(lx + dx, wy + dy, hz);
  const h = p(lx, wy + dy, hz);
  const topEdges = {
    /** −Y edge of top face (a→b) */
    ny: `${a.x},${a.y} ${b.x},${b.y}`,
    /** +X edge of top face (b→c) */
    px: `${b.x},${b.y} ${c.x},${c.y}`,
    /** +Y edge of top face (c→d) */
    py: `${c.x},${c.y} ${d.x},${d.y}`,
    /** −X edge of top face (d→a) */
    nx: `${d.x},${d.y} ${a.x},${a.y}`,
  };
  const plusY = `${d.x},${d.y} ${c.x},${c.y} ${g.x},${g.y} ${h.x},${h.y}`;
  const plusX = `${b.x},${b.y} ${c.x},${c.y} ${g.x},${g.y} ${f.x},${f.y}`;
  return {
    top: `${a.x},${a.y} ${b.x},${b.y} ${c.x},${c.y} ${d.x},${d.y}`,
    topCenter: {
      x: (a.x + b.x + c.x + d.x) / 4,
      y: (a.y + b.y + c.y + d.y) / 4,
    },
    topEdges,
    // Classic SE: +Y left, +X right. X-mirrored SW: swap.
    left: style.mirrorX ? plusX : plusY,
    right: style.mirrorX ? plusY : plusX,
    leftFace: (style.mirrorX ? "px" : "py") as "px" | "py",
    rightFace: (style.mirrorX ? "py" : "px") as "px" | "py",
  };
}

/** Deck tile on Z=0 — top face only. */
function floorFaces(
  lx: number,
  wy: number,
  size: number,
  cx: number,
  cy: number,
  style: IsoProjectStyle,
) {
  const p = (x: number, y: number, z: number) =>
    project(x, y, z, size, cx, cy, style);
  const a = p(lx, wy, 0);
  const b = p(lx + 1, wy, 0);
  const c = p(lx + 1, wy + 1, 0);
  const d = p(lx, wy + 1, 0);
  const top = `${a.x},${a.y} ${b.x},${b.y} ${c.x},${c.y} ${d.x},${d.y}`;
  return {
    top,
    topCenter: {
      x: (a.x + b.x + c.x + d.x) / 4,
      y: (a.y + b.y + c.y + d.y) / 4,
    },
    topEdges: {
      ny: `${a.x},${a.y} ${b.x},${b.y}`,
      px: `${b.x},${b.y} ${c.x},${c.y}`,
      py: `${c.x},${c.y} ${d.x},${d.y}`,
      nx: `${d.x},${d.y} ${a.x},${a.y}`,
    },
    left: top,
    right: top,
    leftFace: (style.mirrorX ? "px" : "py") as "px" | "py",
    rightFace: (style.mirrorX ? "py" : "px") as "px" | "py",
  };
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

        // Structured placement list (may be empty after location filters).
        // Do not fall back to highlightKeys — an empty filter must show no crates.
        const occupiedKeys = new Set(
          placementBoxes.flatMap((box) =>
            box.cells.map((cell) => cargoGridCoordKey(cell)),
          ),
        );
        const placeholderKeys = new Set<string>();
        for (const box of placementBoxes) {
          const { origin, footprint } = box;
          // Whole footprint must sit in this bay (not just the origin cell).
          if (
            origin.x < zoneX0 ||
            origin.x + footprint.dx > zoneX1 ||
            origin.y < zoneY0 ||
            origin.y + footprint.dy > zoneY1
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
            boxId: box.id,
            commoditySlug: box.commoditySlug,
            commodityName: box.commodityName,
            color: box.color,
            color2: box.color2,
            action: box.action,
            deliveryLocationSlug: box.deliveryLocationSlug,
            locationGroupIndex: box.locationGroupIndex,
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

  // Floor → placeholders → cargo; within each, low Z first then far → near.
  // Height before XY so lower tops cannot cover crates stacked above them.
  const depthKeyXY = (cube: IsoCube) =>
    cube.lx + cube.footprint.dx + cube.wy + cube.footprint.dy;
  cubes.sort((a, b) => {
    const kindDelta = kindSortRank(a.kind) - kindSortRank(b.kind);
    if (kindDelta !== 0) return kindDelta;
    const hzDelta = a.hz - b.hz;
    if (hzDelta !== 0) return hzDelta;
    const xyDelta = depthKeyXY(a) - depthKeyXY(b);
    if (xyDelta !== 0) return xyDelta;
    return a.footprint.dz - b.footprint.dz;
  });

  return cubes;
}

/**
 * Isometric 3D cargo grid — SCU cubes stacked on Z (height).
 */
function DefaultFacingIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 12 12"
      className={className}
      aria-hidden
      focusable="false"
    >
      <path
        d="M6 1.4 L10.4 3.9 L6 6.4 L1.6 3.9 Z"
        fill="currentColor"
        opacity="0.95"
      />
      <path
        d="M1.6 3.9 L6 6.4 L6 10.6 L1.6 8.1 Z"
        fill="currentColor"
        opacity="0.55"
      />
      <path
        d="M6 6.4 L10.4 3.9 L10.4 8.1 L6 10.6 Z"
        fill="currentColor"
        opacity="0.7"
      />
    </svg>
  );
}

function IsoFacingPad({
  facing,
  onFacingChange,
}: {
  facing: CargoGridIsoFacing;
  onFacingChange: (facing: CargoGridIsoFacing) => void;
}) {
  const buttonClass = (id: CargoGridIsoFacing) =>
    [
      "inline-flex size-7 items-center justify-center rounded-[4px] border font-mono text-[0.7rem] transition-colors",
      facing === id
        ? "border-rsi-accent/50 bg-rsi-accent-muted/40 text-rsi-accent"
        : "border-rsi-border bg-rsi-bg-deep/80 text-rsi-text-secondary hover:border-rsi-border-strong hover:text-rsi-text",
    ].join(" ");

  return (
    <div
      role="group"
      aria-label="Bay view direction"
      className="pointer-events-auto absolute bottom-2 left-2 z-20 grid grid-cols-3 gap-0.5"
    >
      <span className="size-7" aria-hidden />
      <button
        type="button"
        aria-pressed={facing === "up"}
        aria-label="View up"
        title="Up"
        onClick={() => onFacingChange("up")}
        className={buttonClass("up")}
      >
        ↑
      </button>
      <span className="size-7" aria-hidden />
      <button
        type="button"
        aria-pressed={facing === "left"}
        aria-label="View left"
        title="Left"
        onClick={() => onFacingChange("left")}
        className={buttonClass("left")}
      >
        ←
      </button>
      <button
        type="button"
        aria-pressed={facing === "home"}
        aria-label="View default"
        title="Default"
        onClick={() => onFacingChange("home")}
        className={buttonClass("home")}
      >
        <DefaultFacingIcon className="size-3.5" />
      </button>
      <button
        type="button"
        aria-pressed={facing === "right"}
        aria-label="View right"
        title="Right"
        onClick={() => onFacingChange("right")}
        className={buttonClass("right")}
      >
        →
      </button>
      <span className="size-7" aria-hidden />
      <button
        type="button"
        aria-pressed={facing === "down"}
        aria-label="View down"
        title="Down"
        onClick={() => onFacingChange("down")}
        className={buttonClass("down")}
      >
        ↓
      </button>
      <span className="size-7" aria-hidden />
    </div>
  );
}

/** Extra empty cells inserted between Z layers when peel is on. */
const PEEL_GAP = 0.85;

function visualHz(hz: number, peelStack: boolean): number {
  if (!peelStack || hz <= 0) return hz;
  return hz + hz * PEEL_GAP;
}

/** Inactive layers stay in the scene (no reflow) but are fully invisible. */
const LAYER_OFF_OPACITY = 0;

export function CargoGridIsoView({
  sketch,
  cellPx = 14,
  selectedCoord = null,
  onSelectCoord,
  highlightedCoords = [],
  placementTints = [],
  placementBoxes = [],
  legendItems,
  locationLegendItems = [],
  showLocationOutlines = false,
  hiddenLocations = new Set(),
  onToggleLocation,
  hiddenCommodities = new Set(),
  onToggleCommodity,
  hiddenActions = new Set(),
  onToggleAction,
  mode = "full",
  toolbarExtra = null,
  toolbarBelow = null,
  showFacingPad = true,
  embedded = false,
  hideLegend = false,
  legendToggleAbove = false,
  hidePeel = false,
  peelStack: peelStackProp,
  onPeelStackChange,
  hiddenLayers: hiddenLayersProp,
  onToggleLayer,
}: CargoGridIsoViewProps) {
  const [peelStackInternal, setPeelStackInternal] = useState(false);
  const peelStack = peelStackProp ?? peelStackInternal;
  const [facing, setFacing] = useState<CargoGridIsoFacing>(
    defaultCargoGridIsoFacing,
  );
  const [hiddenLayersInternal, setHiddenLayersInternal] = useState<
    ReadonlySet<number>
  >(() => new Set());
  const hiddenLayers = hiddenLayersProp ?? hiddenLayersInternal;

  function setPeelStack(value: boolean | ((prev: boolean) => boolean)) {
    const next =
      typeof value === "function" ? value(peelStack) : value;
    if (onPeelStackChange) onPeelStackChange(next);
    else setPeelStackInternal(next);
  }

  const tintByKey = useMemo(() => {
    const map = new Map<string, CargoGridPlacementTint>();
    for (const tint of placementTints) {
      map.set(cargoGridCoordKey(tint.coord), tint);
    }
    return map;
  }, [placementTints]);

  // Parent passes location-filtered boxes (empty when none selected).
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

  const totalLength = cargoGridTotalLength(sketch);
  const maxWidth = cargoGridMaxWidth(sketch);
  const { viewLength, viewWidth } = viewExtents(facing, totalLength, maxWidth);
  const yawCenterX = viewLength / 2;
  const yawCenterY = viewWidth / 2;
  const projectStyle = useMemo(
    () => projectStyleForFacing(facing),
    [facing],
  );

  const { cubes, locationOutlines, locationLabelBoxIds } = useMemo(() => {
    // Inactive mission locations are omitted entirely (not semi-transparent).
    // Empty placementBoxes must not fall back to drawing every tint/highlight cell.
    const built = buildCubes(sketch, mode, highlightKeys, placementBoxes).map(
      (cube) => orientCube(cube, facing, totalLength, maxWidth),
    );
    const outlines = showLocationOutlines
      ? locationGroupBoxOutlinesFromViewBoxes(
          built
            .filter(
              (cube) =>
                cube.kind === "cargo" &&
                cube.boxId != null &&
                cube.deliveryLocationSlug != null &&
                cube.locationGroupIndex != null,
            )
            .map((cube) => ({
              id: cube.boxId!,
              locationSlug: cube.deliveryLocationSlug!,
              groupIndex: cube.locationGroupIndex!,
              origin: { x: cube.lx, y: cube.wy, z: cube.hz },
              footprint: cube.footprint,
            })),
        )
      : new Map();
    // Prefer the top of each location pile so the number sits on the crown.
    const bestLabel = new Map<
      string,
      { boxId: string; top: number; volume: number }
    >();
    for (const cube of built) {
      if (cube.kind !== "cargo" || cube.boxId == null) continue;
      const outline = outlines.get(cube.boxId);
      if (!outline) continue;
      const volume =
        cube.footprint.dx * cube.footprint.dy * cube.footprint.dz;
      const top = cube.hz + cube.footprint.dz;
      const current = bestLabel.get(outline.componentId);
      if (
        !current ||
        top > current.top ||
        (top === current.top && volume > current.volume)
      ) {
        bestLabel.set(outline.componentId, {
          boxId: cube.boxId,
          top,
          volume,
        });
      }
    }
    // Horizontal far→near only (far corner after yaw). Height is ordered
    // separately so a nearer lower crate cannot paint over a farther upper one.
    const depthKeyXY = (cube: IsoCube) => {
      const spun = yawPoint(
        cube.lx + cube.footprint.dx,
        cube.wy + cube.footprint.dy,
        yawCenterX,
        yawCenterY,
        projectStyle.yawRad,
      );
      return spun.x + spun.y;
    };
    // Painter: kind → stack height (low first) → horizontal depth → taller top.
    // Height-before-XY stops deck tops from covering crates stacked above them.
    const sorted = [...built].sort((a, b) => {
      const kindDelta = kindSortRank(a.kind) - kindSortRank(b.kind);
      if (kindDelta !== 0) return kindDelta;
      const hzDelta = a.hz - b.hz;
      if (hzDelta !== 0) return hzDelta;
      const xyDelta = depthKeyXY(a) - depthKeyXY(b);
      if (xyDelta !== 0) return xyDelta;
      return a.footprint.dz - b.footprint.dz;
    });
    return {
      cubes: sorted,
      locationOutlines: outlines,
      locationLabelBoxIds: new Set(
        [...bestLabel.values()].map((entry) => entry.boxId),
      ),
    };
  }, [
    sketch,
    mode,
    highlightKeys,
    placementBoxes,
    facing,
    totalLength,
    maxWidth,
    yawCenterX,
    yawCenterY,
    projectStyle,
    showLocationOutlines,
  ]);
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
    if (onToggleLayer) {
      onToggleLayer(z);
      return;
    }
    setHiddenLayersInternal((prev) => {
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
      project(0, 0, 0, cellPx, yawCenterX, yawCenterY, projectStyle),
      project(viewLength, 0, 0, cellPx, yawCenterX, yawCenterY, projectStyle),
      project(0, viewWidth, 0, cellPx, yawCenterX, yawCenterY, projectStyle),
      project(
        viewLength,
        viewWidth,
        0,
        cellPx,
        yawCenterX,
        yawCenterY,
        projectStyle,
      ),
      project(0, 0, viewHeight, cellPx, yawCenterX, yawCenterY, projectStyle),
      project(
        viewLength,
        0,
        viewHeight,
        cellPx,
        yawCenterX,
        yawCenterY,
        projectStyle,
      ),
      project(
        0,
        viewWidth,
        viewHeight,
        cellPx,
        yawCenterX,
        yawCenterY,
        projectStyle,
      ),
      project(
        viewLength,
        viewWidth,
        viewHeight,
        cellPx,
        yawCenterX,
        yawCenterY,
        projectStyle,
      ),
    ];
    const labels = bayEndLabelAnchors(
      facing,
      viewLength,
      viewWidth,
      cellPx,
      yawCenterX,
      yawCenterY,
      projectStyle,
    );
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const point of [
      ...corners,
      { x: labels.front.x, y: labels.front.y },
      { x: labels.rear.x, y: labels.rear.y },
    ]) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }
    // Extra room for rotated FRONT / REAR glyphs outside the hull.
    const padX = cellPx * 2.2;
    const padY = cellPx * 1.35;
    return {
      minX: minX - padX,
      minY: minY - padY,
      width: maxX - minX + padX * 2,
      height: maxY - minY + padY * 2,
      labels,
    };
  }, [
    cellPx,
    facing,
    viewHeight,
    viewLength,
    viewWidth,
    yawCenterX,
    yawCenterY,
    projectStyle,
  ]);

  const endLabels = bounds.labels;

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

  const canPeel = mode === "placement" && maxPlacedZ > 0;
  const showPeel = canPeel && !hidePeel;
  const showLayers = layerOptions.length > 0;
  const hasPickup = placementTints.some((tint) => tint.action === "pickup");
  const hasDelivery = placementTints.some(
    (tint) => tint.action === "delivery",
  );
  const showActionKey = hasPickup || hasDelivery;
  const showLocationKey = locationLegendItems.length > 0;
  const showLegend =
    !hideLegend &&
    (legend.length > 0 || showActionKey || showLayers || showLocationKey);

  const showToolbar =
    showPeel || mode !== "placement" || Boolean(toolbarBelow);

  return (
    <div
      className={[
        "relative flex h-[26rem] flex-col overflow-hidden px-3 pt-3 pb-3",
        embedded
          ? "bg-transparent"
          : "rounded-rsi border border-rsi-border bg-rsi-bg-deep/50",
      ].join(" ")}
    >
      {showToolbar ? (
        <div
          className={[
            "mb-1 flex shrink-0 flex-col items-start gap-1.5",
            showLegend ? "pr-[17.5rem]" : "",
          ].join(" ")}
        >
          {mode === "placement" ? (
            <span className="sr-only">3D cargo grid</span>
          ) : (
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-rsi-text-muted">
              Height {height}
            </p>
          )}
          {toolbarBelow}
          {showPeel ? (
            <button
              type="button"
              aria-pressed={peelStack}
              onClick={() => setPeelStack((value) => !value)}
              className={[
                "rounded-rsi border px-1.5 py-0.5 font-mono text-[0.5rem] uppercase tracking-[0.12em] transition-colors",
                peelStack
                  ? "border-rsi-accent/50 bg-rsi-accent-muted/40 text-rsi-accent"
                  : "border-rsi-border bg-rsi-bg-deep/70 text-rsi-text-secondary hover:border-rsi-border-strong hover:text-rsi-text",
              ].join(" ")}
            >
              Peel
            </button>
          ) : null}
        </div>
      ) : (
        <span className="sr-only">3D cargo grid</span>
      )}
      {showFacingPad ? (
        <IsoFacingPad facing={facing} onFacingChange={setFacing} />
      ) : null}
      {toolbarExtra ? (
        <div className="pointer-events-auto absolute right-2 bottom-2 z-20">
          {toolbarExtra}
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-auto">
        <div
          className={[
            "flex min-h-full min-w-full items-center justify-center",
            showLegend ? "pr-[17.5rem]" : "",
          ].join(" ")}
        >

      {showLegend ? (
        <div
          className={[
            "absolute right-2 z-10 w-[16rem] space-y-1.5 rounded-rsi border border-rsi-border/80 bg-rsi-bg-deep/95 px-2 py-1.5 shadow-rsi-panel",
            legendToggleAbove ? "top-8" : "top-2",
          ].join(" ")}
          aria-label="Cargo color legend"
        >
          {showLocationKey ? (
            <ul className="space-y-0.5" aria-label="Delivery locations">
              {locationLegendItems.map((item) => {
                const isOn = !hiddenLocations.has(item.locationSlug);
                const canToggle = Boolean(onToggleLocation);
                const row = (
                  <span
                    className={[
                      "flex min-w-0 flex-1 items-center gap-1.5",
                      isOn ? "" : "opacity-55",
                    ].join(" ")}
                  >
                    <span
                      className="inline-flex size-4 shrink-0 items-center justify-center rounded-[3px] border font-mono text-[0.55rem] tabular-nums text-rsi-bg-deep"
                      style={{
                        borderColor: item.stroke,
                        backgroundColor: isOn ? item.stroke : "transparent",
                        color: isOn ? undefined : item.stroke,
                      }}
                      aria-hidden
                    >
                      {item.groupIndex}
                    </span>
                    <span
                      className={[
                        "min-w-0 flex-1 truncate text-[0.7rem] leading-none",
                        isOn ? "text-rsi-text" : "text-rsi-text-muted",
                      ].join(" ")}
                    >
                      {item.locationName}
                    </span>
                    <span className="shrink-0 font-mono text-[0.55rem] tabular-nums text-rsi-text-muted">
                      {item.scu}
                    </span>
                  </span>
                );
                return (
                  <li key={item.locationSlug}>
                    {canToggle ? (
                      <button
                        type="button"
                        aria-pressed={isOn}
                        aria-label={`${isOn ? "Hide" : "Show"} ${item.locationName}`}
                        onClick={() => onToggleLocation?.(item.locationSlug)}
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
          {legend.length > 0 ? (
            <ul
              className={[
                "space-y-0.5",
                showLocationKey ? "border-t border-rsi-border/60 pt-1.5" : "",
              ].join(" ")}
            >
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
                const boxTotal = hasBoxIcons
                  ? item.boxCounts!.reduce((sum, entry) => sum + entry.count, 0)
                  : null;
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
                      {boxTotal != null ? (
                        <span className="ml-1.5 font-mono text-[0.55rem] text-rsi-text-muted">
                          ({boxTotal})
                        </span>
                      ) : null}
                    </span>
                    {hasBoxIcons ? (
                      <CargoBoxCountIcons
                        boxCounts={item.boxCounts!}
                        color={hex}
                        className="ml-4 shrink-0 justify-end gap-x-1 pl-1 [&_svg]:size-3.5 [&_span]:text-[0.55rem]"
                      />
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
                "flex items-center justify-between gap-2",
                showActionKey || legend.length > 0
                  ? "border-t border-rsi-border/60 pt-1.5"
                  : "",
              ].join(" ")}
            >
              <p className="shrink-0 font-mono text-[0.55rem] uppercase leading-none tracking-[0.14em] text-rsi-text-muted">
                Layers
              </p>
              <div className="flex flex-wrap items-center justify-end gap-1">
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
            </div>
          ) : null}
        </div>
      ) : null}

      <svg
        role="img"
        aria-label={`${sketch.shipName} isometric cargo grid, ${cubes.length} cubes. Rear left, front right by default.`}
        viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
        width={bounds.width}
        height={bounds.height}
        className="block max-w-none shrink-0"
      >
        {cubes.map((cube) => {
          const isFloor = cube.kind === "floor";
          const isPlaceholder = cube.kind === "placeholder";
          const tint = tintByKey.get(cargoGridCoordKey(cube.coord));
          const commoditySlug =
            cube.commoditySlug ?? tint?.commoditySlug ?? null;
          const commodityName =
            cube.commodityName ?? tint?.commodityName ?? null;
          const action =
            cube.kind === "cargo" ? (cube.action ?? tint?.action) : undefined;
          if (
            !isFloor &&
            ((commoditySlug != null &&
              hiddenCommodities.has(commoditySlug)) ||
              (action != null && hiddenActions.has(action)))
          ) {
            return null;
          }
          const drawHz = isFloor ? 0 : visualHz(cube.hz, peelStack);
          const faces = isFloor
            ? floorFaces(
                cube.lx,
                cube.wy,
                cellPx,
                yawCenterX,
                yawCenterY,
                projectStyle,
              )
            : boxFaces(
                cube.lx,
                cube.wy,
                drawHz,
                cube.footprint,
                cellPx,
                yawCenterX,
                yawCenterY,
                projectStyle,
              );
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
          const outline: LocationGroupBoxOutline | undefined = cube.boxId
            ? locationOutlines.get(cube.boxId)
            : undefined;
          const groupStroke = showLocationOutlines
            ? locationGroupStroke(cube.locationGroupIndex)
            : null;
          const useFullGroupOutline =
            groupStroke != null && outline?.isIsolated === true;
          const useOuterGroupOutline =
            groupStroke != null && outline != null && !outline.isIsolated;
          const leftExposed =
            outline != null && outline.exposed[faces.leftFace];
          const rightExposed =
            outline != null && outline.exposed[faces.rightFace];
          const actionStroke =
            useFullGroupOutline
              ? groupStroke
              : action === "pickup"
                ? "color-mix(in srgb, var(--rsi-accent) 55%, var(--rsi-border-strong))"
                : action === "delivery"
                  ? "color-mix(in srgb, var(--rsi-success) 75%, var(--rsi-border-strong))"
                  : null;
          const actionDash =
            useFullGroupOutline || useOuterGroupOutline
              ? undefined
              : action === "delivery"
                ? "2.5 2"
                : isPlaceholder
                  ? "2 2"
                  : undefined;
          const leftGroupStroke =
            useOuterGroupOutline && leftExposed ? groupStroke : null;
          const rightGroupStroke =
            useOuterGroupOutline && rightExposed ? groupStroke : null;
          const sideStrokeLeft =
            leftGroupStroke ?? actionStroke ?? "var(--rsi-border)";
          const sideStrokeRight =
            rightGroupStroke ?? actionStroke ?? "var(--rsi-border)";
          const topStroke = isSelected
            ? "var(--rsi-accent)"
            : useFullGroupOutline
              ? groupStroke!
              : isPlaceholder
                ? "var(--rsi-border)"
                : "var(--rsi-border-strong)";
          const topStrokeWidth = isSelected
            ? 1.4
            : useFullGroupOutline
              ? 1.15
              : actionStroke
                ? 0.85
                : 0.7;
          const sideStrokeWidthLeft = leftGroupStroke
            ? 1.15
            : useFullGroupOutline
              ? 0.95
              : actionStroke
                ? 0.65
                : 0.5;
          const sideStrokeWidthRight = rightGroupStroke
            ? 1.15
            : useFullGroupOutline
              ? 0.95
              : actionStroke
                ? 0.65
                : 0.5;
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
                  ? `${cube.locationGroupIndex != null ? `Loc ${cube.locationGroupIndex} · ` : ""}${actionLabel ? `${actionLabel} · ` : ""}${commodityName ? `${commodityName} · ` : ""}${cube.footprint.dx * cube.footprint.dy * cube.footprint.dz} SCU · ${formatCargoGridCoord(cube.coord)}`
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
                    layerDimmed
                      ? LAYER_OFF_OPACITY
                      : isPlaceholder
                        ? 0.45
                        : 1
                  }
                >
                  {leftGroupStroke || useFullGroupOutline ? (
                    <polygon
                      points={faces.left}
                      fill="none"
                      stroke="black"
                      strokeWidth={sideStrokeWidthLeft + 0.9}
                      strokeLinejoin="round"
                    />
                  ) : null}
                  <polygon
                    points={faces.left}
                    fill={colors.left}
                    stroke={sideStrokeLeft}
                    strokeWidth={sideStrokeWidthLeft}
                    strokeDasharray={actionDash}
                  />
                  {rightGroupStroke || useFullGroupOutline ? (
                    <polygon
                      points={faces.right}
                      fill="none"
                      stroke="black"
                      strokeWidth={sideStrokeWidthRight + 0.9}
                      strokeLinejoin="round"
                    />
                  ) : null}
                  <polygon
                    points={faces.right}
                    fill={colors.right}
                    stroke={sideStrokeRight}
                    strokeWidth={sideStrokeWidthRight}
                    strokeDasharray={actionDash}
                  />
                  {useFullGroupOutline ? (
                    <polygon
                      points={faces.top}
                      fill="none"
                      stroke="black"
                      strokeWidth={topStrokeWidth + 0.9}
                      strokeLinejoin="round"
                    />
                  ) : null}
                  <polygon
                    points={faces.top}
                    fill={colors.top}
                    stroke={
                      useOuterGroupOutline ? "var(--rsi-border-strong)" : topStroke
                    }
                    strokeWidth={
                      useOuterGroupOutline ? 0.55 : topStrokeWidth
                    }
                    strokeDasharray={
                      useOuterGroupOutline ? undefined : actionDash
                    }
                  />
                  {useOuterGroupOutline &&
                  groupStroke != null &&
                  outline != null &&
                  !isPlaceholder ? (
                    <g pointerEvents="none">
                      {(
                        [
                          ["ny", outline.exposed.ny],
                          ["px", outline.exposed.px],
                          ["py", outline.exposed.py],
                          ["nx", outline.exposed.nx],
                        ] as const
                      ).map(([edge, exposed]) =>
                        exposed ? (
                          <g key={`${cube.key}-edge-${edge}`}>
                            <polyline
                              points={faces.topEdges[edge]}
                              fill="none"
                              stroke="black"
                              strokeWidth={2.15}
                              strokeLinejoin="round"
                              strokeLinecap="round"
                            />
                            <polyline
                              points={faces.topEdges[edge]}
                              fill="none"
                              stroke={groupStroke}
                              strokeWidth={1.25}
                              strokeLinejoin="round"
                              strokeLinecap="round"
                            />
                          </g>
                        ) : null,
                      )}
                    </g>
                  ) : null}
                </g>
              )}
            </g>
          );
        })}
        {/* Fixed-size mission number badges on top so crates never bury them. */}
        <g pointerEvents="none" aria-hidden>
          {cubes.map((cube) => {
            if (cube.kind !== "cargo" || cube.boxId == null) return null;
            if (!locationLabelBoxIds.has(cube.boxId)) return null;
            if (!showLocationOutlines) return null;
            const groupStroke = locationGroupStroke(cube.locationGroupIndex);
            if (groupStroke == null || cube.locationGroupIndex == null) {
              return null;
            }
            if (
              Array.from(
                { length: cube.footprint.dz },
                (_, offset) => cube.hz + offset,
              ).some((z) => hiddenLayers.has(z))
            ) {
              return null;
            }
            if (
              cube.commoditySlug != null &&
              hiddenCommodities.has(cube.commoditySlug)
            ) {
              return null;
            }
            if (cube.action != null && hiddenActions.has(cube.action)) {
              return null;
            }
            const faces = boxFaces(
              cube.lx,
              cube.wy,
              visualHz(cube.hz, peelStack),
              cube.footprint,
              cellPx,
              yawCenterX,
              yawCenterY,
              projectStyle,
            );
            const badgeR = 6;
            return (
              <g key={`loc-badge-${cube.key}`}>
                <circle
                  cx={faces.topCenter.x}
                  cy={faces.topCenter.y}
                  r={badgeR + 0.75}
                  fill="none"
                  stroke="black"
                  strokeWidth={1.25}
                />
                <circle
                  cx={faces.topCenter.x}
                  cy={faces.topCenter.y}
                  r={badgeR}
                  fill="var(--rsi-bg-deep)"
                  stroke={groupStroke}
                  strokeWidth={1.5}
                />
                <text
                  x={faces.topCenter.x}
                  y={faces.topCenter.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={groupStroke}
                  fontSize={8}
                  fontFamily="var(--font-mono, ui-monospace, monospace)"
                  fontWeight={700}
                >
                  {cube.locationGroupIndex}
                </text>
              </g>
            );
          })}
        </g>
        {(
          [
            ["FRONT", endLabels.front],
            ["REAR", endLabels.rear],
          ] as const
        ).map(([label, anchor]) => (
          <text
            key={label}
            x={anchor.x}
            y={anchor.y}
            textAnchor="middle"
            dominantBaseline="central"
            fill="var(--rsi-text-secondary)"
            stroke="var(--rsi-bg-deep)"
            strokeWidth={3}
            paintOrder="stroke"
            fontSize={Math.max(8, cellPx * 0.48)}
            fontFamily="var(--font-mono, ui-monospace, monospace)"
            letterSpacing="0.16em"
            transform={`rotate(${anchor.angle} ${anchor.x} ${anchor.y})`}
            style={{ pointerEvents: "none", userSelect: "none" }}
          >
            {label}
          </text>
        ))}
      </svg>
        </div>
      </div>
    </div>
  );
}
