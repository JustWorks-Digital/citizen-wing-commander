"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { CargoGridSketch } from "@/components/ships/CargoGridSketch";
import { cargoBaySidePanelClassName } from "@/components/ships/cargoBaySidePanel";
import {
  ManualBayBoxTray,
  ManualBayPlacedBoxDragGhost,
  ManualBayTrayBulkDragGhost,
  ManualBayTrayDragGhost,
  ManualBayTrayMissionDragGhost,
} from "@/components/missions/ManualBayBoxTray";
import { SessionCurrentStopPickupGrid } from "@/components/missions/SessionStatsStrip";
import { useSessionCargoBayChrome } from "@/hooks/useSessionCargoBayChrome";
import { useSessionCargoBayLayoutHeight } from "@/hooks/useSessionCargoBayLayoutHeight";
import { getLocationBySlug } from "@/lib/fixtures";
import { cargoInventory } from "@/lib/missions/cargoInventory";
import type { HaulingChecklistRow } from "@/lib/missions/sessionChecklist";
import type { SessionMission } from "@/lib/missions/sessionMissions";

import {
  cargoBayModalShellMaxHeightPx,
  MAX_CARGO_BAY_LAYOUT_HEIGHT_PX,
  MIN_CARGO_BAY_LAYOUT_HEIGHT_PX,
} from "@/lib/sessions/cargoBayLayoutClientPrefs";
import {
  boxesFromManualTemplate,
  getManualBayLayoutStopState,
  latestManualBoxesBeforeStop,
  newManualBayTemplateId,
  renameManualBayTemplate,
  uniqueManualTemplateName,
  posesFromBoxes,
  readManualBayLayoutSession,
  storedBoxesFromPlaced,
  writeManualBayLayoutSession,
  type ManualBayLayoutTemplate,
  type ManualBayLayoutSessionState,
} from "@/lib/sessions/manualBayLayoutPrefs";
import {
  cargoBayPackModes,
  placementPlanLegend,
  placementPlanLocationLegend,
  placementPlanTints,
  upcomingDeliveryLocationSlugs,
  type CargoBayPackMode,
  type PlacedCargoBox,
} from "@/lib/ships/cargoGridPlacement";
import type { CargoBoxScu } from "@/lib/ships/cargoBoxSizes";
import { getCargoGridSketchBySlug } from "@/lib/ships/cargoGrids";
import { manualBayInventory } from "@/lib/ships/manualBayInventory";
import {
  cargoCellCoordFromPoint,
  manualBayBoxStackColumn,
  nextManualBayOrientationIndex,
  tryAddManualBayBox,
  tryDropManualBayBox,
  tryDropManualBayStack,
  tryFillManualBayZoneWithCargoType,
  tryFillManualBayZoneWithMission,
  tryRemoveManualBayBox,
  tryRotateManualBayBox,
  type ManualBayAddBoxSpec,
  type ManualBayBulkFillSpec,
  type ManualBayMissionFillSpec,
} from "@/lib/ships/manualBayMove";
import { cargoBay } from "@/lib/ships/cargoBay";
import { manualBayCarryover } from "@/lib/ships/manualBayCarryover";
import { getShipBayPreferenceFixture } from "@/lib/ships/shipBayPreferences";
import type { CargoGridCoord } from "@/lib/ships/cargoGridCoords";

/**
 * What the cargo grid shows for the focused checklist stop.
 * `all` = all crates aboard in the bay at that point (including transfer).
 * `transfer` = only this stop’s pickup / delivery.
 */
export type CargoBayStopScope = "all" | "transfer";

/** Imperative height API for the cargo-bays modal corner resize. */
export type CargoBayLayoutResizeApi = {
  getHeightPx: () => number;
  setHeightPx: (next: number, options?: { persist?: boolean }) => void;
  resetHeightPx: () => void;
  getMaxHeightPx: () => number;
};

export type CargoBayLayoutProps = {
  rows: HaulingChecklistRow[];
  /** Session contracts — Manual tray groups identical crates by mission. */
  missions?: SessionMission[];
  /** Active session ship — drives which cargo grid to show. */
  shipSlug?: string | null;
  /** Checklist stop to preview (completed or not). Defaults to next incomplete. */
  focusedStopId?: string | null;
  /**
   * `all` = everything aboard at the focused stop (including transfer).
   * `transfer` = only that stop’s pickup / delivery.
   * Toggle UI shows when `onStopScopeChange` is set.
   */
  stopScope?: CargoBayStopScope;
  onStopScopeChange?: (scope: CargoBayStopScope) => void;
  /** Session UUID — scopes browser-local layout height prefs. */
  sessionId?: string | null;
  /**
   * Optional session stats — right of the Cargo bays title.
   * Pass a render fn to receive All-tab grid placed SCU (packing / Manual).
   */
  headerAside?:
    | ReactNode
    | ((ctx: { gridPlacedScu: number }) => ReactNode);
  /** When true, graph height fills the modal shell (no height drag). */
  isFullscreen?: boolean;
  /**
   * When set, exposes height controls to the parent (modal corner resize) and
   * hides the bottom height-only handle.
   */
  layoutResizeRef?: MutableRefObject<CargoBayLayoutResizeApi | null>;
  className?: string;
};

/**
 * Session cargo layout: ship bay grid at the focused stop (top / 3D / split).
 * Memoized so modal open/close on the parent does not rebuild the grid.
 */
export const CargoBayLayout = memo(function CargoBayLayout({
  rows,
  missions = [],
  shipSlug = null,
  focusedStopId = null,
  stopScope = "transfer",
  onStopScopeChange,
  sessionId = null,
  headerAside = null,
  isFullscreen = false,
  layoutResizeRef,
  className,
}: CargoBayLayoutProps) {
  const sketch = useMemo(
    () => getCargoGridSketchBySlug(shipSlug),
    [shipSlug],
  );
  const {
    legendHidden,
    sortingHidden,
    sidePanelsOverlay,
    viewTab,
    splitOrientation,
    syncedZoom,
    topZoomLocked,
    isoZoomLocked,
    sortingMode,
    lastAutoPackMode,
    prioritized,
    topZoom,
    isoZoom,
    setLegendHidden,
    setSortingHidden,
    setSidePanelsOverlay,
    setViewTab,
    setSplitOrientation,
    setSyncedZoom,
    setTopZoomLocked,
    setIsoZoomLocked,
    setSortingMode,
    setLastAutoPackMode,
    setPrioritized,
    setTopZoom,
    setIsoZoom,
  } = useSessionCargoBayChrome(sessionId);
  const [peelStack, setPeelStack] = useState(false);
  /** Manual Path: preview Blank / Automatic seeds until Save. */
  const [manualSeedPicker, setManualSeedPicker] = useState(false);
  /** Blank / Automatic mode id / existing custom template id. */
  const [manualSeedPreview, setManualSeedPreview] = useState<string | null>(
    null,
  );
  const [renamingTemplateId, setRenamingTemplateId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [manualSession, setManualSession] =
    useState<ManualBayLayoutSessionState>({ byStop: {} });
  const [manualLiveBoxes, setManualLiveBoxes] = useState<PlacedCargoBox[] | null>(
    null,
  );
  const [trayPlacement, setTrayPlacement] = useState<{
    mode: "single" | "bulk" | "mission";
    spec: ManualBayAddBoxSpec;
    bulk?: ManualBayBulkFillSpec;
    mission?: ManualBayMissionFillSpec;
    bulkRemainingScu?: number;
    lineKey: string;
    orientationIndex: number;
  } | null>(null);
  const [trayPointerClient, setTrayPointerClient] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const trayPlacementRef = useRef(trayPlacement);
  trayPlacementRef.current = trayPlacement;
  const manualDragBaseRef = useRef<PlacedCargoBox[] | null>(null);
  /** Cursor-follow drag for a placed crate (ghost); drop commits or reverts. */
  const [crateDrag, setCrateDrag] = useState<{
    boxId: string;
    clientX: number;
    clientY: number;
    grabOffsetX: number;
    grabOffsetY: number;
    moveStack?: boolean;
  } | null>(null);
  const crateDragRef = useRef(crateDrag);
  crateDragRef.current = crateDrag;
  const { heightPx, setHeightPx, resetHeightPx } =
    useSessionCargoBayLayoutHeight(sessionId);
  /** Ephemeral fill height while fullscreen — does not overwrite stored height. */
  const [fullscreenHeightPx, setFullscreenHeightPx] = useState<number | null>(
    null,
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const dragRef = useRef<{
    pointerId: number;
    startY: number;
    startHeight: number;
  } | null>(null);

  /**
   * Cap graph height so the modal shell never needs a scrollbar.
   * Chrome = everything in the layout root except the sized graph panel
   * (header, tabs, transfer footer, padding).
   */
  const maxPanelHeightPx = useCallback((): number => {
    const shellMax = cargoBayModalShellMaxHeightPx({ fullscreen: isFullscreen });
    const root = rootRef.current;
    const graph = root?.querySelector("[data-cargo-bay-height-panel]");
    if (!root || !(graph instanceof HTMLElement)) {
      return isFullscreen
        ? shellMax
        : Math.min(MAX_CARGO_BAY_LAYOUT_HEIGHT_PX, shellMax);
    }
    if (isFullscreen) {
      // Root is already viewport-tall; do not treat leftover flex gap as chrome.
      const rootRect = root.getBoundingClientRect();
      const graphRect = graph.getBoundingClientRect();
      // Footers sit beside the graph column (not inside the sized graph node).
      let siblingBelow = 0;
      let sib: Element | null = graph.parentElement?.nextElementSibling ?? null;
      while (sib) {
        if (sib instanceof HTMLElement) {
          siblingBelow += sib.getBoundingClientRect().height;
        }
        sib = sib.nextElementSibling;
      }
      // `above` already includes header + tabs above the graph.
      const above = Math.max(0, graphRect.top - rootRect.top);
      const padBottom =
        Number.parseFloat(getComputedStyle(root).paddingBottom) || 0;
      return Math.max(
        MIN_CARGO_BAY_LAYOUT_HEIGHT_PX,
        Math.floor(rootRect.height - above - siblingBelow - padBottom),
      );
    }
    // Use the CSS shell max (not shrink-wrapped clientHeight) so the graph can
    // still grow until the modal would otherwise need a scrollbar.
    const rootHeight = root.offsetHeight;
    const graphHeight = Math.max(1, graph.offsetHeight);
    const chrome = Math.max(0, rootHeight - graphHeight);
    return Math.max(
      MIN_CARGO_BAY_LAYOUT_HEIGHT_PX,
      Math.min(MAX_CARGO_BAY_LAYOUT_HEIGHT_PX, shellMax - chrome),
    );
  }, [isFullscreen]);

  const setPanelHeightPx = useCallback(
    (next: number, options?: { persist?: boolean }) => {
      setHeightPx(Math.min(next, maxPanelHeightPx()), options);
    },
    [maxPanelHeightPx, setHeightPx],
  );

  const panelHeightPx =
    isFullscreen && fullscreenHeightPx != null ? fullscreenHeightPx : heightPx;

  const heightPxRef = useRef(heightPx);
  heightPxRef.current = heightPx;

  const hostCornerResize = layoutResizeRef != null;
  useEffect(() => {
    if (!layoutResizeRef) return;
    layoutResizeRef.current = {
      getHeightPx: () => heightPxRef.current,
      setHeightPx: setPanelHeightPx,
      resetHeightPx,
      getMaxHeightPx: maxPanelHeightPx,
    };
    return () => {
      layoutResizeRef.current = null;
    };
  }, [layoutResizeRef, maxPanelHeightPx, resetHeightPx, setPanelHeightPx]);

  useEffect(() => {
    setManualSession(readManualBayLayoutSession(sessionId));
    setManualLiveBoxes(null);
    setManualSeedPicker(false);
    setManualSeedPreview(null);
  }, [sessionId]);

  const shipBayPrefs = useMemo(
    () => getShipBayPreferenceFixture(shipSlug),
    [shipSlug],
  );
  const supportsPrioritized = Boolean(
    shipBayPrefs.missionPriorityPacking?.bias,
  );
  const packMode: CargoBayPackMode =
    sortingMode === "manual" ? lastAutoPackMode : sortingMode;
  const isManual = sortingMode === "manual";
  const showPrioritizedToggle =
    !isManual && packMode === "by-cargo-type" && supportsPrioritized;

  const activeRow = useMemo(() => {
    if (focusedStopId) {
      const hit = rows.find((row) => row.id === focusedStopId);
      if (hit) return hit;
    }
    return rows.find((row) => !row.isCompleted) ?? rows[rows.length - 1] ?? null;
  }, [rows, focusedStopId]);

  const thisStopTransfers = useMemo(
    () => cargoInventory.transferByCommodityAtStop(activeRow),
    [activeRow],
  );
  const thisStopLabel = useMemo(() => {
    if (!activeRow) return null;
    return (
      getLocationBySlug(activeRow.locationSlug)?.name ?? activeRow.locationSlug
    );
  }, [activeRow]);

  const stopId = activeRow?.id ?? null;
  const manualStop = useMemo(
    () => getManualBayLayoutStopState(manualSession, stopId),
    [manualSession, stopId],
  );
  const activeManualTemplate = useMemo(() => {
    if (!manualStop.activeTemplateId) return null;
    return (
      manualStop.templates.find(
        (template) => template.id === manualStop.activeTemplateId,
      ) ?? null
    );
  }, [manualStop]);

  const persistManualSession = useCallback(
    (next: ManualBayLayoutSessionState) => {
      setManualSession(next);
      writeManualBayLayoutSession(sessionId, next);
    },
    [sessionId],
  );

  const updateStopManual = useCallback(
    (
      updater: (
        current: ReturnType<typeof getManualBayLayoutStopState>,
      ) => ReturnType<typeof getManualBayLayoutStopState>,
    ) => {
      if (!stopId) return;
      const current = getManualBayLayoutStopState(manualSession, stopId);
      const nextStop = updater(current);
      persistManualSession({
        byStop: {
          ...manualSession.byStop,
          [stopId]: nextStop,
        },
      });
    },
    [manualSession, persistManualSession, stopId],
  );

  const basePlan = useMemo(() => {
    if (!sketch || !activeRow) return null;
    // Always pack against full bay occupancy so Transfer crates sit in free
    // cells (not on top of stay cargo). Transfer scope only hides stay.
    return cargoBay.packAtStop(activeRow.id, sketch, rows, {
      packMode,
      missionPrioritized:
        packMode === "by-cargo-type" && supportsPrioritized && prioritized,
      includeAboardCargo: true,
    });
  }, [
    sketch,
    rows,
    activeRow,
    packMode,
    prioritized,
    supportsPrioritized,
  ]);

  /** Nearest earlier Manual snapshot (route order), if any. */
  const earlierManualSnapshot = useMemo(() => {
    if (!stopId) return null;
    return latestManualBoxesBeforeStop(
      manualSession,
      rows.map((row) => row.id),
      stopId,
    );
  }, [manualSession, rows, stopId]);

  const earlierManualLayout = earlierManualSnapshot?.boxes ?? null;

  /**
   * Earlier Manual poses with prior-stop deliveries stripped and this stop’s
   * delivery tags applied. Prefer over a per-stop template seeded from auto-pack.
   */
  const deliveryRetagOptions = useMemo(
    () => ({
      ...(sketch?.widthCells
        ? { deckWidthCells: sketch.widthCells }
        : {}),
      rows,
      earlierStopId: earlierManualSnapshot?.stopId ?? null,
      currentStopId: stopId,
    }),
    [earlierManualSnapshot?.stopId, rows, sketch?.widthCells, stopId],
  );

  const manualBaseBoxes = useMemo(() => {
    if (!basePlan || !stopId) return [];
    return earlierManualLayout && earlierManualLayout.length > 0
      ? manualBayCarryover.boxesAtStop(
          basePlan.boxes,
          earlierManualLayout,
          deliveryRetagOptions,
        )
      : basePlan.boxes;
  }, [basePlan, deliveryRetagOptions, earlierManualLayout, stopId]);

  /** Full bay contents (before All/Transfer filter) — Manual edits this list. */
  const workingBoxes = useMemo(() => {
    if (!basePlan) return [];
    let boxes: PlacedCargoBox[];
    if (!isManual) {
      boxes = basePlan.boxes;
    } else if (manualLiveBoxes) {
      // Live edits on this stop win.
      boxes = manualLiveBoxes;
    } else if (earlierManualLayout && earlierManualLayout.length > 0) {
      // Advancing stops: always derive from earlier Manual layout when present.
      // Do not use this stop’s saved template snapshot — it may be a stale auto-pack
      // seed and would replace the player’s Everus (etc.) arrangement.
      boxes = manualBaseBoxes;
    } else {
      boxes = boxesFromManualTemplate(activeManualTemplate, manualBaseBoxes);
    }
    // Transfer: doorward / aisle first; clear a stack top→bottom before another.
    return manualBayCarryover.retagDeliveryPreferringTop(
      boxes,
      deliveryRetagOptions,
    );
  }, [
    activeManualTemplate,
    basePlan,
    deliveryRetagOptions,
    earlierManualLayout,
    isManual,
    manualBaseBoxes,
    manualLiveBoxes,
  ]);

  const displayBoxes = useMemo(() => {
    // Transfer: show only pickup / delivery; stay stays packed underneath.
    if (stopScope === "transfer") {
      return workingBoxes.filter(
        (box) => box.action === "pickup" || box.action === "delivery",
      );
    }
    return workingBoxes;
  }, [stopScope, workingBoxes]);

  /** All-tab bay contents (not Transfer-filtered) — header “On grid” SCU. */
  const gridPlacedScu = useMemo(
    () => workingBoxes.reduce((sum, box) => sum + box.size, 0),
    [workingBoxes],
  );

  const headerAsideNode = useMemo(() => {
    if (typeof headerAside === "function") {
      return headerAside({ gridPlacedScu });
    }
    return headerAside;
  }, [gridPlacedScu, headerAside]);

  const plan = useMemo(() => {
    if (!basePlan) return null;
    return { ...basePlan, boxes: displayBoxes };
  }, [basePlan, displayBoxes]);

  const baseBoxIdsKey = useMemo(
    () => basePlan?.boxes.map((box) => box.id).join("|") ?? "",
    [basePlan],
  );

  const manualSeedPickerRef = useRef(manualSeedPicker);
  manualSeedPickerRef.current = manualSeedPicker;

  useEffect(() => {
    setManualSeedPicker(false);
    setManualSeedPreview(null);
    setManualLiveBoxes(null);
    manualDragBaseRef.current = null;
  }, [stopId]);

  // Drop live overrides when auto-pack inventory changes so Manual falls back
  // to this stop’s template or earlier-stop carryover. Skip while Start-from is
  // open so previews are not wiped.
  useEffect(() => {
    if (manualSeedPickerRef.current) return;
    setManualLiveBoxes(null);
    manualDragBaseRef.current = null;
  }, [baseBoxIdsKey]);

  const placementTints = useMemo(
    () => (plan ? placementPlanTints(plan) : []),
    [plan],
  );
  const legendItems = useMemo(
    () => (plan ? placementPlanLegend(plan) : []),
    [plan],
  );
  const locationLegendItems = useMemo(() => {
    if (!plan || !activeRow) return [];
    return placementPlanLocationLegend(plan, {
      locationOrder: upcomingDeliveryLocationSlugs(rows, activeRow.id),
    });
  }, [plan, rows, activeRow]);
  const showLocationOutlines = packMode === "by-mission-location" && !isManual;
  // Manual must keep the empty bay visible after Clear / remove-all so tray place works.
  const showGrid = Boolean(
    sketch && plan && (plan.boxes.length > 0 || isManual),
  );
  const showViewTabs = showGrid;

  useEffect(() => {
    if (isFullscreen) return;
    const reclamp = () => {
      const max = maxPanelHeightPx();
      if (heightPxRef.current > max) setHeightPx(max);
    };
    reclamp();
    window.addEventListener("resize", reclamp);
    return () => window.removeEventListener("resize", reclamp);
  }, [maxPanelHeightPx, setHeightPx, showGrid, isFullscreen]);

  useEffect(() => {
    if (!isFullscreen) {
      setFullscreenHeightPx(null);
      return;
    }
    const sync = () => {
      setFullscreenHeightPx(maxPanelHeightPx());
    };
    sync();
    const raf = requestAnimationFrame(sync);
    window.addEventListener("resize", sync);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", sync);
    };
  }, [
    isFullscreen,
    maxPanelHeightPx,
    showGrid,
    sortingHidden,
    legendHidden,
    sidePanelsOverlay,
    viewTab,
  ]);
  const canPeel = useMemo(() => {
    if (!plan) return false;
    let maxZ = -1;
    for (const box of plan.boxes) {
      maxZ = Math.max(maxZ, box.origin.z + box.footprint.dz - 1);
    }
    return maxZ > 0;
  }, [plan]);
  const showPeelToggle =
    canPeel && (viewTab === "iso" || viewTab === "split");

  const createManualTemplateFromBoxes = useCallback(
    (
      boxes: PlacedCargoBox[],
      options?: { name?: string },
    ): ManualBayLayoutTemplate | null => {
      if (!stopId) return null;
      const templates = manualStop.templates;
      return {
        id: newManualBayTemplateId(),
        name: uniqueManualTemplateName(
          options?.name?.trim() || "Manual",
          templates,
        ),
        stopId,
        poses: posesFromBoxes(boxes),
        boxes: storedBoxesFromPlaced(boxes),
        updatedAt: new Date().toISOString(),
      };
    },
    [manualStop.templates, stopId],
  );

  type ManualSeed = "blank" | CargoBayPackMode | string;

  const isCargoBayPackMode = useCallback((seed: string): seed is CargoBayPackMode => {
    return cargoBayPackModes.some((mode) => mode.id === seed);
  }, []);

  /** Fresh Automatic pack for a mode — same boxes Automatic Path would show. */
  const packBoxesForMode = useCallback(
    (mode: CargoBayPackMode): PlacedCargoBox[] => {
      if (!sketch || !activeRow || !stopId) return [];
      return cargoBay.packAtStop(activeRow.id, sketch, rows, {
        packMode: mode,
        missionPrioritized:
          mode === "by-cargo-type" && supportsPrioritized && prioritized,
        includeAboardCargo: true,
      }).boxes;
    },
    [
      activeRow,
      prioritized,
      rows,
      sketch,
      stopId,
      supportsPrioritized,
    ],
  );

  /** Boxes for a Base template seed (Blank, Automatic mode, or custom template). */
  const boxesForManualSeed = useCallback(
    (seed: ManualSeed): PlacedCargoBox[] => {
      if (seed === "blank") return [];
      if (isCargoBayPackMode(seed)) return packBoxesForMode(seed);
      const template = manualStop.templates.find((entry) => entry.id === seed);
      if (!template) return [];
      return boxesFromManualTemplate(template, manualBaseBoxes);
    },
    [
      isCargoBayPackMode,
      manualBaseBoxes,
      manualStop.templates,
      packBoxesForMode,
    ],
  );

  const labelForManualSeed = useCallback(
    (seed: ManualSeed): string => {
      if (seed === "blank") return "Blank";
      if (isCargoBayPackMode(seed)) {
        return (
          cargoBayPackModes.find((mode) => mode.id === seed)?.label ?? "Manual"
        );
      }
      return (
        manualStop.templates.find((entry) => entry.id === seed)?.name ??
        "Manual"
      );
    },
    [isCargoBayPackMode, manualStop.templates],
  );

  const patchActiveTemplateBoxes = useCallback(
    (boxes: PlacedCargoBox[]) => {
      if (!stopId) return;
      updateStopManual((current) => {
        // Draft seed preview — keep edits live until Save.
        if (manualSeedPicker) return current;
        // Manual is session-wide: a stop with no template yet saves its first edit as one.
        if (!current.activeTemplateId) {
          const template = createManualTemplateFromBoxes(boxes);
          if (!template) return current;
          return {
            activeTemplateId: template.id,
            templates: [...current.templates, template],
          };
        }
        return {
          ...current,
          templates: current.templates.map((template) =>
            template.id === current.activeTemplateId
              ? {
                  ...template,
                  poses: posesFromBoxes(boxes),
                  boxes: storedBoxesFromPlaced(boxes),
                  updatedAt: new Date().toISOString(),
                }
              : template,
          ),
        };
      });
    },
    [
      createManualTemplateFromBoxes,
      manualSeedPicker,
      stopId,
      updateStopManual,
    ],
  );

  const selectAutoMode = useCallback(
    (mode: CargoBayPackMode) => {
      setLastAutoPackMode(mode);
      setSortingMode(mode);
      setManualLiveBoxes(null);
      manualDragBaseRef.current = null;
      setManualSeedPicker(false);
      setManualSeedPreview(null);
      setRenamingTemplateId(null);
    },
    [setLastAutoPackMode, setSortingMode],
  );

  /** Switch Path → Manual: restore templates, or open the seed picker. */
  const enterManualPath = useCallback(() => {
    if (!stopId) return;
    setSortingHidden(false);
    setSortingMode("manual");
    setRenamingTemplateId(null);
    if (manualStop.templates.length === 0) {
      setManualSeedPicker(true);
      setManualSeedPreview(null);
      setManualLiveBoxes(null);
      return;
    }
    setManualSeedPicker(false);
    setManualSeedPreview(null);
    const template =
      manualStop.templates.find(
        (entry) => entry.id === manualStop.activeTemplateId,
      ) ?? manualStop.templates[0]!;
    if (!manualStop.activeTemplateId || template.id !== manualStop.activeTemplateId) {
      updateStopManual((current) => ({
        ...current,
        activeTemplateId: template.id,
      }));
    }
    setManualLiveBoxes(boxesFromManualTemplate(template, manualBaseBoxes));
  }, [
    manualBaseBoxes,
    manualStop.activeTemplateId,
    manualStop.templates,
    setSortingHidden,
    setSortingMode,
    stopId,
    updateStopManual,
  ]);

  /** Preview a seed on the bay; Start from stays open until Select. */
  const previewManualSeed = useCallback(
    (seed: ManualSeed) => {
      if (!stopId) return;
      setManualSeedPreview(seed);
      setManualLiveBoxes(boxesForManualSeed(seed));
      setSortingMode("manual");
      setSortingHidden(false);
    },
    [boxesForManualSeed, setSortingHidden, setSortingMode, stopId],
  );

  const saveManualSeedAsTemplate = useCallback(() => {
    if (!stopId || manualSeedPreview == null) return;
    const sourceBoxes =
      manualLiveBoxes ?? boxesForManualSeed(manualSeedPreview);
    const template = createManualTemplateFromBoxes(sourceBoxes, {
      name: labelForManualSeed(manualSeedPreview),
    });
    if (!template) return;
    updateStopManual((current) => ({
      activeTemplateId: template.id,
      templates: [...current.templates, template],
    }));
    setManualLiveBoxes(sourceBoxes);
    setManualSeedPicker(false);
    setManualSeedPreview(null);
  }, [
    boxesForManualSeed,
    createManualTemplateFromBoxes,
    labelForManualSeed,
    manualLiveBoxes,
    manualSeedPreview,
    stopId,
    updateStopManual,
  ]);

  const cancelManualSeedPicker = useCallback(() => {
    setManualSeedPicker(false);
    setManualSeedPreview(null);
    if (manualStop.templates.length === 0) return;
    const template =
      manualStop.templates.find(
        (entry) => entry.id === manualStop.activeTemplateId,
      ) ?? manualStop.templates[0]!;
    setManualLiveBoxes(boxesFromManualTemplate(template, manualBaseBoxes));
  }, [
    manualBaseBoxes,
    manualStop.activeTemplateId,
    manualStop.templates,
  ]);

  const commitTemplateRename = useCallback(
    (templateId: string, nextName: string) => {
      updateStopManual((current) => ({
        ...current,
        templates: renameManualBayTemplate(current.templates, templateId, nextName),
      }));
      setRenamingTemplateId(null);
      setRenameDraft("");
    },
    [updateStopManual],
  );

  const deleteManualTemplate = useCallback(
    (templateId: string) => {
      const remaining = manualStop.templates.filter(
        (template) => template.id !== templateId,
      );
      updateStopManual((current) => {
        const templates = current.templates.filter(
          (template) => template.id !== templateId,
        );
        const activeTemplateId =
          current.activeTemplateId === templateId
            ? (templates[0]?.id ?? null)
            : current.activeTemplateId;
        return { templates, activeTemplateId };
      });
      setManualLiveBoxes(null);
      setRenamingTemplateId(null);
      setManualSeedPreview(null);
      if (remaining.length === 0) {
        setManualSeedPicker(true);
        setSortingMode("manual");
      } else {
        const next =
          remaining.find((template) => template.id === manualStop.activeTemplateId) ??
          remaining[0]!;
        setManualLiveBoxes(boxesFromManualTemplate(next, manualBaseBoxes));
      }
    },
    [
      manualBaseBoxes,
      manualStop.activeTemplateId,
      manualStop.templates,
      setSortingMode,
      updateStopManual,
    ],
  );

  const onManualDragStart = useCallback(
    (
      boxId: string,
      clientX: number,
      clientY: number,
      options?: { moveStack?: boolean },
    ) => {
      const base = workingBoxes.map((box) => ({ ...box }));
      manualDragBaseRef.current = base;
      // Keep bay crates at the pre-drag pose; the ghost follows the cursor.
      setManualLiveBoxes(base);
      const box = base.find((entry) => entry.id === boxId);
      const grabCell = cargoCellCoordFromPoint(clientX, clientY);
      const grabOffsetX =
        box && grabCell ? grabCell.x - box.origin.x : 0;
      const grabOffsetY =
        box && grabCell ? grabCell.y - box.origin.y : 0;
      setCrateDrag({
        boxId,
        clientX,
        clientY,
        grabOffsetX,
        grabOffsetY,
        moveStack: options?.moveStack === true,
      });
    },
    [workingBoxes],
  );

  const onManualDragMove = useCallback(
    (boxId: string, clientX: number, clientY: number) => {
      setCrateDrag((current) =>
        current && current.boxId === boxId
          ? { ...current, clientX, clientY }
          : current,
      );
    },
    [],
  );

  const onManualDragEnd = useCallback(
    (boxId: string, clientX: number, clientY: number) => {
      const base = manualDragBaseRef.current;
      const drag = crateDragRef.current;
      setCrateDrag(null);
      manualDragBaseRef.current = null;

      const revert = () => {
        if (base) setManualLiveBoxes(base);
      };

      if (!base || !sketch || !drag || drag.boxId !== boxId) {
        revert();
        return;
      }

      const dropCell = cargoCellCoordFromPoint(clientX, clientY);
      if (!dropCell) {
        revert();
        return;
      }

      const grab = {
        dx: drag.grabOffsetX,
        dy: drag.grabOffsetY,
      };
      const next = drag.moveStack
        ? tryDropManualBayStack(sketch, base, boxId, dropCell, grab)
        : tryDropManualBayBox(sketch, base, boxId, dropCell, grab);
      if (!next) {
        revert();
        return;
      }

      setManualLiveBoxes(next);
      patchActiveTemplateBoxes(next);
    },
    [patchActiveTemplateBoxes, sketch],
  );

  const persistManualBoxes = useCallback(
    (boxes: PlacedCargoBox[]) => {
      setManualLiveBoxes(boxes);
      patchActiveTemplateBoxes(boxes);
    },
    [patchActiveTemplateBoxes],
  );

  const manualInventoryGroups = useMemo(() => {
    if (!isManual || !stopId) return [];
    return manualBayInventory.remainingByMission(
      stopId,
      rows,
      workingBoxes,
      {
        missions,
        includeAboardCargo: stopScope === "all",
      },
    );
  }, [isManual, missions, rows, stopId, stopScope, workingBoxes]);

  const clearTrayPlacement = useCallback(() => {
    trayPlacementRef.current = null;
    setTrayPlacement(null);
    setTrayPointerClient(null);
  }, []);

  const placeTrayAtCoord = useCallback(
    (coord: CargoGridCoord) => {
      const current = trayPlacementRef.current;
      if (!sketch || !isManual || !current) return false;
      if (current.mode === "mission" && current.mission) {
        const result = tryFillManualBayZoneWithMission(
          sketch,
          workingBoxes,
          coord,
          current.mission,
        );
        if (!result || result.placedCount === 0) return false;
        persistManualBoxes(result.boxes);
        return true;
      }
      if (current.mode === "bulk" && current.bulk) {
        const result = tryFillManualBayZoneWithCargoType(
          sketch,
          workingBoxes,
          coord,
          current.bulk,
        );
        if (!result || result.placedCount === 0) return false;
        persistManualBoxes(result.boxes);
        return true;
      }
      const next = tryAddManualBayBox(
        sketch,
        workingBoxes,
        current.spec,
        coord,
        current.orientationIndex,
      );
      if (!next) return false;
      persistManualBoxes(next);
      return true;
    },
    [isManual, persistManualBoxes, sketch, workingBoxes],
  );

  const rotateTrayOrientation = useCallback(() => {
    setTrayPlacement((current) => {
      if (!current) return current;
      const next = {
        ...current,
        orientationIndex: nextManualBayOrientationIndex(
          current.spec.size,
          current.orientationIndex,
        ),
      };
      trayPlacementRef.current = next;
      return next;
    });
  }, []);

  const onManualBoxRemove = useCallback(
    (boxId: string) => {
      if (!isManual) return;
      const next = tryRemoveManualBayBox(workingBoxes, boxId);
      if (!next) return;
      persistManualBoxes(next);
    },
    [isManual, persistManualBoxes, workingBoxes],
  );

  const onManualBoxRotate = useCallback(
    (boxId: string) => {
      if (!isManual || !sketch) return;
      const next = tryRotateManualBayBox(sketch, workingBoxes, boxId);
      if (!next) return;
      persistManualBoxes(next);
    },
    [isManual, persistManualBoxes, sketch, workingBoxes],
  );

  const clearBayToTray = useCallback(() => {
    if (!isManual) return;
    persistManualBoxes([]);
  }, [isManual, persistManualBoxes]);

  const resetCommodityToTray = useCallback(
    (missionId: string | null, commoditySlug: string) => {
      if (!isManual) return;
      persistManualBoxes(
        manualBayInventory.removeCommodityFromBay(
          workingBoxes,
          missionId,
          commoditySlug,
        ),
      );
    },
    [isManual, persistManualBoxes, workingBoxes],
  );

  const resetMissionToTray = useCallback(
    (missionId: string | null) => {
      if (!isManual) return;
      persistManualBoxes(
        manualBayInventory.removeMissionFromBay(workingBoxes, missionId),
      );
    },
    [isManual, persistManualBoxes, workingBoxes],
  );

  const onResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      dragRef.current = {
        pointerId: event.pointerId,
        startY: event.clientY,
        startHeight: heightPx,
      };
      setIsResizing(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [heightPx],
  );

  const onResizePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const delta = event.clientY - drag.startY;
      setPanelHeightPx(drag.startHeight + delta, { persist: false });
    },
    [setPanelHeightPx],
  );

  const endResize = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const finalHeight = drag.startHeight + (event.clientY - drag.startY);
      dragRef.current = null;
      setIsResizing(false);
      setPanelHeightPx(finalHeight);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [setPanelHeightPx],
  );

  useEffect(() => {
    if (!isResizing) return;
    const previous = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "ns-resize";
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.cursor = previous;
      document.body.style.userSelect = previousUserSelect;
    };
  }, [isResizing]);

  const trayDragging = Boolean(trayPlacement);
  useEffect(() => {
    if (!trayDragging) return;
    const previous = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.cursor = previous;
      document.body.style.userSelect = previousUserSelect;
    };
  }, [trayDragging]);

  useEffect(() => {
    if (sortingHidden) {
      setManualSeedPicker(false);
      setRenamingTemplateId(null);
    }
  }, [sortingHidden]);

  const panelHeightMax = maxPanelHeightPx();

  const viewTabList = (
    <div
      role="tablist"
      aria-label="Cargo grid projection"
      className="inline-flex w-fit rounded-rsi border border-rsi-border bg-rsi-bg-deep/95 p-0.5 shadow-rsi-panel"
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
  );

  /** Pack mode / graph top inset under Packing (+ Peel) toggles. */
  const pushPackTopClass = showPeelToggle ? "top-14 sm:top-8" : "top-8";
  const pushPackOpen = !sidePanelsOverlay && !sortingHidden;
  /** Overlay off: clear Packing (+ Peel); keep 2D/Split/3D above the grid. */
  const pushGraphTopClass = !sidePanelsOverlay
    ? showPeelToggle
      ? "pt-14 sm:pt-8"
      : "pt-8"
    : "";
  /** Left gutter matching Pack mode width so graph + footer clear the panel. */
  const pushPackGutterClass = pushPackOpen ? "pl-[17.5rem]" : "";

  return (
    <div
      ref={rootRef}
      className={[
        "min-w-0 overflow-hidden bg-rsi-surface/90 px-4 pt-4 shadow-rsi-panel",
        isFullscreen
          ? "flex h-full flex-col rounded-none border-0"
          : "rounded-rsi border border-rsi-border",
        showGrid ? "pb-0" : "pb-4",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="mb-3 min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-rsi-accent">
              Cargo bays
            </p>
            {sketch ? (
              <p className="mt-1 text-sm text-rsi-text-secondary">{sketch.shipName}</p>
            ) : null}
            {onStopScopeChange ? (
              <div
                role="tablist"
                aria-label="Bay cargo scope"
                className="mt-2 inline-flex w-fit rounded-rsi border border-rsi-border bg-rsi-bg-deep/95 p-0.5"
              >
                {(
                  [
                    { id: "all", label: "All" },
                    { id: "transfer", label: "Transfer" },
                  ] as const
                ).map((option) => {
                  const selected = stopScope === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      onClick={() => onStopScopeChange(option.id)}
                      className={[
                        "rounded-[calc(var(--radius-rsi)-2px)] px-1.5 py-0.5 font-mono text-[0.5rem] uppercase tracking-[0.12em] transition-colors",
                        selected
                          ? "bg-rsi-accent-muted/50 text-rsi-accent"
                          : "text-rsi-text-muted hover:text-rsi-text",
                      ].join(" ")}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
          {headerAsideNode ? (
            <div className="ml-auto min-w-0 shrink">{headerAsideNode}</div>
          ) : null}
        </div>
      </div>

      {trayPlacement && trayPointerClient ? (
        trayPlacement.mode === "mission" && trayPlacement.mission ? (
          <ManualBayTrayMissionDragGhost
            fill={trayPlacement.mission}
            remainingScu={trayPlacement.bulkRemainingScu ?? 0}
            clientX={trayPointerClient.x}
            clientY={trayPointerClient.y}
          />
        ) : trayPlacement.mode === "bulk" && trayPlacement.bulk ? (
          <ManualBayTrayBulkDragGhost
            fill={trayPlacement.bulk}
            remainingScu={trayPlacement.bulkRemainingScu ?? 0}
            clientX={trayPointerClient.x}
            clientY={trayPointerClient.y}
          />
        ) : (
          <ManualBayTrayDragGhost
            spec={trayPlacement.spec}
            orientationIndex={trayPlacement.orientationIndex}
            clientX={trayPointerClient.x}
            clientY={trayPointerClient.y}
          />
        )
      ) : null}
      {crateDrag
        ? (() => {
            const dragged = workingBoxes.find(
              (box) => box.id === crateDrag.boxId,
            );
            if (!dragged) return null;
            const stack = crateDrag.moveStack
              ? manualBayBoxStackColumn(dragged, workingBoxes)
              : [dragged];
            const cellPx = 14;
            return stack.map((box) => (
              <ManualBayPlacedBoxDragGhost
                key={`stack-ghost-${box.id}`}
                box={box}
                clientX={
                  crateDrag.clientX +
                  (box.origin.x - dragged.origin.x) * cellPx
                }
                clientY={
                  crateDrag.clientY +
                  (box.origin.y - dragged.origin.y) * cellPx
                }
              />
            ));
          })()
        : null}

      {!sketch ? (
        <p className="py-6 text-center text-sm text-rsi-text-muted">
          Select a ship with a known cargo grid to see bay placement.
        </p>
      ) : showGrid ? (
        <div
          className={[
            "relative",
            isFullscreen ? "flex min-h-0 flex-1 flex-col" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {showViewTabs ? (
            <>
              {sidePanelsOverlay ? (
                <div className="pointer-events-none absolute top-2 left-1/2 z-20 -translate-x-1/2">
                  <div className="pointer-events-auto">{viewTabList}</div>
                </div>
              ) : null}
              <div className="pointer-events-auto absolute top-2 left-2 z-30 flex flex-col items-start gap-1 sm:flex-row sm:items-center">
                <button
                  type="button"
                  aria-pressed={!sortingHidden}
                  aria-label={sortingHidden ? "Show packing" : "Hide packing"}
                  onClick={() => setSortingHidden(!sortingHidden)}
                  className={[
                    "rounded-rsi border px-1.5 py-0.5 font-mono text-[0.5rem] uppercase tracking-[0.12em] shadow-rsi-panel transition-colors",
                    !sortingHidden
                      ? "border-rsi-accent/50 bg-rsi-accent-muted/40 text-rsi-accent"
                      : "border-rsi-border bg-rsi-bg-deep/95 text-rsi-text-secondary hover:border-rsi-border-strong hover:text-rsi-text",
                  ].join(" ")}
                >
                  Packing
                </button>
                {showPeelToggle ? (
                  <button
                    type="button"
                    aria-pressed={peelStack}
                    aria-label={peelStack ? "Disable peel" : "Enable peel"}
                    onClick={() => setPeelStack((value) => !value)}
                    className={[
                      "rounded-rsi border px-1.5 py-0.5 font-mono text-[0.5rem] uppercase tracking-[0.12em] shadow-rsi-panel transition-colors",
                      peelStack
                        ? "border-rsi-accent/50 bg-rsi-accent-muted/40 text-rsi-accent"
                        : "border-rsi-border bg-rsi-bg-deep/95 text-rsi-text-secondary hover:border-rsi-border-strong hover:text-rsi-text",
                    ].join(" ")}
                  >
                    Peel
                  </button>
                ) : null}
              </div>
              {sidePanelsOverlay ? (
                <button
                  type="button"
                  aria-pressed={!legendHidden}
                  aria-label={legendHidden ? "Show legend" : "Hide legend"}
                  onClick={() => setLegendHidden(!legendHidden)}
                  className={[
                    "pointer-events-auto absolute top-2 right-2 z-30 rounded-rsi border px-1.5 py-0.5 font-mono text-[0.5rem] uppercase tracking-[0.12em] shadow-rsi-panel transition-colors",
                    !legendHidden
                      ? "border-rsi-accent/50 bg-rsi-accent-muted/40 text-rsi-accent"
                      : "border-rsi-border bg-rsi-bg-deep/95 text-rsi-text-secondary hover:border-rsi-border-strong hover:text-rsi-text",
                  ].join(" ")}
                >
                  Legend
                </button>
              ) : null}
              {!sortingHidden ? (
                <div
                  role="region"
                  aria-label="Cargo packing"
                  className={[
                    cargoBaySidePanelClassName({
                      overlay: true,
                      side: "left",
                      toggleAbove: true,
                      topClassName: pushPackTopClass,
                      matchGraphHeight: true,
                    }),
                    "flex flex-col space-y-2",
                  ].join(" ")}
                  style={{ height: panelHeightPx }}
                >
                  <div className="min-w-0 space-y-1.5">
                    <p className="font-mono text-[0.55rem] uppercase tracking-[0.14em] text-rsi-text-muted">
                      Type
                    </p>
                    <div
                      role="group"
                      aria-label="Packing type"
                      className="grid grid-cols-2 gap-1"
                    >
                      {(
                        [
                          { id: "automatic" as const, label: "Automatic" },
                          { id: "manual" as const, label: "Manual" },
                        ] as const
                      ).map((path) => {
                        const selected =
                          path.id === "manual" ? isManual : !isManual;
                        return (
                          <button
                            key={path.id}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => {
                              if (path.id === "manual") enterManualPath();
                              else selectAutoMode(lastAutoPackMode);
                            }}
                            className={[
                              "rounded-rsi border px-2 py-1.5 font-mono text-[0.55rem] uppercase tracking-[0.12em] transition-colors",
                              selected
                                ? "border-rsi-accent/50 bg-rsi-accent-muted/40 text-rsi-accent"
                                : "border-rsi-border/80 bg-rsi-bg-deep/50 text-rsi-text-muted hover:border-rsi-border-strong hover:text-rsi-text-secondary",
                            ].join(" ")}
                          >
                            {path.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {!isManual ? (
                    <div className="min-w-0 space-y-1">
                      <div
                        role="group"
                        aria-label="Automatic pack mode"
                        className="flex flex-col gap-1"
                      >
                        {cargoBayPackModes.map((mode) => {
                          const selected = sortingMode === mode.id;
                          return (
                            <button
                              key={mode.id}
                              type="button"
                              title={mode.summary}
                              aria-pressed={selected}
                              onClick={() => selectAutoMode(mode.id)}
                              className={[
                                "flex w-full flex-col items-start gap-0.5 rounded-rsi border px-2 py-1.5 text-left transition-colors",
                                selected
                                  ? "border-rsi-accent/50 bg-rsi-accent-muted/30 text-rsi-accent"
                                  : "border-rsi-border/70 bg-rsi-bg-deep/40 text-rsi-text-secondary hover:border-rsi-border-strong hover:text-rsi-text",
                              ].join(" ")}
                            >
                              <span className="font-mono text-[0.55rem] uppercase tracking-[0.14em]">
                                {mode.label}
                              </span>
                              <span className="text-[0.65rem] leading-snug text-rsi-text-muted">
                                {mode.summary}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      {supportsPrioritized &&
                      sortingMode === "by-cargo-type" ? (
                        <button
                          type="button"
                          aria-pressed={showPrioritizedToggle && prioritized}
                          title={
                            shipBayPrefs.missionPriorityPacking?.bias ===
                            "edges-first"
                              ? "Early deliveries toward bay edges; later deliveries toward the center."
                              : "Order cargo by upcoming delivery stops."
                          }
                          onClick={() => {
                            selectAutoMode("by-cargo-type");
                            setPrioritized(
                              sortingMode === "by-cargo-type"
                                ? !prioritized
                                : true,
                            );
                          }}
                          className={[
                            "w-full rounded-rsi border px-2 py-1 font-mono text-[0.5rem] uppercase tracking-[0.12em] transition-colors",
                            showPrioritizedToggle && prioritized
                              ? "border-rsi-accent/50 bg-rsi-accent-muted/40 text-rsi-accent"
                              : "border-rsi-border/80 bg-rsi-bg-deep/50 text-rsi-text-muted hover:border-rsi-border-strong hover:text-rsi-text-secondary",
                          ].join(" ")}
                        >
                          Prioritized
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  {isManual ? (
                    <div className="flex min-h-0 flex-1 flex-col gap-1.5">
                      {manualSeedPicker ? (
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center justify-between gap-1">
                            <p className="font-mono text-[0.55rem] uppercase tracking-[0.14em] text-rsi-text-muted">
                              Base template
                            </p>
                            {manualStop.templates.length > 0 ? (
                              <button
                                type="button"
                                aria-label="Cancel"
                                title="Cancel"
                                onClick={cancelManualSeedPicker}
                                className="inline-flex size-6 shrink-0 items-center justify-center rounded text-[0.85rem] leading-none text-rsi-text-muted transition-colors hover:text-rsi-text-secondary"
                              >
                                ×
                              </button>
                            ) : null}
                          </div>
                          <div className="flex flex-col gap-1">
                            <div className="flex flex-nowrap gap-1">
                              {(
                                [
                                  {
                                    id: "blank" as const,
                                    label: "Blank",
                                  },
                                  ...cargoBayPackModes
                                    .filter((mode) => mode.id !== "suggested")
                                    .map((mode) => ({
                                      id: mode.id,
                                      label: mode.label,
                                    })),
                                ] as const
                              ).map((option) => {
                                const selected =
                                  manualSeedPreview === option.id;
                                return (
                                  <button
                                    key={option.id}
                                    type="button"
                                    aria-pressed={selected}
                                    onClick={() =>
                                      previewManualSeed(option.id)
                                    }
                                    className={[
                                      "min-w-0 shrink rounded-rsi border px-1.5 py-1.5 font-mono text-[0.5rem] uppercase tracking-[0.1em] transition-colors",
                                      selected
                                        ? "border-rsi-accent/50 bg-rsi-accent-muted/30 text-rsi-accent"
                                        : "border-rsi-border/70 bg-rsi-bg-deep/40 text-rsi-text-secondary hover:border-rsi-border-strong hover:text-rsi-text",
                                    ].join(" ")}
                                  >
                                    {option.label}
                                  </button>
                                );
                              })}
                            </div>
                            {cargoBayPackModes
                              .filter((mode) => mode.id === "suggested")
                              .map((mode) => {
                                const selected =
                                  manualSeedPreview === mode.id;
                                return (
                                  <button
                                    key={mode.id}
                                    type="button"
                                    aria-pressed={selected}
                                    onClick={() => previewManualSeed(mode.id)}
                                    className={[
                                      "w-fit rounded-rsi border px-1.5 py-1.5 font-mono text-[0.5rem] uppercase tracking-[0.1em] transition-colors",
                                      selected
                                        ? "border-rsi-accent/50 bg-rsi-accent-muted/30 text-rsi-accent"
                                        : "border-rsi-border/70 bg-rsi-bg-deep/40 text-rsi-text-secondary hover:border-rsi-border-strong hover:text-rsi-text",
                                    ].join(" ")}
                                  >
                                    {mode.label}
                                  </button>
                                );
                              })}
                            {manualStop.templates.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {manualStop.templates.map((template) => {
                                  const selected =
                                    manualSeedPreview === template.id;
                                  return (
                                    <button
                                      key={template.id}
                                      type="button"
                                      title={`Start from ${template.name}`}
                                      aria-pressed={selected}
                                      onClick={() =>
                                        previewManualSeed(template.id)
                                      }
                                      className={[
                                        "min-w-0 max-w-full truncate rounded-rsi border px-1.5 py-1.5 font-mono text-[0.5rem] uppercase tracking-[0.1em] transition-colors",
                                        selected
                                          ? "border-rsi-accent/50 bg-rsi-accent-muted/30 text-rsi-accent"
                                          : "border-rsi-border/70 bg-rsi-bg-deep/40 text-rsi-text-secondary hover:border-rsi-border-strong hover:text-rsi-text",
                                      ].join(" ")}
                                    >
                                      {template.name}
                                    </button>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            disabled={manualSeedPreview == null}
                            onClick={saveManualSeedAsTemplate}
                            className={[
                              "w-full rounded-rsi border px-1.5 py-1.5 font-mono text-[0.5rem] uppercase tracking-[0.1em] transition-colors",
                              manualSeedPreview == null
                                ? "cursor-not-allowed border-rsi-border/50 bg-rsi-bg-deep/30 text-rsi-text-muted/60"
                                : "border-rsi-accent/50 bg-rsi-accent-muted/40 text-rsi-accent hover:bg-rsi-accent-muted/55",
                            ].join(" ")}
                          >
                            Select
                          </button>
                        </div>
                      ) : (
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center justify-between gap-1">
                            <p className="font-mono text-[0.55rem] uppercase tracking-[0.14em] text-rsi-text-muted">
                              Templates
                            </p>
                            <button
                              type="button"
                              title="Add a template from Blank or Automatic"
                              aria-label="Add template"
                              onClick={() => {
                                setManualSeedPicker(true);
                                setManualSeedPreview(null);
                              }}
                              className="inline-flex size-6 shrink-0 items-center justify-center rounded border border-dashed border-rsi-border/80 font-mono text-[0.75rem] leading-none text-rsi-text-muted transition-colors hover:border-rsi-border-strong hover:text-rsi-text-secondary"
                            >
                              +
                            </button>
                          </div>
                          <div className="flex max-h-40 flex-col gap-1 overflow-y-auto pr-0.5">
                            {manualStop.templates.map((template) => {
                              const selected =
                                template.id === manualStop.activeTemplateId;
                              const renaming = renamingTemplateId === template.id;
                              return (
                                <div
                                  key={template.id}
                                  className={[
                                    "flex min-w-0 items-stretch gap-1 rounded-rsi border px-2 py-2",
                                    selected
                                      ? "border-rsi-accent/50 bg-rsi-accent-muted/25"
                                      : "border-rsi-border/70 bg-rsi-bg-deep/40",
                                  ].join(" ")}
                                >
                                  {renaming ? (
                                    <input
                                      autoFocus
                                      value={renameDraft}
                                      aria-label={`Rename ${template.name}`}
                                      onChange={(event) =>
                                        setRenameDraft(event.target.value)
                                      }
                                      onBlur={() =>
                                        commitTemplateRename(
                                          template.id,
                                          renameDraft,
                                        )
                                      }
                                      onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                          event.preventDefault();
                                          commitTemplateRename(
                                            template.id,
                                            renameDraft,
                                          );
                                        } else if (event.key === "Escape") {
                                          event.preventDefault();
                                          setRenamingTemplateId(null);
                                          setRenameDraft("");
                                        }
                                      }}
                                      className="min-w-0 flex-1 rounded border border-rsi-accent/40 bg-rsi-bg-deep px-1.5 py-1 font-mono text-[0.7rem] text-rsi-text outline-none"
                                    />
                                  ) : (
                                    <button
                                      type="button"
                                      title={`${template.name} — click to use, double-click to rename`}
                                      onClick={() => {
                                        updateStopManual((current) => ({
                                          ...current,
                                          activeTemplateId: template.id,
                                        }));
                                        setManualLiveBoxes(
                                          boxesFromManualTemplate(
                                            template,
                                            manualBaseBoxes,
                                          ),
                                        );
                                      }}
                                      onDoubleClick={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        setRenamingTemplateId(template.id);
                                        setRenameDraft(template.name);
                                      }}
                                      className={[
                                        "min-w-0 flex-1 truncate text-left font-mono text-[0.7rem] tracking-wide",
                                        selected
                                          ? "text-rsi-accent"
                                          : "text-rsi-text-secondary hover:text-rsi-text",
                                      ].join(" ")}
                                    >
                                      {template.name}
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    aria-label={`Delete ${template.name}`}
                                    title="Delete template"
                                    onClick={() =>
                                      deleteManualTemplate(template.id)
                                    }
                                    className="shrink-0 px-1 text-[0.85rem] leading-none text-rsi-text-muted hover:text-rsi-danger"
                                  >
                                    ×
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {manualInventoryGroups.length > 0 ? (
                        <ManualBayBoxTray
                          groups={manualInventoryGroups}
                          onClearBay={clearBayToTray}
                          onResetCommodity={resetCommodityToTray}
                          onResetMission={resetMissionToTray}
                          draggingLineKey={trayPlacement?.lineKey ?? null}
                          orientationIndex={
                            trayPlacement?.orientationIndex ?? 0
                          }
                          onTrayDragStart={(spec, lineKey) => {
                            const next = {
                              mode: "single" as const,
                              spec,
                              lineKey,
                              orientationIndex: 0,
                            };
                            trayPlacementRef.current = next;
                            setTrayPlacement(next);
                          }}
                          onTrayBulkDragStart={(fill, lineKey) => {
                            const remainingScu = fill.crates.reduce(
                              (sum, line) => sum + line.size * line.count,
                              0,
                            );
                            const next = {
                              mode: "bulk" as const,
                              spec: {
                                size: fill.crates[0]?.size ?? 8,
                                commoditySlug: fill.commoditySlug,
                                commodityName: fill.commodityName,
                                color: fill.color,
                                color2: fill.color2,
                                missionId: fill.missionId,
                                action: "pickup" as const,
                              },
                              bulk: fill,
                              bulkRemainingScu: remainingScu,
                              lineKey,
                              orientationIndex: 0,
                            };
                            trayPlacementRef.current = next;
                            setTrayPlacement(next);
                          }}
                          onTrayMissionDragStart={(fill, lineKey) => {
                            const remainingScu = fill.commodities.reduce(
                              (sum, commodity) =>
                                sum +
                                commodity.crates.reduce(
                                  (lineSum, line) =>
                                    lineSum + line.size * line.count,
                                  0,
                                ),
                              0,
                            );
                            const head = fill.commodities[0];
                            const next = {
                              mode: "mission" as const,
                              spec: {
                                size: head?.crates[0]?.size ?? 8,
                                commoditySlug:
                                  head?.commoditySlug ?? "mission",
                                commodityName:
                                  head?.commodityName ?? fill.missionTitle,
                                color: head?.color ?? null,
                                color2: head?.color2 ?? null,
                                missionId: fill.missionId,
                                action: "pickup" as const,
                              },
                              mission: fill,
                              bulkRemainingScu: remainingScu,
                              lineKey,
                              orientationIndex: 0,
                            };
                            trayPlacementRef.current = next;
                            setTrayPlacement(next);
                          }}
                          onTrayDragMove={(clientX, clientY) => {
                            setTrayPointerClient({ x: clientX, y: clientY });
                          }}
                          onTrayDragEnd={(clientX, clientY) => {
                            const coord = cargoCellCoordFromPoint(
                              clientX,
                              clientY,
                            );
                            if (coord) placeTrayAtCoord(coord);
                            clearTrayPlacement();
                          }}
                          onTrayDragCancel={clearTrayPlacement}
                          className="min-h-0 flex-1"
                        />
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}
          <div
            className={[pushPackGutterClass, pushGraphTopClass]
              .filter(Boolean)
              .join(" ") || undefined}
          >
            {/* Overlay off: 2D / Split / 3D left, Legend right — same row above the grid. */}
            {showViewTabs && !sidePanelsOverlay ? (
              <div className="mb-2 flex items-center justify-between gap-2">
                {viewTabList}
                <button
                  type="button"
                  aria-pressed={!legendHidden}
                  aria-label={legendHidden ? "Show legend" : "Hide legend"}
                  onClick={() => setLegendHidden(!legendHidden)}
                  className={[
                    "shrink-0 rounded-rsi border px-1.5 py-0.5 font-mono text-[0.5rem] uppercase tracking-[0.12em] transition-colors",
                    !legendHidden
                      ? "border-rsi-accent/50 bg-rsi-accent-muted/40 text-rsi-accent"
                      : "border-rsi-border bg-rsi-bg-deep/95 text-rsi-text-secondary hover:border-rsi-border-strong hover:text-rsi-text",
                  ].join(" ")}
                >
                  Legend
                </button>
              </div>
            ) : null}
            {/* Sized graph only — height clamp measures this node, not tabs/footer. */}
            <div
              data-cargo-bay-height-panel
              className="relative"
              style={{ height: panelHeightPx }}
            >
              <CargoGridSketch
                sketch={sketch}
                cellPx={14}
                isoCellPx={16}
                compact
                views={viewTab}
                inlineTopLegend={viewTab === "top" || viewTab === "split"}
                hideLegend={legendHidden}
                legendToggleAbove={sidePanelsOverlay}
                sidePanelsOverlay={sidePanelsOverlay}
                onSidePanelsOverlayChange={setSidePanelsOverlay}
                splitOrientation={splitOrientation}
                onSplitOrientationChange={setSplitOrientation}
                syncedZoom={syncedZoom}
                onSyncedZoomChange={setSyncedZoom}
                topZoomLocked={topZoomLocked}
                onTopZoomLockedChange={setTopZoomLocked}
                isoZoomLocked={isoZoomLocked}
                onIsoZoomLockedChange={setIsoZoomLocked}
                hidePeel
                peelStack={peelStack}
                onPeelStackChange={setPeelStack}
                panelHeightPx={panelHeightPx}
                placementTints={placementTints}
                placementBoxes={plan!.boxes}
                legendItems={legendItems}
                locationLegendItems={locationLegendItems}
                showLocationOutlines={showLocationOutlines}
                manualEdit={isManual && (viewTab === "top" || viewTab === "split")}
                onManualDragStart={onManualDragStart}
                onManualDragMove={onManualDragMove}
                onManualDragEnd={onManualDragEnd}
                manualCrateDrag={
                  isManual && (viewTab === "top" || viewTab === "split")
                    ? crateDrag
                    : null
                }
                manualTrayDrop={
                  isManual && (viewTab === "top" || viewTab === "split")
                }
                trayDragSpec={
                  isManual && (viewTab === "top" || viewTab === "split")
                    ? (trayPlacement?.spec ?? null)
                    : null
                }
                trayBulkFill={
                  isManual &&
                  (viewTab === "top" || viewTab === "split") &&
                  trayPlacement?.mode === "bulk"
                }
                trayBulkFillSpec={
                  isManual &&
                  (viewTab === "top" || viewTab === "split") &&
                  trayPlacement?.mode === "bulk"
                    ? (trayPlacement.bulk ?? null)
                    : null
                }
                trayMissionFill={
                  isManual &&
                  (viewTab === "top" || viewTab === "split") &&
                  trayPlacement?.mode === "mission"
                    ? (trayPlacement.mission ?? null)
                    : null
                }
                trayCollisionBoxes={isManual ? workingBoxes : undefined}
                trayOrientationIndex={trayPlacement?.orientationIndex ?? 0}
                trayPointerClient={trayPointerClient}
                onTrayRotate={rotateTrayOrientation}
                onTrayPlaceCancel={clearTrayPlacement}
                onManualBoxRemove={onManualBoxRemove}
                onManualBoxRotate={onManualBoxRotate}
                topZoom={topZoom}
                onTopZoomChange={setTopZoom}
                isoZoom={isoZoom}
                onIsoZoomChange={setIsoZoom}
              />
            </div>
          </div>
          <p className="sr-only">
            Ship orientation: back (ramp) on the left, front (nose) on the
            right.
          </p>
          {thisStopTransfers.length > 0 ? (
            <div
              className={[
                "mt-2 border-t border-rsi-border/80 pt-2",
                // Overlay off: sit under the graph, not under the Pack mode column.
                pushPackGutterClass,
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <SessionCurrentStopPickupGrid
                transfers={thisStopTransfers}
                stopLabel={thisStopLabel}
              />
            </div>
          ) : null}
          {!isFullscreen && !hostCornerResize ? (
            <div className="-mx-4 mt-1">
              <button
                type="button"
                role="slider"
                aria-label="Cargo bays height"
                aria-orientation="vertical"
                aria-valuemin={MIN_CARGO_BAY_LAYOUT_HEIGHT_PX}
                aria-valuemax={panelHeightMax}
                aria-valuenow={heightPx}
                title="Drag to resize · double-click to reset"
                onPointerDown={onResizePointerDown}
                onPointerMove={onResizePointerMove}
                onPointerUp={endResize}
                onPointerCancel={endResize}
                onDoubleClick={resetHeightPx}
                onKeyDown={(event) => {
                  const step = event.shiftKey ? 48 : 16;
                  if (event.key === "ArrowUp" || event.key === "ArrowRight") {
                    event.preventDefault();
                    setPanelHeightPx(heightPx + step);
                  } else if (
                    event.key === "ArrowDown" ||
                    event.key === "ArrowLeft"
                  ) {
                    event.preventDefault();
                    setPanelHeightPx(heightPx - step);
                  } else if (event.key === "Home") {
                    event.preventDefault();
                    setPanelHeightPx(panelHeightMax);
                  } else if (event.key === "End") {
                    event.preventDefault();
                    setPanelHeightPx(MIN_CARGO_BAY_LAYOUT_HEIGHT_PX);
                  }
                }}
                className="group flex h-3 w-full cursor-ns-resize items-center justify-center"
              >
                <span
                  aria-hidden
                  className="h-0.5 w-10 rounded-full bg-rsi-border-strong/80 group-hover:bg-rsi-accent"
                />
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <p className="py-6 text-center text-sm text-rsi-text-muted">
            {activeRow
              ? !isManual && packMode === "by-mission-location"
                ? "No upcoming delivery cargo to group by location."
                : "No cargo placed at this stop yet."
              : "No route stops yet."}
          </p>
          {thisStopTransfers.length > 0 ? (
            <div className="mt-2 border-t border-rsi-border/80 pt-2 pb-3">
              <SessionCurrentStopPickupGrid
                transfers={thisStopTransfers}
                stopLabel={thisStopLabel}
              />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
});
