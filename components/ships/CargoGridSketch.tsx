"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  cargoGridCargoLength,
  cargoGridMaxWidth,
  cargoGridTotalLength,
  cargoGridTotalScu,
  cargoGridZoneScu,
  cargoGridZoneWidth,
  getCargoGridViewScale,
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
  CargoGridBoxAction,
  CargoGridPlacementTint,
  PlacementLocationLegendItem,
  PlacedCargoBox,
} from "@/lib/ships/cargoGridPlacement";
import { locationGroupStroke } from "@/lib/ships/cargoGridPlacement";
import { locationGroupBoxOutlines } from "@/lib/ships/locationGroupOutline";
import { CargoBoxCountIcons } from "./CargoBoxSizeIcon";
import {
  CargoGridIsoView,
  type CargoGridIsoLegendItem,
} from "./CargoGridIsoView";
import { ShipBayEndsFrame } from "./ShipBayEndsMarkers";

const GRID_ZOOM_MIN = 0.5;
const GRID_ZOOM_MAX = 2.5;
const GRID_ZOOM_STEP = 0.25;

function CargoGridZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onReset,
}: {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}) {
  const buttonClass =
    "inline-flex size-7 items-center justify-center border border-rsi-border bg-rsi-bg-deep/70 font-mono text-[0.7rem] text-rsi-text-secondary transition-colors hover:border-rsi-border-strong hover:text-rsi-text disabled:cursor-default disabled:opacity-40";
  return (
    <div
      className="inline-flex overflow-hidden rounded-rsi border border-rsi-border"
      role="group"
      aria-label="Grid zoom"
    >
      <button
        type="button"
        aria-label="Zoom out"
        disabled={zoom <= GRID_ZOOM_MIN}
        onClick={onZoomOut}
        className={`${buttonClass} border-0 border-r border-rsi-border`}
      >
        −
      </button>
      <button
        type="button"
        aria-label="Reset zoom"
        title="Reset zoom"
        onClick={onReset}
        className={`${buttonClass} min-w-[2.75rem] border-0 border-r border-rsi-border px-1.5 text-[0.6rem] tabular-nums`}
      >
        {Math.round(zoom * 100)}%
      </button>
      <button
        type="button"
        aria-label="Zoom in"
        disabled={zoom >= GRID_ZOOM_MAX}
        onClick={onZoomIn}
        className={`${buttonClass} border-0`}
      >
        +
      </button>
    </div>
  );
}

export type CargoGridViewTab = "top" | "iso";

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
  /** Whole 8/4/2/1 crates for solid 3D box rendering. */
  placementBoxes?: PlacedCargoBox[];
  legendItems?: CargoGridIsoLegendItem[];
  /** Delivery location groups for the legend / show-hide filter. */
  locationLegendItems?: PlacementLocationLegendItem[];
  /**
   * When true, draw mission-location perimeter outlines + number badges.
   * Filter toggles still work when false (Suggested / Cargo type).
   */
  showLocationOutlines?: boolean;
  /** When set, other commodities start hidden so this one stands out. */
  focusCommoditySlug?: string | null;
  /** Hide sketch chrome when embedded in a placement modal. */
  compact?: boolean;
  /**
   * Which projections to render.
   * `"both"` shows Top / 3D tabs (one view at a time). Session overview uses `"top"`.
   */
  views?: "both" | "top" | "iso";
  /**
   * Render the placement legend inside the top view (storage modal).
   * Session bay layout keeps its own legend outside the sketch.
   */
  inlineTopLegend?: boolean;
  /** Controls stacked under Peel in the 3D view. */
  isoToolbarBelow?: ReactNode;
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
 * Cargo-grid sketch: top (overhead) and/or 3D isometric stacked cubes.
 * With `views="both"`, switch via Top / 3D tabs.
 */
export function CargoGridSketch({
  sketch,
  cellPx = 20,
  isoCellPx = 16,
  selectedCoord = null,
  onSelectCoord,
  highlightedCoords = [],
  placementTints = [],
  placementBoxes = [],
  legendItems,
  locationLegendItems = [],
  showLocationOutlines = false,
  focusCommoditySlug = null,
  compact = false,
  views = "both",
  inlineTopLegend = false,
  isoToolbarBelow = null,
}: CargoGridSketchProps) {
  const tabbed = views === "both";
  const [viewTab, setViewTab] = useState<CargoGridViewTab>("top");
  const [zoom, setZoom] = useState(1);
  const showIso = views === "iso" || (tabbed && viewTab === "iso");
  const showTop = views === "top" || (tabbed && viewTab === "top");
  const totalLength = cargoGridTotalLength(sketch);
  const cargoLength = cargoGridCargoLength(sketch);
  const totalScu = cargoGridTotalScu(sketch);
  const maxWidth = cargoGridMaxWidth(sketch);
  const [activeZ, setActiveZ] = useState(0);
  const { top: topScale, iso: isoScale } = getCargoGridViewScale(
    sketch.shipSlug,
  );
  const viewCellPx = Math.max(4, Math.round(cellPx * topScale * zoom));
  const viewIsoCellPx = Math.max(4, Math.round(isoCellPx * isoScale * zoom));

  function zoomIn() {
    setZoom((value) =>
      Math.min(GRID_ZOOM_MAX, Math.round((value + GRID_ZOOM_STEP) * 100) / 100),
    );
  }
  function zoomOut() {
    setZoom((value) =>
      Math.max(GRID_ZOOM_MIN, Math.round((value - GRID_ZOOM_STEP) * 100) / 100),
    );
  }
  function resetZoom() {
    setZoom(1);
  }

  const zoomControls: ReactNode = (
    <CargoGridZoomControls
      zoom={zoom}
      onZoomIn={zoomIn}
      onZoomOut={zoomOut}
      onReset={resetZoom}
    />
  );
  const commoditySlugs = useMemo(() => {
    if (legendItems && legendItems.length > 0) {
      return legendItems.map((item) => item.commoditySlug);
    }
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const box of placementBoxes) {
      if (seen.has(box.commoditySlug)) continue;
      seen.add(box.commoditySlug);
      ordered.push(box.commoditySlug);
    }
    return ordered;
  }, [legendItems, placementBoxes]);

  const [hiddenCommodities, setHiddenCommodities] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const [hiddenActions, setHiddenActions] = useState<
    ReadonlySet<CargoGridBoxAction>
  >(() => new Set());
  const [hiddenLocations, setHiddenLocations] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const locationSlugsKey = locationLegendItems
    .map((item) => item.locationSlug)
    .join("|");

  useEffect(() => {
    // New stop / cargo click: show every material so the full location is visible.
    setHiddenCommodities(new Set());
    setHiddenActions(new Set());
  }, [focusCommoditySlug, commoditySlugs.join("|")]);

  useEffect(() => {
    setHiddenLocations(new Set());
  }, [locationSlugsKey]);

  function toggleCommodity(slug: string) {
    setHiddenCommodities((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  function toggleAction(action: CargoGridBoxAction) {
    setHiddenActions((prev) => {
      const next = new Set(prev);
      if (next.has(action)) next.delete(action);
      else next.add(action);
      return next;
    });
  }

  function toggleLocation(slug: string) {
    setHiddenLocations((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  const zoneLogicalX0 = useMemo(() => {
    const map = new Map<string, number>();
    let offset = 0;
    for (const zone of sketch.zones) {
      map.set(zone.id, offset);
      offset += zone.lengthCells;
    }
    return map;
  }, [sketch.zones]);
  const cargoZoneIndex = useMemo(() => {
    const map = new Map<string, number>();
    let index = 0;
    for (const zone of sketch.zones) {
      if (zone.kind === "cargo") map.set(zone.id, index++);
    }
    return map;
  }, [sketch.zones]);
  /** Ramp → nose on screen (front bay on the right). */
  const topViewZones = useMemo(
    () => [...sketch.zones].reverse(),
    [sketch.zones],
  );

  const z = Math.min(Math.max(activeZ, 0), sketch.heightCells - 1);
  const visiblePlacementBoxes = useMemo(() => {
    return placementBoxes.filter((box) => {
      if (hiddenCommodities.has(box.commoditySlug)) return false;
      if (box.action != null && hiddenActions.has(box.action)) return false;
      if (locationLegendItems.length === 0) return true;
      return (
        box.deliveryLocationSlug != null &&
        !hiddenLocations.has(box.deliveryLocationSlug)
      );
    });
  }, [
    placementBoxes,
    hiddenCommodities,
    hiddenActions,
    hiddenLocations,
    locationLegendItems.length,
  ]);

  const locationOutlines = useMemo(
    () =>
      showLocationOutlines
        ? locationGroupBoxOutlines(visiblePlacementBoxes)
        : new Map(),
    [visiblePlacementBoxes, showLocationOutlines],
  );
  const locationLabelBoxIds = useMemo(() => {
    const best = new Map<string, { boxId: string; size: number }>();
    for (const box of visiblePlacementBoxes) {
      const outline = locationOutlines.get(box.id);
      if (!outline) continue;
      const current = best.get(outline.componentId);
      if (!current || box.size > current.size) {
        best.set(outline.componentId, { boxId: box.id, size: box.size });
      }
    }
    return new Set([...best.values()].map((entry) => entry.boxId));
  }, [visiblePlacementBoxes, locationOutlines]);
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
    compact &&
    (highlightedCoords.length > 0 ||
      placementTints.length > 0 ||
      placementBoxes.length > 0);
  const useBoxFootprints = placementBoxes.length > 0;
  const topLegend =
    legendItems && legendItems.length > 0 ? legendItems : null;
  const hasPickup = placementTints.some((tint) => tint.action === "pickup");
  const hasDelivery = placementTints.some(
    (tint) => tint.action === "delivery",
  );
  const showLocationKey = locationLegendItems.length > 0;
  const showTopLegend =
    showTop &&
    (tabbed || inlineTopLegend) &&
    (topLegend != null || hasPickup || hasDelivery || showLocationKey);

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
            Axes · X ramp→nose (visual) · Y port→starboard · Z deck→ceiling
          </p>
        </>
      )}

      {tabbed ? (
        <div
          role="tablist"
          aria-label="Cargo grid projection"
          className="inline-flex w-fit rounded-rsi border border-rsi-border bg-rsi-bg-deep/60 p-0.5"
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

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {showIso ? (
            <CargoGridIsoView
              sketch={sketch}
              cellPx={viewIsoCellPx}
              selectedCoord={selectedCoord}
              onSelectCoord={onSelectCoord}
              highlightedCoords={highlightedCoords}
              placementTints={placementTints}
              placementBoxes={visiblePlacementBoxes}
              legendItems={legendItems}
              locationLegendItems={locationLegendItems}
              showLocationOutlines={showLocationOutlines}
              hiddenLocations={hiddenLocations}
              onToggleLocation={toggleLocation}
              hiddenCommodities={hiddenCommodities}
              onToggleCommodity={toggleCommodity}
              hiddenActions={hiddenActions}
              onToggleAction={toggleAction}
              mode={isPlacementView ? "placement" : "full"}
              toolbarExtra={zoomControls}
              toolbarBelow={isoToolbarBelow}
              showFacingPad={isPlacementView}
            />
          ) : null}

          {showTop ? (
          <div className="relative flex h-[24rem] flex-col overflow-hidden rounded-rsi border border-rsi-border bg-rsi-bg-deep/50 p-3 pb-10 md:h-[18rem]">
            <div
              className={[
                "mb-2 flex shrink-0 flex-wrap items-center gap-2",
                showTopLegend ? "md:pr-[13.5rem]" : "",
              ].join(" ")}
            >
              {tabbed || compact ? (
                <span className="sr-only">Top view</span>
              ) : (
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-rsi-text-muted">
                  Top view
                </p>
              )}
              <select
                aria-label="Z layer"
                value={z}
                onChange={(event) =>
                  setActiveZ(Number(event.target.value) || 0)
                }
                className="rounded-rsi border border-rsi-border bg-rsi-surface px-2 py-1 font-mono text-[0.65rem] tabular-nums text-rsi-text"
              >
                {Array.from({ length: sketch.heightCells }, (_, layer) => (
                  <option key={layer} value={layer}>
                    {layer + 1}
                  </option>
                ))}
              </select>
            </div>
            <div className="pointer-events-auto absolute right-2 bottom-2 z-20">
              {zoomControls}
            </div>
            {showTopLegend ? (
              <div
                className="absolute top-2 right-2 z-10 w-[13rem] space-y-1.5 rounded-rsi border border-rsi-border/80 bg-rsi-bg-deep/95 px-2 py-1.5 shadow-rsi-panel"
                aria-label="Cargo color legend"
              >
                {showLocationKey ? (
                  <ul className="space-y-0.5" aria-label="Delivery locations">
                    {locationLegendItems.map((item) => {
                      const isOn = !hiddenLocations.has(item.locationSlug);
                      return (
                        <li key={item.locationSlug}>
                          <button
                            type="button"
                            aria-pressed={isOn}
                            aria-label={`${isOn ? "Hide" : "Show"} ${item.locationName}`}
                            onClick={() => toggleLocation(item.locationSlug)}
                            className={[
                              "flex w-full min-w-0 cursor-pointer items-center gap-1.5 text-left",
                              isOn ? "" : "opacity-55",
                            ].join(" ")}
                          >
                            <span
                              className="inline-flex size-4 shrink-0 items-center justify-center rounded-[3px] border font-mono text-[0.55rem] tabular-nums text-rsi-bg-deep"
                              style={{
                                borderColor: item.stroke,
                                backgroundColor: isOn
                                  ? item.stroke
                                  : "transparent",
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
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
                {topLegend ? (
                  <ul
                    className={[
                      "space-y-0.5",
                      showLocationKey
                        ? "border-t border-rsi-border/60 pt-1.5"
                        : "",
                    ].join(" ")}
                  >
                    {topLegend.map((item) => {
                      const hex =
                        resolveCommodityColorHex(
                          item.color,
                          item.color2,
                          item.commoditySlug,
                        ) ?? "#54a0f7";
                      const isOn = !hiddenCommodities.has(item.commoditySlug);
                      const hasBoxIcons =
                        item.boxCounts != null && item.boxCounts.length > 0;
                      const boxTotal = hasBoxIcons
                        ? item.boxCounts!.reduce(
                            (sum, entry) => sum + entry.count,
                            0,
                          )
                        : null;
                      return (
                        <li key={item.commoditySlug}>
                          <button
                            type="button"
                            aria-pressed={isOn}
                            onClick={() => toggleCommodity(item.commoditySlug)}
                            className={[
                              "flex w-full cursor-pointer items-center gap-1.5 text-left",
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
                                "min-w-0 flex-1 truncate text-[0.7rem] leading-none",
                                isOn ? "text-rsi-text" : "text-rsi-text-muted",
                              ].join(" ")}
                            >
                              {item.commodityName}
                              {boxTotal != null ? (
                                <span className="-ml-1 font-mono text-[0.55rem] text-rsi-text-muted">
                                  ({boxTotal})
                                </span>
                              ) : null}
                            </span>
                            {hasBoxIcons ? (
                              <CargoBoxCountIcons
                                boxCounts={item.boxCounts!}
                                color={hex}
                                className="ml-auto shrink-0 justify-end gap-x-1 [&_svg]:size-3.5 [&_span]:text-[0.55rem]"
                              />
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
                {hasPickup || hasDelivery ? (
                  <div
                    className={[
                      "flex flex-wrap items-center gap-x-2 gap-y-1",
                      topLegend || showLocationKey
                        ? "border-t border-rsi-border/60 pt-1.5"
                        : "",
                    ].join(" ")}
                  >
                    {hasPickup ? (
                      <button
                        type="button"
                        aria-pressed={!hiddenActions.has("pickup")}
                        onClick={() => toggleAction("pickup")}
                        className={[
                          "inline-flex items-center gap-1 text-[0.6rem]",
                          hiddenActions.has("pickup")
                            ? "text-rsi-text-muted opacity-55"
                            : "text-rsi-text-secondary",
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
                        onClick={() => toggleAction("delivery")}
                        className={[
                          "inline-flex items-center gap-1 text-[0.6rem]",
                          hiddenActions.has("delivery")
                            ? "text-rsi-text-muted opacity-55"
                            : "text-rsi-text-secondary",
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
              </div>
            ) : null}
            <div className="min-h-0 flex-1 overflow-auto">
            <div
              className={[
                "flex min-h-full min-w-full items-center justify-center",
                showTopLegend
                  ? "max-md:pt-14 md:pr-[13.5rem]"
                  : "",
              ].join(" ")}
              role="img"
              aria-label={`${sketch.shipName} top-view cargo grid, ${totalScu} SCU. Rear left, front right.`}
            >
              <ShipBayEndsFrame>
              <div className="flex items-center">
              {topViewZones.map((zone) => {
                const zoneWidth = cargoGridZoneWidth(sketch, zone);
                const yOffset = Math.floor((maxWidth - zoneWidth) / 2);
                const zoneX0 = zoneLogicalX0.get(zone.id) ?? 0;
                const fillClass = zoneFillClass(
                  zone,
                  zone.kind === "cargo" ? (cargoZoneIndex.get(zone.id) ?? 0) : 0,
                );
                const cells: { x: number; y: number; localIndex: number }[] =
                  [];
                // Columns run ramp→nose so the front bay faces the opposite side.
                for (let localY = 0; localY < zoneWidth; localY += 1) {
                  for (
                    let displayX = 0;
                    displayX < zone.lengthCells;
                    displayX += 1
                  ) {
                    const localX = zone.lengthCells - 1 - displayX;
                    cells.push({
                      x: zoneX0 + localX,
                      y: yOffset + localY,
                      localIndex: localY * zone.lengthCells + displayX,
                    });
                  }
                }

                const boxesOnLayer = useBoxFootprints
                  ? visiblePlacementBoxes.filter(
                      (box) =>
                        box.origin.z <= z &&
                        z < box.origin.z + box.footprint.dz &&
                        box.origin.x >= zoneX0 &&
                        box.origin.x + box.footprint.dx <=
                          zoneX0 + zone.lengthCells &&
                        box.origin.y >= yOffset &&
                        box.origin.y + box.footprint.dy <= yOffset + zoneWidth,
                    )
                  : [];

                if (zone.kind === "gap") {
                  return (
                    <div
                      key={zone.id}
                      title="Grid break"
                      aria-label={`${zone.label} grid break`}
                      className={[
                        "relative flex items-center justify-center border-2 bg-rsi-bg-deep/40",
                        fillClass,
                      ].join(" ")}
                      style={{
                        width: zone.lengthCells * viewCellPx,
                        height: zoneWidth * viewCellPx,
                      }}
                    >
                      <span className="pointer-events-none font-mono text-[0.65rem] uppercase tracking-[0.16em] text-rsi-text-muted">
                        <span className="rounded-sm bg-rsi-bg-deep/75 px-1.5 py-0.5">
                          {zone.label}
                        </span>
                      </span>
                    </div>
                  );
                }

                return (
                  <div
                    key={zone.id}
                    className={["relative grid border-2", fillClass].join(" ")}
                    style={{
                      gridTemplateColumns: `repeat(${zone.lengthCells}, ${viewCellPx}px)`,
                      gridTemplateRows: `repeat(${zoneWidth}, ${viewCellPx}px)`,
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
                      const rawTint = useBoxFootprints
                        ? null
                        : tintByKey.get(coordKey);
                      const tint =
                        rawTint &&
                        !hiddenCommodities.has(rawTint.commoditySlug) &&
                        !(
                          rawTint.action != null &&
                          hiddenActions.has(rawTint.action)
                        )
                          ? rawTint
                          : null;
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
                      const canSelect = Boolean(onSelectCoord);
                      return (
                        <button
                          key={`${zone.id}-${cell.localIndex}`}
                          type="button"
                          disabled={!canSelect}
                          title={
                            tint
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
                            "relative z-0 box-border border border-rsi-border-strong/70 bg-rsi-surface-sunken/30",
                            canSelect
                              ? "cursor-pointer hover:bg-rsi-accent/25"
                              : "cursor-default",
                            isSelected
                              ? "z-[6] ring-2 ring-inset ring-rsi-accent"
                              : tint?.action === "pickup" && isHighlightExact
                                ? "ring-1 ring-inset ring-rsi-accent/50"
                                : isHighlightExact &&
                                    !tint?.action &&
                                    !useBoxFootprints
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
                                  opacity: 1,
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
                                    opacity: 1,
                                  }
                                : undefined
                          }
                          aria-label={formatCargoGridCoord({
                            x: cell.x,
                            y: cell.y,
                            z,
                          })}
                        />
                      );
                    })}
                    {boxesOnLayer.map((box) => {
                      const hex =
                        resolveCommodityColorHex(
                          box.color,
                          box.color2,
                          box.commoditySlug,
                        ) ?? "#54a0f7";
                      const left =
                        (zone.lengthCells -
                          (box.origin.x - zoneX0) -
                          box.footprint.dx) *
                        viewCellPx;
                      const top = (box.origin.y - yOffset) * viewCellPx;
                      const outline = showLocationOutlines
                        ? locationOutlines.get(box.id)
                        : undefined;
                      const groupStroke = showLocationOutlines
                        ? locationGroupStroke(box.locationGroupIndex)
                        : null;
                      const fallbackBorder =
                        box.action === "pickup"
                          ? "1px solid color-mix(in srgb, var(--rsi-accent) 55%, var(--rsi-border-strong))"
                          : box.action === "delivery"
                            ? "1px dashed color-mix(in srgb, var(--rsi-success) 75%, var(--rsi-border-strong))"
                            : "1px solid color-mix(in srgb, var(--rsi-border-strong) 70%, black)";
                      const groupEdge = (exposed: boolean) =>
                        groupStroke != null &&
                        (outline?.isIsolated || exposed)
                          ? `2px solid ${groupStroke}`
                          : fallbackBorder;
                      const hasGroupOutline =
                        groupStroke != null && outline != null;
                      // Top view mirrors X (ramp→nose): screen left = sketch +X.
                      const borderStyle = hasGroupOutline
                          ? {
                              borderTop: groupEdge(outline.exposed.ny),
                              borderBottom: groupEdge(outline.exposed.py),
                              borderLeft: groupEdge(outline.exposed.px),
                              borderRight: groupEdge(outline.exposed.nx),
                              // Thin black halo so colored mission edges pop.
                              boxShadow: "0 0 0 1px #000",
                            }
                          : { border: fallbackBorder };
                      const actionLabel =
                        box.action === "pickup"
                          ? "Pickup · "
                          : box.action === "delivery"
                            ? "Delivery · "
                            : "";
                      const locationLabel =
                        box.locationGroupIndex != null
                          ? `Loc ${box.locationGroupIndex} · `
                          : "";
                      return (
                        <div
                          key={box.id}
                          title={`${locationLabel}${actionLabel}${box.commodityName} · ${box.size} SCU · ${formatCargoGridCoord(box.origin)}`}
                          aria-hidden
                          className="pointer-events-none absolute z-[5] box-border flex items-center justify-center rounded-[2px]"
                          style={{
                            left,
                            top,
                            width: box.footprint.dx * viewCellPx,
                            height: box.footprint.dy * viewCellPx,
                            backgroundColor: hex,
                            opacity: 0.92,
                            ...borderStyle,
                          }}
                        >
                          {groupStroke != null &&
                          box.locationGroupIndex != null &&
                          locationLabelBoxIds.has(box.id) ? (
                            <span
                              className="inline-flex size-4 items-center justify-center rounded-full font-mono text-[0.6rem] font-bold tabular-nums leading-none"
                              style={{
                                color: groupStroke,
                                backgroundColor: "var(--rsi-bg-deep)",
                                boxShadow: `0 0 0 1px #000, 0 0 0 2.5px ${groupStroke}`,
                              }}
                            >
                              {box.locationGroupIndex}
                            </span>
                          ) : null}
                        </div>
                      );
                    })}
                    <span className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center font-mono text-[0.65rem] uppercase tracking-[0.16em] text-rsi-text">
                      <span className="rounded-sm bg-rsi-bg-deep/75 px-1.5 py-0.5">
                        {zone.label}
                      </span>
                    </span>
                  </div>
                );
              })}
              </div>
              </ShipBayEndsFrame>
            </div>
            </div>
          </div>
          ) : null}
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
