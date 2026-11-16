"use client";

import {
  Fragment,
  memo,
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { RouteChecklistMenu } from "@/components/missions/RouteChecklistMenu";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { LocationFuzzySearch } from "@/components/ui/LocationFuzzySearch";
import { Spinner } from "@/components/ui/Spinner";
import {
  describeCargoDeliveries,
  getCommodityIconSrc,
  getLocationBySlug,
  getLocationImageSrc,
  getLocationShortName,
  getShipIconSrc,
  sumCargoScu,
} from "@/lib/fixtures";
import {
  getLocationShopBySlug,
  listLocationShops,
} from "@/lib/fixtures/locationShops";
import {
  commodityBadgeBackground,
  commodityBadgeBorder,
  commodityBadgeForeground,
  resolveCommodityColorHex,
} from "@/lib/fixtures/commodityColors";
import {
  formatAuecAmount,
  type ScuBoxSplits,
} from "@/lib/missions/catalogMission";
import { missionsExpectedToCompleteAtStop } from "@/lib/missions/expectedCompletions";
import {
  estimateMissionHaulingRepXp,
  estimateMissionsHaulingRepXp,
  formatHaulingRepXp,
} from "@/lib/missions/haulingRepXp";
import { formatDistanceToNext, isQuantumTravelRow, type HaulingChecklistRow, type RouteAction } from "@/lib/missions/sessionChecklist";

import {
  cargoInventory,
  type ScuTransfer,
  type StopTransferLedger,
} from "@/lib/missions/cargoInventory";
import {
  resolveMissionRank,
  resolveMissionTitle,
} from "@/lib/missions/missionRank";
import {
  INSERT_AFTER_SESSION_START,
  quantumFromSlugAfter,
} from "@/lib/missions/quantumTravel";
import {
  inferCargoMissionId,
  screenshotRefsForMission,
} from "@/lib/missions/rowMissionScreenshots";
import {
  missionAuecAmount,
  missionRewardLabel,
} from "@/lib/missions/sessionMissionObjectives";
import type { MissionScuDraft } from "@/lib/missions/missionScuAmounts";
import type { SessionMission } from "@/lib/missions/sessionMissions";
import { stopMissionBoxConfigModalProps } from "@/lib/missions/stopMissionBoxConfig";
import { distanceBetweenLocationSlugs } from "@/lib/starmap/distance";
import { AUEC_TITLE, SCU_TITLE } from "@/lib/ui/abbrevTitles";
import { OutdoorFreightBadge } from "../OutdoorFreightBadge";
import { StopDeliveryBayPreview } from "../StopDeliveryBayPreview";
import { StopMissionBoxConfigModal } from "../StopMissionBoxConfigModal";
import { StopMissionScreenshots } from "../StopMissionScreenshots";
import { cargoPendingKey, CargoGroups } from "./ChecklistCargoTiles";
import {
  DoneCheckbox,
  DoneStopButton,
  STICKY_DONE_TOP,
} from "./ChecklistDoneControls";
import { AddStopAfterButton, LocationHeader } from "./ChecklistLocationHeader";
import {
  CompletedStopHistoryRow,
  NextDistanceMeta,
  NextStopBridgeBand,
  PayoutExpMeta,
  checklistRowToneClass,
} from "./CompletedHistoryRow";
import { QuantumTravelComposer } from "./QuantumTravelComposer";
import { QuantumTravelRow } from "./QuantumTravelRow";

/** Display-only origin row when start ≠ first stop (matches route timeline). */
export const QUANTUM_ORIGIN_ROW_ID = INSERT_AFTER_SESSION_START;

export type MissionChecklistTableProps = {
  rows: HaulingChecklistRow[];
  /** Mark stop done/undone; return a Promise to show the checkbox spinner until save finishes. */
  onToggle: (rowId: string) => void | Promise<void>;
  /** Stop shown in cargo layout — any stop, including completed. */
  focusedStopId?: string | null;
  /** Click a row (not checkbox / copy) to preview that stop. `null` clears focus. */
  onFocusStop?: (rowId: string | null) => void;
  /** Left side of the toolbar (e.g. Missions / Stops / Cargo stats). */
  toolbarStart?: ReactNode;
  /** Shown inside the ⋯ menu on small phones (Distance / aUEC overflow). */
  toolbarEnd?: ReactNode;
  /** ⋯ menu: duplicate this trip into a new session. */
  onCopyTrip?: () => void | Promise<void>;
  /** ⋯ menu: repair an invalid trip after the banner was dismissed. */
  onRepairTrip?: () => void;
  isRepairingTrip?: boolean;
  /** Session ship display name for pickup transfer labels. */
  shipName?: string | null;
  /** Primary session ship slug (Next stop badge icon). */
  shipSlug?: string | null;
  /** Session missions — used to attach contract screenshot refs per stop. */
  missions?: SessionMission[];
  /** Session id (screenshot batch) for image URLs. */
  sessionId?: string | null;
  /** Toggle shared pickup/delivery brick handled state (persisted). */
  onToggleCargoHandled?: (
    rowId: string,
    cargoIndex: number,
  ) => void | Promise<void>;
  /**
   * Session origin. When set and different from the first stop, a compact
   * “Quantum to …” row is shown above the checklist.
   */
  startLocationSlug?: string | null;
  /**
   * Controlled: synthetic start → first-stop quantum marked done.
   * When omitted, the table keeps local state (Storybook).
   */
  quantumOriginDeparted?: boolean;
  onQuantumOriginDepartedChange?: (departed: boolean) => void;
  /** Persist a manual quantum travel leg after a row (or session start). */
  onInsertQuantumTravel?: (input: {
    afterRowId: string;
    fromSlug: string;
    toSlug: string;
    reasonShopSlug?: string | null;
  }) => void | Promise<void>;
  /**
   * Double-click edit on a quantum travel row (or the synthetic origin row).
   * Pass `QUANTUM_ORIGIN_ROW_ID` for the start → first-stop travel row.
   */
  onUpdateQuantumTravel?: (input: {
    rowId: string;
    fromSlug?: string;
    toSlug?: string;
  }) => void | Promise<void>;
  /** Keyboard shortcuts: B cargo bays, S stops, C contracts. */
  onOpenCargoBays?: () => void;
  onOpenStops?: () => void;
  /** Open contracts table; pass a mission id to highlight that row. */
  onOpenContracts?: (missionId?: string) => void;
  /** Persist crate mix for a session mission (Pickup / Drop off double-click). */
  onSelectBoxBreakdown?: (
    missionId: string,
    commoditySlug: string,
    breakdown: ScuBoxSplits,
    options?: {
      applyPreferredMaxToRemaining?: boolean;
      onlyUncorrected?: boolean;
    },
  ) => void | Promise<void>;
  /** Persist draft mission + delivery SCU from the box-types modal. */
  onSaveMissionScuDraft?: (missionId: string, draft: MissionScuDraft) => void;
  /** True while any session save is awaiting the backend echo. */
  isSaving?: boolean;
  /** True until the first checklist hydrate on page / session change. */
  isLoading?: boolean;
};

function sameLocationSlug(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** True when we should show the travel-from-start quantum row. */
export function needsQuantumOriginRow(
  rows: HaulingChecklistRow[],
  startLocationSlug?: string | null,
): boolean {
  const startSlug = startLocationSlug?.trim() || null;
  const firstSlug = rows[0]?.locationSlug ?? null;
  return Boolean(
    startSlug && firstSlug && !sameLocationSlug(startSlug, firstSlug),
  );
}

/**
 * Default focus: quantum origin (when start ≠ first and no stop done yet),
 * else first incomplete stop. When every stop is done, no active focus
 * (completed rows keep the green rail, not the blue active rail).
 */
export function defaultFocusedStopId(
  rows: HaulingChecklistRow[],
  startLocationSlug?: string | null,
): string | null {
  if (
    needsQuantumOriginRow(rows, startLocationSlug) &&
    !rows.some((row) => row.isCompleted)
  ) {
    return QUANTUM_ORIGIN_ROW_ID;
  }
  return rows.find((row) => !row.isCompleted)?.id ?? null;
}


/** Memoized so parent modal open/close does not rebuild every stop card. */
export const MissionChecklistTable = memo(function MissionChecklistTable({
  rows,
  onToggle,
  focusedStopId = null,
  onFocusStop,
  toolbarStart = null,
  toolbarEnd = null,
  onCopyTrip,
  onRepairTrip,
  isRepairingTrip = false,
  shipName = null,
  shipSlug = null,
  missions = [],
  sessionId = null,
  onToggleCargoHandled,
  startLocationSlug = null,
  quantumOriginDeparted: quantumOriginDepartedProp,
  onQuantumOriginDepartedChange,
  onInsertQuantumTravel,
  onUpdateQuantumTravel,
  onOpenCargoBays,
  onOpenStops,
  onOpenContracts,
  onSelectBoxBreakdown,
  onSaveMissionScuDraft,
  isSaving = false,
  isLoading = false,
}: MissionChecklistTableProps) {
  const transferShipName = shipName?.trim() || "Ship";
  const [copiedRowId, setCopiedRowId] = useState<string | null>(null);
  const [pendingCompleteRowIds, setPendingCompleteRowIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const [pendingCargoKeys, setPendingCargoKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [pendingQuantumRowIds, setPendingQuantumRowIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const [hideCompleted, setHideCompleted] = useState(false);
  /** Uncontrolled fallback when parent does not lift QT-origin departed. */
  const [quantumDepartedLocal, setQuantumDepartedLocal] = useState(false);
  const isQuantumOriginControlled = onQuantumOriginDepartedChange != null;
  const quantumDeparted = isQuantumOriginControlled
    ? Boolean(quantumOriginDepartedProp)
    : quantumDepartedLocal;
  const setQuantumDeparted = (departed: boolean) => {
    if (isQuantumOriginControlled) onQuantumOriginDepartedChange(departed);
    else setQuantumDepartedLocal(departed);
  };
  /** Which row’s + control opened the quantum destination composer. */
  const [draftingAfterRowId, setDraftingAfterRowId] = useState<string | null>(
    null,
  );
  /** Double-click Pickup / Drop off crate → box mix modal. */
  const [boxEditMissionId, setBoxEditMissionId] = useState<string | null>(null);
  /** Completed Done-strip row expanded to full card (history shown). */
  const [expandedCompletedRowId, setExpandedCompletedRowId] = useState<
    string | null
  >(null);
  const boxEditMission =
    boxEditMissionId == null
      ? null
      : (missions.find((mission) => mission.id === boxEditMissionId) ?? null);
  const rowElsRef = useRef(new Map<string, HTMLLIElement>());
  /** Next stop transition band — keyed by destination stop id. */
  const bridgeElsRef = useRef(new Map<string, HTMLElement>());
  const stickyToolbarRef = useRef<HTMLDivElement | null>(null);
  const pendingScrollToIdRef = useRef<string | null>(null);
  const displayRows = rows;
  const tripStarted = rows.some((row) => row.isCompleted);
  const showQuantumOrigin = needsQuantumOriginRow(
    displayRows,
    startLocationSlug,
  );
  const quantumCompleted =
    quantumDeparted || rows.some((row) => row.isCompleted);
  const completedCount =
    rows.filter((row) => row.isCompleted).length +
    (showQuantumOrigin && quantumCompleted ? 1 : 0);
  const visibleRows = hideCompleted
    ? displayRows.filter((row) => !row.isCompleted)
    : displayRows;
  const showQuantumInList =
    showQuantumOrigin && !(hideCompleted && quantumCompleted);
  const canAddStops = Boolean(onInsertQuantumTravel);

  useEffect(() => {
    if (isQuantumOriginControlled) return;
    setQuantumDepartedLocal(false);
  }, [
    isQuantumOriginControlled,
    startLocationSlug,
    rows[0]?.id,
    rows[0]?.locationSlug,
  ]);

  // Reset trip clears stop completion; also drop local QT-origin "departed".
  useEffect(() => {
    if (isQuantumOriginControlled) return;
    if (!tripStarted) setQuantumDepartedLocal(false);
  }, [isQuantumOriginControlled, tripStarted]);

  useEffect(() => {
    if (hideCompleted) setExpandedCompletedRowId(null);
  }, [hideCompleted]);

  useEffect(() => {
    if (!draftingAfterRowId) return;
    if (draftingAfterRowId === QUANTUM_ORIGIN_ROW_ID) return;
    if (!rows.some((row) => row.id === draftingAfterRowId)) {
      setDraftingAfterRowId(null);
    }
  }, [rows, draftingAfterRowId]);

  useEffect(() => {
    const targetId = pendingScrollToIdRef.current;
    if (!targetId) return;
    pendingScrollToIdRef.current = null;
    // Land the Next stop block (bridge, else stop card) flush under the sticky
    // toolbar — use measured sticky height, not a guessed scroll-margin.
    const el =
      bridgeElsRef.current.get(targetId) ?? rowElsRef.current.get(targetId);
    const sticky = stickyToolbarRef.current;
    if (!el) return;
    const stickyBottom = sticky?.getBoundingClientRect().bottom ?? 0;
    const delta = el.getBoundingClientRect().top - stickyBottom;
    if (Math.abs(delta) < 1) return;
    window.scrollBy({ top: delta, behavior: "smooth" });
  }, [rows, visibleRows]);

  async function copyStarmapName(rowId: string, name: string) {
    try {
      await navigator.clipboard.writeText(name);
      setCopiedRowId(rowId);
      window.setTimeout(() => {
        setCopiedRowId((current) => (current === rowId ? null : current));
      }, 1500);
    } catch {
      // Clipboard may be denied; leave UI unchanged.
    }
  }

  const markPendingId = (
    setter: Dispatch<SetStateAction<ReadonlySet<string>>>,
    id: string,
    pending: boolean,
  ) => {
    setter((prev) => {
      const next = new Set(prev);
      if (pending) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const runRowPending = (
    rowId: string,
    action: () => void | Promise<void>,
  ) => {
    markPendingId(setPendingCompleteRowIds, rowId, true);
    return Promise.resolve(action()).finally(() => {
      markPendingId(setPendingCompleteRowIds, rowId, false);
    });
  };

  const runCargoPending = (
    rowId: string,
    cargoIndex: number,
    action: () => void | Promise<void>,
  ) => {
    const key = cargoPendingKey(rowId, cargoIndex);
    markPendingId(setPendingCargoKeys, key, true);
    return Promise.resolve(action()).finally(() => {
      markPendingId(setPendingCargoKeys, key, false);
    });
  };

  const runQuantumPending = (
    rowId: string,
    action: () => void | Promise<void>,
  ) => {
    markPendingId(setPendingQuantumRowIds, rowId, true);
    return Promise.resolve(action()).finally(() => {
      markPendingId(setPendingQuantumRowIds, rowId, false);
    });
  };

  const toolbar = (
    <div
      ref={stickyToolbarRef}
      className="sticky top-0 z-20 flex w-full min-w-0 max-w-full items-center gap-1.5 border-b border-rsi-divider bg-rsi-bg-deep/95 px-2.5 py-2.5 sm:gap-2 sm:px-3 sm:py-2"
    >
      <div className="min-w-0 flex-1">{toolbarStart}</div>
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {isSaving ? (
          <span
            className="inline-flex items-center gap-1 font-mono text-[0.55rem] uppercase tracking-[0.12em] text-rsi-accent sm:gap-1.5 sm:text-[0.6rem] sm:tracking-[0.14em]"
            role="status"
            aria-live="polite"
          >
            <Spinner className="size-3 sm:size-3.5" label="Saving trip" />
            <span className="hidden sm:inline">Saving…</span>
          </span>
        ) : null}
        <RouteChecklistMenu
          hideCompleted={hideCompleted}
          completedCount={completedCount}
          onToggleHistory={() => setHideCompleted((value) => !value)}
          onCopyTrip={onCopyTrip}
          onRepairTrip={onRepairTrip}
          isRepairingTrip={isRepairingTrip}
          overflowStats={toolbarEnd}
        />
      </div>
    </div>
  );

  const emptyMessage =
    rows.length === 0
      ? missions.some((mission) => !mission.isHidden)
        ? "All contracts complete — reopen one from Contracts to rebuild the route"
        : "No contracts yet"
      : "All contracts complete — show history to review";

  const stepById = new Map(
    displayRows.map((row, index) => [row.id, index + 1]),
  );
  const transferLedgerByStop =
    cargoInventory.transferLedgerByStop(displayRows);
  const focusTargetsQuantum =
    focusedStopId === QUANTUM_ORIGIN_ROW_ID && showQuantumOrigin;
  const hasIncompleteStop = displayRows.some((row) => !row.isCompleted);
  const focusedRow =
    focusedStopId && focusedStopId !== QUANTUM_ORIGIN_ROW_ID
      ? (displayRows.find((row) => row.id === focusedStopId) ?? null)
      : null;
  // Trip finished: drop active focus so the last Done row shows green, not blue.
  const activeRowId =
    focusTargetsQuantum && (hasIncompleteStop || !quantumCompleted)
      ? focusedStopId
      : focusedRow && !(focusedRow.isCompleted && !hasIncompleteStop)
        ? focusedStopId
        : defaultFocusedStopId(displayRows, startLocationSlug);
  const firstStop = displayRows[0] ?? null;
  const quantumDestinationName = firstStop
    ? (getLocationBySlug(firstStop.locationSlug)?.name ??
      firstStop.locationSlug)
    : null;
  const startSlugTrimmed = startLocationSlug?.trim() || null;

  const completeQuantumOrigin = () => {
    const nextIncomplete =
      rows.find((entry) => !entry.isCompleted) ?? firstStop;
    setQuantumDeparted(true);
    if (nextIncomplete) {
      startTransition(() => {
        pendingScrollToIdRef.current = nextIncomplete.id;
        onFocusStop?.(nextIncomplete.id);
      });
    }
  };

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      if (target.isContentEditable) return true;
      return Boolean(
        target.closest(
          "input, textarea, select, [contenteditable='true'], [role='textbox']",
        ),
      );
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.repeat) return;
      if (isTypingTarget(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === "b") {
        event.preventDefault();
        onOpenCargoBays?.();
        return;
      }
      if (key === "s") {
        event.preventDefault();
        onOpenStops?.();
        return;
      }
      if (key === "c") {
        event.preventDefault();
        onOpenContracts?.();
        return;
      }
      if (key === "h") {
        if (completedCount === 0) return;
        event.preventDefault();
        setHideCompleted((value) => !value);
        return;
      }
      if (key === "d") {
        if (!activeRowId) return;
        event.preventDefault();
        if (activeRowId === QUANTUM_ORIGIN_ROW_ID && showQuantumInList) {
          if (quantumCompleted) {
            setQuantumDeparted(false);
            onFocusStop?.(QUANTUM_ORIGIN_ROW_ID);
          } else {
            completeQuantumOrigin();
          }
          return;
        }
        const row = rows.find((entry) => entry.id === activeRowId);
        if (!row) return;
        if (pendingCompleteRowIds.has(row.id)) return;
        const completing = !row.isCompleted;
        void runRowPending(row.id, () => onToggle(row.id));
        if (completing) {
          const routeIndex = rows.findIndex((entry) => entry.id === row.id);
          const nextIncomplete = rows
            .slice(routeIndex + 1)
            .find((entry) => !entry.isCompleted);
          startTransition(() => {
            if (nextIncomplete) {
              pendingScrollToIdRef.current = nextIncomplete.id;
              onFocusStop?.(nextIncomplete.id);
            } else {
              onFocusStop?.(null);
            }
          });
        }
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    activeRowId,
    completedCount,
    onFocusStop,
    onOpenCargoBays,
    onOpenContracts,
    onOpenStops,
    onToggle,
    pendingCompleteRowIds,
    quantumCompleted,
    rows,
    showQuantumInList,
  ]);

  const confirmQuantumDraft = (input: {
    toSlug: string;
    reasonShopSlug: string;
  }) => {
    if (!onInsertQuantumTravel || !draftingAfterRowId) return;
    const afterRowId = draftingAfterRowId;
    const fromSlug = quantumFromSlugAfter({
      rows,
      afterRowId,
      startLocationSlug,
    });
    if (!fromSlug) return;
    setDraftingAfterRowId(null);
    void runQuantumPending(afterRowId, () =>
      onInsertQuantumTravel({
        afterRowId,
        fromSlug,
        toSlug: input.toSlug,
        reasonShopSlug: input.reasonShopSlug,
      }),
    );
  };

  const handleCargoToggle = (rowId: string, cargoIndex: number) => {
    if (!onToggleCargoHandled) return;
    if (pendingCargoKeys.has(cargoPendingKey(rowId, cargoIndex))) return;
    void runCargoPending(rowId, cargoIndex, () =>
      onToggleCargoHandled(rowId, cargoIndex),
    );
  };

  const handleQuantumEndpointChange = (
    rowId: string,
    patch: { fromSlug?: string; toSlug?: string },
  ) => {
    if (!onUpdateQuantumTravel) return;
    if (pendingQuantumRowIds.has(rowId)) return;
    void runQuantumPending(rowId, () =>
      onUpdateQuantumTravel({ rowId, ...patch }),
    );
  };

  const addStopFooter = (afterRowId: string) =>
    canAddStops ? (
      <AddStopAfterButton
        onClick={() => setDraftingAfterRowId(afterRowId)}
        disabled={draftingAfterRowId === afterRowId}
      />
    ) : null;

  const draftComposer =
    draftingAfterRowId && canAddStops
      ? (() => {
          const fromSlug = quantumFromSlugAfter({
            rows,
            afterRowId: draftingAfterRowId,
            startLocationSlug,
          });
          if (!fromSlug) return null;
          return (
            <QuantumTravelComposer
              fromSlug={fromSlug}
              onCancel={() => setDraftingAfterRowId(null)}
              onConfirm={confirmQuantumDraft}
            />
          );
        })()
      : null;

  return (
    <div
      className="min-w-0 max-w-full rounded-rsi border border-rsi-border bg-rsi-surface/90 shadow-rsi-panel"
      aria-busy={isLoading || undefined}
    >
      {toolbar}

      {isLoading ? (
        <div
          className="flex flex-col items-center justify-center gap-2 px-4 py-16 text-rsi-accent"
          role="status"
          aria-live="polite"
        >
          <Spinner className="size-6" label="Loading trip" />
          <span className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-rsi-text-muted">
            Loading trip…
          </span>
        </div>
      ) : (
      <ul className="flex flex-col">
        {visibleRows.length === 0 && !showQuantumInList ? (
          <li className="px-4 py-8 text-center text-sm text-rsi-text-muted">
            {emptyMessage}
          </li>
        ) : null}
        {showQuantumInList && startSlugTrimmed && quantumDestinationName ? (
          <>
            <QuantumTravelRow
              rowId={QUANTUM_ORIGIN_ROW_ID}
              fromSlug={startSlugTrimmed}
              destinationSlug={firstStop?.locationSlug ?? null}
              destinationName={quantumDestinationName}
              shipSlug={shipSlug}
              distanceToNext={
                firstStop
                  ? distanceBetweenLocationSlugs(
                      startSlugTrimmed,
                      firstStop.locationSlug,
                    )
                  : null
              }
              isCompleted={quantumCompleted}
              isFocused={activeRowId === QUANTUM_ORIGIN_ROW_ID}
              isCopied={copiedRowId === QUANTUM_ORIGIN_ROW_ID}
              onCopy={() => {
                void copyStarmapName(
                  QUANTUM_ORIGIN_ROW_ID,
                  getLocationShortName(startSlugTrimmed),
                );
              }}
              onFocus={() => onFocusStop?.(QUANTUM_ORIGIN_ROW_ID)}
              onToggle={() => {
                if (quantumCompleted) {
                  setQuantumDeparted(false);
                  onFocusStop?.(QUANTUM_ORIGIN_ROW_ID);
                  return;
                }
                completeQuantumOrigin();
              }}
              isSavingSection={pendingQuantumRowIds.has(QUANTUM_ORIGIN_ROW_ID)}
              onChangeFrom={
                onUpdateQuantumTravel
                  ? (slug) =>
                      handleQuantumEndpointChange(QUANTUM_ORIGIN_ROW_ID, {
                        fromSlug: slug,
                      })
                  : undefined
              }
              onChangeTo={
                onUpdateQuantumTravel
                  ? (slug) =>
                      handleQuantumEndpointChange(QUANTUM_ORIGIN_ROW_ID, {
                        toSlug: slug,
                      })
                  : undefined
              }
              footer={addStopFooter(QUANTUM_ORIGIN_ROW_ID)}
              isHistoryExpanded={
                expandedCompletedRowId === QUANTUM_ORIGIN_ROW_ID
              }
              onHistoryExpand={() => {
                setExpandedCompletedRowId(QUANTUM_ORIGIN_ROW_ID);
                onFocusStop?.(QUANTUM_ORIGIN_ROW_ID);
              }}
              onHistoryCollapse={() => setExpandedCompletedRowId(null)}
            />
            {draftingAfterRowId === QUANTUM_ORIGIN_ROW_ID ? draftComposer : null}
          </>
        ) : null}
        {visibleRows.map((row) => {
          const locationFixture = getLocationBySlug(row.locationSlug);
          const location = locationFixture?.name ?? row.locationSlug;
          const routeIndex = displayRows.findIndex(
            (entry) => entry.id === row.id,
          );
          const nextRow =
            routeIndex >= 0 ? (displayRows[routeIndex + 1] ?? null) : null;
          const nextLocationSlug = nextRow?.locationSlug ?? null;
          const nextLocationName = nextLocationSlug
            ? (getLocationBySlug(nextLocationSlug)?.name ?? nextLocationSlug)
            : null;
          const isCopied = copiedRowId === row.id;
          const step = stepById.get(row.id) ?? 0;
          const isFocused = row.id === activeRowId;
          const isPendingComplete = pendingCompleteRowIds.has(row.id);
          const isQuantumSaving = pendingQuantumRowIds.has(row.id);
          const isRowCargoPending = [...pendingCargoKeys].some((key) =>
            key.startsWith(`${row.id}:`),
          );
          const isRowSectionBusy =
            isPendingComplete || isQuantumSaving || isRowCargoPending;
          const toggleStopDoneById = (
            stopId: string,
            stopRouteIndex: number,
            isCompleted: boolean,
          ) => {
            if (pendingCompleteRowIds.has(stopId)) return;
            const completing = !isCompleted;
            void runRowPending(stopId, () => onToggle(stopId));
            // Defer focus/scroll/bay replan so the checkbox paints first.
            // Always advance when completing — especially with history hidden,
            // the finished stop leaves the list and the next one should be active.
            if (completing) {
              const nextIncomplete = displayRows
                .slice(stopRouteIndex + 1)
                .find((entry) => !entry.isCompleted);
              startTransition(() => {
                if (nextIncomplete) {
                  pendingScrollToIdRef.current = nextIncomplete.id;
                  onFocusStop?.(nextIncomplete.id);
                } else {
                  onFocusStop?.(null);
                }
              });
            }
          };
          const toggleStopDone = () => {
            toggleStopDoneById(row.id, routeIndex, row.isCompleted);
          };

          if (isQuantumTravelRow(row)) {
            const destinationSlug = row.quantumToLocationSlug?.trim() || "";
            const destinationName = destinationSlug
              ? (getLocationBySlug(destinationSlug)?.name ?? destinationSlug)
              : "…";
            return (
              <Fragment key={row.id}>
                <QuantumTravelRow
                  rowId={row.id}
                  fromSlug={row.locationSlug}
                  destinationSlug={destinationSlug || null}
                  destinationName={destinationName}
                  reasonShopSlug={row.reasonShopSlug ?? null}
                  distanceToNext={row.distanceToNext}
                  shipSlug={shipSlug}
                  isCompleted={row.isCompleted}
                  isFocused={isFocused}
                  isCopied={isCopied}
                  onCopy={() => {
                    void copyStarmapName(
                      row.id,
                      getLocationShortName(row.locationSlug),
                    );
                  }}
                  onFocus={() => onFocusStop?.(row.id)}
                  isPending={isPendingComplete}
                  isSavingSection={isQuantumSaving}
                  onToggle={toggleStopDone}
                  onChangeFrom={
                    onUpdateQuantumTravel
                      ? (slug) =>
                          handleQuantumEndpointChange(row.id, {
                            fromSlug: slug,
                          })
                      : undefined
                  }
                  onChangeTo={
                    onUpdateQuantumTravel
                      ? (slug) =>
                          handleQuantumEndpointChange(row.id, {
                            toSlug: slug,
                          })
                      : undefined
                  }
                  footer={addStopFooter(row.id)}
                  isHistoryExpanded={expandedCompletedRowId === row.id}
                  onHistoryExpand={() => {
                    setExpandedCompletedRowId(row.id);
                    onFocusStop?.(row.id);
                  }}
                  onHistoryCollapse={() => setExpandedCompletedRowId(null)}
                />
                {draftingAfterRowId === row.id ? draftComposer : null}
              </Fragment>
            );
          }

          const cargoFallbackRole =
            row.routeAction === "pickup" || row.routeAction === "delivery"
              ? row.routeAction
              : null;
          const cargoLines = describeCargoDeliveries(
            row.cargoDeliveries,
            cargoFallbackRole,
          );
          const expectedCompletions = missionsExpectedToCompleteAtStop(
            missions,
            displayRows,
            row.id,
          );
          const completionAuec = expectedCompletions.reduce(
            (sum, mission) => sum + missionAuecAmount(mission),
            0,
          );
          const completionXp =
            estimateMissionsHaulingRepXp(expectedCompletions);

          const prevRow =
            routeIndex > 0 ? (displayRows[routeIndex - 1] ?? null) : null;
          // Bridge only while the *next* stop is still open — drops once that
          // stop is completed. With history hidden, render it above the next
          // incomplete card so the hop stays visible.
          const bridgeNextDistance =
            row.isCompleted &&
            nextRow != null &&
            !nextRow.isCompleted;
          const historyHiddenBridge =
            hideCompleted &&
            !row.isCompleted &&
            prevRow != null &&
            prevRow.isCompleted &&
            !isQuantumTravelRow(prevRow);
          const historyHiddenBridgeNextName = historyHiddenBridge
            ? (getLocationBySlug(row.locationSlug)?.name ?? row.locationSlug)
            : null;

          // Show-history: collapse completed stops to a strip unless expanded.
          if (
            row.isCompleted &&
            !hideCompleted &&
            expandedCompletedRowId !== row.id
          ) {
            return (
              <Fragment key={row.id}>
                <li
                  ref={(node) => {
                    if (node) rowElsRef.current.set(row.id, node);
                    else rowElsRef.current.delete(row.id);
                  }}
                  aria-checked
                  aria-busy={isRowSectionBusy}
                  aria-current={isFocused ? "step" : undefined}
                  className="scroll-mt-20 border-b border-rsi-divider/80 sm:scroll-mt-24"
                  onClick={() => onFocusStop?.(row.id)}
                >
                  <CompletedStopHistoryRow
                    location={location}
                    step={step}
                    routeAction={row.routeAction}
                    scuTotal={sumCargoScu(row.cargoDeliveries)}
                    hopLabel={(() => {
                      const hop =
                        (nextLocationSlug
                          ? distanceBetweenLocationSlugs(
                              row.locationSlug,
                              nextLocationSlug,
                            )
                          : null) ?? row.distanceToNext;
                      if (!hop) return null;
                      return (
                        <>
                          <span className="md:hidden">
                            {formatDistanceToNext(hop, { compact: true })}
                          </span>
                          <span className="hidden md:inline">
                            {formatDistanceToNext(hop)}
                          </span>
                        </>
                      );
                    })()}
                    hopTitle={(() => {
                      const hop =
                        (nextLocationSlug
                          ? distanceBetweenLocationSlugs(
                              row.locationSlug,
                              nextLocationSlug,
                            )
                          : null) ?? row.distanceToNext;
                      return hop ? formatDistanceToNext(hop) : null;
                    })()}
                    isFocused={isFocused}
                    isPending={isPendingComplete}
                    onToggle={toggleStopDone}
                    onOpen={() => {
                      setExpandedCompletedRowId(row.id);
                      onFocusStop?.(row.id);
                    }}
                  />
                  {bridgeNextDistance && nextRow ? (
                    <NextStopBridgeBand
                      row={row}
                      nextLocationName={nextLocationName}
                      nextLocationSlug={nextLocationSlug}
                      shipSlug={shipSlug}
                      bridgeRef={(node) => {
                        if (node) bridgeElsRef.current.set(nextRow.id, node);
                        else bridgeElsRef.current.delete(nextRow.id);
                      }}
                    />
                  ) : null}
                </li>
                {draftingAfterRowId === row.id ? draftComposer : null}
              </Fragment>
            );
          }

          return (
            <Fragment key={row.id}>
            <li
              ref={(node) => {
                if (node) rowElsRef.current.set(row.id, node);
                else rowElsRef.current.delete(row.id);
              }}
              aria-checked={row.isCompleted}
              aria-busy={isRowSectionBusy}
              aria-current={isFocused ? "step" : undefined}
              className="flex scroll-mt-20 flex-col border-b border-rsi-divider/80 pb-1 sm:scroll-mt-24"
              onClick={() => onFocusStop?.(row.id)}
            >
              {historyHiddenBridge && prevRow ? (
                <NextStopBridgeBand
                  row={prevRow}
                  nextLocationName={historyHiddenBridgeNextName}
                  nextLocationSlug={row.locationSlug}
                  shipSlug={shipSlug}
                  bridgeRef={(node) => {
                    if (node) bridgeElsRef.current.set(row.id, node);
                    else bridgeElsRef.current.delete(row.id);
                  }}
                />
              ) : null}
              <div
                className={[
                  "flex min-h-0 flex-1 flex-col px-3 pt-4.5 pb-1",
                  checklistRowToneClass(row.isCompleted, isFocused),
                ].join(" ")}
              >
                {row.isCompleted &&
                !hideCompleted &&
                expandedCompletedRowId === row.id ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setExpandedCompletedRowId(null);
                    }}
                    className="mb-2 ml-auto block font-mono text-[0.6rem] uppercase tracking-[0.14em] text-rsi-text-muted hover:text-rsi-accent"
                  >
                    Collapse
                  </button>
                ) : null}
                {/* Sticky Done shares this column height through Next stop so it can pin mid-ship. */}
                <div className="flex min-h-0 flex-1 gap-3">
                  <div className="hidden w-8 shrink-0 self-stretch md:block">
                    <div
                      className={`${STICKY_DONE_TOP} flex h-14 items-center justify-center sm:h-16`}
                    >
                      <DoneCheckbox
                        location={location}
                        step={step}
                        isCompleted={row.isCompleted}
                        isActive={isFocused}
                        isPending={isPendingComplete}
                        onToggle={toggleStopDone}
                      />
                    </div>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <LocationHeader
                      row={row}
                      location={location}
                      hasOutdoorFreightElevator={Boolean(
                        locationFixture?.hasOutdoorFreightElevator,
                      )}
                      isCopied={isCopied}
                      onCopy={() => {
                        void copyStarmapName(
                          row.id,
                          getLocationShortName(row.locationSlug),
                        );
                      }}
                    />
                    <div className="mt-5 overflow-x-clip pb-5">
                      {isRowSectionBusy ? (
                        <p className="mb-2 inline-flex items-center gap-1.5 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-rsi-accent">
                          <Spinner className="size-3" />
                          Saving…
                        </p>
                      ) : null}
                      <CargoGroups
                        row={row}
                        cargoLines={cargoLines}
                        missions={missions}
                        location={location}
                        shipName={transferShipName}
                        shipSlug={shipSlug}
                        sessionId={sessionId}
                        transferLedger={
                          transferLedgerByStop.get(row.id) ?? null
                        }
                        pendingCargoKeys={pendingCargoKeys}
                        onToggleCargoHandled={
                          onToggleCargoHandled
                            ? handleCargoToggle
                            : undefined
                        }
                        bayAside={(role) => (
                          <StopDeliveryBayPreview
                            row={row}
                            rows={rows}
                            missions={missions}
                            role={role}
                            onEditMissionBoxes={
                              onSelectBoxBreakdown
                                ? (missionId: string) => {
                                    const mission = missions.find(
                                      (entry) => entry.id === missionId,
                                    );
                                    if (!mission || mission.isCompleted)
                                      return;
                                    setBoxEditMissionId(missionId);
                                  }
                                : undefined
                            }
                          />
                        )}
                      />
                    </div>
                    {/* Same lg split as transfer + Breakdown so width matches Pick up / Drop off. */}
                    <div className="mt-2 flex w-full min-w-0 flex-col lg:flex-row lg:gap-4">
                      <div className="min-w-0 w-full lg:flex-1">
                        <PayoutExpMeta
                          row={row}
                          completionAuec={completionAuec}
                          approxXp={completionXp}
                          completingMissionCount={expectedCompletions.length}
                        />
                      </div>
                      <div
                        className="hidden lg:block lg:w-1/2 lg:shrink-0"
                        aria-hidden
                      />
                    </div>
                    <div className="mt-auto">
                      <div className="mb-2 pt-3 md:hidden">
                        <DoneStopButton
                          location={location}
                          step={step}
                          isCompleted={row.isCompleted}
                          isPending={isPendingComplete}
                          onToggle={toggleStopDone}
                        />
                      </div>
                      <NextDistanceMeta
                        row={row}
                        nextLocationName={nextLocationName}
                        nextLocationSlug={nextLocationSlug}
                        shipSlug={shipSlug}
                        isPending={isPendingComplete}
                        checkboxColumn="external"
                        onToggle={
                          row.isCompleted ? undefined : toggleStopDone
                        }
                      />
                    </div>
                  </div>
                </div>
                {addStopFooter(row.id)}
              </div>
            </li>
            {draftingAfterRowId === row.id ? draftComposer : null}
            </Fragment>
          );
        })}
      </ul>
      )}
      {boxEditMission && onSelectBoxBreakdown ? (
        <StopMissionBoxConfigModal
          {...stopMissionBoxConfigModalProps({
            mission: boxEditMission,
            rows,
            sessionId,
            onClose: () => setBoxEditMissionId(null),
            onSelectBoxBreakdown,
            onSaveMissionScuDraft,
          })}
        />
      ) : null}
    </div>
  );
});
