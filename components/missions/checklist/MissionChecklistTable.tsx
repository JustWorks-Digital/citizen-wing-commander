"use client";

import {
  Fragment,
  memo,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { LocationFuzzySearch } from "@/components/ui/LocationFuzzySearch";
import {
  describeCargoDeliveries,
  getCommodityIconSrc,
  getLocationBySlug,
  getLocationImageSrc,
  getLocationShortName,
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
import {
  formatDistanceToNext,
  isQuantumTravelRow,
  type DistanceToNext,
  type HaulingChecklistRow,
  type RouteAction,
} from "@/lib/missions/sessionChecklist";

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
import {
  missionScuAmounts,
  type MissionScuDraft,
} from "@/lib/missions/missionScuAmounts";
import type { SessionMission } from "@/lib/missions/sessionMissions";
import { stopMissionBoxConfigModalProps } from "@/lib/missions/stopMissionBoxConfig";
import { distanceBetweenLocationSlugs } from "@/lib/starmap/distance";
import { AUEC_TITLE, SCU_TITLE } from "@/lib/ui/abbrevTitles";
import { OutdoorFreightBadge } from "../OutdoorFreightBadge";
import { StopDeliveryBayPreview } from "../StopDeliveryBayPreview";
import { StopMissionBoxConfigModal } from "../StopMissionBoxConfigModal";
import { StopMissionScreenshots } from "../StopMissionScreenshots";
import { cargoPendingKey, CargoGroups } from "./ChecklistCargoTiles";
import { AddStopAfterButton, LocationHeader } from "./ChecklistLocationHeader";
import {
  ChecklistProgressRail,
  ChecklistProgressTimeline,
  CondensedStopRow,
  CompletedStopHistoryRow,
  FinishRunTile,
  NextDistanceMeta,
  NextStopBridgeBand,
  PayoutExpMeta,
  checklistRowToneClass,
} from "./CompletedHistoryRow";
import { ChecklistStopsSkeleton } from "./ChecklistStopsSkeleton";
import { QuantumTravelComposer } from "./QuantumTravelComposer";
import { QuantumTravelRow } from "./QuantumTravelRow";
import {
  TripCompleteSummaryPanel,
  type TripCompleteSummaryPanelProps,
} from "@/components/missions/TripCompleteSummaryPanel";

/** Display-only origin row when start ≠ first stop (matches route timeline). */
export const QUANTUM_ORIGIN_ROW_ID = INSERT_AFTER_SESSION_START;

/** Pinwheel in the Done checkbox before the checkmark commits. */
const STOP_COMPLETE_SPINNER_MS = 900;
/** Brief hold on the checkmark before advancing to the next stop. */
const STOP_COMPLETE_CHECKMARK_HOLD_MS = 350;

type StopCompleteHandoff = {
  fromStopId: string;
};

export type MissionChecklistTripSummary = TripCompleteSummaryPanelProps;

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
  /**
   * Content stacked above the checklist card in the same column (e.g. trip
   * expand/collapse). Matches checklist width beside the Progress rail.
   */
  aboveChecklist?: ReactNode;
  /**
   * Reopen / focus the inline finish report (FinishRunTile when summary was
   * dismissed). ⋯ menu lives beside Find a Contract in the trip header.
   */
  onOpenSummary?: () => void;
  /** Finish report shown in place of the active stop when the trip is complete. */
  tripSummary?: MissionChecklistTripSummary | null;
  /** Controlled hide-completed (⋯ menu lives outside this table). */
  hideCompleted?: boolean;
  onHideCompletedChange?: (hidden: boolean) => void;
  /** Prefer Pick up as the left cargo tab (⋯ Prioritize pickup). */
  prioritizePickup?: boolean;
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
   * Mark all pickup or delivery cargo at a stop handled (Drop off / Pick up).
   * Does not complete the stop — Done stays separate.
   */
  onSetCargoRoleHandled?: (
    rowId: string,
    role: "pickup" | "delivery",
    handled: boolean,
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
  /** Trip distance — shown in the Stops rail (not the sticky toolbar). */
  distanceTraveled?: DistanceToNext | null;
  distanceTotal?: DistanceToNext | null;
  /** Open contracts table; pass a mission id to highlight that row. */
  onOpenContracts?: (missionId?: string) => void;
  /** Persist crate mix for a session mission (Pickup / Drop off click). */
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
  /**
   * Skip pick-up of one cargo at the current stop (Breakdown ×) and
   * rebalance remaining pick-up stops for that commodity.
   */
  onSkipPickupAtStop?: (input: {
    missionId: string;
    commoditySlug: string;
    locationSlug: string;
  }) => void | Promise<void>;
  /**
   * Add / restore pick-up SCU for a mission commodity at this stop
   * (mission-card Add cargo).
   */
  onSetPickupScuAtStop?: (input: {
    missionId: string;
    commoditySlug: string;
    locationSlug: string;
    scu: number;
  }) => void | Promise<void>;
  /**
   * Set drop-off SCU at this stop and rebalance remaining deliveries.
   * SCU 0 clears that cargo at the stop.
   */
  onSetDeliveryScuAtStop?: (input: {
    missionId: string;
    commoditySlug: string;
    locationSlug: string;
    scu: number;
  }) => void | Promise<void>;
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
  aboveChecklist = null,
  onOpenSummary,
  tripSummary = null,
  hideCompleted: hideCompletedProp,
  onHideCompletedChange,
  prioritizePickup = true,
  shipName = null,
  shipSlug = null,
  missions = [],
  sessionId = null,
  onToggleCargoHandled,
  onSetCargoRoleHandled,
  startLocationSlug = null,
  quantumOriginDeparted: quantumOriginDepartedProp,
  onQuantumOriginDepartedChange,
  onInsertQuantumTravel,
  onUpdateQuantumTravel,
  onOpenCargoBays,
  onOpenStops,
  distanceTraveled = null,
  distanceTotal = null,
  onOpenContracts,
  onSelectBoxBreakdown,
  onSaveMissionScuDraft,
  onSkipPickupAtStop,
  onSetPickupScuAtStop,
  onSetDeliveryScuAtStop,
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
  const [pendingSkipPickupKeys, setPendingSkipPickupKeys] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const [pendingAddPickupKeys, setPendingAddPickupKeys] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const [pendingCargoRoleKeys, setPendingCargoRoleKeys] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const [pendingQuantumRowIds, setPendingQuantumRowIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const [hideCompletedLocal, setHideCompletedLocal] = useState(false);
  const isHideCompletedControlled = onHideCompletedChange != null;
  const hideCompleted = isHideCompletedControlled
    ? Boolean(hideCompletedProp)
    : hideCompletedLocal;
  const setHideCompleted = (value: boolean | ((prev: boolean) => boolean)) => {
    const next = typeof value === "function" ? value(hideCompleted) : value;
    if (isHideCompletedControlled) onHideCompletedChange(next);
    else setHideCompletedLocal(next);
  };
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
  /** Click Pickup / Drop off crate → box mix modal. */
  const [boxEditMissionId, setBoxEditMissionId] = useState<string | null>(null);
  /** Completed Done-strip row expanded to full card (history shown). */
  const [expandedCompletedRowId, setExpandedCompletedRowId] = useState<
    string | null
  >(null);
  /** Progress timeline open/collapsed. */
  const [isProgressExpanded, setIsProgressExpanded] = useState(true);
  const boxEditMission =
    boxEditMissionId == null
      ? null
      : (missions.find((mission) => mission.id === boxEditMissionId) ?? null);
  const rowElsRef = useRef(new Map<string, HTMLLIElement>());
  /** Next stop transition band — keyed by destination stop id. */
  const bridgeElsRef = useRef(new Map<string, HTMLElement>());
  const stickyToolbarRef = useRef<HTMLDivElement | null>(null);
  /** Checklist card — desktop Progress rail matches this height. */
  const [checklistPanelEl, setChecklistPanelEl] = useState<HTMLElement | null>(
    null,
  );
  const pendingScrollToIdRef = useRef<string | null>(null);
  const [completeHandoff, setCompleteHandoff] =
    useState<StopCompleteHandoff | null>(null);
  const handoffTimerRef = useRef<number | null>(null);
  /** Block history-strip Open after Done — click can retarget onto the strip. */
  const suppressHistoryOpenUntilRef = useRef(new Map<string, number>());
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
  // Keep the stop just completed visible during handoff (even if history is hidden).
  const visibleRows = hideCompleted
    ? displayRows.filter(
        (row) =>
          !row.isCompleted || row.id === completeHandoff?.fromStopId,
      )
    : displayRows;
  const showQuantumInList =
    showQuantumOrigin &&
    (!(hideCompleted && quantumCompleted) ||
      completeHandoff?.fromStopId === QUANTUM_ORIGIN_ROW_ID);
  const canAddStops = Boolean(onInsertQuantumTravel);

  /** Keys: `missionId::commoditySlug::locationSlug` that can absorb a skip. */
  const skippablePickupKeys = useMemo(() => {
    if (!onSkipPickupAtStop) return null;
    const keys = new Set<string>();
    for (const mission of missions) {
      if (mission.isCompleted) continue;
      const draft = missionScuAmounts.draftFromMission(mission, rows);
      for (const pickup of draft.pickups) {
        if (
          !missionScuAmounts.canSkipPickupInDraft(
            draft,
            pickup.commoditySlug,
            pickup.locationSlug,
          )
        ) {
          continue;
        }
        keys.add(
          `${mission.id}::${pickup.commoditySlug}::${pickup.locationSlug}`,
        );
      }
    }
    return keys;
  }, [missions, onSkipPickupAtStop, rows]);

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
    // Progress timeline selection only — land the opened stop under the sticky toolbar.
    const el =
      bridgeElsRef.current.get(targetId) ?? rowElsRef.current.get(targetId);
    const sticky = stickyToolbarRef.current;
    if (!el) return;
    const stickyBottom = sticky?.getBoundingClientRect().bottom ?? 0;
    const delta = el.getBoundingClientRect().top - stickyBottom;
    if (Math.abs(delta) < 1) return;
    window.scrollBy({ top: delta, behavior: "smooth" });
  }, [rows, visibleRows, focusedStopId]);

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

  const clearCompleteHandoffTimer = useCallback(() => {
    if (handoffTimerRef.current == null) return;
    window.clearTimeout(handoffTimerRef.current);
    handoffTimerRef.current = null;
  }, []);

  const setCompleteHandoffPending = useCallback(
    (stopId: string, pending: boolean) => {
      if (stopId === QUANTUM_ORIGIN_ROW_ID) {
        markPendingId(setPendingQuantumRowIds, stopId, pending);
        return;
      }
      markPendingId(setPendingCompleteRowIds, stopId, pending);
    },
    [],
  );

  /**
   * Done click: pinwheel → checkmark (commit) → brief hold → advance focus.
   */
  const scheduleAdvanceAfterComplete = useCallback(
    (
      fromStopId: string,
      nextIncomplete: HaulingChecklistRow | null | undefined,
      commit: () => void | Promise<void>,
    ) => {
      clearCompleteHandoffTimer();
      setCompleteHandoff({ fromStopId });
      setCompleteHandoffPending(fromStopId, true);
      onFocusStop?.(fromStopId);
      handoffTimerRef.current = window.setTimeout(() => {
        void Promise.resolve(commit())
          .catch(() => undefined)
          .finally(() => {
            setCompleteHandoffPending(fromStopId, false);
            handoffTimerRef.current = window.setTimeout(() => {
              handoffTimerRef.current = null;
              setCompleteHandoff(null);
              startTransition(() => {
                if (nextIncomplete) {
                  pendingScrollToIdRef.current = nextIncomplete.id;
                  onFocusStop?.(nextIncomplete.id);
                } else {
                  onFocusStop?.(fromStopId);
                }
              });
            }, STOP_COMPLETE_CHECKMARK_HOLD_MS);
          });
      }, STOP_COMPLETE_SPINNER_MS);
    },
    [clearCompleteHandoffTimer, onFocusStop, setCompleteHandoffPending],
  );

  useEffect(() => () => clearCompleteHandoffTimer(), [clearCompleteHandoffTimer]);

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

  /** Add or edit pick-up / drop-off SCU at a stop (shared pending key). */
  const queueSetStopScuAtStop = (
    role: "pickup" | "delivery",
    locationSlug: string,
    missionId: string,
    commoditySlug: string,
    scu: number,
  ) => {
    const handler =
      role === "pickup" ? onSetPickupScuAtStop : onSetDeliveryScuAtStop;
    if (!handler) return;
    const key = `${missionId}::${commoditySlug}::${locationSlug}`;
    if (pendingAddPickupKeys.has(key)) return;
    markPendingId(setPendingAddPickupKeys, key, true);
    void Promise.resolve(
      handler({
        missionId,
        commoditySlug,
        locationSlug,
        scu,
      }),
    ).finally(() => {
      markPendingId(setPendingAddPickupKeys, key, false);
    });
  };

  /** Sibling of the checklist panel (not inside it) so sticky top gap shows page bg like Stops. */
  const toolbar = (
    <div
      ref={stickyToolbarRef}
      className="sticky top-1.5 z-20 flex w-full min-w-0 max-w-full items-center gap-1.5 rounded-rsi border border-rsi-border bg-rsi-surface/90 px-2.5 py-1 shadow-[0_12px_40px_rgba(0,0,0,0.35)] sm:gap-2 sm:px-3"
    >
      <div className="flex min-w-0 flex-1 items-center">{toolbarStart}</div>
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
  const focusedRow =
    focusedStopId && focusedStopId !== QUANTUM_ORIGIN_ROW_ID
      ? (displayRows.find((row) => row.id === focusedStopId) ?? null)
      : null;
  // Honor explicit focus (including completed stops after the trip is done).
  const activeRowId =
    focusTargetsQuantum || focusedRow
      ? focusedStopId
      : defaultFocusedStopId(displayRows, startLocationSlug);
  const firstStop = displayRows[0] ?? null;
  const quantumDestinationName = firstStop
    ? (getLocationBySlug(firstStop.locationSlug)?.name ??
      firstStop.locationSlug)
    : null;
  const startSlugTrimmed = startLocationSlug?.trim() || null;

  /**
   * Visual order: progress timeline → open card at bottom.
   * Timeline covers done / now / ahead; click a node to open that stop’s card.
   */
  const workingIncompleteId =
    displayRows.find((row) => !row.isCompleted)?.id ?? null;
  const openActiveId =
    activeRowId === QUANTUM_ORIGIN_ROW_ID
      ? QUANTUM_ORIGIN_ROW_ID
      : activeRowId &&
          displayRows.some((row) => row.id === activeRowId)
        ? activeRowId
        : (workingIncompleteId ?? null);
  const isViewingCompleted = Boolean(
    openActiveId &&
      openActiveId !== QUANTUM_ORIGIN_ROW_ID &&
      displayRows.some(
        (row) => row.id === openActiveId && row.isCompleted,
      ),
  );
  const activeListRows = visibleRows.filter((row) => row.id === openActiveId);
  type ChecklistListItem =
    | { kind: "section"; band: "completed" | "active" }
    | { kind: "completedBand" }
    | { kind: "quantum" }
    | { kind: "stop"; row: (typeof visibleRows)[number] }
    | { kind: "tripSummary" };
  const checklistListItems: ChecklistListItem[] = [];
  const pushSection = (band: "completed" | "active") => {
    checklistListItems.push({ kind: "section", band });
  };
  const isTripComplete =
    displayRows.length > 0 && displayRows.every((row) => row.isCompleted);
  const showTripSummary = Boolean(isTripComplete && tripSummary);
  // Keep the Stops rail after the last stop is done (even if history is hidden).
  const showProgressTimeline =
    displayRows.length > 0 && (isTripComplete || !hideCompleted);

  if (showProgressTimeline) {
    pushSection("completed");
    checklistListItems.push({ kind: "completedBand" });
  }
  if (showTripSummary) {
    pushSection("active");
    checklistListItems.push({ kind: "tripSummary" });
  } else if (
    (showQuantumInList && openActiveId === QUANTUM_ORIGIN_ROW_ID) ||
    activeListRows.length > 0
  ) {
    pushSection("active");
    if (showQuantumInList && openActiveId === QUANTUM_ORIGIN_ROW_ID) {
      checklistListItems.push({ kind: "quantum" });
    }
    for (const row of activeListRows) {
      checklistListItems.push({ kind: "stop", row });
    }
  }

  const activeSectionLocationName = (() => {
    if (showQuantumInList && openActiveId === QUANTUM_ORIGIN_ROW_ID) {
      return startSlugTrimmed
        ? (getLocationBySlug(startSlugTrimmed)?.name ?? startSlugTrimmed)
        : null;
    }
    const openRow = activeListRows[0] ?? null;
    if (!openRow) return null;
    return (
      getLocationBySlug(openRow.locationSlug)?.name ?? openRow.locationSlug
    );
  })();

  const completeQuantumOrigin = () => {
    const nextIncomplete =
      rows.find((entry) => !entry.isCompleted) ?? firstStop;
    scheduleAdvanceAfterComplete(
      QUANTUM_ORIGIN_ROW_ID,
      nextIncomplete ?? null,
      () => {
        setQuantumDeparted(true);
      },
    );
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
        const doneTargetId = isViewingCompleted
          ? workingIncompleteId
          : openActiveId;
        if (!doneTargetId) return;
        event.preventDefault();
        if (doneTargetId === QUANTUM_ORIGIN_ROW_ID && showQuantumInList) {
          if (quantumCompleted) {
            setQuantumDeparted(false);
            onFocusStop?.(QUANTUM_ORIGIN_ROW_ID);
          } else {
            completeQuantumOrigin();
          }
          return;
        }
        const row = rows.find((entry) => entry.id === doneTargetId);
        if (!row) return;
        if (pendingCompleteRowIds.has(row.id)) return;
        const completing = !row.isCompleted;
        if (completing) {
          suppressHistoryOpenUntilRef.current.set(row.id, Date.now() + 500);
          setExpandedCompletedRowId((current) =>
            current === row.id ? null : current,
          );
          const routeIndex = rows.findIndex((entry) => entry.id === row.id);
          const nextIncomplete = rows
            .slice(routeIndex + 1)
            .find((entry) => !entry.isCompleted);
          scheduleAdvanceAfterComplete(row.id, nextIncomplete ?? null, () =>
            onToggle(row.id),
          );
        } else {
          clearCompleteHandoffTimer();
          setCompleteHandoff(null);
          void runRowPending(row.id, () => onToggle(row.id));
          if (isViewingCompleted) {
            // Undoing Done from a history view — return focus to this stop.
            onFocusStop?.(row.id);
          }
        }
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    openActiveId,
    workingIncompleteId,
    isViewingCompleted,
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
    scheduleAdvanceAfterComplete,
    clearCompleteHandoffTimer,
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

  const cargoRolePendingKey = (rowId: string, role: "pickup" | "delivery") =>
    `${rowId}::${role}`;

  const advanceFocusAfterStop = (rowId: string) => {
    const stopRouteIndex = displayRows.findIndex((entry) => entry.id === rowId);
    const nextIncomplete = displayRows
      .slice(stopRouteIndex + 1)
      .find((entry) => !entry.isCompleted);
    startTransition(() => {
      if (nextIncomplete) {
        onFocusStop?.(nextIncomplete.id);
      } else {
        onFocusStop?.(null);
      }
    });
  };

  const handleSetCargoRoleHandled = (
    rowId: string,
    role: "pickup" | "delivery",
    handled: boolean,
  ) => {
    if (!onSetCargoRoleHandled) return;
    const key = cargoRolePendingKey(rowId, role);
    if (pendingCargoRoleKeys.has(key)) return;
    setPendingCargoRoleKeys((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    void Promise.resolve(onSetCargoRoleHandled(rowId, role, handled)).finally(
      () => {
        setPendingCargoRoleKeys((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      },
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

  const progressTotal =
    displayRows.length + (showQuantumInList ? 1 : 0);
  const progressDone = Math.min(completedCount, progressTotal);
  const progressStops = showProgressTimeline
    ? [
        ...(showQuantumInList && startSlugTrimmed
          ? [
              {
                id: QUANTUM_ORIGIN_ROW_ID,
                locationSlug: startSlugTrimmed,
                step: "QT" as const,
                isCompleted: quantumCompleted,
                isCurrent:
                  openActiveId === QUANTUM_ORIGIN_ROW_ID && !quantumCompleted,
                isViewing: openActiveId === QUANTUM_ORIGIN_ROW_ID,
              },
            ]
          : []),
        ...displayRows.map((row) => ({
          id: row.id,
          locationSlug: row.locationSlug,
          step: stepById.get(row.id) ?? 0,
          isCompleted: row.isCompleted,
          isCurrent: row.id === workingIncompleteId,
          // Active = the stop the user opened (checklist focus), not only “next”.
          isViewing: row.id === openActiveId,
        })),
      ]
    : [];
  const onSelectProgressStop = (stopId: string) => {
    onFocusStop?.(stopId);
    pendingScrollToIdRef.current = stopId;
  };

  const checklistBody = (
    <ul className="flex flex-col">
      {checklistListItems.length === 0 ? (
        <li className="px-4 py-8 text-center text-sm text-rsi-text-muted">
          {emptyMessage}
        </li>
      ) : null}
      {checklistListItems.map((item) => {
          if (item.kind === "section") {
            const isProgressSection = item.band === "completed";
            const distanceCompact =
              distanceTotal || distanceTraveled
                ? `${formatDistanceToNext(distanceTraveled, { compact: true })}/${formatDistanceToNext(distanceTotal, { compact: true })}`
                : null;
            const isLocationSection =
              !isProgressSection && !showTripSummary;
            const label = isProgressSection
              ? null
              : showTripSummary
                ? "Summary"
                : (activeSectionLocationName ?? "Current");
            const monoLabelClass =
              "font-mono text-[0.55rem] uppercase tracking-[0.16em] text-rsi-text-muted";
            return (
              <li
                key={`section-${item.band}`}
                className={[
                  "border-b border-rsi-divider/60 bg-rsi-bg-deep/40",
                  isProgressSection ? "lg:hidden" : "",
                ].join(" ")}
              >
                <button
                  type="button"
                  aria-controls={
                    isProgressSection
                      ? undefined
                      : "checklist-current-stop"
                  }
                  title={isProgressSection ? "Open stops" : undefined}
                  onClick={() => {
                    if (isProgressSection) {
                      onOpenStops?.();
                    }
                    // Location / Summary header is display-only (chevron stays).
                  }}
                  className={[
                    "flex w-full items-center gap-1.5 px-3 py-1.5 text-left",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--rsi-ring)]",
                    isProgressSection
                      ? "hover:bg-rsi-surface-raised/30"
                      : "cursor-default",
                  ].join(" ")}
                >
                  {isLocationSection ? (
                    <svg
                      aria-hidden
                      viewBox="0 0 20 20"
                      className="size-3 shrink-0 rotate-90 text-rsi-text-muted"
                      fill="currentColor"
                    >
                      <path d="M7.05 4.55a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 1 1-1.06-1.06L10.69 10 7.05 6.36a.75.75 0 0 1 0-1.06Z" />
                    </svg>
                  ) : null}
                  {isProgressSection ? (
                    <span className={`flex min-w-0 flex-wrap items-center gap-x-4 gap-y-0.5 ${monoLabelClass}`}>
                      <span>
                        Stops: {progressDone}/{progressTotal}
                      </span>
                      {distanceCompact ? (
                        <span>Distance: {distanceCompact}</span>
                      ) : null}
                    </span>
                  ) : (
                    <span
                      className={
                        isLocationSection
                          ? "truncate text-[0.7rem] font-medium text-rsi-text-secondary"
                          : monoLabelClass
                      }
                    >
                      {label}
                    </span>
                  )}
                </button>
              </li>
            );
          }

          if (item.kind === "completedBand") {
            if (!isProgressExpanded) return null;
            return (
              <li
                id="checklist-progress-timeline"
                key="completed-band"
                className="border-b border-rsi-divider/80 bg-rsi-bg-deep/35 lg:hidden"
              >
                <ChecklistProgressTimeline
                  stops={progressStops}
                  onSelectStop={onSelectProgressStop}
                />
              </li>
            );
          }

          if (item.kind === "tripSummary") {
            if (!tripSummary) return null;
            return (
              <li
                id="checklist-current-stop"
                key="trip-complete-summary"
                className="flex justify-center border-b border-rsi-divider/80 bg-rsi-bg-deep/25 px-3 py-4 sm:px-4"
              >
                <TripCompleteSummaryPanel {...tripSummary} />
              </li>
            );
          }

          if (item.kind === "quantum") {
            if (!startSlugTrimmed || !quantumDestinationName) return null;
            return (
              <Fragment key={QUANTUM_ORIGIN_ROW_ID}>
                <QuantumTravelRow
                  id="checklist-current-stop"
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
                  isFocused={openActiveId === QUANTUM_ORIGIN_ROW_ID}
                  isCopied={copiedRowId === QUANTUM_ORIGIN_ROW_ID}
                  onCopy={() => {
                    void copyStarmapName(
                      QUANTUM_ORIGIN_ROW_ID,
                      getLocationShortName(startSlugTrimmed),
                    );
                  }}
                  onFocus={() => {
                    setExpandedCompletedRowId(null);
                    onFocusStop?.(QUANTUM_ORIGIN_ROW_ID);
                  }}
                  onToggle={() => {
                    if (quantumCompleted) {
                      clearCompleteHandoffTimer();
                      setCompleteHandoffPending(QUANTUM_ORIGIN_ROW_ID, false);
                      setCompleteHandoff(null);
                      setQuantumDeparted(false);
                      onFocusStop?.(QUANTUM_ORIGIN_ROW_ID);
                      return;
                    }
                    if (pendingQuantumRowIds.has(QUANTUM_ORIGIN_ROW_ID)) return;
                    completeQuantumOrigin();
                  }}
                  isSavingSection={pendingQuantumRowIds.has(
                    QUANTUM_ORIGIN_ROW_ID,
                  )}
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
                {draftingAfterRowId === QUANTUM_ORIGIN_ROW_ID
                  ? draftComposer
                  : null}
              </Fragment>
            );
          }

          const row = item.row;
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
          const isFocused = row.isCompleted
            ? row.id === focusedStopId ||
              expandedCompletedRowId === row.id
            : row.id === openActiveId;
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
            if (completing) {
              // Force history-strip condensation even if this stop was expanded.
              // Also ignore Open for a beat — Done click can land on the strip.
              suppressHistoryOpenUntilRef.current.set(stopId, Date.now() + 500);
              setExpandedCompletedRowId((current) =>
                current === stopId ? null : current,
              );
              const nextIncomplete = displayRows
                .slice(stopRouteIndex + 1)
                .find((entry) => !entry.isCompleted);
              scheduleAdvanceAfterComplete(
                stopId,
                nextIncomplete ?? null,
                () => onToggle(stopId),
              );
            } else {
              clearCompleteHandoffTimer();
              setCompleteHandoff(null);
              void runRowPending(stopId, () => onToggle(stopId));
            }
          };
          const openCompletedHistory = (stopId: string) => {
            const until =
              suppressHistoryOpenUntilRef.current.get(stopId) ?? 0;
            if (Date.now() < until) return;
            if (pendingCompleteRowIds.has(stopId)) return;
            setExpandedCompletedRowId(stopId);
            onFocusStop?.(stopId);
          };
          const toggleStopDone = () => {
            toggleStopDoneById(row.id, routeIndex, row.isCompleted);
          };

          const condensedHopLabel = (() => {
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
          })();
          const condensedHopTitle = (() => {
            const hop =
              (nextLocationSlug
                ? distanceBetweenLocationSlugs(
                    row.locationSlug,
                    nextLocationSlug,
                  )
                : null) ?? row.distanceToNext;
            return hop ? formatDistanceToNext(hop) : null;
          })();

          const focusUpcomingStop = () => {
            setExpandedCompletedRowId(null);
            onFocusStop?.(row.id);
          };

          // Upcoming stops stay condensed; only the active stop is fully open.
          if (!row.isCompleted && !isFocused && !isQuantumTravelRow(row)) {
            return (
              <Fragment key={row.id}>
                <li
                  ref={(node) => {
                    if (node) rowElsRef.current.set(row.id, node);
                    else rowElsRef.current.delete(row.id);
                  }}
                  aria-checked={false}
                  aria-busy={isRowSectionBusy}
                  className="scroll-mt-20 border-b border-rsi-divider/80 sm:scroll-mt-24"
                  onClick={focusUpcomingStop}
                >
                  <CondensedStopRow
                    location={location}
                    step={step}
                    routeAction={row.routeAction}
                    scuTotal={sumCargoScu(row.cargoDeliveries)}
                    hopLabel={condensedHopLabel}
                    hopTitle={condensedHopTitle}
                    isCompleted={false}
                    isFocused={false}
                    isPending={isPendingComplete}
                    onToggle={toggleStopDone}
                    onOpen={focusUpcomingStop}
                  />
                </li>
                {draftingAfterRowId === row.id ? draftComposer : null}
              </Fragment>
            );
          }

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
                  onFocus={() => {
                    if (!row.isCompleted) setExpandedCompletedRowId(null);
                    onFocusStop?.(row.id);
                  }}
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
                  onHistoryExpand={() => openCompletedHistory(row.id)}
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

          // Completed stops live in the completed chip band unless opened below.
          if (
            row.isCompleted &&
            !isFocused &&
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
                    onOpen={() => openCompletedHistory(row.id)}
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
              id="checklist-current-stop"
              ref={(node) => {
                if (node) rowElsRef.current.set(row.id, node);
                else rowElsRef.current.delete(row.id);
              }}
              aria-checked={row.isCompleted}
              aria-busy={isRowSectionBusy}
              aria-current={isFocused ? "step" : undefined}
              className={[
                "flex scroll-mt-20 flex-col border-b border-rsi-divider/80 sm:scroll-mt-24",
                checklistRowToneClass(row.isCompleted, isFocused),
              ].join(" ")}
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
              <div className="flex min-h-0 flex-1 flex-col px-3 pt-4.5 pb-1">
                <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:gap-4">
                      <div className="min-w-0 lg:flex-1">
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
                      </div>
                      <div className="min-w-0 lg:flex-1 lg:pt-0.5">
                        {nextLocationSlug == null &&
                        nextLocationName == null ? (
                          <FinishRunTile
                            location={location}
                            step={step}
                            isCompleted={row.isCompleted}
                            isActive={isFocused}
                            isPending={isPendingComplete}
                            onToggle={toggleStopDone}
                            onOpenSummary={onOpenSummary}
                          />
                        ) : (
                          <NextDistanceMeta
                            row={row}
                            nextLocationName={nextLocationName}
                            nextLocationSlug={nextLocationSlug}
                            shipSlug={shipSlug}
                            variant="header"
                            isPending={isPendingComplete}
                            locationLabel={location}
                            step={step}
                            isActive={isFocused}
                            onToggle={toggleStopDone}
                          />
                        )}
                      </div>
                    </div>
                    <div className="mt-5 overflow-x-clip pb-5">
                      <CargoGroups
                        row={row}
                        cargoLines={cargoLines}
                        missions={missions}
                        location={location}
                        shipName={transferShipName}
                        shipSlug={shipSlug}
                        sessionId={sessionId}
                        prioritizePickup={prioritizePickup}
                        transferLedger={
                          transferLedgerByStop.get(row.id) ?? null
                        }
                        pendingCargoKeys={pendingCargoKeys}
                        onToggleCargoHandled={
                          onToggleCargoHandled
                            ? handleCargoToggle
                            : undefined
                        }
                        onSkipPickup={
                          onSkipPickupAtStop && !row.isCompleted
                            ? (missionId, commoditySlug) => {
                                const key = `${missionId}::${commoditySlug}::${row.locationSlug}`;
                                if (pendingSkipPickupKeys.has(key)) return;
                                if (
                                  skippablePickupKeys &&
                                  !skippablePickupKeys.has(key)
                                ) {
                                  return;
                                }
                                setPendingSkipPickupKeys((prev) => {
                                  const next = new Set(prev);
                                  next.add(key);
                                  return next;
                                });
                                void Promise.resolve(
                                  onSkipPickupAtStop({
                                    missionId,
                                    commoditySlug,
                                    locationSlug: row.locationSlug,
                                  }),
                                ).finally(() => {
                                  setPendingSkipPickupKeys((prev) => {
                                    const next = new Set(prev);
                                    next.delete(key);
                                    return next;
                                  });
                                });
                              }
                            : undefined
                        }
                        canSkipPickup={
                          onSkipPickupAtStop &&
                          !row.isCompleted &&
                          skippablePickupKeys
                            ? (missionId, commoditySlug) =>
                                skippablePickupKeys.has(
                                  `${missionId}::${commoditySlug}::${row.locationSlug}`,
                                )
                            : undefined
                        }
                        pendingSkipPickupKeys={
                          pendingSkipPickupKeys.size > 0
                            ? pendingSkipPickupKeys
                            : undefined
                        }
                        onAddPickup={
                          onSetPickupScuAtStop && !row.isCompleted
                            ? (missionId, commoditySlug, scu) => {
                                queueSetStopScuAtStop(
                                  "pickup",
                                  row.locationSlug,
                                  missionId,
                                  commoditySlug,
                                  scu,
                                );
                              }
                            : undefined
                        }
                        pendingAddPickupKeys={
                          pendingAddPickupKeys.size > 0
                            ? pendingAddPickupKeys
                            : undefined
                        }
                        onSetPickupScu={
                          onSetPickupScuAtStop && !row.isCompleted
                            ? (missionId, commoditySlug, scu) => {
                                queueSetStopScuAtStop(
                                  "pickup",
                                  row.locationSlug,
                                  missionId,
                                  commoditySlug,
                                  scu,
                                );
                              }
                            : undefined
                        }
                        pendingSetPickupScuKeys={
                          pendingAddPickupKeys.size > 0
                            ? pendingAddPickupKeys
                            : undefined
                        }
                        bayAside={(role) => (
                          <StopDeliveryBayPreview
                            row={row}
                            rows={rows}
                            missions={missions}
                            role={role}
                            onSetCargoRoleHandled={
                              onSetCargoRoleHandled
                                ? (cargoRole, handled) => {
                                    handleSetCargoRoleHandled(
                                      row.id,
                                      cargoRole,
                                      handled,
                                    );
                                  }
                                : undefined
                            }
                            pendingCargoRoleKeys={
                              pendingCargoRoleKeys.size > 0
                                ? new Set(
                                    (["pickup", "delivery"] as const).filter(
                                      (cargoRole) =>
                                        pendingCargoRoleKeys.has(
                                          cargoRolePendingKey(
                                            row.id,
                                            cargoRole,
                                          ),
                                        ),
                                    ),
                                  )
                                : undefined
                            }
                            onEditMissionBoxes={
                              onSelectBoxBreakdown
                                ? (missionId: string) => {
                                    const mission = missions.find(
                                      (entry) => entry.id === missionId,
                                    );
                                    // Completed missions still open (modal is read-only).
                                    if (!mission) return;
                                    setBoxEditMissionId(missionId);
                                  }
                                : undefined
                            }
                            onSetPickupScu={
                              onSetPickupScuAtStop && !row.isCompleted
                                ? (missionId, commoditySlug, scu) => {
                                    queueSetStopScuAtStop(
                                      "pickup",
                                      row.locationSlug,
                                      missionId,
                                      commoditySlug,
                                      scu,
                                    );
                                  }
                                : undefined
                            }
                            onSetDeliveryScu={
                              onSetDeliveryScuAtStop && !row.isCompleted
                                ? (missionId, commoditySlug, scu) => {
                                    queueSetStopScuAtStop(
                                      "delivery",
                                      row.locationSlug,
                                      missionId,
                                      commoditySlug,
                                      scu,
                                    );
                                  }
                                : undefined
                            }
                            pendingSetStopScuKeys={
                              pendingAddPickupKeys.size > 0
                                ? pendingAddPickupKeys
                                : undefined
                            }
                          />
                        )}
                      />
                    </div>
                    {/* Same lg split as transfer + pad so width matches Pick up / Drop off. */}
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
                </div>
                {addStopFooter(row.id)}
              </div>
            </li>
            {draftingAfterRowId === row.id ? draftComposer : null}
            </Fragment>
          );
        })}
    </ul>
  );

  const showStopsRailSlot = isLoading || showProgressTimeline;

  return (
    <div className="flex min-w-0 max-w-full flex-col gap-4">
      {aboveChecklist ? (
        <div className="flex min-w-0 max-w-full items-start gap-4">
          {showStopsRailSlot ? (
            <div
              aria-hidden
              className="hidden w-[8.75rem] shrink-0 lg:block"
            />
          ) : null}
          <div className="flex min-w-0 max-w-full flex-1 flex-col gap-4">
            {aboveChecklist}
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <ChecklistStopsSkeleton />
      ) : (
        <div className="flex min-w-0 max-w-full items-start gap-4">
          {showProgressTimeline ? (
            <ChecklistProgressRail
              stops={progressStops}
              progressDone={progressDone}
              progressTotal={progressTotal}
              matchHeightEl={checklistPanelEl}
              onSelectStop={onSelectProgressStop}
              onOpenStops={onOpenStops}
              distanceTraveled={distanceTraveled}
              distanceTotal={distanceTotal}
            />
          ) : null}

          <div
            ref={setChecklistPanelEl}
            className="flex min-w-0 max-w-full flex-1 flex-col gap-1.5"
          >
            {toolbar}
            <div className="min-w-0 max-w-full flex-1 rounded-rsi border border-rsi-border bg-rsi-surface/90 shadow-rsi-panel">
              {checklistBody}
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
          </div>
        </div>
      )}
    </div>
  );
});
