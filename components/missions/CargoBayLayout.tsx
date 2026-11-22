"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
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
  boxesFromManualPreset,
  getManualBayLayoutStopState,
  latestManualBoxesBeforeStop,
  newManualBayPresetId,
  nextManualPresetName,
  posesFromBoxes,
  readManualBayLayoutSession,
  storedBoxesFromPlaced,
  writeManualBayLayoutSession,
  type ManualBayLayoutPreset,
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
import { getCargoGridSketchBySlug } from "@/lib/ships/cargoGrids";
import { manualBayInventory } from "@/lib/ships/manualBayInventory";
import {
  cargoCellCoordFromPoint,
  nextManualBayOrientationIndex,
  tryAddManualBayBox,
  tryDropManualBayBox,
  tryFillManualBayZoneWithCargoType,
  tryFillManualBayZoneWithMission,
  tryRemoveManualBayBox,
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
  /** Optional session stats — right of the Cargo bays title. */
  headerAside?: ReactNode;
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
  const [packModeOpen, setPackModeOpen] = useState(false);
  const packModeMenuRef = useRef<HTMLDivElement>(null);
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
  } | null>(null);
  const crateDragRef = useRef(crateDrag);
  crateDragRef.current = crateDrag;
  const { heightPx, setHeightPx, resetHeightPx } =
    useSessionCargoBayLayoutHeight(sessionId);
  const rootRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const dragRef = useRef<{
    pointerId: number;
    startY: number;
    startHeight: number;
  } | null>(null);

  /** Cap panel height so the modal shell never overflows into a scroll area. */
  const maxPanelHeightPx = useCallback((): number => {
    const shellMax = cargoBayModalShellMaxHeightPx();
    const root = rootRef.current;
    const panel = root?.querySelector("[data-cargo-bay-height-panel]");
    if (!root || !(panel instanceof HTMLElement)) {
      return Math.min(MAX_CARGO_BAY_LAYOUT_HEIGHT_PX, shellMax);
    }
    const rootHeight = root.getBoundingClientRect().height;
    const panelHeight = panel.getBoundingClientRect().height;
    const chrome = Math.max(0, rootHeight - panelHeight);
    // Modal padding around the panel (`p-3` / `sm:p-6`).
    const modalPad = typeof window !== "undefined" && window.innerWidth >= 640 ? 48 : 24;
    return Math.max(
      MIN_CARGO_BAY_LAYOUT_HEIGHT_PX,
      Math.min(MAX_CARGO_BAY_LAYOUT_HEIGHT_PX, shellMax - chrome - modalPad),
    );
  }, []);

  const setPanelHeightPx = useCallback(
    (next: number, options?: { persist?: boolean }) => {
      setHeightPx(Math.min(next, maxPanelHeightPx()), options);
    },
    [maxPanelHeightPx, setHeightPx],
  );

  const heightPxRef = useRef(heightPx);
  heightPxRef.current = heightPx;

  useEffect(() => {
    setManualSession(readManualBayLayoutSession(sessionId));
    setManualLiveBoxes(null);
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
  const activeManualPreset = useMemo(() => {
    if (!manualStop.activePresetId) return null;
    return (
      manualStop.presets.find(
        (preset) => preset.id === manualStop.activePresetId,
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
   * delivery tags applied. Prefer over a per-stop preset seeded from auto-pack.
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
      // Do not use this stop’s saved preset snapshot — it may be a stale auto-pack
      // seed and would replace the player’s Everus (etc.) arrangement.
      boxes = manualBaseBoxes;
    } else {
      boxes = boxesFromManualPreset(activeManualPreset, manualBaseBoxes);
    }
    // Transfer: doorward / aisle first; clear a stack top→bottom before another.
    return manualBayCarryover.retagDeliveryPreferringTop(
      boxes,
      deliveryRetagOptions,
    );
  }, [
    activeManualPreset,
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

  const plan = useMemo(() => {
    if (!basePlan) return null;
    return { ...basePlan, boxes: displayBoxes };
  }, [basePlan, displayBoxes]);

  const baseBoxIdsKey = useMemo(
    () => basePlan?.boxes.map((box) => box.id).join("|") ?? "",
    [basePlan],
  );

  // Drop live overrides when the stop or auto-pack inventory changes so
  // Manual falls back to this stop’s preset or earlier-stop carryover.
  useEffect(() => {
    setManualLiveBoxes(null);
    manualDragBaseRef.current = null;
  }, [stopId, baseBoxIdsKey]);

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
    const reclamp = () => {
      const max = maxPanelHeightPx();
      if (heightPxRef.current > max) setHeightPx(max);
    };
    reclamp();
    window.addEventListener("resize", reclamp);
    return () => window.removeEventListener("resize", reclamp);
  }, [maxPanelHeightPx, setHeightPx, showGrid]);
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

  const createManualPresetFromBoxes = useCallback(
    (boxes: PlacedCargoBox[]): ManualBayLayoutPreset | null => {
      if (!stopId) return null;
      const presets = manualStop.presets;
      return {
        id: newManualBayPresetId(),
        name: nextManualPresetName(presets),
        stopId,
        poses: posesFromBoxes(boxes),
        boxes: storedBoxesFromPlaced(boxes),
        updatedAt: new Date().toISOString(),
      };
    },
    [manualStop.presets, stopId],
  );

  const patchActivePresetBoxes = useCallback(
    (boxes: PlacedCargoBox[]) => {
      if (!stopId) return;
      updateStopManual((current) => {
        // Manual is session-wide: a stop with no preset yet saves its first edit as one.
        if (!current.activePresetId) {
          const preset = createManualPresetFromBoxes(boxes);
          if (!preset) return current;
          return {
            activePresetId: preset.id,
            presets: [...current.presets, preset],
          };
        }
        return {
          ...current,
          presets: current.presets.map((preset) =>
            preset.id === current.activePresetId
              ? {
                  ...preset,
                  poses: posesFromBoxes(boxes),
                  boxes: storedBoxesFromPlaced(boxes),
                  updatedAt: new Date().toISOString(),
                }
              : preset,
          ),
        };
      });
    },
    [createManualPresetFromBoxes, stopId, updateStopManual],
  );

  const selectAutoMode = useCallback(
    (mode: CargoBayPackMode) => {
      setLastAutoPackMode(mode);
      setSortingMode(mode);
      setManualLiveBoxes(null);
      manualDragBaseRef.current = null;
    },
    [setLastAutoPackMode, setSortingMode],
  );

  const enterManualMode = useCallback(
    (options?: { addPreset?: boolean }) => {
      if (!basePlan || !stopId) return;
      setViewTab("top");
      setSortingHidden(false);

      const addPreset = options?.addPreset === true;
      if (manualStop.presets.length === 0 || addPreset) {
        const sourceBoxes =
          isManual && manualLiveBoxes
            ? manualLiveBoxes
            : isManual
              ? boxesFromManualPreset(activeManualPreset, manualBaseBoxes)
              : manualBaseBoxes;
        const preset = createManualPresetFromBoxes(sourceBoxes);
        if (!preset) return;
        updateStopManual((current) => ({
          activePresetId: preset.id,
          presets: [...current.presets, preset],
        }));
        setManualLiveBoxes(sourceBoxes);
      } else {
        const preset =
          manualStop.presets.find(
            (entry) => entry.id === manualStop.activePresetId,
          ) ?? manualStop.presets[0]!;
        if (!manualStop.activePresetId || preset.id !== manualStop.activePresetId) {
          updateStopManual((current) => ({
            ...current,
            activePresetId: preset.id,
          }));
        }
        // Restore snapshot — pose-only presets cannot rematch after Clear/Fill.
        setManualLiveBoxes(boxesFromManualPreset(preset, manualBaseBoxes));
      }
      setSortingMode("manual");
    },
    [
      activeManualPreset,
      basePlan,
      createManualPresetFromBoxes,
      isManual,
      manualBaseBoxes,
      manualLiveBoxes,
      manualStop.activePresetId,
      manualStop.presets,
      setSortingHidden,
      stopId,
      updateStopManual,
    ],
  );

  const deleteManualPreset = useCallback(
    (presetId: string) => {
      const remaining = manualStop.presets.filter(
        (preset) => preset.id !== presetId,
      );
      updateStopManual((current) => {
        const presets = current.presets.filter(
          (preset) => preset.id !== presetId,
        );
        const activePresetId =
          current.activePresetId === presetId
            ? (presets[0]?.id ?? null)
            : current.activePresetId;
        return { presets, activePresetId };
      });
      setManualLiveBoxes(null);
      if (remaining.length === 0) {
        setSortingMode(lastAutoPackMode);
      }
    },
    [lastAutoPackMode, manualStop.presets, updateStopManual],
  );

  const onManualDragStart = useCallback(
    (boxId: string, clientX: number, clientY: number) => {
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

      const next = tryDropManualBayBox(sketch, base, boxId, dropCell, {
        dx: drag.grabOffsetX,
        dy: drag.grabOffsetY,
      });
      if (!next) {
        revert();
        return;
      }

      setManualLiveBoxes(next);
      patchActivePresetBoxes(next);
    },
    [patchActivePresetBoxes, sketch],
  );

  const persistManualBoxes = useCallback(
    (boxes: PlacedCargoBox[]) => {
      setManualLiveBoxes(boxes);
      patchActivePresetBoxes(boxes);
    },
    [patchActivePresetBoxes],
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
    if (!packModeOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!packModeMenuRef.current?.contains(event.target as Node)) {
        setPackModeOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPackModeOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [packModeOpen]);

  useEffect(() => {
    if (sortingHidden) setPackModeOpen(false);
  }, [sortingHidden]);

  const panelHeightMax = maxPanelHeightPx();

  const packModeChoices = [
    ...cargoBayPackModes.map((mode) => ({
      id: mode.id as CargoBayPackMode | "manual",
      label: mode.label,
      summary: mode.summary,
    })),
    {
      id: "manual" as const,
      label: "Manual",
      summary: "Drag crates on 2D.",
    },
  ];
  const activePackModeId: CargoBayPackMode | "manual" = isManual
    ? "manual"
    : sortingMode;
  const activePackMode =
    packModeChoices.find((mode) => mode.id === activePackModeId) ??
    packModeChoices[0]!;

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
        "min-w-0 overflow-hidden rounded-rsi border border-rsi-border bg-rsi-surface/90 px-4 pt-4 shadow-rsi-panel",
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
          {headerAside ? (
            <div className="ml-auto min-w-0 shrink">{headerAside}</div>
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
            return dragged ? (
              <ManualBayPlacedBoxDragGhost
                box={dragged}
                clientX={crateDrag.clientX}
                clientY={crateDrag.clientY}
              />
            ) : null;
          })()
        : null}

      {!sketch ? (
        <p className="py-6 text-center text-sm text-rsi-text-muted">
          Select a ship with a known cargo grid to see bay placement.
        </p>
      ) : showGrid ? (
        <div className="relative">
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
                  style={{ height: heightPx }}
                >
                  <div ref={packModeMenuRef} className="relative min-w-0">
                    <p className="mb-1 font-mono text-[0.55rem] uppercase tracking-[0.14em] text-rsi-text-muted">
                      Pack mode
                    </p>
                    <button
                      type="button"
                      aria-haspopup="listbox"
                      aria-expanded={packModeOpen}
                      aria-label="Cargo packing mode"
                      title={activePackMode.summary}
                      onClick={() => setPackModeOpen((open) => !open)}
                      className={[
                        "flex w-full items-start gap-1.5 rounded-rsi border px-2 py-1.5 text-left transition-colors",
                        "border-rsi-accent/50 bg-rsi-accent-muted/30 text-rsi-accent",
                        packModeOpen ? "ring-1 ring-rsi-accent/40" : "",
                      ].join(" ")}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block font-mono text-[0.55rem] uppercase tracking-[0.14em]">
                          {activePackMode.label}
                        </span>
                        <span className="mt-0.5 block text-[0.65rem] leading-snug text-rsi-text-muted">
                          {activePackMode.summary}
                        </span>
                      </span>
                      <svg
                        aria-hidden
                        viewBox="0 0 24 24"
                        className={[
                          "mt-0.5 h-3 w-3 shrink-0 text-rsi-text-muted transition-transform",
                          packModeOpen ? "rotate-180" : "",
                        ].join(" ")}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                    {packModeOpen ? (
                      <ul
                        role="listbox"
                        aria-label="Cargo packing modes"
                        className="absolute top-full left-0 z-50 mt-1 w-full space-y-1 rounded-rsi border border-rsi-border/80 bg-rsi-bg-deep/95 p-1 shadow-rsi-panel"
                      >
                        {packModeChoices.map((mode) => {
                          const selected = mode.id === activePackModeId;
                          return (
                            <li key={mode.id} role="presentation">
                              <button
                                type="button"
                                role="option"
                                aria-selected={selected}
                                title={mode.summary}
                                onClick={() => {
                                  if (mode.id === "manual") {
                                    enterManualMode();
                                  } else {
                                    selectAutoMode(mode.id);
                                  }
                                  setPackModeOpen(false);
                                }}
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
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </div>
                  {supportsPrioritized &&
                  !isManual &&
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
                  {isManual ? (
                    <div className="flex min-h-0 flex-1 flex-col gap-1">
                      <div className="flex min-w-0 items-center gap-1">
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-0.5">
                          {manualStop.presets.map((preset) => {
                            const selected =
                              preset.id === manualStop.activePresetId;
                            return (
                              <span
                                key={preset.id}
                                className={[
                                  "inline-flex max-w-full items-center rounded border px-1 py-px font-mono text-[0.45rem] uppercase tracking-[0.08em]",
                                  selected
                                    ? "border-rsi-border-strong bg-rsi-surface text-rsi-text"
                                    : "border-rsi-border/70 bg-rsi-bg-deep/50 text-rsi-text-muted",
                                ].join(" ")}
                              >
                                <button
                                  type="button"
                                  title={`Use ${preset.name}`}
                                  onClick={() => {
                                    updateStopManual((current) => ({
                                      ...current,
                                      activePresetId: preset.id,
                                    }));
                                    setManualLiveBoxes(
                                      boxesFromManualPreset(
                                        preset,
                                        manualBaseBoxes,
                                      ),
                                    );
                                  }}
                                  className="truncate hover:text-rsi-text"
                                >
                                  {preset.name}
                                </button>
                                <button
                                  type="button"
                                  aria-label={`Delete ${preset.name}`}
                                  title="Delete preset"
                                  onClick={() =>
                                    deleteManualPreset(preset.id)
                                  }
                                  className="ml-0.5 shrink-0 leading-none text-rsi-text-muted hover:text-rsi-danger"
                                >
                                  ×
                                </button>
                              </span>
                            );
                          })}
                        </div>
                        <button
                          type="button"
                          title="Snapshot the current layout as a new preset"
                          aria-label="Add preset"
                          onClick={() =>
                            enterManualMode({ addPreset: true })
                          }
                          className="inline-flex size-5 shrink-0 items-center justify-center rounded border border-dashed border-rsi-border/80 font-mono text-[0.7rem] leading-none text-rsi-text-muted transition-colors hover:border-rsi-border-strong hover:text-rsi-text-secondary"
                        >
                          +
                        </button>
                      </div>
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
            data-cargo-bay-height-panel
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
            <div className="relative">
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
                panelHeightPx={heightPx}
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
