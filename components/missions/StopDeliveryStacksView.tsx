"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { resolveCommodityColorHex } from "@/lib/fixtures/commodityColors";
import { CargoBoxCountIcons } from "@/components/ships/CargoBoxSizeIcon";
import type { CargoBoxFootprint } from "@/lib/ships/cargoBoxSizes";
import type { PlacedCargoBox } from "@/lib/ships/cargoGridPlacement";
import {
  focusPickupHangarPile,
  type StopCargoStacksPlan,
} from "@/lib/missions/stopDeliveryBoxes";
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
   * Double-click the under-stack cargo label (abbrev + SCU) — or a Breakdown
   * row — to edit that mission’s crate mix.
   */
  onEditMissionBoxes?: (missionId: string) => void;
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

function SplitMissionIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 12 12"
      className={className}
      aria-hidden
      focusable="false"
    >
      <rect
        x="1.25"
        y="3.25"
        width="6.5"
        height="6.5"
        rx="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
      />
      <rect
        x="4.25"
        y="1.25"
        width="6.5"
        height="6.5"
        rx="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        opacity="0.9"
      />
    </svg>
  );
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
  hasPileLabels: boolean,
): { minX: number; minY: number; width: number; height: number } {
  const pileHeaderPad = hasPileLabels ? cellSize * 2.1 : 0;
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
    // Extra top room for pile headers when present.
    minY: minY - padY - pileHeaderPad,
    width: maxX - minX + padX * 2,
    height: maxY - minY + padY * 2 + pileHeaderPad + bottomLabelPad,
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
export function StopDeliveryStacksView({
  plan,
  cellPx = 14,
  className,
  peelStack: peelStackProp,
  onPeelStackChange,
  hidePeel = false,
  onEditMissionBoxes,
}: StopDeliveryStacksViewProps) {
  const [legendCollapsed, setLegendCollapsed] = useState(true);
  const [peelStackInternal, setPeelStackInternal] = useState(true);
  const peelStack = peelStackProp ?? peelStackInternal;
  const [zoom, setZoom] = useState(1);

  function setPeelStack(value: boolean | ((prev: boolean) => boolean)) {
    const next = typeof value === "function" ? value(peelStack) : value;
    if (onPeelStackChange) onPeelStackChange(next);
    else setPeelStackInternal(next);
  }
  const [viewportWidth, setViewportWidth] = useState(0);
  const [pileIndex, setPileIndex] = useState(0);
  const [hiddenCommodities, setHiddenCommodities] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const viewportRef = useRef<HTMLDivElement>(null);
  const userZoomedRef = useRef(false);

  const allPileLabels = plan.pileLabels ?? [];
  const showPileNav = allPileLabels.length > 0;
  const pileRouteKey = allPileLabels.map((pile) => pile.locationSlug).join("|");

  useEffect(() => {
    setPileIndex(0);
  }, [pileRouteKey]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const update = () => setViewportWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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
  const hasPileLabels = Boolean(pileLabels && pileLabels.length > 0);

  const baseBounds = useMemo(
    () =>
      stackViewBounds(
        frameLengthCells,
        widthCells,
        viewHeight,
        cellPx,
        hasPileLabels,
      ),
    [frameLengthCells, widthCells, viewHeight, cellPx, hasPileLabels],
  );

  const fitZoom = useMemo(() => {
    const availableW = Math.max(0, viewportWidth - VIEWPORT_PAD_X);
    // Fit to the fixed max frame height (not measured height) so tall piles
    // zoom out instead of fighting a content-sized viewport feedback loop.
    const availableH = Math.max(0, MAX_VIEWPORT_HEIGHT_PX - VIEWPORT_PAD_Y);
    if (availableW <= 0 || baseBounds.width <= 0) return 1;
    let zoom = Math.min(
      availableW / baseBounds.width,
      baseBounds.height > 0 ? availableH / baseBounds.height : 1,
    );
    // Under-stack labels use floored font sizes, so bounds height is not linear
    // in zoom — iterate until the rendered frame actually fits (no y-scroll).
    for (let i = 0; i < 10; i++) {
      const renderedHeight = stackViewBounds(
        frameLengthCells,
        widthCells,
        viewHeight,
        cellPx * zoom,
        hasPileLabels,
      ).height;
      if (renderedHeight <= availableH + 0.5 || renderedHeight <= 0) break;
      zoom *= availableH / renderedHeight;
    }
    return clampZoom(zoom);
  }, [
    viewportWidth,
    baseBounds.width,
    baseBounds.height,
    frameLengthCells,
    widthCells,
    viewHeight,
    cellPx,
    hasPileLabels,
  ]);

  useEffect(() => {
    userZoomedRef.current = false;
  }, [pileRouteKey, frameLengthCells, widthCells, frameHeightCells, peelStack]);

  useEffect(() => {
    if (!userZoomedRef.current) setZoom(fitZoom);
  }, [fitZoom]);

  const renderCellPx = cellPx * zoom;

  const bounds = useMemo(
    () =>
      stackViewBounds(
        frameLengthCells,
        widthCells,
        viewHeight,
        renderCellPx,
        hasPileLabels,
      ),
    [frameLengthCells, widthCells, viewHeight, renderCellPx, hasPileLabels],
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

  function toggleCommodity(slug: string) {
    setHiddenCommodities((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  return (
    <div
      className={[
        "relative flex h-auto flex-col overflow-hidden rounded-rsi border border-rsi-border bg-rsi-bg-deep/50",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex shrink-0 flex-nowrap items-center justify-between gap-2 px-2.5 pt-1.5">
        <div className="flex min-w-0 items-start gap-2">
          <span className="sr-only">
            {pileLabels && pileLabels.length > 0
              ? "Hangar piles by delivery location"
              : "Delivery cargo stacks"}
          </span>
          <div className="relative z-10 shrink-0">
            <button
              type="button"
              aria-expanded={!legendCollapsed}
              aria-controls="stop-delivery-stacks-breakdown"
              title={legendCollapsed ? "Show breakdown" : "Hide breakdown"}
              onClick={() => setLegendCollapsed((value) => !value)}
              className={[
                "inline-flex items-center gap-1 rounded-rsi border px-1.5 py-1.5 font-mono text-[0.55rem] uppercase leading-none tracking-[0.14em] transition-colors",
                legendCollapsed
                  ? "border-rsi-border/80 bg-rsi-bg-deep/95 text-rsi-text-muted hover:border-rsi-accent/40 hover:text-rsi-accent"
                  : "border-rsi-accent/40 bg-rsi-accent-muted/30 text-rsi-accent",
              ].join(" ")}
            >
              <span aria-hidden>{legendCollapsed ? "‹" : "›"}</span>
              Breakdown
            </button>
            {!legendCollapsed ? (
              <aside
                id="stop-delivery-stacks-breakdown"
                aria-label="Cargo breakdown"
                className="absolute top-0 left-full z-10 ml-1.5 w-[12.5rem] rounded-rsi border border-rsi-border/80 bg-rsi-bg-deep/95 px-2 py-1.5 shadow-rsi-panel"
              >
                <ul className="space-y-0.5">
                  {displayPlan.legendItems.map((item) => {
                    const hex =
                      resolveCommodityColorHex(
                        item.color,
                        item.color2,
                        item.commoditySlug,
                      ) ?? FALLBACK_HEX;
                    const isOn = !hiddenCommodities.has(item.commoditySlug);
                    const canEditBoxes =
                      Boolean(onEditMissionBoxes) && Boolean(item.missionId);
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          aria-pressed={isOn}
                          title={
                            canEditBoxes
                              ? "Click to toggle · double-click to edit box types"
                              : undefined
                          }
                          onClick={() => toggleCommodity(item.commoditySlug)}
                          onDoubleClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            if (!canEditBoxes || !item.missionId) return;
                            onEditMissionBoxes?.(item.missionId);
                          }}
                          className="flex w-full cursor-pointer text-left"
                        >
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
                              {item.locationName
                                ? `${item.commodityName} · ${item.locationName}`
                                : item.commodityName}
                            </span>
                            {item.isSplitMission ? (
                              <span
                                className="inline-flex shrink-0 text-rsi-warn"
                                title="Same cargo type from separate contracts"
                              >
                                <SplitMissionIcon className="size-3" />
                                <span className="sr-only">
                                  Same cargo type from separate contracts
                                </span>
                              </span>
                            ) : null}
                            <CargoBoxCountIcons
                              boxCounts={item.boxCounts}
                              color={hex}
                              className="ml-auto shrink-0 justify-end gap-x-1 [&_svg]:size-3.5 [&_span]:text-[0.55rem]"
                            />
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </aside>
            ) : null}
          </div>
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
              userZoomedRef.current = true;
              setZoom((value) => clampZoom(value - ZOOM_STEP));
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
              userZoomedRef.current = true;
              setZoom(next);
            }}
            onClick={() => {
              userZoomedRef.current = false;
              setZoom(fitZoom);
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
              userZoomedRef.current = true;
              setZoom((value) => clampZoom(value + ZOOM_STEP));
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

      <div
        ref={viewportRef}
        className={[
          "relative min-w-0 px-2.5 pb-2.5 pt-1",
          // Default fit zoom must not introduce a vertical scrollbar; allow it
          // only after the user zooms in past the auto-fit scale.
          zoom > fitZoom + 0.01 ? "overflow-auto" : "overflow-x-auto overflow-y-hidden",
        ].join(" ")}
        style={{ maxHeight: MAX_VIEWPORT_HEIGHT_PX }}
      >
        <div className="flex w-max min-w-full items-start justify-center">
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
              const dimmed = hiddenCommodities.has(box.commoditySlug);
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
                <g key={box.id} opacity={dimmed ? 0.28 : 1}>
                  <title>
                    {box.deliveryLocationName
                      ? `${box.deliveryLocationName} pile`
                      : isPickup
                        ? "Pickup"
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
            {pileLabels?.map((pile) => {
              const left = project(pile.x, widthCells / 2, viewHeight, renderCellPx);
              const right = project(
                pile.x + pile.widthCells,
                widthCells / 2,
                viewHeight,
                renderCellPx,
              );
              const midX = (left.x + right.x) / 2;
              const topY = Math.min(left.y, right.y) - renderCellPx * 1.55;
              const fontSize = Math.max(8, Math.round(renderCellPx * 0.55));
              return (
                <g key={`pile-${pile.id}`}>
                  <title>
                    {pile.locationName} pile · {pile.scu} {SCU_TITLE}
                  </title>
                  <text
                    x={midX}
                    y={topY}
                    textAnchor="middle"
                    dominantBaseline="auto"
                    fill="var(--rsi-text-secondary)"
                    style={{
                      fontFamily: "var(--font-mono, ui-monospace, monospace)",
                      fontSize,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                    }}
                  >
                    <title>{pile.locationName}</title>
                    {pile.abbrev} · {pile.scu}
                  </text>
                </g>
              );
            })}
            {stackLabels.map((label) => {
              const dimmed = hiddenCommodities.has(label.commoditySlug);
              const labelSpan = label.widthCells ?? stackWidthCells;
              const foot = project(
                label.x + labelSpan / 2,
                widthCells / 2,
                0,
                renderCellPx,
              );
              const canEditBoxes =
                Boolean(onEditMissionBoxes) && Boolean(label.missionId);
              const scuTitle =
                displayPlan.action === "pickup"
                  ? `${label.scu} ${SCU_TITLE} collect · ${label.commodityName}`
                  : `${label.scu} ${SCU_TITLE} drop off · ${label.commodityName}`;
              const editHint = canEditBoxes
                ? " · Double-click to edit box types"
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
              return (
                <g
                  key={`label-${label.id}`}
                  opacity={dimmed ? 0.35 : 1}
                  style={canEditBoxes ? { cursor: "pointer" } : undefined}
                  onDoubleClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (!canEditBoxes || !label.missionId) return;
                    onEditMissionBoxes?.(label.missionId);
                  }}
                >
                  <title>{`${scuTitle}${editHint}`}</title>
                  <rect
                    x={boxX}
                    y={boxY}
                    width={boxW}
                    height={boxH}
                    rx={3}
                    fill="var(--rsi-bg-deep)"
                    stroke="var(--rsi-border-strong)"
                    strokeWidth={1}
                  />
                  <text
                    x={foot.x}
                    y={abbrevY}
                    textAnchor="middle"
                    dominantBaseline="hanging"
                    fill="var(--rsi-text-secondary)"
                    style={{
                      fontFamily: "var(--font-mono, ui-monospace, monospace)",
                      fontSize: abbrevSize,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                    }}
                  >
                    <title>{label.commodityName}</title>
                    {label.abbrev}
                  </text>
                  <text
                    x={foot.x}
                    y={scuY}
                    textAnchor="middle"
                    dominantBaseline="hanging"
                    fill="var(--rsi-text)"
                    style={{
                      fontFamily: "var(--font-mono, ui-monospace, monospace)",
                      fontSize: scuSize,
                      fontVariantNumeric: "tabular-nums",
                      letterSpacing: "0.04em",
                    }}
                  >
                    <title>{SCU_TITLE}</title>
                    {label.scu}
                  </text>
                </g>
              );
            })}
          </svg>
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
            <p className="mt-0.5 font-mono text-[0.55rem] uppercase tracking-[0.14em] text-rsi-text-muted">
              Pile {safePileIndex + 1}/{allPileLabels.length}
              <span className="ml-1.5 tabular-nums">
                {activePile.scu}{" "}
                <span title={SCU_TITLE}>SCU</span>
              </span>
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
