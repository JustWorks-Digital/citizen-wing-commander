"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  commodityBadgeBackground,
  commodityBadgeBorder,
  commodityBadgeForeground,
  resolveCommodityColorHex,
} from "@/lib/fixtures/commodityColors";
import type { CargoBoxFootprint } from "@/lib/ships/cargoBoxSizes";
import type { PlacedCargoBox } from "@/lib/ships/cargoGridPlacement";
import type { ScuBoxSplitsIndicators } from "@/lib/missions/scuCertainty";
import {
  focusPickupHangarPile,
  type StopCargoStacksPlan,
} from "@/lib/missions/stopDeliveryBoxes";
import { useRightClickPan } from "@/hooks/useRightClickPan";
import { EditableZoomPercent } from "@/components/ui/EditableZoomPercent";
import { SCU_TITLE } from "@/lib/ui/abbrevTitles";

export type StopDeliveryStacksViewProps = {
  plan: StopCargoStacksPlan;
  /** Cell size in px for the flat oblique projection. */
  cellPx?: number;
  className?: string;
  /** Controlled peel; defaults to on when omitted. */
  peelStack?: boolean;
  onPeelStackChange?: (value: boolean) => void;
  /** Hide the built-in Peel control (e.g. host it next to Cargo / Piles). */
  hidePeel?: boolean;
  /**
   * Desktop (md+): grow to the parent height and fit the graph into that
   * space. Mobile keeps the fixed max frame height.
   */
  fillAvailableHeight?: boolean;
  /** Click under-stack abbrev / box to edit crate mix. */
  onEditMissionBoxes?: (missionId: string) => void;
  /**
   * Per-mission crate-mix dots on under-stack SCU boxes (independent):
   * warn = AI uncertain, accent = manual overwrite. Both may show.
   */
  boxSplitIndicatorsByMissionId?: ReadonlyMap<string, ScuBoxSplitsIndicators>;
  /**
   * Double-click under-stack SCU to edit quantity (pick-up or drop-off);
   * remaining same-role stops rebalance on blur. 0 clears this stop.
   */
  onSetStopScu?: (
    missionId: string,
    commoditySlug: string,
    scu: number,
  ) => void;
  /** Mission commodity totals keyed by commodity slug. */
  maxStopScuBySlug?: ReadonlyMap<string, number> | null;
  /**
   * Pending keys `missionId::commoditySlug::locationSlug` while SCU save runs.
   */
  pendingSetStopScuKeys?: ReadonlySet<string>;
  /** Stop location slug — pairs with pending SCU keys. */
  locationSlug?: string | null;
};

type Point = { x: number; y: number };
const FALLBACK_HEX = "#54a0f7";
/** Low enough that tall hangar piles + under-stack labels still fit the frame. */
const ZOOM_MIN = 0.22;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.25;
/** Horizontal padding on the scroll viewport (`px-2.5` × 2). */
const VIEWPORT_PAD_X = 20;
/** Vertical padding on the scroll viewport (`pt-1` + `pb-2.5`). */
const VIEWPORT_PAD_Y = 14;
/** Leave room so fit-zoom doesn't sit on the scroll edge (matches cargo grid). */
const STACK_FIT_PAD_PX = 8;
/**
 * Cap graph frame height so tall piles zoom out instead of stretching the
 * stop card / introducing a default vertical scroll.
 */
const MAX_VIEWPORT_HEIGHT_PX = 253;

const FLOOR_TOP =
  "color-mix(in srgb, var(--rsi-surface) 70%, var(--rsi-bg-deep))";

function clampZoom(value: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(value * 100) / 100));
}

/** Shallow oblique: march along X, light depth from Y, Z rises. */
function project(lx: number, wy: number, hz: number, size: number): Point {
  return {
    x: lx * size + wy * size * 0.4,
    y: wy * size * 0.22 - hz * size,
  };
}

function poly(points: Point[]): string {
  return points.map((p) => `${p.x},${p.y}`).join(" ");
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
  const e = p(lx, wy, hz);
  const f = p(lx + dx, wy, hz);
  const g = p(lx + dx, wy + dy, hz);
  const h = p(lx, wy + dy, hz);
  return {
    top: poly([a, b, c, d]),
    /** West (−X) — left silhouette in the flat oblique view. */
    west: poly([a, d, h, e]),
    /** South (+Y) — near depth face. */
    south: poly([d, c, g, h]),
    /** East (+X) — right face. */
    east: poly([b, c, g, f]),
    /**
     * Visible wire edges drawn after fills. Face-polygon strokes alone drop the
     * bottom silhouette (shared edges / sub-pixel width), so crates look open.
     */
    edges: [
      poly([e, h]), // west bottom
      poly([h, g]), // south bottom (front)
      poly([g, f]), // east bottom
      poly([e, a]), // west back upright
      poly([f, b]), // east back upright
      poly([h, d]), // west front upright
      poly([g, c]), // east front upright
      poly([a, b]), // top far
      poly([b, c]), // top right
      poly([c, d]), // top near
      poly([d, a]), // top left
    ],
  };
}

function sideColors(hex: string): {
  top: string;
  west: string;
  south: string;
  east: string;
} {
  return {
    top: hex,
    west: `color-mix(in srgb, ${hex} 42%, black)`,
    south: `color-mix(in srgb, ${hex} 55%, black)`,
    east: `color-mix(in srgb, ${hex} 68%, black)`,
  };
}

function floorFace(lx: number, wy: number, size: number) {
  const p = (x: number, y: number, z: number) => project(x, y, z, size);
  return poly([
    p(lx, wy, 0),
    p(lx + 1, wy, 0),
    p(lx + 1, wy + 1, 0),
    p(lx, wy + 1, 0),
  ]);
}

const PEEL_GAP = 0.85;

function visualHz(hz: number, peelStack: boolean): number {
  if (!peelStack || hz <= 0) return hz;
  return hz + hz * PEEL_GAP;
}

/**
 * Bottom space for under-stack cargo labels. Must include the floored font
 * sizes so zoomed-out tall piles still leave room for abbrev + SCU.
 */
function stackBottomLabelPad(cellSize: number): number {
  const abbrevSize = Math.max(8, Math.round(cellSize * 0.55));
  const scuSize = Math.max(9, Math.round(cellSize * 0.65));
  const padTop = cellSize * 0.42;
  const padBottom = cellSize * 0.22;
  const boxH =
    padTop + padBottom + abbrevSize + scuSize + cellSize * 0.35;
  // Label box sits below the floor (`foot.y + 0.85 * cell`); keep a small margin.
  return cellSize * 0.85 + boxH + cellSize * 0.25;
}

function stackViewBounds(
  lengthCells: number,
  widthCells: number,
  viewHeight: number,
  cellSize: number,
): { minX: number; minY: number; width: number; height: number } {
  const bottomLabelPad = stackBottomLabelPad(cellSize);
  const corners = [
    project(0, 0, 0, cellSize),
    project(lengthCells, 0, 0, cellSize),
    project(0, widthCells, 0, cellSize),
    project(lengthCells, widthCells, 0, cellSize),
    project(0, 0, viewHeight, cellSize),
    project(lengthCells, 0, viewHeight, cellSize),
    project(0, widthCells, viewHeight, cellSize),
    project(lengthCells, widthCells, viewHeight, cellSize),
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
  const padX = cellSize;
  const padY = cellSize * 0.55;
  return {
    minX: minX - padX,
    minY: minY - padY,
    width: maxX - minX + padX * 2,
    height: maxY - minY + padY * 2 + bottomLabelPad,
  };
}

function sortKey(box: PlacedCargoBox, peelStack: boolean): number {
  const { origin, footprint } = box;
  const hz = visualHz(origin.z, peelStack);
  return (
    origin.x +
    origin.y +
    hz +
    footprint.dx +
    footprint.dy +
    footprint.dz
  );
}

/**
 * Checklist stop delivery stacks — flat oblique 3D pad (not the ship bay iso view).
 */
/** Tailwind `md` — pad graphs only stretch on desktop. */
const MD_MIN_WIDTH_PX = 768;

export function StopDeliveryStacksView({
  plan,
  cellPx = 14,
  className,
  peelStack: peelStackProp,
  onPeelStackChange,
  hidePeel = false,
  fillAvailableHeight = false,
  onEditMissionBoxes,
  boxSplitIndicatorsByMissionId,
  onSetStopScu,
  maxStopScuBySlug = null,
  pendingSetStopScuKeys,
  locationSlug = null,
}: StopDeliveryStacksViewProps) {
  const [peelStackInternal, setPeelStackInternal] = useState(true);
  const peelStack = peelStackProp ?? peelStackInternal;
  /** Null = auto fitZoom; set only when the user overrides zoom. */
  const [userZoom, setUserZoom] = useState<number | null>(null);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [scuEditText, setScuEditText] = useState("");
  /** Escape cancels — skip the following blur commit. */
  const skipScuCommitRef = useRef(false);

  function setPeelStack(value: boolean | ((prev: boolean) => boolean)) {
    const next = typeof value === "function" ? value(peelStack) : value;
    if (onPeelStackChange) onPeelStackChange(next);
    else setPeelStackInternal(next);
  }
  const [viewportWidth, setViewportWidth] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [isDesktop, setIsDesktop] = useState(false);
  const [pileIndex, setPileIndex] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);
  /** Overflow scroller inside the measure shell (right-click pan target). */
  const scrollRef = useRef<HTMLDivElement>(null);
  useRightClickPan(scrollRef);
  /** Last committed measure — ignore tiny scrollbar / subpixel noise. */
  const viewportSizeRef = useRef({ w: 0, h: 0 });
  const stretchToParent = fillAvailableHeight && isDesktop;

  const allPileLabels = plan.pileLabels ?? [];
  const showPileNav = allPileLabels.length > 0;
  const pileRouteKey = allPileLabels.map((pile) => pile.locationSlug).join("|");

  useEffect(() => {
    setPileIndex(0);
  }, [pileRouteKey]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(`(min-width: ${MD_MIN_WIDTH_PX}px)`);
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    // Lock after a usable layout so zoom / sibling bay graphs cannot re-enter
    // measure → fitZoom → layout. Keep sampling until flex has real height.
    let locked = false;
    let raf = 0;
    let bestW = 0;
    let bestH = 0;

    const publish = (w: number, h: number) => {
      viewportSizeRef.current = { w, h };
      setViewportWidth(w);
      setViewportHeight(h);
    };

    const commit = (nextW: number, nextH: number) => {
      if (locked) return;
      if (nextW < 32) return;
      const h = stretchToParent ? nextH : 0;
      bestW = Math.max(bestW, nextW);
      bestH = Math.max(bestH, h);
      const prev = viewportSizeRef.current;
      if (bestW !== prev.w || bestH !== prev.h) {
        publish(bestW, bestH);
      }
      const heightReady =
        !stretchToParent || bestH >= Math.min(120, MAX_VIEWPORT_HEIGHT_PX);
      if (heightReady) locked = true;
    };

    const update = () => {
      const nextW = Math.round(el.clientWidth);
      const nextH = Math.round(el.clientHeight);
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => commit(nextW, nextH));
    };

    const unlock = () => {
      locked = false;
      bestW = 0;
      bestH = 0;
      update();
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    window.addEventListener("resize", unlock);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("resize", unlock);
    };
  }, [stretchToParent]);

  const safePileIndex = showPileNav
    ? Math.min(Math.max(0, pileIndex), allPileLabels.length - 1)
    : 0;
  const activePile = showPileNav ? (allPileLabels[safePileIndex] ?? null) : null;
  const activePileSlug = activePile?.locationSlug ?? null;

  const displayPlan = useMemo(() => {
    if (!activePileSlug) return plan;
    return focusPickupHangarPile(plan, activePileSlug) ?? plan;
  }, [plan, activePileSlug]);

  const { lengthCells, widthCells, stackLabels, pileLabels } = displayPlan;

  const legendDots = useMemo(() => {
    let showEstimated = false;
    let showOverridden = false;
    if (!boxSplitIndicatorsByMissionId) {
      return { showEstimated, showOverridden };
    }
    for (const label of stackLabels) {
      if (label.missionId == null) continue;
      const indicators = boxSplitIndicatorsByMissionId.get(
        `${label.missionId}::${label.commoditySlug}`,
      );
      if (!indicators) continue;
      if (indicators.uncertain) showEstimated = true;
      if (indicators.overridden) showOverridden = true;
      if (showEstimated && showOverridden) break;
    }
    return { showEstimated, showOverridden };
  }, [boxSplitIndicatorsByMissionId, stackLabels]);

  // Frame height from the full hangar plan so pile switches keep a stable graph height.
  const frameHeightCells = showPileNav
    ? Math.max(1, plan.heightCells)
    : Math.max(1, displayPlan.heightCells);
  const frameLengthCells = showPileNav
    ? Math.max(
        1,
        ...allPileLabels.map((pile) => pile.widthCells),
        lengthCells,
      )
    : lengthCells;
  const showPeel = frameHeightCells > 1 && !hidePeel;
  const viewHeight = visualHz(frameHeightCells, peelStack);
  const stackWidthCells = 2;

  const baseBounds = useMemo(
    () =>
      stackViewBounds(frameLengthCells, widthCells, viewHeight, cellPx),
    [frameLengthCells, widthCells, viewHeight, cellPx],
  );

  const fitZoom = useMemo(() => {
    const availableW = Math.max(
      0,
      viewportWidth - VIEWPORT_PAD_X - STACK_FIT_PAD_PX,
    );
    // Desktop fill: use the stretched parent height. Otherwise keep the fixed
    // max so tall piles zoom out instead of a content-sized feedback loop.
    const frameH =
      stretchToParent && viewportHeight > 0
        ? viewportHeight
        : MAX_VIEWPORT_HEIGHT_PX;
    const availableH = Math.max(
      0,
      frameH - VIEWPORT_PAD_Y - STACK_FIT_PAD_PX,
    );
    if (availableW <= 0 || baseBounds.width <= 0) return 1;
    let zoom = Math.min(
      availableW / baseBounds.width,
      baseBounds.height > 0 ? availableH / baseBounds.height : 1,
    );
    // Under-stack labels use floored font sizes, so bounds are not linear in
    // zoom — iterate until the rendered frame fits (no H/V scroll at fit).
    for (let i = 0; i < 10; i++) {
      const rendered = stackViewBounds(
        frameLengthCells,
        widthCells,
        viewHeight,
        cellPx * zoom,
      );
      const scaleW =
        rendered.width > availableW + 0.5 && rendered.width > 0
          ? availableW / rendered.width
          : 1;
      const scaleH =
        rendered.height > availableH + 0.5 && rendered.height > 0
          ? availableH / rendered.height
          : 1;
      const scale = Math.min(scaleW, scaleH);
      if (scale >= 1) break;
      zoom *= scale;
    }
    // Rounding in clampZoom can nudge over the edge — shrink once more if needed.
    zoom = clampZoom(zoom);
    const finalBounds = stackViewBounds(
      frameLengthCells,
      widthCells,
      viewHeight,
      cellPx * zoom,
    );
    const finalScale = Math.min(
      finalBounds.width > 0 ? availableW / finalBounds.width : 1,
      finalBounds.height > 0 ? availableH / finalBounds.height : 1,
    );
    if (finalScale < 1) zoom = clampZoom(zoom * finalScale);
    return zoom;
  }, [
    viewportWidth,
    viewportHeight,
    stretchToParent,
    baseBounds.width,
    baseBounds.height,
    frameLengthCells,
    widthCells,
    viewHeight,
    cellPx,
  ]);

  useEffect(() => {
    setUserZoom(null);
  }, [pileRouteKey, frameLengthCells, widthCells, frameHeightCells, peelStack]);

  // Derive display zoom — never write fitZoom into state (that re-entered the
  // measure → setState → layout loop with dual bay graphs).
  const zoom = userZoom ?? fitZoom;
  const renderCellPx = cellPx * zoom;

  const bounds = useMemo(
    () =>
      stackViewBounds(frameLengthCells, widthCells, viewHeight, renderCellPx),
    [frameLengthCells, widthCells, viewHeight, renderCellPx],
  );

  const floorTiles = useMemo(() => {
    const tiles: { key: string; lx: number; wy: number }[] = [];
    for (let lx = 0; lx < lengthCells; lx += 1) {
      for (let wy = 0; wy < widthCells; wy += 1) {
        tiles.push({ key: `floor-${lx}-${wy}`, lx, wy });
      }
    }
    return tiles;
  }, [lengthCells, widthCells]);

  const boxes = useMemo(
    () =>
      [...displayPlan.boxes].sort(
        (a, b) => sortKey(a, peelStack) - sortKey(b, peelStack),
      ),
    [displayPlan.boxes, peelStack],
  );

  const canGoPrev = showPileNav && safePileIndex > 0;
  const canGoNext = showPileNav && safePileIndex < allPileLabels.length - 1;

  return (
    <div
      className={[
        "relative flex flex-col overflow-hidden rounded-rsi bg-rsi-bg-deep/50",
        stretchToParent ? "h-full min-h-0" : "h-auto",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex shrink-0 flex-nowrap items-start justify-between gap-2 px-2.5 pt-1.5">
        <div className="flex min-w-0 flex-wrap items-start gap-x-2.5 gap-y-1">
          <span className="sr-only">
            {pileLabels && pileLabels.length > 0
              ? "Hangar piles by delivery location"
              : "Delivery cargo stacks"}
          </span>
          {showPeel ? (
            <button
              type="button"
              aria-pressed={peelStack}
              onClick={() => setPeelStack((value) => !value)}
              className={[
                "rounded-rsi border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-[0.12em] transition-colors",
                peelStack
                  ? "border-rsi-accent/50 bg-rsi-accent-muted/40 text-rsi-accent"
                  : "border-rsi-border bg-rsi-bg-deep/70 text-rsi-text-secondary hover:border-rsi-border-strong hover:text-rsi-text",
              ].join(" ")}
            >
              Peel
            </button>
          ) : null}
          {legendDots.showEstimated || legendDots.showOverridden ? (
            <div
              className="flex flex-wrap items-center gap-x-3 gap-y-1"
              role="list"
              aria-label="Crate-mix indicator legend"
            >
              {legendDots.showEstimated ? (
                <span
                  role="listitem"
                  className="inline-flex items-center gap-1.5 font-mono text-[0.5rem] leading-none uppercase tracking-[0.1em] text-rsi-text-muted"
                >
                  <span
                    aria-hidden
                    className="inline-block size-1.5 shrink-0 self-center rounded-full bg-rsi-warn"
                  />
                  <span className="leading-none">Estimated</span>
                </span>
              ) : null}
              {legendDots.showOverridden ? (
                <span
                  role="listitem"
                  className="inline-flex items-center gap-1.5 font-mono text-[0.5rem] leading-none uppercase tracking-[0.1em] text-rsi-text-muted"
                >
                  <span
                    aria-hidden
                    className="inline-block size-1.5 shrink-0 self-center rounded-full bg-rsi-accent"
                  />
                  <span className="leading-none">Overridden</span>
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        <div
          className="inline-flex shrink-0 overflow-hidden rounded-rsi border border-rsi-border/80 bg-rsi-bg-deep/95"
          role="group"
          aria-label="Cargo stack zoom"
        >
          <button
            type="button"
            aria-label="Zoom out"
            title="Zoom out"
            disabled={zoom <= ZOOM_MIN}
            onClick={() => {
              setUserZoom((prev) =>
                clampZoom((prev ?? fitZoom) - ZOOM_STEP),
              );
            }}
            className={[
              "inline-flex size-6 items-center justify-center border-r border-rsi-border/80 font-mono text-[0.7rem]",
              "text-rsi-text-secondary transition-colors hover:text-rsi-accent",
              "disabled:cursor-default disabled:opacity-40",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
            ].join(" ")}
          >
            −
          </button>
          <EditableZoomPercent
            zoom={zoom}
            min={ZOOM_MIN}
            max={ZOOM_MAX}
            onChange={(next) => {
              setUserZoom(next);
            }}
            onClick={() => {
              setUserZoom(null);
            }}
            title="Fit to view · click to reset"
            aria-label="Fit zoom"
            className={[
              "inline-flex min-w-[2.5rem] items-center justify-center border-r border-rsi-border/80 px-1",
              "font-mono text-[0.5rem] tabular-nums tracking-[0.08em] text-rsi-text-muted",
              "transition-colors hover:text-rsi-accent",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
            ].join(" ")}
          />
          <button
            type="button"
            aria-label="Zoom in"
            title="Zoom in"
            disabled={zoom >= ZOOM_MAX}
            onClick={() => {
              setUserZoom((prev) =>
                clampZoom((prev ?? fitZoom) + ZOOM_STEP),
              );
            }}
            className={[
              "inline-flex size-6 items-center justify-center font-mono text-[0.7rem]",
              "text-rsi-text-secondary transition-colors hover:text-rsi-accent",
              "disabled:cursor-default disabled:opacity-40",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
            ].join(" ")}
          >
            +
          </button>
        </div>
      </div>

      {/* In-flow SVG so bay sections keep real height; overflow-hidden on the
          shell keeps scrollbars off the ResizeObserver target. */}
      <div
        ref={viewportRef}
        className={[
          "relative min-w-0 overflow-hidden px-2.5 pb-2.5 pt-1",
          stretchToParent ? "min-h-0 flex-1" : "",
        ].join(" ")}
        style={
          stretchToParent ? undefined : { maxHeight: MAX_VIEWPORT_HEIGHT_PX }
        }
      >
        <div
          ref={scrollRef}
          className={[
            "h-full min-h-0 min-w-0",
            // Auto-fit: clip (no phantom H scroll). Scroll + pan only after zoom-in.
            zoom > fitZoom + 0.01 ? "overflow-auto" : "overflow-hidden",
          ].join(" ")}
        >
        <div
          className={[
            "flex w-max min-w-full justify-center",
            stretchToParent ? "h-full items-center" : "items-start",
          ].join(" ")}
        >
          <svg
            role="img"
            aria-label={`Delivery cargo stacks, ${boxes.length} crates`}
            viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
            width={bounds.width}
            height={bounds.height}
            className="block max-w-none shrink-0"
          >
            {floorTiles.map((tile) => (
              <polygon
                key={tile.key}
                points={floorFace(tile.lx, tile.wy, renderCellPx)}
                fill={FLOOR_TOP}
                stroke="var(--rsi-border)"
                strokeWidth={0.4}
                opacity={0.9}
              />
            ))}
            {boxes.map((box) => {
              const hex =
                resolveCommodityColorHex(
                  box.color,
                  box.color2,
                  box.commoditySlug,
                ) ?? FALLBACK_HEX;
              const colors = sideColors(hex);
              const faces = boxFaces(
                box.origin.x,
                box.origin.y,
                visualHz(box.origin.z, peelStack),
                box.footprint,
                renderCellPx,
              );
              const isPickup = (box.action ?? displayPlan.action) === "pickup";
              const actionStroke = isPickup
                ? "color-mix(in srgb, var(--rsi-accent) 32%, var(--rsi-border-strong))"
                : "color-mix(in srgb, var(--rsi-gold) 42%, var(--rsi-border-strong))";
              const actionDash = isPickup ? undefined : "2.5 2";
              return (
                <g key={box.id}>
                  <title>
                    {box.deliveryLocationName
                      ? `${box.deliveryLocationName} pile`
                      : isPickup
                        ? "Pick up"
                        : "Drop off"}{" "}
                    · {box.commodityName} · {box.size} SCU
                  </title>
                  <polygon points={faces.west} fill={colors.west} />
                  <polygon points={faces.south} fill={colors.south} />
                  <polygon points={faces.east} fill={colors.east} />
                  <polygon points={faces.top} fill={colors.top} />
                  {/* Explicit edges: black under + blue/green action rim. */}
                  {faces.edges.map((points, edgeIndex) => (
                    <g key={`${box.id}-edge-${edgeIndex}`}>
                      <polyline
                        points={points}
                        fill="none"
                        stroke="rgba(0,0,0,0.9)"
                        strokeWidth={1.35}
                        strokeLinecap="square"
                        strokeLinejoin="miter"
                      />
                      <polyline
                        points={points}
                        fill="none"
                        stroke={actionStroke}
                        strokeWidth={0.85}
                        strokeDasharray={actionDash}
                        strokeLinecap="square"
                        strokeLinejoin="miter"
                      />
                    </g>
                  ))}
                </g>
              );
            })}
            {stackLabels.map((label) => {
              const labelSpan = label.widthCells ?? stackWidthCells;
              const foot = project(
                label.x + labelSpan / 2,
                widthCells / 2,
                0,
                renderCellPx,
              );
              const canEditBoxes =
                Boolean(onEditMissionBoxes) && Boolean(label.missionId);
              const pendingScuKey =
                label.missionId && label.commoditySlug && locationSlug
                  ? `${label.missionId}::${label.commoditySlug}::${locationSlug}`
                  : null;
              const isScuPending = Boolean(
                pendingScuKey && pendingSetStopScuKeys?.has(pendingScuKey),
              );
              const canEditStopScu =
                (displayPlan.action === "pickup" ||
                  displayPlan.action === "delivery") &&
                Boolean(onSetStopScu) &&
                Boolean(label.missionId) &&
                label.scu > 0 &&
                !isScuPending;
              const isEditingScu = editingLabelId === label.id;
              const roleVerb =
                displayPlan.action === "pickup" ? "pickups" : "drop-offs";
              // Same commodity chip colors as left-side cargo tiles / stack crates.
              const cargoHex =
                resolveCommodityColorHex(
                  null,
                  null,
                  label.commoditySlug,
                ) ?? FALLBACK_HEX;
              const labelBoxFill = commodityBadgeBackground(cargoHex);
              const labelBoxStroke = commodityBadgeBorder(cargoHex);
              const labelAbbrevFill = commodityBadgeForeground(cargoHex);
              const boxSplitIndicators =
                label.missionId != null
                  ? (boxSplitIndicatorsByMissionId?.get(
                      `${label.missionId}::${label.commoditySlug}`,
                    ) ?? null)
                  : null;
              const scuTitle =
                displayPlan.action === "pickup"
                  ? `${label.scu} ${SCU_TITLE} pick up · ${label.commodityName}`
                  : `${label.scu} ${SCU_TITLE} drop off · ${label.commodityName}`;
              const editHints = [
                canEditBoxes ? "Click to edit box types" : null,
                canEditStopScu
                  ? `Double-click SCU to edit — remaining ${roleVerb} rebalance; 0 removes`
                  : null,
              ].filter(Boolean);
              const editHint =
                editHints.length > 0 ? ` · ${editHints.join(" · ")}` : "";
              const indicatorHints = [
                boxSplitIndicators?.uncertain ? "Crate mix estimated" : null,
                boxSplitIndicators?.overridden ? "Crate mix overridden" : null,
              ].filter(Boolean);
              const indicatorHint =
                indicatorHints.length > 0
                  ? ` · ${indicatorHints.join(" · ")}`
                  : "";
              const abbrevSize = Math.max(8, Math.round(renderCellPx * 0.55));
              const scuSize = Math.max(9, Math.round(renderCellPx * 0.65));
              const padX = renderCellPx * 0.45;
              const padTop = renderCellPx * 0.42;
              const padBottom = renderCellPx * 0.22;
              const boxW = Math.max(
                renderCellPx * 2.1,
                padX * 2 + abbrevSize * 2.6,
              );
              const boxH =
                padTop +
                padBottom +
                abbrevSize +
                scuSize +
                renderCellPx * 0.35;
              const boxX = foot.x - boxW / 2;
              const boxY = foot.y + renderCellPx * 0.85;
              const abbrevY = boxY + padTop;
              const scuY = abbrevY + abbrevSize + renderCellPx * 0.2;
              // Wide (not tall) SCU hit strip — easier double-click than the glyph alone.
              const scuHitW = Math.max(boxW + renderCellPx * 1.2, renderCellPx * 3.4);
              const scuHitH = scuSize + 4;
              const scuHitX = foot.x - scuHitW / 2;
              const scuHitY = scuY - 1;
              const indicatorDotR = Math.max(1.5, renderCellPx * 0.11);
              const indicatorDotInset = Math.max(2, renderCellPx * 0.14);
              const indicatorDotGap = indicatorDotR * 2 + renderCellPx * 0.12;
              const indicatorCy =
                boxY + boxH - indicatorDotInset - indicatorDotR;
              const indicatorDots: Array<{
                key: string;
                fill: string;
                title: string;
              }> = [];
              if (boxSplitIndicators?.uncertain) {
                indicatorDots.push({
                  key: "uncertain",
                  fill: "var(--rsi-warn)",
                  title: "Crate mix estimated",
                });
              }
              if (boxSplitIndicators?.overridden) {
                indicatorDots.push({
                  key: "overridden",
                  fill: "var(--rsi-accent)",
                  title: "Crate mix overridden",
                });
              }

              const commitStopScu = () => {
                setEditingLabelId(null);
                if (skipScuCommitRef.current) {
                  skipScuCommitRef.current = false;
                  return;
                }
                if (!canEditStopScu || !label.missionId) return;
                const maxScu = Math.max(
                  0,
                  maxStopScuBySlug?.get(label.commoditySlug) ?? label.scu,
                );
                const parsed = Math.min(
                  maxScu,
                  Math.max(0, Math.floor(Number(scuEditText) || 0)),
                );
                setScuEditText(String(parsed));
                if (parsed === label.scu) return;
                onSetStopScu?.(
                  label.missionId,
                  label.commoditySlug,
                  parsed,
                );
              };

              return (
                <g
                  key={`label-${label.id}`}
                  style={
                    canEditBoxes || canEditStopScu
                      ? { cursor: "pointer" }
                      : undefined
                  }
                >
                  <title>{`${scuTitle}${indicatorHint}${editHint}`}</title>
                  <rect
                    x={boxX}
                    y={boxY}
                    width={boxW}
                    height={boxH}
                    rx={3}
                    fill={labelBoxFill}
                    stroke={labelBoxStroke}
                    strokeWidth={1}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      if (isEditingScu) return;
                      if (!canEditBoxes || !label.missionId) return;
                      onEditMissionBoxes?.(label.missionId);
                    }}
                  />
                  {indicatorDots.map((dot, index) => (
                    <circle
                      key={dot.key}
                      cx={
                        boxX +
                        indicatorDotInset +
                        indicatorDotR +
                        index * indicatorDotGap
                      }
                      cy={indicatorCy}
                      r={indicatorDotR}
                      fill={dot.fill}
                    >
                      <title>{dot.title}</title>
                    </circle>
                  ))}
                  <text
                    x={foot.x}
                    y={abbrevY}
                    textAnchor="middle"
                    dominantBaseline="hanging"
                    fill={labelAbbrevFill}
                    style={{
                      fontFamily: "var(--font-mono, ui-monospace, monospace)",
                      fontSize: abbrevSize,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                    }}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      if (isEditingScu) return;
                      if (!canEditBoxes || !label.missionId) return;
                      onEditMissionBoxes?.(label.missionId);
                    }}
                  >
                    <title>{label.commodityName}</title>
                    {label.abbrev}
                  </text>
                  {isEditingScu ? (
                    <foreignObject
                      x={scuHitX}
                      y={scuHitY}
                      width={scuHitW}
                      height={scuHitH + 2}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "100%",
                          height: "100%",
                        }}
                      >
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={
                            maxStopScuBySlug?.get(label.commoditySlug) ??
                            undefined
                          }
                          step={1}
                          value={scuEditText}
                          aria-label={`${label.commodityName} ${displayPlan.action === "pickup" ? "pick-up" : "drop-off"} SCU`}
                          autoFocus
                          onFocus={(event) => event.currentTarget.select()}
                          onChange={(event) =>
                            setScuEditText(event.target.value)
                          }
                          onBlur={commitStopScu}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              (event.target as HTMLInputElement).blur();
                            }
                            if (event.key === "Escape") {
                              event.preventDefault();
                              skipScuCommitRef.current = true;
                              setScuEditText(String(label.scu));
                              setEditingLabelId(null);
                              (event.target as HTMLInputElement).blur();
                            }
                          }}
                          onClick={(event) => event.stopPropagation()}
                          onDoubleClick={(event) => event.stopPropagation()}
                          style={{
                            width: "100%",
                            maxWidth: "4.5rem",
                            boxSizing: "border-box",
                            margin: 0,
                            padding: "0 4px",
                            border: "1px solid color-mix(in srgb, var(--rsi-accent) 55%, transparent)",
                            borderRadius: 2,
                            background:
                              "color-mix(in srgb, var(--rsi-bg-deep) 70%, transparent)",
                            color: "var(--rsi-text)",
                            fontFamily:
                              "var(--font-mono, ui-monospace, monospace)",
                            fontSize: scuSize,
                            fontVariantNumeric: "tabular-nums",
                            letterSpacing: "0.04em",
                            textAlign: "center",
                            outline: "none",
                          }}
                        />
                      </div>
                    </foreignObject>
                  ) : (
                    <g>
                      {/* Wider SCU hit strip (same height as the number) for double-click. */}
                      <rect
                        x={scuHitX}
                        y={scuHitY}
                        width={scuHitW}
                        height={scuHitH}
                        fill="transparent"
                        style={{
                          cursor: canEditStopScu ? "text" : undefined,
                        }}
                        onClick={(event) => {
                          // Don't open box-types modal from the SCU strip.
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        onDoubleClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          if (!canEditStopScu || !label.missionId) return;
                          setScuEditText(String(label.scu));
                          setEditingLabelId(label.id);
                        }}
                      >
                        <title>
                          {canEditStopScu
                            ? `Double-click to edit ${SCU_TITLE}`
                            : SCU_TITLE}
                        </title>
                      </rect>
                      <text
                        x={foot.x}
                        y={scuY}
                        textAnchor="middle"
                        dominantBaseline="hanging"
                        fill={labelAbbrevFill}
                        pointerEvents="none"
                        style={{
                          fontFamily:
                            "var(--font-mono, ui-monospace, monospace)",
                          fontSize: scuSize,
                          fontVariantNumeric: "tabular-nums",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {label.scu}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
        </div>
      </div>
      {showPileNav && activePile ? (
        <div
          className="flex shrink-0 items-center gap-2 border-t border-rsi-border/80 px-2.5 py-2"
          role="navigation"
          aria-label="Hangar pile"
        >
          <button
            type="button"
            aria-label="Previous pile"
            title="Previous pile"
            disabled={!canGoPrev}
            onClick={() => setPileIndex((value) => Math.max(0, value - 1))}
            className={[
              "inline-flex size-7 shrink-0 items-center justify-center rounded-rsi border font-mono text-sm transition-colors",
              canGoPrev
                ? "border-rsi-border bg-rsi-bg-deep/80 text-rsi-text-secondary hover:border-rsi-accent/45 hover:text-rsi-accent"
                : "cursor-default border-rsi-border/50 bg-rsi-bg-deep/40 text-rsi-text-muted opacity-40",
            ].join(" ")}
          >
            ‹
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p
              className="truncate text-sm font-medium leading-snug text-rsi-text"
              title={`${activePile.locationName} pile`}
            >
              {activePile.locationName}
            </p>
            <p
              className="mt-0.5 font-mono text-[0.55rem] tabular-nums tracking-[0.14em] text-rsi-text-muted"
              title={`Pile ${safePileIndex + 1} of ${allPileLabels.length}`}
            >
              {safePileIndex + 1}/{allPileLabels.length}
            </p>
          </div>
          <button
            type="button"
            aria-label="Next pile"
            title="Next pile"
            disabled={!canGoNext}
            onClick={() =>
              setPileIndex((value) =>
                Math.min(allPileLabels.length - 1, value + 1),
              )
            }
            className={[
              "inline-flex size-7 shrink-0 items-center justify-center rounded-rsi border font-mono text-sm transition-colors",
              canGoNext
                ? "border-rsi-border bg-rsi-bg-deep/80 text-rsi-text-secondary hover:border-rsi-accent/45 hover:text-rsi-accent"
                : "cursor-default border-rsi-border/50 bg-rsi-bg-deep/40 text-rsi-text-muted opacity-40",
            ].join(" ")}
          >
            ›
          </button>
        </div>
      ) : null}
    </div>
  );
}
