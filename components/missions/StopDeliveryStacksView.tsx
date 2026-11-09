"use client";

import { useMemo, useState } from "react";
import { resolveCommodityColorHex } from "@/lib/fixtures/commodityColors";
import { CargoBoxCountIcons } from "@/components/ships/CargoBoxSizeIcon";
import type { CargoBoxFootprint } from "@/lib/ships/cargoBoxSizes";
import type { PlacedCargoBox } from "@/lib/ships/cargoGridPlacement";
import type { StopCargoStacksPlan } from "@/lib/missions/stopDeliveryBoxes";

export type StopDeliveryStacksViewProps = {
  plan: StopCargoStacksPlan;
  /** Cell size in px for the flat oblique projection. */
  cellPx?: number;
  className?: string;
};

type Point = { x: number; y: number };
const FALLBACK_HEX = "#54a0f7";

const FLOOR_TOP =
  "color-mix(in srgb, var(--rsi-surface) 70%, var(--rsi-bg-deep))";

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
}: StopDeliveryStacksViewProps) {
  const [legendCollapsed, setLegendCollapsed] = useState(true);
  const [peelStack, setPeelStack] = useState(true);
  const [hiddenCommodities, setHiddenCommodities] = useState<
    ReadonlySet<string>
  >(() => new Set());

  const { lengthCells, widthCells, heightCells, stackLabels } = plan;
  const showPeel = heightCells > 1;
  const viewHeight = visualHz(heightCells, peelStack);
  const stackWidthCells = 2;
  const labelPad = cellPx * 1.15;

  const bounds = useMemo(() => {
    const corners = [
      project(0, 0, 0, cellPx),
      project(lengthCells, 0, 0, cellPx),
      project(0, widthCells, 0, cellPx),
      project(lengthCells, widthCells, 0, cellPx),
      project(0, 0, viewHeight, cellPx),
      project(lengthCells, 0, viewHeight, cellPx),
      project(0, widthCells, viewHeight, cellPx),
      project(lengthCells, widthCells, viewHeight, cellPx),
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
    const padY = cellPx * 0.55;
    return {
      minX: minX - padX,
      minY: minY - padY,
      width: maxX - minX + padX * 2,
      height: maxY - minY + padY * 2 + labelPad,
    };
  }, [cellPx, lengthCells, widthCells, viewHeight, labelPad]);

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
      [...plan.boxes].sort(
        (a, b) => sortKey(a, peelStack) - sortKey(b, peelStack),
      ),
    [plan.boxes, peelStack],
  );

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
        <div className="flex min-w-0 items-center gap-2">
          <span className="sr-only">Delivery cargo stacks</span>
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
              Peel
            </button>
          ) : null}
        </div>
        <button
          type="button"
          aria-expanded={!legendCollapsed}
          aria-controls="stop-delivery-stacks-breakdown"
          title={legendCollapsed ? "Show breakdown" : "Hide breakdown"}
          onClick={() => setLegendCollapsed((value) => !value)}
          className={[
            "inline-flex h-auto shrink-0 items-center gap-1 rounded-rsi border px-1.5 py-0.5 font-mono text-[0.55rem] uppercase leading-none tracking-[0.14em] transition-colors",
            legendCollapsed
              ? "border-rsi-border/80 bg-rsi-bg-deep/95 text-rsi-text-muted hover:border-rsi-accent/40 hover:text-rsi-accent"
              : "border-rsi-accent/40 bg-rsi-accent-muted/30 text-rsi-accent",
          ].join(" ")}
        >
          <span aria-hidden>{legendCollapsed ? "‹" : "›"}</span>
          Breakdown
        </button>
      </div>

      <div className="relative min-w-0 overflow-x-auto px-2.5 pb-2.5 pt-1">
        {!legendCollapsed ? (
          <aside
            id="stop-delivery-stacks-breakdown"
            aria-label="Cargo breakdown"
            className="absolute top-1 right-2.5 z-10 w-[12.5rem] rounded-rsi border border-rsi-border/80 bg-rsi-bg-deep/95 px-2 py-1.5 shadow-rsi-panel"
          >
            <ul className="space-y-0.5">
              {plan.legendItems.map((item) => {
                const hex =
                  resolveCommodityColorHex(
                    item.color,
                    item.color2,
                    item.commoditySlug,
                  ) ?? FALLBACK_HEX;
                const isOn = !hiddenCommodities.has(item.commoditySlug);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      aria-pressed={isOn}
                      onClick={() => toggleCommodity(item.commoditySlug)}
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
                          {item.commodityName}
                        </span>
                        {item.isSplitMission ? (
                          <span
                            className="inline-flex shrink-0 text-rsi-warn"
                            title="Same cargo type from separate missions"
                          >
                            <SplitMissionIcon className="size-3" />
                            <span className="sr-only">
                              Same cargo type from separate missions
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
                points={floorFace(tile.lx, tile.wy, cellPx)}
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
                cellPx,
              );
              const isPickup = (box.action ?? plan.action) === "pickup";
              const sideStroke = isPickup
                ? "color-mix(in srgb, var(--rsi-accent) 55%, var(--rsi-border-strong))"
                : "color-mix(in srgb, var(--rsi-success) 75%, var(--rsi-border-strong))";
              const sideDash = isPickup ? undefined : "2.5 2";
              return (
                <g key={box.id} opacity={dimmed ? 0.28 : 1}>
                  <title>
                    {isPickup ? "Pickup" : "Delivery"} · {box.commodityName} ·{" "}
                    {box.size} SCU
                  </title>
                  <polygon
                    points={faces.west}
                    fill={colors.west}
                    stroke={sideStroke}
                    strokeWidth={0.65}
                    strokeDasharray={sideDash}
                  />
                  <polygon
                    points={faces.south}
                    fill={colors.south}
                    stroke={sideStroke}
                    strokeWidth={0.65}
                    strokeDasharray={sideDash}
                  />
                  <polygon
                    points={faces.east}
                    fill={colors.east}
                    stroke={sideStroke}
                    strokeWidth={0.65}
                    strokeDasharray={sideDash}
                  />
                  <polygon
                    points={faces.top}
                    fill={colors.top}
                    stroke={sideStroke}
                    strokeWidth={0.85}
                    strokeDasharray={sideDash}
                  />
                </g>
              );
            })}
            {stackLabels.map((label) => {
              const dimmed = hiddenCommodities.has(label.commoditySlug);
              const anchor = project(
                label.x + stackWidthCells / 2,
                widthCells / 2,
                0,
                cellPx,
              );
              return (
                <text
                  key={`label-${label.id}`}
                  x={anchor.x}
                  y={anchor.y + cellPx * 0.85}
                  textAnchor="middle"
                  dominantBaseline="hanging"
                  fill="var(--rsi-text-muted)"
                  style={{
                    fontFamily: "var(--font-mono, ui-monospace, monospace)",
                    fontSize: Math.max(8, Math.round(cellPx * 0.55)),
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    opacity: dimmed ? 0.35 : 0.95,
                  }}
                >
                  <title>{label.commodityName}</title>
                  {label.abbrev}
                </text>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}
