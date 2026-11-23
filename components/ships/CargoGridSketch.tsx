"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { useOverflowScrollY } from "@/hooks/useOverflowScrollY";
import { useRightClickPan } from "@/hooks/useRightClickPan";
import { useWheelZoom } from "@/hooks/useWheelZoom";
import {
  cargoGridCargoLength,
  cargoGridHasExplicitPlacement,
  cargoGridMaxWidth,
  cargoGridTotalLength,
  cargoGridTotalScu,
  cargoGridZoneHeight,
  cargoGridOverflowZoneScu,
  cargoGridZoneScu,
  cargoGridZoneSpans,
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
import {
  cargoBoxStackRoomOpacity,
  freeStackLayersAbove,
} from "@/lib/ships/cargoBoxStackRoom";
import {
  cargoCellCoordFromPoint,
  manualBayBoxFocusLayer,
  manualBayBoxIsBuried,
  manualBayBoxStackColumn,
  previewManualBayDrop,
  previewManualBayPlacement,
  previewManualBayStackDrop,
  previewManualBayZoneFill,
  previewManualBayZoneMissionFill,
  type ManualBayAddBoxSpec,
  type ManualBayBulkFillSpec,
  type ManualBayMissionFillSpec,
} from "@/lib/ships/manualBayMove";
import { SCU_TITLE } from "@/lib/ui/abbrevTitles";
import { cargoBaySidePanelClassName } from "./cargoBaySidePanel";
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

const GRID_ZOOM_MIN = 0.25;
const GRID_ZOOM_MAX = 2.5;
/** Finer than 0.25 so 2D / Split / 3D zoom clicks are more precise. */
const GRID_ZOOM_STEP = 0.1;
/** Larger than click step so wheel in/out covers the range faster. */
const GRID_WHEEL_ZOOM_STEP = 0.25;
/** Leave a little room so fit-zoom doesn't sit on the scroll edge. */
const GRID_FIT_PAD_PX = 8;
/** Top-view size badge toggles (ascending). */
const SCU_SIZE_BADGE_OPTIONS = [1, 2, 4, 8, 16, 32] as const satisfies readonly CargoBoxScu[];

function clampGridZoom(value: number): number {
  return Math.min(
    GRID_ZOOM_MAX,
    Math.max(GRID_ZOOM_MIN, Math.round(value * 100) / 100),
  );
}

/** Zoom that fits content in the scroll viewport (no H/V scroll). */
function fitZoomForViewport(
  scrollEl: HTMLElement | null,
  contentEl: HTMLElement | null,
  currentZoom: number,
): number {
  if (!scrollEl || !contentEl || currentZoom <= 0) return 1;
  const availW = Math.max(0, scrollEl.clientWidth - GRID_FIT_PAD_PX);
  const availH = Math.max(0, scrollEl.clientHeight - GRID_FIT_PAD_PX);
  const contentW = contentEl.offsetWidth;
  const contentH = contentEl.offsetHeight;
  if (availW <= 0 || availH <= 0 || contentW <= 0 || contentH <= 0) return 1;
  const baseW = contentW / currentZoom;
  const baseH = contentH / currentZoom;
  return clampGridZoom(Math.min(availW / baseW, availH / baseH));
}

/**
 * Scroll arrows (trackpad/wheel) — bold enough to read at control size.
 * Slash when scroll-to-zoom is off.
 */
function ScrollZoomIcon({ scrollZoomOff }: { scrollZoomOff: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      aria-hidden
      className="block shrink-0"
    >
      {/* Up / down chevrons = scroll */}
      <path
        d="M8 2.25 4.75 5.5h6.5L8 2.25Zm0 11.5 3.25-3.25h-6.5L8 13.75Z"
        fill="currentColor"
      />
      <path
        d="M8 6.25v3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      {scrollZoomOff ? (
        <path
          d="M2.5 2.5 13.5 13.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      ) : null}
    </svg>
  );
}

function CargoGridZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onReset,
  onZoomChange,
  /** When true, trackpad/wheel zoom is off — +/- and % still work. */
  scrollZoomOff = false,
  onScrollZoomOffChange,
  ariaLabel = "Grid zoom",
}: {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onZoomChange: (zoom: number) => void;
  scrollZoomOff?: boolean;
  onScrollZoomOffChange?: (off: boolean) => void;
  ariaLabel?: string;
}) {
  const buttonClass =
    "inline-flex size-5 items-center justify-center border border-rsi-border bg-rsi-bg-deep/70 font-mono text-[0.6rem] text-rsi-text-secondary transition-colors hover:border-rsi-border-strong hover:text-rsi-text disabled:cursor-default disabled:opacity-40 sm:size-7 sm:text-[0.7rem]";
  return (
    <div
      className="inline-flex overflow-hidden rounded-rsi border border-rsi-border"
      role="group"
      aria-label={
        scrollZoomOff ? `${ariaLabel} (scroll zoom off)` : ariaLabel
      }
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
        title="Fit grid in view · double-click to set"
        aria-label="Fit grid in view"
        className={`${buttonClass} min-w-[2.25rem] border-0 border-r border-rsi-border px-1 text-[0.5rem] tabular-nums sm:min-w-[2.75rem] sm:px-1.5 sm:text-[0.6rem]`}
      />
      <button
        type="button"
        aria-label="Zoom in"
        disabled={zoom >= GRID_ZOOM_MAX}
        onClick={onZoomIn}
        className={`${buttonClass} border-0 border-r border-rsi-border`}
      >
        +
      </button>
      {onScrollZoomOffChange ? (
        <button
          type="button"
          aria-label={
            scrollZoomOff ? "Enable scroll zoom" : "Disable scroll zoom"
          }
          aria-pressed={scrollZoomOff}
          title={
            scrollZoomOff
              ? "Scroll zoom off — click or V to enable"
              : "Scroll zoom on — click or V to disable"
          }
          onClick={() => onScrollZoomOffChange(!scrollZoomOff)}
          className={[
            buttonClass,
            "border-0",
            scrollZoomOff
              ? "bg-rsi-accent-muted/40 text-rsi-accent"
              : "text-rsi-text",
          ].join(" ")}
        >
          <ScrollZoomIcon scrollZoomOff={scrollZoomOff} />
        </button>
      ) : null}
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
   * `"both"` shows 2D / 3D / Split tabs. `"split"` shows both panes
   * (side-by-side or stacked via `splitOrientation`).
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
  /**
   * When true (default), Packing / Legend float over the grid.
   * When false, they dock and shrink it. Controlled with `onSidePanelsOverlayChange`.
   */
  sidePanelsOverlay?: boolean;
  onSidePanelsOverlayChange?: (overlay: boolean) => void;
  /** Split layout: left/right (`horizontal`) or top/bottom (`vertical`). */
  splitOrientation?: "horizontal" | "vertical";
  onSplitOrientationChange?: (orientation: "horizontal" | "vertical") => void;
  /** When true, 2D and 3D zoom stay at the same percentage. */
  syncedZoom?: boolean;
  onSyncedZoomChange?: (synced: boolean) => void;
  /** Freeze 2D zoom controls / wheel. */
  /** When true, 2D trackpad/wheel zoom is off (+/- still work). */
  topZoomLocked?: boolean;
  onTopZoomLockedChange?: (locked: boolean) => void;
  /** Freeze 3D zoom controls / wheel. */
  /** When true, 3D trackpad/wheel zoom is off (+/- still work). */
  isoZoomLocked?: boolean;
  onIsoZoomLockedChange?: (locked: boolean) => void;
  /** Hide Peel (e.g. parent hosts it next to Packing). */
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
  onManualDragStart?: (
    boxId: string,
    clientX: number,
    clientY: number,
    options?: { moveStack?: boolean },
  ) => void;
  /** Pointer moved while dragging — parent updates the floating ghost. */
  onManualDragMove?: (
    boxId: string,
    clientX: number,
    clientY: number,
  ) => void;
  /** Pointer up / cancel — parent commits drop or reverts. */
  onManualDragEnd?: (
    boxId: string,
    clientX: number,
    clientY: number,
  ) => void;
  /**
   * Live placed-crate drag — footprint cells light up under the pointer
   * (accent = legal drop, danger = gap / collision / miss).
   * `moveStack` is set when the drag started from the stacked-crate badge.
   */
  manualCrateDrag?: {
    boxId: string;
    clientX: number;
    clientY: number;
    grabOffsetX: number;
    grabOffsetY: number;
    moveStack?: boolean;
  } | null;
  /**
   * Manual tray drag-and-drop onto a 2D cell.
   * Enable with `manualTrayDrop`. Parent places on drag end.
   */
  manualTrayDrop?: boolean;
  /** Active Manual tray drag — footprint highlight under cursor. */
  trayDragSpec?: ManualBayAddBoxSpec | null;
  /** Bulk cargo-type fill — footprint highlight sized to the cargo load. */
  trayBulkFill?: boolean;
  /** Crates for bulk-fill footprint estimate (with `trayBulkFill`). */
  trayBulkFillSpec?: Pick<ManualBayBulkFillSpec, "crates"> | null;
  /** Mission-parent fill — packs all remaining types as one block. */
  trayMissionFill?: ManualBayMissionFillSpec | null;
  /**
   * Full bay occupancy for tray fit checks (includes stay cargo when Transfer
   * hides it). Defaults to `placementBoxes`.
   */
  trayCollisionBoxes?: PlacedCargoBox[];
  /** Orientation index for tray place preview (R cycles in parent). */
  trayOrientationIndex?: number;
  /** Live pointer while tray-dragging (elementFromPoint hover). */
  trayPointerClient?: { x: number; y: number } | null;
  onTrayRotate?: () => void;
  onTrayPlaceCancel?: () => void;
  /** Double-click a crate in Manual mode to return it to the tray. */
  onManualBoxRemove?: (boxId: string) => void;
  /** Rotate the selected placed crate (R). */
  onManualBoxRotate?: (boxId: string) => void;
  /** Controlled 2D zoom (and Split). Falls back to internal state. */
  topZoom?: number;
  onTopZoomChange?: (zoom: number) => void;
  /** Controlled 3D zoom (and Split). Falls back to internal state. */
  isoZoom?: number;
  onIsoZoomChange?: (zoom: number) => void;
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
  if (zone.kind === "empty") {
    return "border-rsi-border/60 bg-rsi-bg-deep/30";
  }
  if (zone.kind === "overflow") {
    // Unstable reserve — distinct from snapped cargo bays.
    return "border-dashed border-rsi-warn/40 bg-rsi-warn/10";
  }
  return CARGO_ZONE_FILL[cargoIndex % CARGO_ZONE_FILL.length] ?? CARGO_ZONE_FILL[0];
}

/** Visible cargo-grid chrome: Zone 1, Zone 2, … */
function zoneOrdinalLabel(index: number): string {
  return `Zone ${index}`;
}

/** Keep hidden filters for slugs still in the bay; drop obsolete ones. */
function pruneHiddenSet(
  prev: ReadonlySet<string>,
  available: ReadonlySet<string>,
): ReadonlySet<string> {
  if (prev.size === 0) return prev;
  let changed = false;
  const next = new Set<string>();
  for (const slug of prev) {
    if (available.has(slug)) next.add(slug);
    else changed = true;
  }
  return changed ? next : prev;
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
  sidePanelsOverlay: sidePanelsOverlayProp,
  onSidePanelsOverlayChange,
  splitOrientation: splitOrientationProp,
  onSplitOrientationChange,
  syncedZoom: syncedZoomProp,
  onSyncedZoomChange,
  topZoomLocked: topZoomLockedProp,
  onTopZoomLockedChange,
  isoZoomLocked: isoZoomLockedProp,
  onIsoZoomLockedChange,
  hidePeel = false,
  peelStack: peelStackProp,
  onPeelStackChange,
  panelHeightPx = 26 * 16,
  manualEdit = false,
  onManualDragStart,
  onManualDragMove,
  onManualDragEnd,
  manualCrateDrag = null,
  manualTrayDrop = false,
  trayDragSpec = null,
  trayBulkFill = false,
  trayBulkFillSpec = null,
  trayMissionFill = null,
  trayCollisionBoxes,
  trayOrientationIndex = 0,
  trayPointerClient = null,
  onTrayRotate,
  onTrayPlaceCancel,
  onManualBoxRemove,
  onManualBoxRotate,
  topZoom: topZoomProp,
  onTopZoomChange,
  isoZoom: isoZoomProp,
  onIsoZoomChange,
}: CargoGridSketchProps) {
  const tabbed = views === "both";
  const [viewTab, setViewTab] = useState<CargoGridViewTab>("top");
  const manualDragRef = useRef<{
    boxId: string;
    pointerId: number;
    lastClientX: number;
    lastClientY: number;
    moveStack: boolean;
  } | null>(null);
  /** Last legal Manual drop preview — sync 2D Z after release. */
  const lastCrateDropPreviewRef = useRef<{
    boxId: string;
    origin: CargoGridCoord;
    footprintDz: number;
    fits: boolean;
  } | null>(null);
  /** Pending press — drag only after moving past threshold (keeps dbl-click). */
  const manualPressRef = useRef<{
    boxId: string;
    pointerId: number;
    startX: number;
    startY: number;
    dragging: boolean;
    moveStack: boolean;
  } | null>(null);
  const manualLastTapRef = useRef<{ boxId: string; at: number } | null>(null);
  /** Active Manual crate drag — other crates go pointer-events-none. */
  const [draggingManualBoxId, setDraggingManualBoxId] = useState<string | null>(
    null,
  );
  const onManualDragStartRef = useRef(onManualDragStart);
  const onManualDragMoveRef = useRef(onManualDragMove);
  const onManualDragEndRef = useRef(onManualDragEnd);
  const onManualBoxRemoveRef = useRef(onManualBoxRemove);
  const onManualBoxRotateRef = useRef(onManualBoxRotate);
  const publishSelectedCoordRef = useRef<(coord: CargoGridCoord | null) => void>(
    () => {},
  );
  const manualDragWindowCleanupRef = useRef<(() => void) | null>(null);
  onManualDragStartRef.current = onManualDragStart;
  onManualDragMoveRef.current = onManualDragMove;
  onManualDragEndRef.current = onManualDragEnd;
  onManualBoxRemoveRef.current = onManualBoxRemove;
  onManualBoxRotateRef.current = onManualBoxRotate;

  useEffect(
    () => () => {
      manualDragWindowCleanupRef.current?.();
      manualDragWindowCleanupRef.current = null;
    },
    [],
  );

  const MANUAL_DRAG_THRESHOLD_PX = 6;
  const MANUAL_DOUBLE_CLICK_MS = 400;

  const beginManualBoxDrag = useCallback(
    (
      boxId: string,
      pointerId: number,
      clientX: number,
      clientY: number,
      options?: { moveStack?: boolean },
    ) => {
      manualDragWindowCleanupRef.current?.();
      const moveStack = options?.moveStack === true;
      manualDragRef.current = {
        boxId,
        pointerId,
        lastClientX: clientX,
        lastClientY: clientY,
        moveStack,
      };
      setDraggingManualBoxId(boxId);
      onManualDragStartRef.current?.(boxId, clientX, clientY, {
        moveStack,
      });

      const onMove = (event: PointerEvent) => {
        const drag = manualDragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        drag.lastClientX = event.clientX;
        drag.lastClientY = event.clientY;
        onManualDragMoveRef.current?.(
          drag.boxId,
          event.clientX,
          event.clientY,
        );
      };

      const endDrag = (event: PointerEvent) => {
        if (event.pointerId !== pointerId) return;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", endDrag);
        window.removeEventListener("pointercancel", endDrag);
        manualDragWindowCleanupRef.current = null;
        const drag = manualDragRef.current;
        if (!drag || drag.pointerId !== pointerId) return;
        const endX = event.clientX;
        const endY = event.clientY;
        const preview = lastCrateDropPreviewRef.current;
        manualDragRef.current = null;
        setDraggingManualBoxId(null);
        onManualDragEndRef.current?.(drag.boxId, endX, endY);
        // Follow auto-snapped Z so a deck drop from layer 3 stays visible.
        if (
          preview &&
          preview.fits &&
          preview.boxId === drag.boxId
        ) {
          const layer = Math.max(
            0,
            preview.origin.z + preview.footprintDz - 1,
          );
          setActiveZ(layer);
          setFocusBoxId(drag.boxId);
          publishSelectedCoordRef.current(preview.origin);
        }
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", endDrag);
      window.addEventListener("pointercancel", endDrag);
      manualDragWindowCleanupRef.current = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", endDrag);
        window.removeEventListener("pointercancel", endDrag);
        const drag = manualDragRef.current;
        if (drag?.pointerId === pointerId) {
          const { boxId: id, lastClientX, lastClientY } = drag;
          manualDragRef.current = null;
          setDraggingManualBoxId(null);
          onManualDragEndRef.current?.(id, lastClientX, lastClientY);
        }
        manualDragWindowCleanupRef.current = null;
      };
    },
    [],
  );

  /** Arm press: double-click returns to tray; move past threshold starts drag. */
  const armManualBoxPointer = useCallback(
    (
      boxId: string,
      pointerId: number,
      clientX: number,
      clientY: number,
      options?: { moveStack?: boolean },
    ) => {
      manualDragWindowCleanupRef.current?.();
      manualPressRef.current = {
        boxId,
        pointerId,
        startX: clientX,
        startY: clientY,
        dragging: false,
        moveStack: options?.moveStack === true,
      };

      const detach = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };

      const onMove = (event: PointerEvent) => {
        const press = manualPressRef.current;
        if (!press || press.pointerId !== event.pointerId || press.dragging) {
          return;
        }
        const dist = Math.hypot(
          event.clientX - press.startX,
          event.clientY - press.startY,
        );
        if (dist < MANUAL_DRAG_THRESHOLD_PX) return;
        press.dragging = true;
        manualLastTapRef.current = null;
        detach();
        beginManualBoxDrag(
          press.boxId,
          press.pointerId,
          press.startX,
          press.startY,
          { moveStack: press.moveStack },
        );
        onManualDragMoveRef.current?.(
          press.boxId,
          event.clientX,
          event.clientY,
        );
      };

      const onUp = (event: PointerEvent) => {
        if (event.pointerId !== pointerId) return;
        detach();
        manualDragWindowCleanupRef.current = null;
        const press = manualPressRef.current;
        manualPressRef.current = null;
        if (!press || press.pointerId !== pointerId || press.dragging) return;
        // Stack-badge press is drag-only (no return-to-tray double-click).
        if (press.moveStack) return;

        const now = Date.now();
        const last = manualLastTapRef.current;
        if (
          last &&
          last.boxId === press.boxId &&
          now - last.at <= MANUAL_DOUBLE_CLICK_MS
        ) {
          manualLastTapRef.current = null;
          onManualBoxRemoveRef.current?.(press.boxId);
          return;
        }
        // Single click selects the crate (R rotates while selected).
        setFocusBoxId(press.boxId);
        manualLastTapRef.current = { boxId: press.boxId, at: now };
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
      manualDragWindowCleanupRef.current = () => {
        detach();
        manualPressRef.current = null;
        manualDragWindowCleanupRef.current = null;
      };
    },
    [beginManualBoxDrag],
  );
  /** Zooms — independent unless syncedZoom. */
  const [topZoomInternal, setTopZoomInternal] = useState(1);
  const [isoZoomInternal, setIsoZoomInternal] = useState(1);
  const topZoom = topZoomProp ?? topZoomInternal;
  const isoZoom = isoZoomProp ?? isoZoomInternal;
  const [sidePanelsOverlayInternal, setSidePanelsOverlayInternal] =
    useState(false);
  const sidePanelsOverlay = sidePanelsOverlayProp ?? sidePanelsOverlayInternal;
  const [splitOrientationInternal, setSplitOrientationInternal] = useState<
    "horizontal" | "vertical"
  >("horizontal");
  const splitOrientation =
    splitOrientationProp ?? splitOrientationInternal;
  const [syncedZoomInternal, setSyncedZoomInternal] = useState(false);
  const syncedZoom = syncedZoomProp ?? syncedZoomInternal;
  const [topZoomLockedInternal, setTopZoomLockedInternal] = useState(false);
  const topZoomLocked = topZoomLockedProp ?? topZoomLockedInternal;
  const [isoZoomLockedInternal, setIsoZoomLockedInternal] = useState(false);
  const isoZoomLocked = isoZoomLockedProp ?? isoZoomLockedInternal;
  /** Hover cell while dragging a Manual tray chip (placement ghost). */
  const [trayHoverCoord, setTrayHoverCoord] = useState<CargoGridCoord | null>(
    null,
  );
  const setSidePanelsOverlay = useCallback(
    (overlay: boolean) => {
      if (onSidePanelsOverlayChange) onSidePanelsOverlayChange(overlay);
      else setSidePanelsOverlayInternal(overlay);
    },
    [onSidePanelsOverlayChange],
  );
  const setSplitOrientation = useCallback(
    (orientation: "horizontal" | "vertical") => {
      if (onSplitOrientationChange) onSplitOrientationChange(orientation);
      else setSplitOrientationInternal(orientation);
    },
    [onSplitOrientationChange],
  );
  const setSyncedZoom = useCallback(
    (synced: boolean) => {
      if (onSyncedZoomChange) onSyncedZoomChange(synced);
      else {
        setSyncedZoomInternal(synced);
        if (synced) {
          const value = topZoomProp ?? topZoomInternal;
          setIsoZoomInternal(value);
        }
      }
    },
    [onSyncedZoomChange, topZoomInternal, topZoomProp],
  );
  const setTopZoomLocked = useCallback(
    (locked: boolean) => {
      if (onTopZoomLockedChange) onTopZoomLockedChange(locked);
      else setTopZoomLockedInternal(locked);
    },
    [onTopZoomLockedChange],
  );
  const setIsoZoomLocked = useCallback(
    (locked: boolean) => {
      if (onIsoZoomLockedChange) onIsoZoomLockedChange(locked);
      else setIsoZoomLockedInternal(locked);
    },
    [onIsoZoomLockedChange],
  );
  const setTopZoom = useCallback(
    (next: number | ((value: number) => number)) => {
      const value =
        typeof next === "function" ? next(topZoomProp ?? topZoomInternal) : next;
      if (onTopZoomChange) onTopZoomChange(value);
      else setTopZoomInternal(value);
      if (syncedZoom) {
        if (onIsoZoomChange) onIsoZoomChange(value);
        else setIsoZoomInternal(value);
      }
    },
    [
      onIsoZoomChange,
      onTopZoomChange,
      syncedZoom,
      topZoomInternal,
      topZoomProp,
    ],
  );
  const setIsoZoom = useCallback(
    (next: number | ((value: number) => number)) => {
      const value =
        typeof next === "function" ? next(isoZoomProp ?? isoZoomInternal) : next;
      if (onIsoZoomChange) onIsoZoomChange(value);
      else setIsoZoomInternal(value);
      if (syncedZoom) {
        if (onTopZoomChange) onTopZoomChange(value);
        else setTopZoomInternal(value);
      }
    },
    [
      isoZoomInternal,
      isoZoomProp,
      onIsoZoomChange,
      onTopZoomChange,
      syncedZoom,
    ],
  );
  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const topContentRef = useRef<HTMLDivElement | null>(null);
  const isoFitZoomRef = useRef<(() => number) | null>(null);
  /** 2D square facing — separate from 3D iso facing inside CargoGridIsoView. */
  const [topFacing, setTopFacing] = useState<BayFacing>(defaultBayFacing);
  const topFacingDegrees = bayFacingSquareDegrees(topFacing);
  const bayLabelChrome = topBayLabelChrome(topFacingDegrees);
  const [legendHiddenLocal, setLegendHiddenLocal] = useState(false);
  const legendHidden = hideLegendProp ?? legendHiddenLocal;
  const isSplit =
    views === "split" || (tabbed && viewTab === "split");
  const splitVertical = isSplit && splitOrientation === "vertical";
  /** Vertical split shares panel height; horizontal keeps full height per pane. */
  const splitPaneHeightPx = splitVertical
    ? Math.max(160, Math.floor(panelHeightPx / 2))
    : panelHeightPx;
  const showIso =
    views === "iso" || isSplit || (tabbed && viewTab === "iso");
  const showTop =
    views === "top" || isSplit || (tabbed && viewTab === "top");
  /** Legend → Settings: wheel over the bay zooms (default on). */
  const [wheelZoom, setWheelZoom] = useState(true);
  useRightClickPan(topScrollRef, showTop);
  useWheelZoom(topScrollRef, topContentRef, topZoom, setTopZoom, {
    enabled: showTop && wheelZoom && !topZoomLocked,
    min: GRID_ZOOM_MIN,
    max: GRID_ZOOM_MAX,
    step: GRID_WHEEL_ZOOM_STEP,
  });
  const totalLength = cargoGridTotalLength(sketch);
  const cargoLength = cargoGridCargoLength(sketch);
  const totalScu = cargoGridTotalScu(sketch);
  const maxWidth = cargoGridMaxWidth(sketch);
  const [activeZ, setActiveZ] = useState(0);
  /** Uncontrolled cell pick when parent omits `selectedCoord` / `onSelectCoord`. */
  const [internalSelectedCoord, setInternalSelectedCoord] =
    useState<CargoGridCoord | null>(null);
  /** Crate focused from 3D (Split) — ring on 2D + Manual-ready. */
  const [focusBoxId, setFocusBoxId] = useState<string | null>(null);
  const selectedCoordResolved = selectedCoord ?? internalSelectedCoord;
  const publishSelectedCoord = useCallback(
    (coord: CargoGridCoord | null) => {
      if (onSelectCoord) onSelectCoord(coord);
      else setInternalSelectedCoord(coord);
    },
    [onSelectCoord],
  );
  publishSelectedCoordRef.current = publishSelectedCoord;
  const focusBoxIdRef = useRef<string | null>(null);
  focusBoxIdRef.current = focusBoxId;
  const focusPlacementBoxFromIso = useCallback(
    (boxId: string, coord: CargoGridCoord) => {
      if (focusBoxIdRef.current === boxId) {
        setFocusBoxId(null);
        publishSelectedCoord(null);
        return;
      }
      const box =
        placementBoxes.find((entry) => entry.id === boxId) ??
        trayCollisionBoxes?.find((entry) => entry.id === boxId);
      if (!box) {
        setFocusBoxId(null);
        publishSelectedCoord(coord);
        return;
      }
      const layer = Math.min(
        sketch.heightCells - 1,
        manualBayBoxFocusLayer(box),
      );
      setActiveZ(layer);
      setHiddenIsoLayers((prev) => {
        let changed = false;
        const next = new Set(prev);
        for (
          let zLayer = box.origin.z;
          zLayer < box.origin.z + box.footprint.dz;
          zLayer += 1
        ) {
          if (next.delete(zLayer)) changed = true;
        }
        return changed ? next : prev;
      });
      setFocusBoxId(boxId);
      publishSelectedCoord(box.origin);
    },
    [placementBoxes, publishSelectedCoord, sketch.heightCells, trayCollisionBoxes],
  );
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
  /** Top-center layer pads on the 2D / 3D grids (toggled from legend). */
  const [topLayerPadVisible, setTopLayerPadVisible] = useState(true);
  const [isoLayerPadVisible, setIsoLayerPadVisible] = useState(true);
  const { top: topScale, iso: isoScale } = getCargoGridViewScale(
    sketch.shipSlug,
  );
  const viewCellPx = Math.max(4, Math.round(cellPx * topScale * topZoom));
  const viewIsoCellPx = Math.max(4, Math.round(isoCellPx * isoScale * isoZoom));

  function makeZoomControls(
    zoom: number,
    setZoom: (next: number | ((value: number) => number)) => void,
    scrollZoomOff: boolean,
    onScrollZoomOffChange: (off: boolean) => void,
    ariaLabel: string,
    fitZoom: () => number,
  ): ReactNode {
    return (
      <CargoGridZoomControls
        zoom={zoom}
        scrollZoomOff={scrollZoomOff}
        onScrollZoomOffChange={onScrollZoomOffChange}
        onZoomIn={() => setZoom((value) => clampGridZoom(value + GRID_ZOOM_STEP))}
        onZoomOut={() =>
          setZoom((value) => clampGridZoom(value - GRID_ZOOM_STEP))
        }
        onReset={() => setZoom(fitZoom())}
        onZoomChange={(next) => setZoom(clampGridZoom(next))}
        ariaLabel={ariaLabel}
      />
    );
  }

  const topZoomControls = makeZoomControls(
    topZoom,
    setTopZoom,
    topZoomLocked,
    setTopZoomLocked,
    "2D grid zoom",
    () =>
      fitZoomForViewport(topScrollRef.current, topContentRef.current, topZoom),
  );
  const isoZoomControls = makeZoomControls(
    isoZoom,
    setIsoZoom,
    isoZoomLocked,
    setIsoZoomLocked,
    "3D grid zoom",
    () => isoFitZoomRef.current?.() ?? 1,
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
  /**
   * Barely-visible ghosts for legend-hidden crates (and off layers in 3D)
   * so stacked / surrounding cargo stays readable.
   */
  const [showHologram, setShowHologram] = useState(false);

  const {
    overflowScrollRef: topLegendScrollRef,
    overflowScrollClassName: topLegendScrollClassName,
  } = useOverflowScrollY([collapsedLegendSections, panelHeightPx]);
  const {
    overflowScrollRef: splitLegendScrollRef,
    overflowScrollClassName: splitLegendScrollClassName,
  } = useOverflowScrollY([collapsedLegendSections, panelHeightPx]);

  const commoditySlugsKey = useMemo(
    () => [...commoditySlugs].sort().join("|"),
    [commoditySlugs],
  );
  const locationSlugsKey = useMemo(
    () =>
      [...locationLegendItems.map((item) => item.locationSlug)]
        .sort()
        .join("|"),
    [locationLegendItems],
  );

  // Pack mode / box order can reshuffle legend lists — keep user filters for
  // slugs that are still present; only drop entries that left the bay.
  useEffect(() => {
    const available = new Set(commoditySlugs);
    setHiddenCommodities((prev) => pruneHiddenSet(prev, available));
  }, [commoditySlugsKey, commoditySlugs]);

  useEffect(() => {
    const available = new Set(
      locationLegendItems.map((item) => item.locationSlug),
    );
    setHiddenLocations((prev) => pruneHiddenSet(prev, available));
  }, [locationSlugsKey, locationLegendItems]);

  useEffect(() => {
    // Optional cargo-focus highlight: reveal every material again.
    if (focusCommoditySlug == null) return;
    setHiddenCommodities(new Set());
    setHiddenActions(new Set());
  }, [focusCommoditySlug]);

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

  const zoneSpans = useMemo(() => cargoGridZoneSpans(sketch), [sketch]);
  const zoneSpanById = useMemo(() => {
    const map = new Map<string, (typeof zoneSpans)[number]>();
    for (const span of zoneSpans) map.set(span.zone.id, span);
    return map;
  }, [zoneSpans]);
  const useAbsoluteFloor = cargoGridHasExplicitPlacement(sketch);
  const cargoZoneIndex = useMemo(() => {
    const map = new Map<string, number>();
    let index = 0;
    for (const zone of sketch.zones) {
      if (zone.kind === "cargo") map.set(zone.id, index++);
    }
    return map;
  }, [sketch.zones]);
  /** Ramp → nose on screen for sequential sketches (front bay on the right). */
  const topViewZones = useMemo(
    () => (useAbsoluteFloor ? sketch.zones : [...sketch.zones].reverse()),
    [sketch.zones, useAbsoluteFloor],
  );

  const z = Math.min(Math.max(activeZ, 0), sketch.heightCells - 1);
  const isPlacementBoxLegendHidden = useCallback(
    (box: PlacedCargoBox) => {
      if (hiddenCommodities.has(box.commoditySlug)) return true;
      if (box.action != null && hiddenActions.has(box.action)) return true;
      if (locationLegendItems.length === 0) return false;
      // Untagged crates stay visible (overflow re-pack must preserve slugs;
      // null must not wipe the whole bay when a location legend exists).
      if (box.deliveryLocationSlug == null) return false;
      return hiddenLocations.has(box.deliveryLocationSlug);
    },
    [
      hiddenCommodities,
      hiddenActions,
      hiddenLocations,
      locationLegendItems.length,
    ],
  );
  const visiblePlacementBoxes = useMemo(() => {
    return placementBoxes.filter((box) => !isPlacementBoxLegendHidden(box));
  }, [placementBoxes, isPlacementBoxLegendHidden]);
  /** Solid crates + optional hologram ghosts of legend-hidden crates. */
  const renderPlacementBoxes = useMemo(() => {
    if (!showHologram) return visiblePlacementBoxes;
    return placementBoxes;
  }, [showHologram, visiblePlacementBoxes, placementBoxes]);

  /**
   * Free Z cells above each crate (physical bay occupancy). Drives 2D opacity:
   * solid = no room on top; fainter = more stack room left.
   */
  const stackFreeByBoxId = useMemo(() => {
    const map = new Map<string, number>();
    for (const box of placementBoxes) {
      map.set(
        box.id,
        freeStackLayersAbove(box, placementBoxes, sketch.heightCells),
      );
    }
    return map;
  }, [placementBoxes, sketch.heightCells]);

  /** 0-based Z layers that currently have at least one visible (legend-filtered) box. */
  const occupiedTopLayers = useMemo(() => {
    const occupied = new Set<number>();
    for (const box of visiblePlacementBoxes) {
      const z0 = box.origin.z;
      const z1 = box.origin.z + box.footprint.dz;
      for (let layer = z0; layer < z1; layer += 1) {
        if (layer >= 0 && layer < sketch.heightCells) occupied.add(layer);
      }
    }
    return occupied;
  }, [visiblePlacementBoxes, sketch.heightCells]);

  const emptyTopLayers = useMemo(() => {
    const empty = new Set<number>();
    for (let layer = 0; layer < sketch.heightCells; layer += 1) {
      if (!occupiedTopLayers.has(layer)) empty.add(layer);
    }
    return empty;
  }, [occupiedTopLayers, sketch.heightCells]);

  // If legend/Transfer filters clear the active 2D layer, jump to the
  // highest occupied one (load/unload is top → bottom).
  useEffect(() => {
    if (sketch.heightCells <= 0) return;
    if (occupiedTopLayers.size === 0) return;
    if (occupiedTopLayers.has(activeZ)) return;
    const next = [...occupiedTopLayers].sort((a, b) => b - a)[0];
    if (next != null) setActiveZ(next);
  }, [activeZ, occupiedTopLayers, sketch.heightCells]);

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

  useEffect(() => {
    if (!trayDragSpec && !manualCrateDrag) setTrayHoverCoord(null);
  }, [manualCrateDrag, trayDragSpec]);

  useEffect(() => {
    const pointer = manualCrateDrag
      ? { x: manualCrateDrag.clientX, y: manualCrateDrag.clientY }
      : trayDragSpec && trayPointerClient
        ? trayPointerClient
        : null;
    if (!pointer) return;
    const coord = cargoCellCoordFromPoint(pointer.x, pointer.y);
    setTrayHoverCoord((prev) => {
      // Clear when over a gap / off-grid so the highlight matches drop behavior.
      if (!coord) return null;
      if (
        prev &&
        prev.x === coord.x &&
        prev.y === coord.y &&
        prev.z === coord.z
      ) {
        return prev;
      }
      return coord;
    });
  }, [manualCrateDrag, trayDragSpec, trayPointerClient]);

  const trayFitBoxes = trayCollisionBoxes ?? placementBoxes;
  /** Manual: crates with cargo stacked above — no body-drag until cleared. */
  const buriedManualBoxIds = useMemo(() => {
    if (!manualEdit) return null;
    const buried = new Set<string>();
    for (const box of trayFitBoxes) {
      if (manualBayBoxIsBuried(box, trayFitBoxes)) buried.add(box.id);
    }
    return buried;
  }, [manualEdit, trayFitBoxes]);
  /** Manual: every crate in a multi-crate vertical column (top and bottom). */
  const stackedManualBoxIds = useMemo(() => {
    if (!manualEdit) return null;
    const stacked = new Set<string>();
    const visited = new Set<string>();
    for (const box of trayFitBoxes) {
      if (visited.has(box.id)) continue;
      const column = manualBayBoxStackColumn(box, trayFitBoxes);
      for (const member of column) visited.add(member.id);
      if (column.length <= 1) continue;
      for (const member of column) stacked.add(member.id);
    }
    return stacked;
  }, [manualEdit, trayFitBoxes]);
  const trayDropPreview = useMemo(() => {
    if (!trayDragSpec || !trayHoverCoord || manualCrateDrag) return null;
    if (trayMissionFill) {
      return previewManualBayZoneMissionFill(
        sketch,
        trayHoverCoord,
        trayMissionFill,
        trayFitBoxes,
      );
    }
    if (trayBulkFill) {
      return previewManualBayZoneFill(
        sketch,
        trayHoverCoord,
        trayBulkFillSpec,
        trayFitBoxes,
      );
    }
    return previewManualBayPlacement(
      sketch,
      trayFitBoxes,
      trayDragSpec,
      trayHoverCoord,
      trayOrientationIndex,
    );
  }, [
    manualCrateDrag,
    sketch,
    trayBulkFill,
    trayBulkFillSpec,
    trayDragSpec,
    trayFitBoxes,
    trayHoverCoord,
    trayMissionFill,
    trayOrientationIndex,
  ]);
  const bulkFillFootprint =
    (trayBulkFill || trayMissionFill) &&
    trayDropPreview &&
    "footprint" in trayDropPreview &&
    trayDropPreview.footprint
      ? (trayDropPreview.footprint as {
          dx: number;
          dy: number;
          origin: { x: number; y: number; z: number };
        })
      : null;
  const crateDropPreview = useMemo(() => {
    if (!manualCrateDrag || !trayHoverCoord) return null;
    const grab = {
      dx: manualCrateDrag.grabOffsetX,
      dy: manualCrateDrag.grabOffsetY,
    };
    if (manualCrateDrag.moveStack) {
      return previewManualBayStackDrop(
        sketch,
        trayFitBoxes,
        manualCrateDrag.boxId,
        trayHoverCoord,
        grab,
      );
    }
    return previewManualBayDrop(
      sketch,
      trayFitBoxes,
      manualCrateDrag.boxId,
      trayHoverCoord,
      grab,
    );
  }, [manualCrateDrag, sketch, trayFitBoxes, trayHoverCoord]);
  const draggingBoxFootprintDz = (() => {
    if (!manualCrateDrag) return 1;
    const seed = trayFitBoxes.find(
      (box) => box.id === manualCrateDrag.boxId,
    );
    return seed?.footprint.dz ?? 1;
  })();
  lastCrateDropPreviewRef.current =
    manualCrateDrag && crateDropPreview
      ? {
          boxId: manualCrateDrag.boxId,
          origin: crateDropPreview.origin,
          footprintDz: draggingBoxFootprintDz,
          fits: crateDropPreview.fits,
        }
      : null;
  const dropPreviewKeys = useMemo(() => {
    const preview = crateDropPreview ?? trayDropPreview;
    if (!preview) return null;
    return {
      fits: preview.fits,
      keys: new Set(
        preview.cells
          .filter((cell) => cell.z === activeZ)
          .map((cell) => cargoGridCoordKey(cell)),
      ),
    };
  }, [activeZ, crateDropPreview, trayDropPreview]);
  const isPlacementView =
    compact &&
    (highlightedCoords.length > 0 ||
      placementTints.length > 0 ||
      placementBoxes.length > 0 ||
      Boolean(manualTrayDrop || manualEdit));
  const useBoxFootprints =
    placementBoxes.length > 0 || Boolean(manualTrayDrop || manualEdit);
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

  /**
   * Keyboard layer shortcut: set 2D layer and solo that Z in 3D so Split stays
   * aligned. Tall crates still show if they intersect the visible layer
   * (iso `layerOff` uses every-hidden, not any-hidden).
   */
  const selectBayLayer = useCallback(
    (layer: number) => {
      if (layer < 0 || layer >= sketch.heightCells) return;
      setActiveZ(layer);
      if (!showIso) return;
      startTransition(() => {
        const hidden = new Set<number>();
        for (let z = 0; z < sketch.heightCells; z += 1) {
          if (z !== layer) hidden.add(z);
        }
        setHiddenIsoLayers(hidden);
      });
    },
    [showIso, sketch.heightCells],
  );

  useEffect(() => {
    if (!showTop && !showIso) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest("input, textarea, select, [contenteditable='true']")
      ) {
        return;
      }
      if (trayDragSpec && (event.key === "r" || event.key === "R")) {
        event.preventDefault();
        onTrayRotate?.();
        return;
      }
      if (trayDragSpec && event.key === "Escape") {
        event.preventDefault();
        onTrayPlaceCancel?.();
        setTrayHoverCoord(null);
        return;
      }
      // Selected placed crate: R rotates footprint (not mid-drag).
      if (
        manualEdit &&
        showTop &&
        !trayDragSpec &&
        !manualDragRef.current &&
        focusBoxId &&
        (event.key === "r" || event.key === "R")
      ) {
        event.preventDefault();
        onManualBoxRotateRef.current?.(focusBoxId);
        return;
      }
      // V — toggle scroll-to-zoom off/on (same control as the zoom toolbar).
      if (event.key === "v" || event.key === "V") {
        event.preventDefault();
        if (showTop && showIso) {
          const next = !topZoomLocked;
          setTopZoomLocked(next);
          setIsoZoomLocked(next);
        } else if (showTop) {
          setTopZoomLocked(!topZoomLocked);
        } else {
          setIsoZoomLocked(!isoZoomLocked);
        }
        return;
      }
      // Z — fit zoom (same as clicking the zoom % control).
      if (event.key === "z" || event.key === "Z") {
        event.preventDefault();
        if (showTop && showIso) {
          const topFit = fitZoomForViewport(
            topScrollRef.current,
            topContentRef.current,
            topZoom,
          );
          if (syncedZoom) {
            setTopZoom(topFit);
          } else {
            setTopZoom(topFit);
            setIsoZoom(isoFitZoomRef.current?.() ?? 1);
          }
        } else if (showTop) {
          setTopZoom(
            fitZoomForViewport(
              topScrollRef.current,
              topContentRef.current,
              topZoom,
            ),
          );
        } else if (showIso) {
          setIsoZoom(isoFitZoomRef.current?.() ?? 1);
        }
        return;
      }
      const match = /^(?:Digit|Numpad)([1-9])$/.exec(event.code);
      if (!match) return;
      const layer = Number(match[1]) - 1;
      if (layer >= sketch.heightCells) return;
      event.preventDefault();
      selectBayLayer(layer);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    focusBoxId,
    isoZoomLocked,
    manualEdit,
    onTrayPlaceCancel,
    onTrayRotate,
    selectBayLayer,
    setIsoZoom,
    setIsoZoomLocked,
    setTopZoom,
    setTopZoomLocked,
    showIso,
    showTop,
    sketch.heightCells,
    syncedZoom,
    topZoom,
    topZoomLocked,
    trayDragSpec,
  ]);

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
                  className="ml-4 shrink-0 justify-end gap-x-1 pl-1 [&_svg]:h-3.5 [&_svg]:w-auto [&_span]:text-[0.55rem]"
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
              className="size-2 shrink-0 rounded-[2px] border border-dashed border-rsi-success/30 bg-transparent"
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
            title="SCU sizes"
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
                    const isEmpty = emptyTopLayers.has(layer);
                    return (
                      <button
                        key={layer}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        aria-label={
                          isEmpty
                            ? `Layer ${layer + 1} (empty)`
                            : `Layer ${layer + 1}`
                        }
                        disabled={isEmpty}
                        onClick={() => {
                          if (isEmpty) return;
                          setActiveZ(layer);
                        }}
                        className={[
                          "inline-flex size-5 items-center justify-center rounded-[3px] border font-mono text-[0.55rem] tabular-nums transition-colors",
                          isEmpty
                            ? "cursor-not-allowed border-rsi-border/50 bg-rsi-bg-deep/20 text-rsi-text-muted/35"
                            : isActive
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
            <div className="space-y-1.5">
              <Switch
                label="Cargo names"
                checked={showCargoNames}
                onCheckedChange={setShowCargoNames}
                ariaLabel="Show cargo names on 2D crates"
              />
              <Switch
                label="Show hologram"
                checked={showHologram}
                onCheckedChange={setShowHologram}
                ariaLabel="Show barely visible ghosts of hidden crates"
              />
              <Switch
                label="Overlay"
                checked={sidePanelsOverlay}
                onCheckedChange={setSidePanelsOverlay}
                ariaLabel="Overlay Packing and Legend on the grid instead of pushing it"
              />
              <Switch
                label="Vertical split"
                checked={splitOrientation === "vertical"}
                onCheckedChange={(checked) =>
                  setSplitOrientation(checked ? "vertical" : "horizontal")
                }
                ariaLabel="Stack Split view top and bottom instead of left and right"
              />
              <Switch
                label="Synced zoom"
                checked={syncedZoom}
                onCheckedChange={setSyncedZoom}
                ariaLabel="Keep 2D and 3D zoom at the same percentage"
              />
              <Switch
                label="Mouse wheel zoom"
                checked={wheelZoom}
                onCheckedChange={setWheelZoom}
                ariaLabel="Zoom the bay with the mouse wheel"
              />
            </div>
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
    setFocusBoxId(null);
    if (
      selectedCoordResolved &&
      selectedCoordResolved.x === coord.x &&
      selectedCoordResolved.y === coord.y &&
      selectedCoordResolved.z === coord.z
    ) {
      publishSelectedCoord(null);
      return;
    }
    publishSelectedCoord(coord);
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
              ? [
                  "grid grid-cols-1 overflow-hidden rounded-rsi border border-rsi-border bg-rsi-bg-deep/50",
                  splitVertical ? "" : "sm:grid-cols-2",
                ]
                  .filter(Boolean)
                  .join(" ")
              : "flex flex-col gap-4",
            showSplitLegend && !sidePanelsOverlay ? "sm:pr-[17.5rem]" : "",
          ].join(" ")}
        >
          {showTop ? (
          <div
            className={[
              "relative flex min-w-0 flex-col overflow-hidden pb-12 sm:pb-14",
              showTopLegend && !sidePanelsOverlay
                ? "pt-3 pr-[17.5rem] pl-3"
                : "p-3",
              isSplit
                ? splitVertical
                  ? "border-b border-rsi-border"
                  : "border-b border-rsi-border sm:border-r sm:border-b-0"
                : "rounded-rsi border border-rsi-border bg-rsi-bg-deep/50",
            ].join(" ")}
            style={{ height: isSplit ? splitPaneHeightPx : panelHeightPx }}
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
            <div className="pointer-events-auto absolute right-1.5 bottom-2 z-30 sm:right-2">
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
                emptyLayers={emptyTopLayers}
                placement={isSplit ? "top" : "bottom"}
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
                className={cargoBaySidePanelClassName({
                  overlay: true,
                  side: "right",
                  toggleAbove: legendToggleAbove,
                  scrollClassName: topLegendScrollClassName,
                })}
                aria-label="Cargo color legend"
              >
                {renderCargoLegendBody({
                  includeIsoLayers: false,
                  topLayersTitle: "2D layers",
                })}
              </div>
            ) : null}
            <div
              ref={topScrollRef}
              className="min-h-0 flex-1 overflow-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            >
            <div
              className="flex min-h-full min-w-full"
              role="img"
              aria-label={`${sketch.shipName} 2D cargo grid, ${totalScu} SCU. Rear left, front right.`}
            >
              {/*
                `m-auto` centers when the bay fits, and still lets overflow
                scroll/pan reach every edge when zoomed in (unlike justify-center).
              */}
              <div ref={topContentRef} className="m-auto w-fit shrink-0">
              <RotatableTopBay degrees={topFacingDegrees}>
              <ShipBayEndsFrame
                compact={isSplit}
                squareDegrees={topFacingDegrees}
              >
              <div
                className={useAbsoluteFloor ? "relative" : "flex items-start"}
                style={
                  useAbsoluteFloor
                    ? {
                        width: totalLength * viewCellPx,
                        height: maxWidth * viewCellPx,
                      }
                    : {
                        // Sequential bays: reserve full deck height so Y offsets
                        // stay cell-stable across zoom (not flex items-center).
                        minHeight: maxWidth * viewCellPx,
                      }
                }
              >
              {(() => {
                let displayBayNumber = 0;
                return topViewZones.map((zone) => {
                const span = zoneSpanById.get(zone.id);
                const zoneWidth = cargoGridZoneWidth(sketch, zone);
                const yOffset =
                  span?.yStart ?? Math.floor((maxWidth - zoneWidth) / 2);
                const zoneX0 = span?.xStart ?? 0;
                const fillClass = zoneFillClass(
                  zone,
                  zone.kind === "cargo" ? (cargoZoneIndex.get(zone.id) ?? 0) : 0,
                );
                if (zone.kind === "cargo") displayBayNumber += 1;
                const bayNumber = displayBayNumber;
                // Absolute floor uses left/top; sequential uses paddingTop from
                // span.yStart so gap/rear stay locked and front stays centered.
                const absoluteStyle = useAbsoluteFloor
                  ? ({
                      position: "absolute" as const,
                      left: (totalLength - zoneX0 - zone.lengthCells) * viewCellPx,
                      top: yOffset * viewCellPx,
                    } as const)
                  : ({
                      paddingTop: yOffset * viewCellPx,
                    } as const);
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

                // Anchor by origin cell (not full footprint) so a cross-zone
                // move keeps one DOM host until the origin enters the next zone.
                // Active Z: solid crates that intersect this layer. Crates
                // entirely below render as ghost underlays (behind solids).
                const boxesOnLayer = useBoxFootprints
                  ? renderPlacementBoxes
                      .filter((box) => {
                        if (
                          box.origin.x < zoneX0 ||
                          box.origin.x >= zoneX0 + zone.lengthCells ||
                          box.origin.y < yOffset ||
                          box.origin.y >= yOffset + zoneWidth
                        ) {
                          return false;
                        }
                        const topZ = box.origin.z + box.footprint.dz - 1;
                        const intersectsActive =
                          box.origin.z <= z && z <= topZ;
                        const entirelyBelow = topZ < z;
                        return intersectsActive || entirelyBelow;
                      })
                      .sort((a, b) => {
                        // Underlays first so solid active-layer crates paint on top.
                        const aUnder =
                          a.origin.z + a.footprint.dz - 1 < z ? 0 : 1;
                        const bUnder =
                          b.origin.z + b.footprint.dz - 1 < z ? 0 : 1;
                        if (aUnder !== bUnder) return aUnder - bUnder;
                        return a.origin.z - b.origin.z;
                      })
                  : [];

                const bayLabel = (text: string) => (
                  <span
                    className="pointer-events-none shrink-0 select-none whitespace-nowrap font-mono text-[0.55rem] uppercase tracking-[0.14em] text-rsi-text-muted"
                    style={
                      bayLabelChrome.labelTransform
                        ? { transform: bayLabelChrome.labelTransform }
                        : undefined
                    }
                    title={zone.label}
                  >
                    {text}
                  </span>
                );
                /**
                 * Height-only stand-in for Zone N above a gap. Zero width so a
                 * narrow gap column does not grow; nowrap so the sample line
                 * never wraps (wrapped “Zone 0” used to push the gap down ~1
                 * cell and drift with zoom).
                 */
                const bayLabelHeightSpacer = (
                  <span
                    aria-hidden
                    className="pointer-events-none block w-0 shrink-0 overflow-hidden whitespace-nowrap font-mono text-[0.55rem] uppercase tracking-[0.14em]"
                  >
                    Zone 1
                  </span>
                );

                if (zone.kind === "gap") {
                  const isDoor = zone.id === "door";
                  const gapGrid = (
                      <div
                        title="Grid break"
                        aria-label={`${zone.label} grid break`}
                        className={[
                          // Never steal Manual crate / cell hits (door label
                          // visually spills into cargo; lift gap sits between).
                          "pointer-events-none relative flex items-center justify-center border bg-rsi-bg-deep/40 select-none",
                          fillClass,
                        ].join(" ")}
                        style={{
                          width: zone.lengthCells * viewCellPx,
                          height: zoneWidth * viewCellPx,
                        }}
                      >
                        <span
                          className={[
                            "pointer-events-none font-mono text-[0.65rem] uppercase tracking-[0.16em] text-rsi-text-muted",
                            isDoor ? "absolute inset-0 flex items-center justify-center" : "",
                          ].join(" ")}
                        >
                          <span
                            className="rounded-sm bg-rsi-bg-deep/75 px-1.5 py-0.5"
                            style={
                              isDoor
                                ? {
                                    // Run along the door strip; nudge screen-right.
                                    transform: `translateX(${viewCellPx}px) rotate(-90deg)`,
                                    transformOrigin: "center",
                                    whiteSpace: "nowrap",
                                  }
                                : undefined
                            }
                          >
                            {zone.label}
                          </span>
                        </span>
                      </div>
                  );
                  return (
                    <div
                      key={zone.id}
                      className={
                        useAbsoluteFloor ? undefined : bayLabelChrome.columnClass
                      }
                      style={absoluteStyle}
                    >
                      {!useAbsoluteFloor && bayLabelChrome.labelBeforeGrid
                        ? bayLabelHeightSpacer
                        : null}
                      {gapGrid}
                      {!useAbsoluteFloor && !bayLabelChrome.labelBeforeGrid
                        ? bayLabelHeightSpacer
                        : null}
                    </div>
                  );
                }

                const cargoGrid = (
                  <div
                    className={[
                      "relative grid overflow-visible border",
                      fillClass,
                    ].join(" ")}
                    style={{
                      gridTemplateColumns: `repeat(${zone.lengthCells}, ${viewCellPx}px)`,
                      gridTemplateRows: `repeat(${zoneWidth}, ${viewCellPx}px)`,
                    }}
                  >
                    {cells.map((cell) => {
                      const isSelected =
                        selectedCoordResolved != null &&
                        selectedCoordResolved.x === cell.x &&
                        selectedCoordResolved.y === cell.y &&
                        selectedCoordResolved.z === z;
                      const isSameColumn =
                        selectedCoordResolved != null &&
                        selectedCoordResolved.x === cell.x &&
                        selectedCoordResolved.y === cell.y;
                      const isFocusBoxCell =
                        focusBoxId != null &&
                        boxesOnLayer.some(
                          (box) =>
                            box.id === focusBoxId &&
                            cell.x >= box.origin.x &&
                            cell.x < box.origin.x + box.footprint.dx &&
                            cell.y >= box.origin.y &&
                            cell.y < box.origin.y + box.footprint.dy,
                        );
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
                      const canSelect =
                        Boolean(onSelectCoord) || isSplit || manualEdit;
                      const canTrayPlace = Boolean(
                        manualTrayDrop && trayDragSpec,
                      );
                      const isDropPreview = Boolean(
                        dropPreviewKeys?.keys.has(coordKey),
                      );
                      const dropPreviewFits = dropPreviewKeys?.fits === true;
                      const cellCoord = { x: cell.x, y: cell.y, z };
                      return (
                        <button
                          key={`${zone.id}-${cell.localIndex}`}
                          type="button"
                          data-cargo-cell="1"
                          data-cargo-x={cell.x}
                          data-cargo-y={cell.y}
                          data-cargo-z={z}
                          disabled={!canSelect && !canTrayPlace && !manualTrayDrop}
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
                          onClick={() => {
                            selectCell(cellCoord);
                          }}
                          onPointerEnter={
                            (manualTrayDrop && trayDragSpec) ||
                            manualCrateDrag
                              ? () => {
                                  setTrayHoverCoord((prev) =>
                                    prev &&
                                    prev.x === cellCoord.x &&
                                    prev.y === cellCoord.y &&
                                    prev.z === cellCoord.z
                                      ? prev
                                      : cellCoord,
                                  );
                                }
                              : undefined
                          }
                          className={[
                            "relative z-0 box-border border border-rsi-border-strong/70 bg-rsi-surface-sunken/30",
                            canSelect || canTrayPlace
                              ? "cursor-pointer hover:bg-rsi-accent/25"
                              : "cursor-default",
                            isDropPreview
                              ? dropPreviewFits
                                ? "z-[7] bg-rsi-accent/45 ring-2 ring-inset ring-rsi-accent"
                                : "z-[7] bg-rsi-danger/35 ring-2 ring-inset ring-rsi-danger"
                              : isSelected || isFocusBoxCell
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
                            isDropPreview
                              ? undefined
                              : tintHex && isHighlightExact
                                ? {
                                    backgroundColor: tintHex,
                                    opacity: 1,
                                    ...(tint?.action === "delivery"
                                      ? {
                                          outline:
                                            "1.5px dashed color-mix(in srgb, var(--rsi-success) 28%, var(--rsi-border-strong))",
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
                      const boxTopZ = box.origin.z + box.footprint.dz - 1;
                      const isUnderlayGhost = boxTopZ < z;
                      const isLegendHologram =
                        isPlacementBoxLegendHidden(box);
                      const isHologram = isUnderlayGhost || isLegendHologram;
                      const freeStackLayers =
                        stackFreeByBoxId.get(box.id) ??
                        freeStackLayersAbove(
                          box,
                          placementBoxes,
                          sketch.heightCells,
                        );
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
                            ? "1px dashed color-mix(in srgb, var(--rsi-success) 28%, var(--rsi-border-strong))"
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
                      // Corner badges track cell zoom so they do not dominate
                      // when the bay is zoomed out.
                      const badgePx = Math.max(
                        7,
                        Math.min(14, Math.round(viewCellPx * 0.55)),
                      );
                      const badgeFontPx = Math.max(
                        5,
                        Math.min(9, Math.round(badgePx * 0.55)),
                      );
                      const badgeInsetPx = Math.max(
                        1,
                        Math.round(badgePx * 0.12),
                      );
                      const isBuried =
                        Boolean(buriedManualBoxIds?.has(box.id)) &&
                        !isHologram;
                      const isInStack =
                        Boolean(stackedManualBoxIds?.has(box.id)) &&
                        !isHologram;
                      const onBoxPointerDown = (
                        event: ReactPointerEvent<HTMLDivElement>,
                      ) => {
                        if (event.button !== 0) return;
                        event.preventDefault();
                        event.stopPropagation();
                        if (selectedCoordResolved) {
                          publishSelectedCoord(null);
                        }
                        // Buried / non-Manual: click selects only (default cursor).
                        // Manual top crates: press arms drag after a move threshold.
                        if (!manualEdit || isBuried) {
                          setFocusBoxId(box.id);
                          return;
                        }
                        armManualBoxPointer(
                          box.id,
                          event.pointerId,
                          event.clientX,
                          event.clientY,
                        );
                      };
                      const isDraggingThis =
                        draggingManualBoxId != null &&
                        draggingManualBoxId === box.id;
                      // Idle crates sit above selected cells (z-6) so Door /
                      // Lift selection rings do not steal clicks. While a
                      // crate/tray drag runs, crates go PE-none so cells get
                      // drop hits (preview uses z-7).
                      const cratePointerClass = isUnderlayGhost
                        ? "pointer-events-none z-[3]"
                        : isHologram
                          ? "pointer-events-none z-[4]"
                          : draggingManualBoxId != null || trayDragSpec
                            ? "pointer-events-none z-[5]"
                            : "pointer-events-auto z-[8] cursor-default touch-none";
                      const manualTitleHint = isInStack
                        ? isBuried
                          ? " · click to select · R rotates stack · drag the stack badge to move"
                          : " · click to select · drag to move · R rotates stack · stack badge moves whole stack · double-click to return to tray"
                        : " · click to select · drag to move · R to rotate · double-click to return to tray";
                      return (
                        <div
                          key={
                            isUnderlayGhost
                              ? `${box.id}-underlay-z${z}`
                              : box.id
                          }
                          title={
                            isUnderlayGhost
                              ? `${locationLabel}${actionLabel}${box.commodityName} · ${box.size} ${SCU_TITLE} · under layer ${z + 1} (Z${box.origin.z}) · ${
                                  freeStackLayers === 0
                                    ? "stack full"
                                    : `${freeStackLayers} layer${freeStackLayers === 1 ? "" : "s"} free above`
                                }`
                              : isLegendHologram
                                ? undefined
                                : `${locationLabel}${actionLabel}${box.commodityName} · ${box.size} ${SCU_TITLE} · ${formatCargoGridCoord(box.origin)} · ${
                                    freeStackLayers === 0
                                      ? "stack full"
                                      : `${freeStackLayers} layer${freeStackLayers === 1 ? "" : "s"} free above`
                                  }${
                                    manualEdit
                                      ? manualTitleHint
                                      : " · click to select"
                                  }`
                          }
                          role={!isHologram ? "button" : undefined}
                          aria-hidden={isHologram ? true : undefined}
                          aria-pressed={
                            !isHologram && focusBoxId === box.id
                              ? true
                              : undefined
                          }
                          aria-grabbed={
                            manualEdit && !isHologram && !isBuried
                              ? isDraggingThis
                              : undefined
                          }
                          aria-label={
                            !isHologram
                              ? isBuried
                                ? `Select stacked ${box.commodityName} ${box.size} SCU crate`
                                : manualEdit
                                  ? `Select or move ${box.commodityName} ${box.size} SCU crate`
                                  : `Select ${box.commodityName} ${box.size} SCU crate`
                              : undefined
                          }
                          onPointerDown={
                            !isHologram ? onBoxPointerDown : undefined
                          }
                          onDoubleClick={
                            // Handled in armManualBoxPointer (pointer path);
                            // keep this as a fallback when the browser fires it.
                            manualEdit &&
                            !isHologram &&
                            !isBuried &&
                            onManualBoxRemove
                              ? (event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  manualLastTapRef.current = null;
                                  manualPressRef.current = null;
                                  manualDragWindowCleanupRef.current?.();
                                  onManualBoxRemove(box.id);
                                }
                              : undefined
                          }
                          className={[
                            "absolute box-border flex items-center justify-center overflow-hidden rounded-[2px] px-0.5",
                            cratePointerClass,
                          ].join(" ")}
                          style={{
                            left,
                            top,
                            width: boxWidthPx,
                            height: boxHeightPx,
                            backgroundColor: hex,
                            // Stack-room opacity: solid = no room on top;
                            // fainter = more free layers. Legend holograms stay
                            // fixed-faint; dragging leaves a footprint.
                            opacity: isUnderlayGhost
                              ? cargoBoxStackRoomOpacity(
                                  freeStackLayers,
                                  sketch.heightCells,
                                  "underlay",
                                )
                              : isLegendHologram
                                ? 0.12
                                : isDraggingThis
                                  ? 0.28
                                  : cargoBoxStackRoomOpacity(
                                      freeStackLayers,
                                      sketch.heightCells,
                                      "solid",
                                    ),
                            ...(isUnderlayGhost
                              ? {
                                  border:
                                    "1px dashed color-mix(in srgb, var(--rsi-border-strong) 55%, transparent)",
                                }
                              : borderStyle),
                            ...(focusBoxId === box.id && !isHologram
                              ? {
                                  boxShadow:
                                    "0 0 0 1px #000, 0 0 0 2.5px var(--rsi-accent)",
                                  zIndex: 9,
                                }
                              : null),
                            ...(debugBoxOutlines && !isHologram
                              ? {
                                  boxShadow:
                                    "0 0 0 1px #000, 0 0 0 2.5px var(--rsi-warn)",
                                  zIndex: 6,
                                }
                              : null),
                          }}
                        >
                          {!isHologram &&
                          groupStroke != null &&
                          box.locationGroupIndex != null &&
                          locationLabelBoxIds.has(box.id) ? (
                            <span
                              className="absolute inline-flex items-center justify-center rounded-full font-mono font-bold tabular-nums leading-none"
                              style={{
                                top: badgeInsetPx,
                                left: badgeInsetPx,
                                width: badgePx,
                                height: badgePx,
                                fontSize: badgeFontPx,
                                color: groupStroke,
                                backgroundColor: "var(--rsi-bg-deep)",
                                boxShadow: `0 0 0 1px #000, 0 0 0 ${Math.max(1, Math.round(badgePx * 0.18))}px ${groupStroke}`,
                              }}
                            >
                              {box.locationGroupIndex}
                            </span>
                          ) : null}
                          {!isHologram &&
                          scuSizeBadges.has(8) &&
                          box.footprint.dz >= 2 ? (
                            <span
                              aria-hidden
                              className="pointer-events-none absolute rounded-[1px] border border-rsi-bg-deep/55"
                              style={{ inset: Math.max(2, badgeInsetPx) }}
                            />
                          ) : null}
                          {!isHologram && showCargoNames ? (
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
                          {!isHologram &&
                          scuSizeBadges.has(box.size as CargoBoxScu) ? (
                            <span
                              className="pointer-events-none absolute inline-flex items-center justify-center rounded-[2px] bg-rsi-bg-deep/75 font-mono font-bold tabular-nums leading-none text-rsi-text"
                              style={{
                                bottom: badgeInsetPx,
                                [isInStack ? "left" : "right"]: badgeInsetPx,
                                minWidth: badgePx,
                                height: badgePx,
                                paddingInline: Math.max(1, badgeInsetPx),
                                fontSize: badgeFontPx,
                              }}
                              title={`${box.size} ${SCU_TITLE}`}
                            >
                              {box.size}
                            </span>
                          ) : null}
                          {!isHologram && isInStack ? (
                            <button
                              type="button"
                              className="absolute z-[9] inline-flex cursor-grab items-center justify-center rounded-[2px] bg-rsi-bg-deep/85 text-rsi-warn touch-none active:cursor-grabbing"
                              style={{
                                right: badgeInsetPx,
                                bottom: badgeInsetPx,
                                width: badgePx,
                                height: badgePx,
                              }}
                              title="Drag to move this whole stack"
                              aria-label={`Move stack containing ${box.commodityName} ${box.size} SCU crate`}
                              onPointerDown={(event) => {
                                if (!manualEdit) return;
                                event.preventDefault();
                                event.stopPropagation();
                                if (selectedCoordResolved) {
                                  publishSelectedCoord(null);
                                }
                                armManualBoxPointer(
                                  box.id,
                                  event.pointerId,
                                  event.clientX,
                                  event.clientY,
                                  { moveStack: true },
                                );
                              }}
                            >
                              {/* Two offset squares = stacked crates */}
                              <svg
                                viewBox="0 0 12 12"
                                style={{
                                  width: Math.max(6, badgePx * 0.7),
                                  height: Math.max(6, badgePx * 0.7),
                                }}
                                aria-hidden
                              >
                                <rect
                                  x="1"
                                  y="4"
                                  width="6"
                                  height="6"
                                  fill="currentColor"
                                  opacity="0.55"
                                />
                                <rect
                                  x="4"
                                  y="1"
                                  width="6"
                                  height="6"
                                  fill="currentColor"
                                />
                              </svg>
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                );

                const zoneLabelText =
                  zone.kind === "empty" || zone.kind === "overflow"
                    ? zone.label
                    : zoneOrdinalLabel(bayNumber);

                return (
                  <div
                    key={zone.id}
                    className={
                      useAbsoluteFloor ? undefined : bayLabelChrome.columnClass
                    }
                    style={absoluteStyle}
                  >
                    {!useAbsoluteFloor && bayLabelChrome.labelBeforeGrid
                      ? bayLabel(zoneLabelText)
                      : null}
                    {cargoGrid}
                    {!useAbsoluteFloor && !bayLabelChrome.labelBeforeGrid
                      ? bayLabel(zoneLabelText)
                      : null}
                  </div>
                );
              });
              })()}
              {useAbsoluteFloor && bulkFillFootprint ? (
                <div
                  aria-hidden
                  className="pointer-events-none absolute z-20 box-border border-2 border-dashed border-rsi-accent bg-rsi-accent/25"
                  style={{
                    left:
                      (totalLength -
                        bulkFillFootprint.origin.x -
                        bulkFillFootprint.dx) *
                      viewCellPx,
                    top: bulkFillFootprint.origin.y * viewCellPx,
                    width: bulkFillFootprint.dx * viewCellPx,
                    height: bulkFillFootprint.dy * viewCellPx,
                  }}
                />
              ) : null}
              </div>
              </ShipBayEndsFrame>
              </RotatableTopBay>
              </div>
            </div>
            </div>
          </div>
          ) : null}

          {showIso ? (
            <div className={isSplit ? "relative min-w-0" : undefined}>
              <CargoGridIsoView
                sketch={sketch}
                cellPx={viewIsoCellPx}
                zoom={isoZoom}
                fitZoomGetterRef={isoFitZoomRef}
                onZoomChange={
                  wheelZoom && !isoZoomLocked ? setIsoZoom : undefined
                }
                selectedCoord={selectedCoordResolved}
                onSelectCoord={publishSelectedCoord}
                onSelectBox={isSplit ? focusPlacementBoxFromIso : undefined}
                highlightedCoords={highlightedCoords}
                placementTints={placementTints}
                placementBoxes={
                  showHologram ? placementBoxes : visiblePlacementBoxes
                }
                legendItems={legendItems}
                locationLegendItems={locationLegendItems}
                showLocationOutlines={showLocationOutlines}
                hiddenLocations={hiddenLocations}
                onToggleLocation={toggleLocation}
                hiddenCommodities={hiddenCommodities}
                onToggleCommodity={toggleCommodity}
                hiddenActions={hiddenActions}
                onToggleAction={toggleAction}
                showHologram={showHologram}
                mode={isPlacementView ? "placement" : "full"}
                toolbarExtra={isoZoomControls}
                toolbarBelow={isSplit ? null : isoToolbarBelow}
                showFacingPad={isPlacementView}
                embedded={isSplit}
                hideLegend={isSplit || legendHidden}
                legendToggleAbove={legendToggleAbove}
                sidePanelsOverlay={sidePanelsOverlay}
                hidePeel={isSplit || hidePeel}
                peelStack={peelStack}
                onPeelStackChange={setPeelStack}
                hiddenLayers={showIso ? hiddenIsoLayers : undefined}
                onToggleLayer={showIso ? toggleIsoLayer : undefined}
                showLayerPad={isoLayerPadVisible}
                onShowLayerPadChange={setIsoLayerPadVisible}
                layerPadPlacement={isSplit ? "top" : "bottom"}
                debugBoxOutlines={debugBoxOutlines}
                onDebugBoxOutlinesChange={setDebugBoxOutlines}
                panelHeightPx={isSplit ? splitPaneHeightPx : panelHeightPx}
              />
            </div>
          ) : null}

          {showSplitLegend ? (
            <div
              ref={splitLegendScrollRef}
              className={cargoBaySidePanelClassName({
                overlay: true,
                side: "right",
                toggleAbove: legendToggleAbove,
                scrollClassName: splitLegendScrollClassName,
              })}
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
              {selectedCoordResolved ? (
                <p className="mt-1 font-mono tabular-nums text-rsi-text">
                  {formatCargoGridCoord(selectedCoordResolved)}
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
                  const zoneHeight = cargoGridZoneHeight(sketch, zone);
                  const scu = cargoGridZoneScu(sketch, zone);
                  const overflowScu = cargoGridOverflowZoneScu(sketch, zone);
                  const kindNote =
                    zone.kind === "gap"
                      ? " (gap)"
                      : zone.kind === "empty"
                        ? " (empty)"
                        : zone.kind === "overflow"
                          ? " (overflow)"
                          : "";
                  return (
                    <li key={zone.id} className="tabular-nums">
                      {zone.label}
                      {kindNote}: {zoneWidth}×{zone.lengthCells}
                      {zone.kind === "cargo"
                        ? `×${zoneHeight} = ${scu} SCU`
                        : zone.kind === "overflow"
                          ? `×${zoneHeight} = ${overflowScu} SCU unstable`
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
