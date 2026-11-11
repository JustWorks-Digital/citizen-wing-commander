"use client";

import {
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { useOverflowScrollY } from "@/hooks/useOverflowScrollY";
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
import { abbreviateCommodityName } from "@/lib/missions/stopDeliveryBoxes";
import type { CargoBoxScu } from "@/lib/ships/cargoBoxSizes";
import { SCU_TITLE } from "@/lib/ui/abbrevTitles";
import { CargoBoxCountIcons } from "./CargoBoxSizeIcon";
import { CargoLegendSection } from "./CargoLegendSection";
import {
  CargoGridIsoView,
  type CargoGridIsoLegendItem,
} from "./CargoGridIsoView";
import {
  BayFacingPad,
  bayFacingSquareDegrees,
  defaultBayFacing,
  topBayLabelChrome,
  type BayFacing,
} from "./BayFacingPad";
import {
  CargoGridLayerPad,
  CargoGridLayerPadToggle,
} from "./CargoGridLayerPad";
import { RotatableTopBay } from "./RotatableTopBay";
import { ShipBayEndsFrame } from "./ShipBayEndsMarkers";
import { EditableZoomPercent } from "@/components/ui/EditableZoomPercent";
import { Switch } from "@/components/ui/Switch";

type LegendSectionKey =
  | "locations"
  | "commodities"
  | "actions"
  | "scuSizes"
  | "topLayers"
  | "isoLayers"
  | "settings"
  | "debugging";

const GRID_ZOOM_MIN = 0.5;
const GRID_ZOOM_MAX = 2.5;
const GRID_ZOOM_STEP = 0.25;
/** Top-view size badge toggles (ascending). */
const SCU_SIZE_BADGE_OPTIONS = [1, 2, 4, 8, 16, 32] as const satisfies readonly CargoBoxScu[];

function CargoGridZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onReset,
  onZoomChange,
  ariaLabel = "Grid zoom",
}: {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onZoomChange: (zoom: number) => void;
  ariaLabel?: string;
}) {
  const buttonClass =
    "inline-flex size-7 items-center justify-center border border-rsi-border bg-rsi-bg-deep/70 font-mono text-[0.7rem] text-rsi-text-secondary transition-colors hover:border-rsi-border-strong hover:text-rsi-text disabled:cursor-default disabled:opacity-40";
  return (
    <div
      className="inline-flex overflow-hidden rounded-rsi border border-rsi-border"
      role="group"
      aria-label={ariaLabel}
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
      <EditableZoomPercent
        zoom={zoom}
        min={GRID_ZOOM_MIN}
        max={GRID_ZOOM_MAX}
        onChange={onZoomChange}
        onClick={onReset}
        title="Reset zoom · double-click to set"
        aria-label="Reset zoom"
        className={`${buttonClass} min-w-[2.75rem] border-0 border-r border-rsi-border px-1.5 text-[0.6rem] tabular-nums`}
      />
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

export type CargoGridViewTab = "top" | "iso" | "split";

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
   * `"both"` shows 2D / 3D / Split tabs. `"split"` stacks 2D above 3D.
   * Session overview uses `"top"` (2D).
   */
  views?: "both" | CargoGridViewTab;
  /**
   * Render the placement legend inside the top view (storage modal).
   * Session bay layout keeps its own legend outside the sketch.
   */
  inlineTopLegend?: boolean;
  /** Controls stacked above Peel in the 3D view. */
  isoToolbarBelow?: ReactNode;
  /** Hide cargo legends (top, 3D, and split shared). */
  hideLegend?: boolean;
  /** Leave room under a top-right Legend toggle hosted by the parent. */
  legendToggleAbove?: boolean;
  /** Hide Peel (e.g. parent hosts it next to Sorting). */
  hidePeel?: boolean;
  /** Controlled peel; falls back to internal state when omitted. */
  peelStack?: boolean;
  onPeelStackChange?: (value: boolean) => void;
  /** Outer panel height in px for top / 3D / split views (default `26rem`). */
  panelHeightPx?: number;
  /**
   * Enable 2D drag-to-reposition for Manual sorting.
   * 3D still renders the same placementBoxes; it does not accept drags.
   */
  manualEdit?: boolean;
  /** Fired when a 2D drag starts (snapshot base layout). */
  onManualDragStart?: (boxId: string) => void;
  /**
   * Cell delta from drag start (sketch axes: +X nose→ramp, +Y port→starboard).
   * Parent validates and updates placementBoxes.
   */
  onManualDragDelta?: (
    boxId: string,
    deltaCellsX: number,
    deltaCellsY: number,
  ) => void;
  onManualDragEnd?: () => void;
};

const CARGO_ZONE_FILL = [
  "bg-rsi-accent/20 border-rsi-accent/30",
  "bg-rsi-warn/15 border-rsi-warn/25",
  "bg-rsi-success/15 border-rsi-success/25",
] as const;

function zoneFillClass(zone: CargoGridZone, cargoIndex: number): string {
  if (zone.kind === "gap") {
    return "border-dashed border-rsi-border-strong bg-rsi-bg/50";
  }
  return CARGO_ZONE_FILL[cargoIndex % CARGO_ZONE_FILL.length] ?? CARGO_ZONE_FILL[0];
}

/**
 * Cargo-grid sketch: 2D (overhead) and/or 3D isometric stacked cubes.
 * With `views="both"`, switch via 2D / 3D / Split tabs.
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
  hideLegend: hideLegendProp,
  legendToggleAbove = false,
  hidePeel = false,
  peelStack: peelStackProp,
  onPeelStackChange,
  panelHeightPx = 26 * 16,
  manualEdit = false,
  onManualDragStart,
  onManualDragDelta,
  onManualDragEnd,
}: CargoGridSketchProps) {
  const tabbed = views === "both";
  const [viewTab, setViewTab] = useState<CargoGridViewTab>("top");
  const manualDragRef = useRef<{
    boxId: string;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    lastDx: number;
    lastDy: number;
  } | null>(null);
  /** Independent zooms so split view can scale 2D and 3D separately. */
  const [topZoom, setTopZoom] = useState(1);
  const [isoZoom, setIsoZoom] = useState(1);
  /** 2D square facing — separate from 3D iso facing inside CargoGridIsoView. */
  const [topFacing, setTopFacing] = useState<BayFacing>(defaultBayFacing);
  const topFacingDegrees = bayFacingSquareDegrees(topFacing);
  const bayLabelChrome = topBayLabelChrome(topFacingDegrees);
  const [legendHiddenLocal, setLegendHiddenLocal] = useState(false);
  const legendHidden = hideLegendProp ?? legendHiddenLocal;
  const isSplit =
    views === "split" || (tabbed && viewTab === "split");
  const showIso =
    views === "iso" || isSplit || (tabbed && viewTab === "iso");
  const showTop =
    views === "top" || isSplit || (tabbed && viewTab === "top");
  const totalLength = cargoGridTotalLength(sketch);
  const cargoLength = cargoGridCargoLength(sketch);
  const totalScu = cargoGridTotalScu(sketch);
  const maxWidth = cargoGridMaxWidth(sketch);
  const [activeZ, setActiveZ] = useState(0);
  const [peelStackInternal, setPeelStackInternal] = useState(false);
  const peelStack = peelStackProp ?? peelStackInternal;
  function setPeelStack(value: boolean | ((prev: boolean) => boolean)) {
    const next = typeof value === "function" ? value(peelStack) : value;
    if (onPeelStackChange) onPeelStackChange(next);
    else setPeelStackInternal(next);
  }
  const [hiddenIsoLayers, setHiddenIsoLayers] = useState<ReadonlySet<number>>(
    () => new Set(),
  );
  /** Bottom-center layer pads on the 2D / 3D grids (toggled from legend). */
  const [topLayerPadVisible, setTopLayerPadVisible] = useState(true);
  const [isoLayerPadVisible, setIsoLayerPadVisible] = useState(true);
  const { top: topScale, iso: isoScale } = getCargoGridViewScale(
    sketch.shipSlug,
  );
  const viewCellPx = Math.max(4, Math.round(cellPx * topScale * topZoom));
  const viewIsoCellPx = Math.max(4, Math.round(isoCellPx * isoScale * isoZoom));

  function clampGridZoom(value: number): number {
    return Math.min(
      GRID_ZOOM_MAX,
      Math.max(GRID_ZOOM_MIN, Math.round(value * 100) / 100),
    );
  }

  function makeZoomControls(
    zoom: number,
    setZoom: (next: number | ((value: number) => number)) => void,
    ariaLabel: string,
  ): ReactNode {
    return (
      <CargoGridZoomControls
        zoom={zoom}
        onZoomIn={() => setZoom((value) => clampGridZoom(value + GRID_ZOOM_STEP))}
        onZoomOut={() =>
          setZoom((value) => clampGridZoom(value - GRID_ZOOM_STEP))
        }
        onReset={() => setZoom(1)}
        onZoomChange={(next) => setZoom(clampGridZoom(next))}
        ariaLabel={ariaLabel}
      />
    );
  }

  const topZoomControls = makeZoomControls(topZoom, setTopZoom, "2D grid zoom");
  const isoZoomControls = makeZoomControls(isoZoom, setIsoZoom, "3D grid zoom");
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
  /** Which crate sizes show a numeric badge on the top-view boxes. */
  const [scuSizeBadges, setScuSizeBadges] = useState<ReadonlySet<CargoBoxScu>>(
    () => new Set(),
  );
  const [collapsedLegendSections, setCollapsedLegendSections] = useState<
    ReadonlySet<LegendSectionKey>
  >(() => new Set<LegendSectionKey>(["debugging"]));
  /** Bright crate silhouettes for checking footprints / Z height. */
  const [debugBoxOutlines, setDebugBoxOutlines] = useState(false);
  /** Abbreviated commodity labels on 2D crates. */
  const [showCargoNames, setShowCargoNames] = useState(true);

  const {
    overflowScrollRef: topLegendScrollRef,
    overflowScrollClassName: topLegendScrollClassName,
  } = useOverflowScrollY([collapsedLegendSections, panelHeightPx]);
  const {
    overflowScrollRef: splitLegendScrollRef,
    overflowScrollClassName: splitLegendScrollClassName,
  } = useOverflowScrollY([collapsedLegendSections, panelHeightPx]);

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
    startTransition(() => {
      setHiddenCommodities((prev) => {
        const next = new Set(prev);
        if (next.has(slug)) next.delete(slug);
        else next.add(slug);
        return next;
      });
    });
  }

  function toggleAction(action: CargoGridBoxAction) {
    startTransition(() => {
      setHiddenActions((prev) => {
        const next = new Set(prev);
        if (next.has(action)) next.delete(action);
        else next.add(action);
        return next;
      });
    });
  }

  function toggleLocation(slug: string) {
    startTransition(() => {
      setHiddenLocations((prev) => {
        const next = new Set(prev);
        if (next.has(slug)) next.delete(slug);
        else next.add(slug);
        return next;
      });
    });
  }

  function toggleScuSizeBadge(size: CargoBoxScu) {
    startTransition(() => {
      setScuSizeBadges((prev) => {
        const next = new Set(prev);
        if (next.has(size)) next.delete(size);
        else next.add(size);
        return next;
      });
    });
  }

  function toggleLegendSection(key: LegendSectionKey) {
    // Section chrome only — keep the heavy grid paint non-blocking.
    startTransition(() => {
      setCollapsedLegendSections((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    });
  }

  function isLegendSectionExpanded(key: LegendSectionKey): boolean {
    return !collapsedLegendSections.has(key);
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
  const showScuSizeFilters = useBoxFootprints && (showTop || isSplit);
  const topLegend =
    legendItems && legendItems.length > 0 ? legendItems : null;
  const hasPickup = placementTints.some((tint) => tint.action === "pickup");
  const hasDelivery = placementTints.some(
    (tint) => tint.action === "delivery",
  );
  const showLocationKey = locationLegendItems.length > 0;
  const showTopLayers = sketch.heightCells > 0;
  /** All Z layers (match Top legend); empty bays stay toggleable in 3D. */
  const isoLayerOptions = useMemo(
    () => Array.from({ length: sketch.heightCells }, (_, layer) => layer),
    [sketch.heightCells],
  );
  const showIsoLayers = isoLayerOptions.length > 0;
  const canPeel = useMemo(() => {
    let maxZ = -1;
    for (const box of placementBoxes) {
      maxZ = Math.max(maxZ, box.origin.z + box.footprint.dz - 1);
    }
    return maxZ > 0;
  }, [placementBoxes]);

  function toggleIsoLayer(z: number) {
    startTransition(() => {
      setHiddenIsoLayers((prev) => {
        const next = new Set(prev);
        if (next.has(z)) next.delete(z);
        else next.add(z);
        return next;
      });
    });
  }

  const showTopLegend =
    showTop &&
    !isSplit &&
    !legendHidden &&
    (tabbed || inlineTopLegend) &&
    (topLegend != null ||
      hasPickup ||
      hasDelivery ||
      showLocationKey ||
      showTopLayers ||
      showScuSizeFilters);
  const showSplitLegend =
    isSplit &&
    !legendHidden &&
    (topLegend != null ||
      hasPickup ||
      hasDelivery ||
      showLocationKey ||
      showTopLayers ||
      showIsoLayers ||
      showScuSizeFilters);

  const scuSizeFilterControls = (
    <div
      role="group"
      aria-label="Show SCU size badges on crates"
      className="flex flex-wrap items-center gap-1.5"
    >
      {SCU_SIZE_BADGE_OPTIONS.map((size) => {
        const isOn = scuSizeBadges.has(size);
        return (
          <label
            key={size}
            className={[
              "inline-flex cursor-pointer items-center gap-1 rounded-rsi border px-1.5 py-0.5 font-mono text-[0.55rem] tabular-nums transition-colors",
              isOn
                ? "border-rsi-accent/50 bg-rsi-accent-muted/35 text-rsi-accent"
                : "border-rsi-border bg-rsi-bg-deep/40 text-rsi-text-muted hover:border-rsi-border-strong hover:text-rsi-text",
            ].join(" ")}
          >
            <input
              type="checkbox"
              checked={isOn}
              onChange={() => toggleScuSizeBadge(size)}
              className="size-3 accent-[var(--rsi-accent)]"
            />
            {size}
          </label>
        );
      })}
    </div>
  );

  const locationLegendList = showLocationKey ? (
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
            </button>
          </li>
        );
      })}
    </ul>
  ) : null;

  const commodityLegendList = topLegend ? (
    <ul className="space-y-0.5">
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
          ? item.boxCounts!.reduce((sum, entry) => sum + entry.count, 0)
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
            </button>
          </li>
        );
      })}
    </ul>
  ) : null;

  const actionLegendControls =
    hasPickup || hasDelivery ? (
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
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
    ) : null;

  function renderCargoLegendBody(options: {
    includeIsoLayers: boolean;
    topLayersTitle: string;
  }) {
    return (
      <>
        {showLocationKey ? (
          <CargoLegendSection
            title="Locations"
            sectionId="locations"
            isExpanded={isLegendSectionExpanded("locations")}
            onToggle={() => toggleLegendSection("locations")}
          >
            {locationLegendList}
          </CargoLegendSection>
        ) : null}
        {topLegend ? (
          <CargoLegendSection
            title="Cargo"
            sectionId="commodities"
            isExpanded={isLegendSectionExpanded("commodities")}
            onToggle={() => toggleLegendSection("commodities")}
            showBorder={showLocationKey}
          >
            {commodityLegendList}
          </CargoLegendSection>
        ) : null}
        {hasPickup || hasDelivery ? (
          <CargoLegendSection
            title="Actions"
            sectionId="actions"
            isExpanded={isLegendSectionExpanded("actions")}
            onToggle={() => toggleLegendSection("actions")}
            showBorder={Boolean(showLocationKey || topLegend)}
          >
            {actionLegendControls}
          </CargoLegendSection>
        ) : null}
        {showScuSizeFilters ? (
          <CargoLegendSection
            title={`${SCU_TITLE} sizes`}
            sectionId="scu-sizes"
            isExpanded={isLegendSectionExpanded("scuSizes")}
            onToggle={() => toggleLegendSection("scuSizes")}
            showBorder={Boolean(
              showLocationKey || topLegend || hasPickup || hasDelivery,
            )}
          >
            {scuSizeFilterControls}
          </CargoLegendSection>
        ) : null}
        {showTopLayers ? (
          <CargoLegendSection
            title={options.topLayersTitle}
            sectionId="top-layers"
            isExpanded={isLegendSectionExpanded("topLayers")}
            onToggle={() => toggleLegendSection("topLayers")}
            showBorder={Boolean(
              showLocationKey ||
                topLegend ||
                hasPickup ||
                hasDelivery ||
                showScuSizeFilters,
            )}
          >
            <div className="space-y-1.5">
              <CargoGridLayerPadToggle
                isOn={topLayerPadVisible}
                onToggle={() => setTopLayerPadVisible((value) => !value)}
                ariaLabel="Show 2D layer controls on grid"
              />
              {!topLayerPadVisible ? (
                <div
                  role="radiogroup"
                  aria-label={
                    options.includeIsoLayers ? "2D view Z layer" : "Z layer"
                  }
                  className="flex flex-wrap items-center justify-start gap-1"
                >
                  {Array.from({ length: sketch.heightCells }, (_, layer) => {
                    const isActive = z === layer;
                    return (
                      <button
                        key={layer}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        aria-label={`Layer ${layer + 1}`}
                        onClick={() => setActiveZ(layer)}
                        className={[
                          "inline-flex size-5 items-center justify-center rounded-[3px] border font-mono text-[0.55rem] tabular-nums transition-colors",
                          isActive
                            ? "border-rsi-accent/50 bg-rsi-accent-muted/35 text-rsi-accent"
                            : "border-rsi-border bg-rsi-bg-deep/40 text-rsi-text-muted hover:border-rsi-border-strong hover:text-rsi-text",
                        ].join(" ")}
                      >
                        {layer + 1}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </CargoLegendSection>
        ) : null}
        {options.includeIsoLayers && showIsoLayers ? (
          <CargoLegendSection
            title="3D layers"
            sectionId="iso-layers"
            isExpanded={isLegendSectionExpanded("isoLayers")}
            onToggle={() => toggleLegendSection("isoLayers")}
            showBorder={Boolean(
              showLocationKey ||
                topLegend ||
                hasPickup ||
                hasDelivery ||
                showScuSizeFilters ||
                showTopLayers,
            )}
          >
            <div className="space-y-1.5">
              <CargoGridLayerPadToggle
                isOn={isoLayerPadVisible}
                onToggle={() => setIsoLayerPadVisible((value) => !value)}
                ariaLabel="Show 3D layer controls on grid"
              />
              {!isoLayerPadVisible ? (
                <div
                  role="group"
                  aria-label="3D layers"
                  className="flex flex-wrap items-center justify-start gap-1"
                >
                  {isoLayerOptions.map((layer) => {
                    const isOn = !hiddenIsoLayers.has(layer);
                    return (
                      <button
                        key={`iso-${layer}`}
                        type="button"
                        aria-pressed={isOn}
                        aria-label={`3D layer ${layer + 1}`}
                        onClick={() => toggleIsoLayer(layer)}
                        className={[
                          "inline-flex size-5 items-center justify-center rounded-[3px] border font-mono text-[0.55rem] tabular-nums transition-colors",
                          isOn
                            ? "border-rsi-accent/50 bg-rsi-accent-muted/35 text-rsi-accent"
                            : "border-rsi-border bg-rsi-bg-deep/40 text-rsi-text-muted hover:border-rsi-border-strong hover:text-rsi-text",
                        ].join(" ")}
                      >
                        {layer + 1}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </CargoLegendSection>
        ) : null}
        {useBoxFootprints ? (
          <CargoLegendSection
            title="Settings"
            sectionId="settings"
            isExpanded={isLegendSectionExpanded("settings")}
            onToggle={() => toggleLegendSection("settings")}
            showBorder
          >
            <Switch
              label="Cargo names"
              checked={showCargoNames}
              onCheckedChange={setShowCargoNames}
              ariaLabel="Show cargo names on 2D crates"
            />
          </CargoLegendSection>
        ) : null}
        {useBoxFootprints ? (
          <CargoLegendSection
            title="Debugging"
            sectionId="debugging"
            isExpanded={isLegendSectionExpanded("debugging")}
            onToggle={() => toggleLegendSection("debugging")}
            showBorder
          >
            <button
              type="button"
              aria-pressed={debugBoxOutlines}
              onClick={() => setDebugBoxOutlines((value) => !value)}
              className={[
                "inline-flex items-center gap-1.5 rounded-[3px] border px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-[0.1em] transition-colors",
                debugBoxOutlines
                  ? "border-rsi-warn/55 bg-rsi-warn/15 text-rsi-warn"
                  : "border-rsi-border bg-rsi-bg-deep/40 text-rsi-text-muted hover:border-rsi-border-strong hover:text-rsi-text",
              ].join(" ")}
            >
              <span
                className="size-2.5 shrink-0 rounded-[2px] border-2 border-rsi-warn bg-transparent"
                aria-hidden
              />
              Box outlines
            </button>
          </CargoLegendSection>
        ) : null}
      </>
    );
  }

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
                  {totalScu} <span title={SCU_TITLE}>SCU</span>
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
        <div className="flex flex-wrap items-center justify-center gap-1">
          <div
            role="tablist"
            aria-label="Cargo grid projection"
            className="inline-flex w-fit rounded-rsi border border-rsi-border bg-rsi-bg-deep/60 p-0.5"
          >
            {(
              [
                { id: "top", label: "2D" },
                { id: "split", label: "Split" },
                { id: "iso", label: "3D" },
              ] as const
            ).map((tab) => {
              const selected = viewTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-label={`${tab.label} view`}
                  onClick={() => setViewTab(tab.id)}
                  className={[
                    "rounded-[calc(var(--radius-rsi)-2px)] px-1.5 py-0.5 font-mono text-[0.5rem] uppercase tracking-[0.12em] transition-colors",
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
          {hideLegendProp === undefined ? (
            <button
              type="button"
              aria-pressed={!legendHidden}
              onClick={() => setLegendHiddenLocal((value) => !value)}
              className={[
                "rounded-rsi border px-1.5 py-0.5 font-mono text-[0.5rem] uppercase tracking-[0.12em] transition-colors",
                !legendHidden
                  ? "border-rsi-accent/50 bg-rsi-accent-muted/40 text-rsi-accent"
                  : "border-rsi-border bg-rsi-bg-deep/70 text-rsi-text-secondary hover:border-rsi-border-strong hover:text-rsi-text",
              ].join(" ")}
            >
              Legend
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div
          className={[
            "relative min-w-0 flex-1",
            isSplit
              ? "grid grid-cols-2 overflow-hidden rounded-rsi border border-rsi-border bg-rsi-bg-deep/50"
              : "flex flex-col gap-4",
          ].join(" ")}
        >
          {showTop ? (
          <div
            className={[
              "relative flex min-w-0 flex-col overflow-hidden p-3 pb-10",
              isSplit
                ? "border-r border-rsi-border"
                : "rounded-rsi border border-rsi-border bg-rsi-bg-deep/50",
            ].join(" ")}
            style={{ height: panelHeightPx }}
          >
            {tabbed || compact ? (
              <span className="sr-only">2D view</span>
            ) : (
              <p className="mb-2 shrink-0 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-rsi-text-muted">
                2D view
              </p>
            )}
            {isoToolbarBelow || (isSplit && canPeel && !hidePeel) ? (
              <div className="mb-1 flex shrink-0 flex-col items-start gap-1.5">
                {isoToolbarBelow}
                {isSplit && canPeel && !hidePeel ? (
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
            ) : null}
            <div className="pointer-events-auto absolute right-2 bottom-2 z-20">
              {topZoomControls}
            </div>
            {showTopLayers && topLayerPadVisible ? (
              <CargoGridLayerPad
                mode="select"
                layers={Array.from(
                  { length: sketch.heightCells },
                  (_, layer) => layer,
                )}
                activeLayer={z}
                onSelectLayer={setActiveZ}
                ariaLabel="2D Z layers"
              />
            ) : null}
            {isPlacementView ? (
              <BayFacingPad
                facing={topFacing}
                onFacingChange={setTopFacing}
                ariaLabel="2D bay view direction"
              />
            ) : null}
            {showTopLegend ? (
              <div
                ref={topLegendScrollRef}
                className={[
                  "pointer-events-auto absolute right-2 z-10 max-h-[calc(100%-3.5rem)] w-[16rem] space-y-1.5 rounded-rsi border border-rsi-border/80 bg-rsi-bg-deep/95 px-2 py-1.5 shadow-rsi-panel",
                  topLegendScrollClassName,
                  legendToggleAbove ? "top-8" : "top-2",
                ].join(" ")}
                aria-label="Cargo color legend"
              >
                {renderCargoLegendBody({
                  includeIsoLayers: false,
                  topLayersTitle: "2D layers",
                })}
              </div>
            ) : null}
            <div className="min-h-0 flex-1 overflow-auto">
            <div
              className="flex min-h-full min-w-full items-center justify-center"
              role="img"
              aria-label={`${sketch.shipName} 2D cargo grid, ${totalScu} SCU. Rear left, front right.`}
            >
              <RotatableTopBay degrees={topFacingDegrees}>
              <ShipBayEndsFrame
                compact={isSplit}
                squareDegrees={topFacingDegrees}
              >
              <div className="flex items-center">
              {(() => {
                let displayBayNumber = 0;
                return topViewZones.map((zone) => {
                const zoneWidth = cargoGridZoneWidth(sketch, zone);
                const yOffset = Math.floor((maxWidth - zoneWidth) / 2);
                const zoneX0 = zoneLogicalX0.get(zone.id) ?? 0;
                const fillClass = zoneFillClass(
                  zone,
                  zone.kind === "cargo" ? (cargoZoneIndex.get(zone.id) ?? 0) : 0,
                );
                if (zone.kind === "cargo") displayBayNumber += 1;
                const bayNumber = displayBayNumber;
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

                const bayLabel = (text: string, invisible: boolean) => (
                  <span
                    className={[
                      "pointer-events-none shrink-0 select-none font-mono text-[0.55rem] uppercase tracking-[0.14em]",
                      invisible
                        ? "invisible"
                        : "text-rsi-text-muted",
                    ].join(" ")}
                    style={
                      bayLabelChrome.labelTransform
                        ? { transform: bayLabelChrome.labelTransform }
                        : undefined
                    }
                    title={invisible ? undefined : zone.label}
                    aria-hidden={invisible || undefined}
                  >
                    {text}
                  </span>
                );

                if (zone.kind === "gap") {
                  const gapGrid = (
                      <div
                        title="Grid break"
                        aria-label={`${zone.label} grid break`}
                        className={[
                          "relative flex items-center justify-center border bg-rsi-bg-deep/40",
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
                  return (
                    <div
                      key={zone.id}
                      className={bayLabelChrome.columnClass}
                    >
                      {/* Match Bay N chrome so the gap sits with cargo grids. */}
                      {bayLabelChrome.labelBeforeGrid
                        ? bayLabel("Bay 0", true)
                        : null}
                      {gapGrid}
                      {!bayLabelChrome.labelBeforeGrid
                        ? bayLabel("Bay 0", true)
                        : null}
                    </div>
                  );
                }

                const cargoGrid = (
                  <div
                    className={["relative grid border", fillClass].join(" ")}
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
                      const boxWidthPx = box.footprint.dx * viewCellPx;
                      const boxHeightPx = box.footprint.dy * viewCellPx;
                      // Tall 1-cell-wide crates (vertical 2 SCU): stack the label
                      // so "QUART" is not clipped to "QUA".
                      const isTallNarrow =
                        box.footprint.dx === 1 && box.footprint.dy >= 2;
                      const maxAbbrevChars =
                        box.size <= 1 ||
                        (box.footprint.dx === 1 && box.footprint.dy === 1)
                          ? 3
                          : 5;
                      const abbrev = abbreviateCommodityName(
                        box.commodityName,
                        maxAbbrevChars,
                      );
                      const fitAlong = isTallNarrow ? boxHeightPx : boxWidthPx;
                      const abbrevPx = Math.max(
                        6,
                        Math.min(
                          11,
                          Math.round(viewCellPx * 0.42),
                          Math.floor(
                            (fitAlong - 2) / Math.max(1, abbrev.length * 0.62),
                          ),
                        ),
                      );
                      const onManualPointerDown = (
                        event: ReactPointerEvent<HTMLDivElement>,
                      ) => {
                        if (!manualEdit) return;
                        event.preventDefault();
                        event.stopPropagation();
                        event.currentTarget.setPointerCapture(event.pointerId);
                        manualDragRef.current = {
                          boxId: box.id,
                          pointerId: event.pointerId,
                          startClientX: event.clientX,
                          startClientY: event.clientY,
                          lastDx: 0,
                          lastDy: 0,
                        };
                        onManualDragStart?.(box.id);
                      };
                      const onManualPointerMove = (
                        event: ReactPointerEvent<HTMLDivElement>,
                      ) => {
                        const drag = manualDragRef.current;
                        if (
                          !manualEdit ||
                          !drag ||
                          drag.boxId !== box.id ||
                          drag.pointerId !== event.pointerId
                        ) {
                          return;
                        }
                        // Top view mirrors X (ramp left / nose right): +screenX → −sketchX.
                        const dx = Math.round(
                          -(event.clientX - drag.startClientX) / viewCellPx,
                        );
                        const dy = Math.round(
                          (event.clientY - drag.startClientY) / viewCellPx,
                        );
                        if (dx === drag.lastDx && dy === drag.lastDy) return;
                        drag.lastDx = dx;
                        drag.lastDy = dy;
                        onManualDragDelta?.(box.id, dx, dy);
                      };
                      const endManualDrag = (
                        event: ReactPointerEvent<HTMLDivElement>,
                      ) => {
                        const drag = manualDragRef.current;
                        if (
                          !drag ||
                          drag.boxId !== box.id ||
                          drag.pointerId !== event.pointerId
                        ) {
                          return;
                        }
                        manualDragRef.current = null;
                        try {
                          event.currentTarget.releasePointerCapture(
                            event.pointerId,
                          );
                        } catch {
                          // Already released.
                        }
                        onManualDragEnd?.();
                      };
                      return (
                        <div
                          key={box.id}
                          title={`${locationLabel}${actionLabel}${box.commodityName} · ${box.size} ${SCU_TITLE} · ${formatCargoGridCoord(box.origin)}${manualEdit ? " · drag to move" : ""}`}
                          role={manualEdit ? "button" : undefined}
                          aria-hidden={manualEdit ? undefined : true}
                          aria-label={
                            manualEdit
                              ? `Move ${box.commodityName} ${box.size} SCU crate`
                              : undefined
                          }
                          onPointerDown={
                            manualEdit ? onManualPointerDown : undefined
                          }
                          onPointerMove={
                            manualEdit ? onManualPointerMove : undefined
                          }
                          onPointerUp={manualEdit ? endManualDrag : undefined}
                          onPointerCancel={
                            manualEdit ? endManualDrag : undefined
                          }
                          className={[
                            "absolute z-[5] box-border flex items-center justify-center overflow-hidden rounded-[2px] px-0.5",
                            // Keep pointer events so crate `title` (full commodity
                            // name) works on hover — not only in Manual drag mode.
                            manualEdit
                              ? "pointer-events-auto cursor-grab touch-none active:cursor-grabbing"
                              : "pointer-events-auto",
                          ].join(" ")}
                          style={{
                            left,
                            top,
                            width: boxWidthPx,
                            height: boxHeightPx,
                            backgroundColor: hex,
                            opacity: 0.92,
                            ...borderStyle,
                            ...(debugBoxOutlines
                              ? {
                                  boxShadow:
                                    "0 0 0 1px #000, 0 0 0 2.5px var(--rsi-warn)",
                                  zIndex: 6,
                                }
                              : null),
                          }}
                        >
                          {groupStroke != null &&
                          box.locationGroupIndex != null &&
                          locationLabelBoxIds.has(box.id) ? (
                            <span
                              className="absolute top-0.5 left-0.5 inline-flex size-3.5 items-center justify-center rounded-full font-mono text-[0.55rem] font-bold tabular-nums leading-none"
                              style={{
                                color: groupStroke,
                                backgroundColor: "var(--rsi-bg-deep)",
                                boxShadow: `0 0 0 1px #000, 0 0 0 2.5px ${groupStroke}`,
                              }}
                            >
                              {box.locationGroupIndex}
                            </span>
                          ) : null}
                          {scuSizeBadges.has(8) && box.footprint.dz >= 2 ? (
                            <span
                              aria-hidden
                              className="pointer-events-none absolute inset-[3px] rounded-[1px] border border-rsi-bg-deep/55"
                            />
                          ) : null}
                          {showCargoNames ? (
                            <span
                              className="pointer-events-none select-none font-mono font-semibold uppercase leading-none tracking-[0.04em] text-rsi-bg-deep"
                              style={{
                                fontSize: abbrevPx,
                                writingMode: isTallNarrow
                                  ? "vertical-rl"
                                  : undefined,
                                textShadow:
                                  "0 0 2px color-mix(in srgb, white 55%, transparent)",
                              }}
                            >
                              {abbrev}
                            </span>
                          ) : null}
                          {scuSizeBadges.has(box.size as CargoBoxScu) ? (
                            <span
                              className="pointer-events-none absolute right-0.5 bottom-0.5 inline-flex min-w-[0.85rem] items-center justify-center rounded-[2px] bg-rsi-bg-deep/75 px-0.5 font-mono text-[0.5rem] font-bold tabular-nums leading-none text-rsi-text"
                              title={`${box.size} ${SCU_TITLE}`}
                            >
                              {box.size}
                            </span>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                );

                return (
                  <div
                    key={zone.id}
                    className={bayLabelChrome.columnClass}
                  >
                    {bayLabelChrome.labelBeforeGrid
                      ? bayLabel(`Bay ${bayNumber}`, false)
                      : null}
                    {cargoGrid}
                    {!bayLabelChrome.labelBeforeGrid
                      ? bayLabel(`Bay ${bayNumber}`, false)
                      : null}
                  </div>
                );
              });
              })()}
              </div>
              </ShipBayEndsFrame>
              </RotatableTopBay>
            </div>
            </div>
          </div>
          ) : null}

          {showIso ? (
            <div className={isSplit ? "relative min-w-0" : undefined}>
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
                toolbarExtra={isoZoomControls}
                toolbarBelow={isSplit ? null : isoToolbarBelow}
                showFacingPad={isPlacementView}
                embedded={isSplit}
                hideLegend={isSplit || legendHidden}
                legendToggleAbove={legendToggleAbove}
                hidePeel={isSplit || hidePeel}
                peelStack={peelStack}
                onPeelStackChange={setPeelStack}
                hiddenLayers={isSplit ? hiddenIsoLayers : undefined}
                onToggleLayer={isSplit ? toggleIsoLayer : undefined}
                showLayerPad={isoLayerPadVisible}
                onShowLayerPadChange={setIsoLayerPadVisible}
                debugBoxOutlines={debugBoxOutlines}
                onDebugBoxOutlinesChange={setDebugBoxOutlines}
                panelHeightPx={panelHeightPx}
              />
            </div>
          ) : null}

          {showSplitLegend ? (
            <div
              ref={splitLegendScrollRef}
              className={[
                "pointer-events-auto absolute top-8 right-2 z-20 max-h-[calc(100%-3.5rem)] w-[16rem] space-y-1.5 rounded-rsi border border-rsi-border/80 bg-rsi-bg-deep/95 px-2 py-1.5 shadow-rsi-panel",
                splitLegendScrollClassName,
              ].join(" ")}
              style={{ maxHeight: Math.max(120, panelHeightPx - 40) }}
              aria-label="Cargo color legend"
            >
              {renderCargoLegendBody({
                includeIsoLayers: true,
                topLayersTitle: "2D layers",
              })}
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
