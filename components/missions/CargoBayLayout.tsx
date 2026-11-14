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
import { SessionCurrentStopPickupGrid } from "@/components/missions/SessionStatsStrip";
import { useSessionCargoBayChrome } from "@/hooks/useSessionCargoBayChrome";
import { useSessionCargoBayLayoutHeight } from "@/hooks/useSessionCargoBayLayoutHeight";
import { getLocationBySlug } from "@/lib/fixtures";
import { cargoInventory } from "@/lib/missions/cargoInventory";
import type { HaulingChecklistRow } from "@/lib/missions/mockSession";
import {
  cargoBayModalShellMaxHeightPx,
  MAX_CARGO_BAY_LAYOUT_HEIGHT_PX,
  MIN_CARGO_BAY_LAYOUT_HEIGHT_PX,
} from "@/lib/sessions/cargoBayLayoutClientPrefs";
import {
  applyManualBayPoses,
  getManualBayLayoutStopState,
  newManualBayPresetId,
  nextManualPresetName,
  posesFromBoxes,
  readManualBayLayoutSession,
  writeManualBayLayoutSession,
  type ManualBayLayoutPreset,
  type ManualBayLayoutSessionState,
} from "@/lib/sessions/manualBayLayoutPrefs";
import {
  cargoBayPackModes,
  defaultCargoBayPackMode,
  placementPlanLegend,
  placementPlanLocationLegend,
  placementPlanTints,
  upcomingDeliveryLocationSlugs,
  type CargoBayPackMode,
  type PlacedCargoBox,
} from "@/lib/ships/cargoGridPlacement";
import { getCargoGridSketchBySlug } from "@/lib/ships/cargoGrids";
import { tryMoveManualBayBox } from "@/lib/ships/manualBayMove";
import { cargoBay } from "@/lib/ships/cargoBay";
import { getShipBayPreferenceFixture } from "@/lib/ships/shipBayPreferences";

type SortingMode = CargoBayPackMode | "manual";

/**
 * What the cargo grid shows for the focused checklist stop.
 * `all` = all crates aboard in the bay at that point (including transfer).
 * `transfer` = only this stop’s pickup / delivery.
 */
export type CargoBayStopScope = "all" | "transfer";

export type CargoBayLayoutProps = {
  rows: HaulingChecklistRow[];
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
  /** Optional session stats — right of the Storage bays title. */
  headerAside?: ReactNode;
  className?: string;
};

/**
 * Session cargo layout: ship bay grid at the focused stop (top / 3D / split).
 * Memoized so modal open/close on the parent does not rebuild the grid.
 */
export const CargoBayLayout = memo(function CargoBayLayout({
  rows,
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
    viewTab,
    setLegendHidden,
    setSortingHidden,
    setViewTab,
  } = useSessionCargoBayChrome(sessionId);
  const [peelStack, setPeelStack] = useState(false);
  const [sortingMode, setSortingMode] =
    useState<SortingMode>(defaultCargoBayPackMode);
  const [lastAutoPackMode, setLastAutoPackMode] = useState<CargoBayPackMode>(
    defaultCargoBayPackMode,
  );
  const [prioritized, setPrioritized] = useState(false);
  const [manualSession, setManualSession] =
    useState<ManualBayLayoutSessionState>({ byStop: {} });
  const [manualLiveBoxes, setManualLiveBoxes] = useState<PlacedCargoBox[] | null>(
    null,
  );
  const manualDragBaseRef = useRef<PlacedCargoBox[] | null>(null);
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

  const displayBoxes = useMemo(() => {
    if (!basePlan) return [];
    let boxes = basePlan.boxes;
    if (isManual) {
      boxes = manualLiveBoxes
        ? manualLiveBoxes
        : applyManualBayPoses(basePlan.boxes, activeManualPreset?.poses);
    }
    // Transfer: show only pickup / delivery; stay stays packed underneath.
    if (stopScope === "transfer") {
      boxes = boxes.filter(
        (box) => box.action === "pickup" || box.action === "delivery",
      );
    }
    return boxes;
  }, [
    basePlan,
    isManual,
    manualLiveBoxes,
    activeManualPreset,
    stopScope,
  ]);

  const plan = useMemo(() => {
    if (!basePlan) return null;
    return { ...basePlan, boxes: displayBoxes };
  }, [basePlan, displayBoxes]);

  const baseBoxIdsKey = useMemo(
    () => basePlan?.boxes.map((box) => box.id).join("|") ?? "",
    [basePlan],
  );

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
  const showViewTabs = Boolean(sketch && plan && plan.boxes.length > 0);
  const showGrid = Boolean(sketch && plan && plan.boxes.length > 0);

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
        updatedAt: new Date().toISOString(),
      };
    },
    [manualStop.presets, stopId],
  );

  const selectAutoMode = useCallback(
    (mode: CargoBayPackMode) => {
      setLastAutoPackMode(mode);
      setSortingMode(mode);
      setManualLiveBoxes(null);
      manualDragBaseRef.current = null;
    },
    [],
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
              ? applyManualBayPoses(basePlan.boxes, activeManualPreset?.poses)
              : basePlan.boxes;
        const preset = createManualPresetFromBoxes(sourceBoxes);
        if (!preset) return;
        updateStopManual((current) => ({
          activePresetId: preset.id,
          presets: [...current.presets, preset],
        }));
        setManualLiveBoxes(sourceBoxes);
      } else if (!manualStop.activePresetId && manualStop.presets[0]) {
        updateStopManual((current) => ({
          ...current,
          activePresetId: current.presets[0]!.id,
        }));
      }
      setSortingMode("manual");
    },
    [
      activeManualPreset?.poses,
      basePlan,
      createManualPresetFromBoxes,
      isManual,
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
    (_boxId: string) => {
      if (!plan) return;
      manualDragBaseRef.current = plan.boxes.map((box) => ({ ...box }));
    },
    [plan],
  );

  const onManualDragDelta = useCallback(
    (boxId: string, deltaCellsX: number, deltaCellsY: number) => {
      if (!sketch) return;
      const base = manualDragBaseRef.current;
      if (!base) return;
      const next = tryMoveManualBayBox(
        sketch,
        base,
        boxId,
        deltaCellsX,
        deltaCellsY,
      );
      if (!next) return;
      setManualLiveBoxes(next);
    },
    [sketch],
  );

  const onManualDragEnd = useCallback(() => {
    const boxes = manualLiveBoxes;
    const presetId = manualStop.activePresetId;
    manualDragBaseRef.current = null;
    if (!boxes || !presetId || !stopId) return;
    updateStopManual((current) => ({
      ...current,
      presets: current.presets.map((preset) =>
        preset.id === presetId
          ? {
              ...preset,
              poses: posesFromBoxes(boxes),
              updatedAt: new Date().toISOString(),
            }
          : preset,
      ),
    }));
  }, [manualLiveBoxes, manualStop.activePresetId, stopId, updateStopManual]);

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

  const panelHeightMax = maxPanelHeightPx();

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
              Storage bays
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

      {!sketch ? (
        <p className="py-6 text-center text-sm text-rsi-text-muted">
          Select a ship with a known cargo grid to see bay placement.
        </p>
      ) : showGrid ? (
        <div className="relative">
          {showViewTabs ? (
            <>
              <div className="pointer-events-none absolute top-2 left-1/2 z-20 -translate-x-1/2">
                <div
                  role="tablist"
                  aria-label="Cargo grid projection"
                  className="pointer-events-auto inline-flex w-fit rounded-rsi border border-rsi-border bg-rsi-bg-deep/95 p-0.5 shadow-rsi-panel"
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
              </div>
              <div className="pointer-events-auto absolute top-2 left-2 z-30 flex items-center gap-1">
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
              {!sortingHidden ? (
                <div
                  role="region"
                  aria-label="Cargo packing"
                  className="pointer-events-auto absolute top-8 left-2 z-40 max-h-[calc(100%-3.5rem)] w-[16rem] space-y-2 overflow-y-auto overscroll-contain rounded-rsi border border-rsi-border/80 bg-rsi-bg-deep/95 px-2 py-1.5 shadow-rsi-panel"
                >
                  <p className="font-mono text-[0.55rem] uppercase tracking-[0.14em] text-rsi-text-muted">
                    Pack mode
                  </p>
                  <div
                    role="group"
                    aria-label="Cargo grouping"
                    className="flex flex-col gap-1"
                  >
                    {cargoBayPackModes.map((mode) => {
                      const selected = sortingMode === mode.id;
                      const showPrioritizedUnder =
                        mode.id === "by-cargo-type" && supportsPrioritized;
                      return (
                        <div key={mode.id} className="min-w-0">
                          <button
                            type="button"
                            aria-pressed={selected}
                            title={mode.summary}
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
                          {showPrioritizedUnder ? (
                            <button
                              type="button"
                              aria-pressed={
                                showPrioritizedToggle && prioritized
                              }
                              title={
                                shipBayPrefs.missionPriorityPacking?.bias ===
                                "edges-first"
                                  ? "Early deliveries toward bay edges; later deliveries toward the center."
                                  : "Order cargo by upcoming delivery stops."
                              }
                              onClick={() => {
                                selectAutoMode("by-cargo-type");
                                setPrioritized((value) =>
                                  sortingMode === "by-cargo-type"
                                    ? !value
                                    : true,
                                );
                              }}
                              className={[
                                "mt-1 w-full rounded-rsi border px-2 py-1 font-mono text-[0.5rem] uppercase tracking-[0.12em] transition-colors",
                                showPrioritizedToggle && prioritized
                                  ? "border-rsi-accent/50 bg-rsi-accent-muted/40 text-rsi-accent"
                                  : "border-rsi-border/80 bg-rsi-bg-deep/50 text-rsi-text-muted hover:border-rsi-border-strong hover:text-rsi-text-secondary",
                              ].join(" ")}
                            >
                              Prioritized
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                    <div className="min-w-0">
                      <button
                        type="button"
                        aria-pressed={isManual}
                        title="Drag crates on the 2D grid. Positions also update 3D. Saved per trip stop."
                        onClick={() => enterManualMode()}
                        className={[
                          "flex w-full flex-col items-start gap-0.5 rounded-rsi border px-2 py-1.5 text-left transition-colors",
                          isManual
                            ? "border-rsi-accent/50 bg-rsi-accent-muted/30 text-rsi-accent"
                            : "border-rsi-border/70 bg-rsi-bg-deep/40 text-rsi-text-secondary hover:border-rsi-border-strong hover:text-rsi-text",
                        ].join(" ")}
                      >
                        <span className="font-mono text-[0.55rem] uppercase tracking-[0.14em]">
                          Manual
                        </span>
                        <span className="text-[0.65rem] leading-snug text-rsi-text-muted">
                          Drag crates on 2D; save presets for this stop.
                        </span>
                      </button>
                      {isManual ? (
                        <div className="mt-1.5 space-y-1.5">
                          <div className="flex flex-wrap gap-1">
                            {manualStop.presets.map((preset) => {
                              const selected =
                                preset.id === manualStop.activePresetId;
                              return (
                                <span
                                  key={preset.id}
                                  className={[
                                    "inline-flex items-center gap-0.5 rounded-rsi border px-1.5 py-0.5 font-mono text-[0.5rem] uppercase tracking-[0.1em]",
                                    selected
                                      ? "border-rsi-border-strong bg-rsi-surface text-rsi-text"
                                      : "border-rsi-border/80 bg-rsi-bg-deep/60 text-rsi-text-muted",
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
                                      setManualLiveBoxes(null);
                                    }}
                                    className="hover:text-rsi-text"
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
                                    className="ml-0.5 text-rsi-text-muted hover:text-rsi-danger"
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
                            onClick={() => enterManualMode({ addPreset: true })}
                            className="w-full rounded-rsi border border-dashed border-rsi-border/80 px-2 py-1 font-mono text-[0.5rem] uppercase tracking-[0.12em] text-rsi-text-muted transition-colors hover:border-rsi-border-strong hover:text-rsi-text-secondary"
                          >
                            + Preset
                          </button>
                          <p className="text-[0.6rem] leading-snug text-rsi-text-muted">
                            Drag on 2D only — 3D follows. Session-local for now.
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
          <div data-cargo-bay-height-panel>
            <CargoGridSketch
              sketch={sketch}
              cellPx={14}
              isoCellPx={16}
              compact
              views={viewTab}
              inlineTopLegend={viewTab === "top" || viewTab === "split"}
              hideLegend={legendHidden}
              legendToggleAbove
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
              onManualDragDelta={onManualDragDelta}
              onManualDragEnd={onManualDragEnd}
            />
          </div>
          <p className="sr-only">
            Ship orientation: back (ramp) on the left, front (nose) on the
            right.
          </p>
          {thisStopTransfers.length > 0 ? (
            <div className="mt-2 border-t border-rsi-border/80 pt-2">
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
              aria-label="Storage bays height"
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
