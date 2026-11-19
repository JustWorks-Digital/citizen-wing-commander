"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  activateChecklistSession,
  copyChecklistSession,
  createChecklistSession,
  deleteChecklistSession,
  fetchChecklist,
  fetchChecklistSessions,
  saveChecklist,
} from "@/lib/api/checklistApi";
import {
  fetchSelectableShips,
  type CatalogShip,
} from "@/lib/api/shipsApi";
import { appPaths } from "@/lib/appPaths";
import { useSessionMissionActions } from "@/hooks/useSessionMissionActions";
import { useSessionRouteEdits } from "@/hooks/useSessionRouteEdits";
import { useSyncCatalogBoxSplits } from "@/hooks/useSyncCatalogBoxSplits";
import { Button } from "@/components/ui/Button";
import { LocationFuzzySearch } from "@/components/ui/LocationFuzzySearch";
import { ShipSelect } from "@/components/ui/ShipSelect";
import {
  getLocationBySlug,
  getShipBySlug,
  sumShipCargoScu,
} from "@/lib/fixtures";
import { getCargoGridSketchBySlug } from "@/lib/ships/cargoGrids";
import {
  applySessionCompletionTiming,
  areAllLegsComplete,
  emptySessionChecklist,
  finishSessionAsCrash,
  formatSessionDuration,
  getSessionElapsedMs,
  isSessionFinished,
  summarizeSessionChecklist,
  type SessionChecklist,
  type SessionTabSummary,
} from "@/lib/missions/sessionChecklist";
import { TripCrashFinishModal } from "@/components/missions/TripCrashFinishModal";
import { cargoInventory } from "@/lib/missions/cargoInventory";
import {
  applyCompletedMissionStopState,
  rebuildRowsFromMissions,
  restampAllMissionBoxSizes,
} from "@/lib/missions/rebuildSessionRoute";
import { SELECTABLE_SHIP_SLUGS } from "@/lib/ships/selectableShips";
import { SessionCreatedLabel } from "./SessionCreatedLabel";
import {
  defaultFocusedStopId,
  MissionChecklistTable,
  needsQuantumOriginRow,
  QUANTUM_ORIGIN_ROW_ID,
} from "./checklist/MissionChecklistTable";
import { SessionCatalogMissionsPanel } from "./SessionCatalogMissionsPanel";
import { SessionMissionsModal } from "./SessionMissionsModal";
import { TripPlanInvalidBanner } from "./TripPlanInvalidBanner";
import { buildRouteStopTimeline } from "@/lib/missions/routeStopTimeline";
import {
  checklistRowsFromTripPlan,
  contractLegsFromChecklistRows,
  optimizeTrip,
  validateChecklistTripCargo,
} from "@/lib/missions/tripPlan";
import {
  mergePreservedQuantumRows,
  recomputeDistances,
} from "@/lib/missions/quantumTravel";
import { fetchSessionScreenshots } from "@/lib/api/screenshotsApi";
import { SessionScreenshotsPanel } from "./SessionScreenshotsPanel";
import { SessionElapsedLabel } from "./SessionElapsedLabel";
import { SessionCargoLayoutModal } from "./SessionCargoLayoutModal";
import { SessionStopsTimelineModal } from "./SessionStopsTimelineModal";
import { RouteChecklistMenu } from "./RouteChecklistMenu";
import {
  readPrioritizePickup,
  writePrioritizePickup,
} from "@/lib/sessions/prioritizePickupPrefs";
import { sessionMissionsAuecProgress } from "@/lib/missions/sessionMissionObjectives";
import { estimateMissionHaulingRepXp } from "@/lib/missions/haulingRepXp";
import {
  SessionInventoryStat,
  RouteTripOverflowStats,
  SessionRouteProgressStats,
} from "./SessionStatsStrip";
import { CreateSessionModal } from "./CreateSessionModal";
import { SessionNameField } from "./SessionNameField";
import { SessionTabs } from "./SessionTabs";
import { SessionTripSideNav } from "./SessionTripSideNav";
import {
  readSessionTripNavOpen,
  writeSessionTripNavOpen,
} from "@/lib/sessions/sessionTripNavPrefs";

export type SessionChecklistViewProps = {
  /** Route param — which session this page is showing. */
  sessionId?: string;
  /** Storybook / offline override (skips network). */
  initial?: SessionChecklist;
};

/** Near-live while the tab is focused; slower when backgrounded. */
const POLL_VISIBLE_MS = 1500;
/** While Contracts / catalog modals are open, poll less so list scroll stays smooth. */
const POLL_MODAL_MS = 8000;
const POLL_HIDDEN_MS = 12000;

export function SessionChecklistView({
  sessionId: routeSessionId,
  initial,
}: SessionChecklistViewProps) {
  const router = useRouter();
  const [session, setSession] = useState<SessionChecklist>(
    initial ??
      emptySessionChecklist({
        id: routeSessionId,
        sessionName: "Loading…",
        // Epoch stamps so SSR/client match and poll staleness never prefers the placeholder.
        startedAt: "1970-01-01T00:00:00.000Z",
        updatedAt: "1970-01-01T00:00:00.000Z",
      }),
  );
  const [tabs, setTabs] = useState<SessionTabSummary[]>(
    initial ? [summarizeSessionChecklist(initial)] : [],
  );
  const [activeSessionId, setActiveSessionId] = useState<string | null>(
    initial?.id ?? routeSessionId ?? null,
  );
  const [tabsBusy, setTabsBusy] = useState(false);
  const [createSessionOpen, setCreateSessionOpen] = useState(false);
  const [crashFinishOpen, setCrashFinishOpen] = useState(false);
  const [crashFinishBusy, setCrashFinishBusy] = useState(false);
  const [hideCompleted, setHideCompleted] = useState(false);
  const [prioritizePickup, setPrioritizePickup] = useState(false);
  const [prioritizePickupReady, setPrioritizePickupReady] = useState(false);
  /** After Continue on the finish report, show the last completed stop again. */
  const [summaryDismissed, setSummaryDismissed] = useState(false);
  const [missionsOpen, setMissionsOpen] = useState(false);
  const [missionsFocusId, setMissionsFocusId] = useState<string | null>(null);
  const [stopsOpen, setStopsOpen] = useState(false);
  const [cargoLayoutOpen, setCargoLayoutOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [screenshotsOpen, setScreenshotsOpen] = useState(false);
  /** Default until mount — avoid localStorage in useState (SSR hydration mismatch). */
  const [tripNavOpen, setTripNavOpen] = useState(true);
  const [tripNavPrefsReady, setTripNavPrefsReady] = useState(false);
  const [pendingScreenshotCount, setPendingScreenshotCount] = useState(0);
  const [focusedStopId, setFocusedStopId] = useState<string | null>(null);
  /** Synthetic start → first-stop quantum marked done (feeds Distance traveled). */
  const [quantumOriginDeparted, setQuantumOriginDeparted] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tripRepairBusy, setTripRepairBusy] = useState(false);
  const [tripRepairError, setTripRepairError] = useState<string | null>(null);
  /** After Dismiss on the invalid banner, Repair lives in the sticky ⋯ menu. */
  const [tripInvalidDismissed, setTripInvalidDismissed] = useState(false);
  const [saveInFlight, setSaveInFlight] = useState(0);
  const [shipCatalog, setShipCatalog] = useState<CatalogShip[]>([]);
  const [shipsLoading, setShipsLoading] = useState(true);
  const [shipsError, setShipsError] = useState<string | null>(null);
  const etagRef = useRef<string | null>(null);
  const savingRef = useRef(false);
  /** Monotonic id so an older PUT cannot overwrite a newer optimistic Done click. */
  const persistGenerationRef = useRef(0);
  /** False until the first successful GET for this route id (loading placeholder must not win the poll race). */
  const hydratedFromServerRef = useRef(Boolean(initial));
  /** Drives trip-table spinner until the first hydrate (or first-load failure). */
  const [isTripLoading, setIsTripLoading] = useState(!initial);
  const sessionRef = useRef(session);
  const activeIdRef = useRef(activeSessionId);
  const routerRef = useRef(router);
  const overlayOpenRef = useRef(false);
  sessionRef.current = session;
  activeIdRef.current = activeSessionId;
  routerRef.current = router;
  overlayOpenRef.current = missionsOpen || catalogOpen;

  useEffect(() => {
    if (initial) return;
    let cancelled = false;
    void fetchSessionScreenshots(session.id)
      .then((result) => {
        if (!cancelled) {
          setPendingScreenshotCount(result.pendingCount ?? 0);
        }
      })
      .catch(() => {
        if (!cancelled) setPendingScreenshotCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [session.id, screenshotsOpen, initial]);

  useEffect(() => {
    let cancelled = false;
    setShipsLoading(true);
    void fetchSelectableShips()
      .then((ships) => {
        if (cancelled) return;
        setShipCatalog(ships);
        setShipsError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        setShipsError(
          error instanceof Error ? error.message : "Failed to load ships",
        );
        // Offline / Storybook fallback from fixtures.
        setShipCatalog(
          SELECTABLE_SHIP_SLUGS.flatMap((slug) => {
            const ship = getShipBySlug(slug);
            if (!ship) return [];
            return [
              {
                id: ship.id,
                slug: ship.slug,
                name: ship.name,
                nameFull: ship.nameFull,
                manufacturer: ship.manufacturer,
                cargoScu: ship.cargoScu,
                isCargo: ship.isCargo,
                containerSizes: ship.containerSizes,
              },
            ];
          }),
        );
      })
      .finally(() => {
        if (!cancelled) setShipsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (initial) return;
    if (!routeSessionId) return;

    setActiveSessionId(routeSessionId);
    activeIdRef.current = routeSessionId;
    etagRef.current = null;
    // Only swap to a Loading placeholder when the route id changes — do not clear
    // a just-applied remote body if this effect restarts for other reasons.
    if (sessionRef.current.id !== routeSessionId) {
      hydratedFromServerRef.current = false;
      setIsTripLoading(true);
      setSession(
        emptySessionChecklist({
          id: routeSessionId,
          sessionName: "Loading…",
          startedAt: "1970-01-01T00:00:00.000Z",
          updatedAt: "1970-01-01T00:00:00.000Z",
        }),
      );
    }

    let cancelled = false;
    let timer: number | null = null;

    const schedule = () => {
      if (cancelled) return;
      if (timer != null) window.clearTimeout(timer);
      const delay =
        document.visibilityState !== "visible"
          ? POLL_HIDDEN_MS
          : overlayOpenRef.current
            ? POLL_MODAL_MS
            : POLL_VISIBLE_MS;
      timer = window.setTimeout(() => {
        void load().finally(schedule);
      }, delay);
    };

    const refreshTabs = async () => {
      const list = await fetchChecklistSessions();
      if (cancelled) return;
      setTabs((prev) => {
        if (
          prev.length === list.sessions.length &&
          prev.every((tab, index) => {
            const next = list.sessions[index];
            return (
              next != null &&
              tab.id === next.id &&
              tab.sessionName === next.sessionName &&
              tab.updatedAt === next.updatedAt &&
              tab.missionCount === next.missionCount &&
              tab.rowCount === next.rowCount &&
              (tab.shipSlugs ?? []).join("\0") ===
                (next.shipSlugs ?? []).join("\0")
            );
          })
        ) {
          return prev;
        }
        return list.sessions;
      });
      const stillExists = list.sessions.some(
        (tab) => tab.id === routeSessionId,
      );
      if (!stillExists && list.activeSessionId) {
        routerRef.current.replace(appPaths.session(list.activeSessionId));
      }
    };

    const applyRemote = (next: SessionChecklist) => {
      if (savingRef.current) return;
      if (next.id !== routeSessionId) return;
      const current = sessionRef.current;
      // Skip until first hydrate — empty placeholder stamps updatedAt=now and would
      // permanently drop a slightly older server body.
      if (
        hydratedFromServerRef.current &&
        current.id === next.id &&
        current.updatedAt &&
        next.updatedAt
      ) {
        if (next.updatedAt === current.updatedAt) return;
        const remoteMs = Date.parse(next.updatedAt);
        const localMs = Date.parse(current.updatedAt);
        // Drop in-flight poll bodies that raced behind a local Reset / save.
        if (
          Number.isFinite(remoteMs) &&
          Number.isFinite(localMs) &&
          remoteMs < localMs
        ) {
          return;
        }
      }
      hydratedFromServerRef.current = true;
      setIsTripLoading(false);
      setSession(next);
      setActiveSessionId(next.id);
      setLoadError(null);
    };

    const load = async () => {
      try {
        await refreshTabs();
        if (cancelled) return;
        const result = await fetchChecklist(etagRef.current, routeSessionId);
        if (cancelled) return;
        if (result.etag) etagRef.current = result.etag;
        if (!result.notModified && result.session) {
          applyRemote(result.session);
        } else if (
          !hydratedFromServerRef.current &&
          result.notModified &&
          !result.session
        ) {
          // First GET returned 304 with no body — stop the placeholder spinner.
          hydratedFromServerRef.current = true;
          setIsTripLoading(false);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error ? error.message : "Failed to load checklist",
          );
          if (!hydratedFromServerRef.current) {
            setIsTripLoading(false);
          }
        }
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void load();
        schedule();
      }
    };

    void activateChecklistSession(routeSessionId).catch(() => {
      /* selection is best-effort; GET still works by id */
    });
    void load().finally(schedule);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      if (timer != null) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // router via routerRef — unstable identity must not cancel in-flight hydrate.
  }, [initial, routeSessionId]);

  useEffect(() => {
    setFocusedStopId(null);
    setQuantumOriginDeparted(false);
  }, [session.id]);

  useEffect(() => {
    setQuantumOriginDeparted(false);
  }, [
    session.startLocationSlug,
    session.rows[0]?.id,
    session.rows[0]?.locationSlug,
  ]);

  const resolvedFocusedStopId = useMemo(() => {
    const canFocusQuantum =
      focusedStopId === QUANTUM_ORIGIN_ROW_ID &&
      needsQuantumOriginRow(
        session.rows,
        session.startLocationSlug ?? null,
      );
    if (
      focusedStopId &&
      (canFocusQuantum ||
        session.rows.some((row) => row.id === focusedStopId))
    ) {
      return focusedStopId;
    }
    return defaultFocusedStopId(
      session.rows,
      session.startLocationSlug ?? null,
    );
  }, [focusedStopId, session.rows, session.startLocationSlug]);

  const selectedShipSlug = session.shipSlugs?.[0] ?? null;
  const tripName = session.sessionName?.trim() ?? "";
  /** Name + start + ship filled — trip chrome becomes a button-triggered modal. */
  const isTripSetupComplete =
    Boolean(tripName) &&
    tripName !== "Loading…" &&
    Boolean(session.startLocationSlug) &&
    Boolean(selectedShipSlug);
  const tripSetupCompleteRef = useRef<boolean | null>(null);
  const shipBySlug = new Map(shipCatalog.map((ship) => [ship.slug, ship]));
  const selectedShipName =
    (selectedShipSlug
      ? shipBySlug.get(selectedShipSlug)?.name ??
        getShipBySlug(selectedShipSlug)?.name
      : null) ?? null;
  const cargoBayCount = useMemo(() => {
    const sketch = getCargoGridSketchBySlug(selectedShipSlug);
    if (!sketch) return 1;
    const holds = sketch.zones.filter((zone) => zone.kind === "cargo").length;
    return Math.max(1, holds);
  }, [selectedShipSlug]);
  const totalCapacity =
    session.shipSlugs?.reduce((total, slug) => {
      const fromCatalog = shipBySlug.get(slug)?.cargoScu;
      if (typeof fromCatalog === "number") return total + fromCatalog;
      return total + (getShipBySlug(slug)?.cargoScu ?? 0);
    }, 0) ?? sumShipCargoScu(session.shipSlugs ?? []);
  const onboardScu = cargoInventory.fromCompleted(session.rows);
  const peakScu = cargoInventory.peakOnboard(session.rows);
  const missionScuBreakdown = cargoInventory.missionBreakdown(
    session.missions,
  );
  const missionsTotalScu = cargoInventory.missionsTotal(
    session.missions,
    session.rows,
  );
  const isOverCapacity =
    totalCapacity > 0 && onboardScu > totalCapacity;
  /** Remaining bay for more missions vs planned peak load. */
  const availableScu =
    totalCapacity > 0 ? totalCapacity - peakScu : null;
  const totalLegs = session.rows.length;
  const completedLegs = session.rows.filter((row) => row.isCompleted).length;
  const isTripComplete = areAllLegsComplete(session.rows);

  useEffect(() => {
    setTripNavOpen(readSessionTripNavOpen());
    setTripNavPrefsReady(true);
    setPrioritizePickup(readPrioritizePickup());
    setPrioritizePickupReady(true);
  }, []);

  useEffect(() => {
    if (!tripNavPrefsReady) return;
    writeSessionTripNavOpen(tripNavOpen);
  }, [tripNavOpen, tripNavPrefsReady]);

  useEffect(() => {
    if (!prioritizePickupReady) return;
    writePrioritizePickup(prioritizePickup);
  }, [prioritizePickup, prioritizePickupReady]);

  // After the user finishes name / start / ship, collapse to the Setup button
  // (do not leave the setup panel open as a modal).
  useEffect(() => {
    if (
      tripSetupCompleteRef.current === false &&
      isTripSetupComplete
    ) {
      setTripNavOpen(false);
    }
    tripSetupCompleteRef.current = isTripSetupComplete;
  }, [isTripSetupComplete]);

  useEffect(() => {
    if (!isTripComplete) setSummaryDismissed(false);
  }, [isTripComplete]);

  useEffect(() => {
    setSummaryDismissed(false);
    setHideCompleted(false);
  }, [session.id]);

  const openTripSummary = useCallback(() => {
    setSummaryDismissed(false);
    // Wait a frame so the panel mounts before scrolling.
    requestAnimationFrame(() => {
      document
        .getElementById("trip-complete-summary")
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, []);

  const dismissTripSummary = useCallback(() => {
    const lastStop = session.rows[session.rows.length - 1];
    if (lastStop) setFocusedStopId(lastStop.id);
    setSummaryDismissed(true);
  }, [session.rows]);

  const tripElapsedLabel = useMemo(
    () =>
      formatSessionDuration(
        getSessionElapsedMs({
          startedAt: session.startedAt,
          completedAt: session.completedAt,
        }),
      ),
    [session.startedAt, session.completedAt],
  );
  const startLocation = session.startLocationSlug
    ? getLocationBySlug(session.startLocationSlug)
    : undefined;

  const persistSession = useCallback((next: SessionChecklist) => {
    // Never PUT the Loading… placeholder — that would wipe a real trip.
    if (!initial && !hydratedFromServerRef.current) {
      return Promise.resolve();
    }
    savingRef.current = true;
    setSaveInFlight((count) => count + 1);
    const persistGeneration = ++persistGenerationRef.current;
    // Stamp locally so in-flight polls can't overwrite with a pre-save body.
    const stamped: SessionChecklist = {
      ...next,
      updatedAt: new Date().toISOString(),
    };
    // Optimistic UI first; defer server echo so packing / grid don't re-run twice urgently.
    setSession(stamped);
    return saveChecklist(stamped)
      .then((result) => {
        // Server updatedAt is always "now", so a slower earlier PUT can look newer.
        // Only the latest persist generation may apply its echo.
        if (persistGeneration !== persistGenerationRef.current) return;
        etagRef.current = result.etag;
        startTransition(() => {
          setSession(result.session);
          setTabs((prev) =>
            prev.map((tab) =>
              tab.id === result.session.id
                ? {
                    ...tab,
                    sessionName: result.session.sessionName,
                    updatedAt: result.session.updatedAt,
                    missionCount: result.session.missionCount,
                    rowCount: result.session.rows.length,
                    shipSlugs: result.session.shipSlugs ?? [],
                  }
                : tab,
            ),
          );
        });
        setLoadError(null);
      })
      .catch(() => {
        if (persistGeneration !== persistGenerationRef.current) return;
        setLoadError("Failed to save checklist");
      })
      .finally(() => {
        setSaveInFlight((count) => {
          const next = Math.max(0, count - 1);
          savingRef.current = next > 0;
          return next;
        });
      });
  }, [initial]);

  const openMissions = useCallback((missionId?: string) => {
    setMissionsFocusId(typeof missionId === "string" ? missionId : null);
    setMissionsOpen(true);
  }, []);
  const closeMissions = useCallback(() => {
    setMissionsOpen(false);
    setMissionsFocusId(null);
  }, []);
  const {
    handleMissionToggleHidden,
    handleMissionToggleCompleted,
    handleMissionRemove,
  } = useSessionMissionActions({
    sessionRef,
    persistSession,
    setLoadError,
  });
  const syncCatalogBoxSplits = useSyncCatalogBoxSplits({
    sessionRef,
    persistSession,
    setLoadError,
  });
  const {
    onToggleCargoHandled,
    onSetCargoRoleHandled,
    onToggleStop,
    onInsertQuantumTravel,
    onUpdateQuantumTravel,
    applyBoxBreakdown,
    applyMissionScuDraft,
    skipPickupAtStop,
    setPickupScuAtStop,
    setDeliveryScuAtStop,
    onReorderStops,
    onResetTrip,
  } = useSessionRouteEdits({
    sessionRef,
    persistSession,
    setLoadError,
    setQuantumOriginDeparted,
    syncCatalogBoxSplits,
  });
  const openStops = useCallback(() => setStopsOpen(true), []);
  const closeStops = useCallback(() => setStopsOpen(false), []);
  const openCargoLayout = useCallback(() => setCargoLayoutOpen(true), []);
  const closeCargoLayout = useCallback(() => setCargoLayoutOpen(false), []);

  const inventoryAside = useMemo(
    () => (
      <SessionInventoryStat
        onboardScu={onboardScu}
        peakScu={peakScu}
        missionsTotalScu={missionsTotalScu}
        missionScuBreakdown={missionScuBreakdown}
        sessionId={session.id}
        totalCapacity={totalCapacity}
        availableScu={availableScu}
        isOverCapacity={isOverCapacity}
      />
    ),
    [
      onboardScu,
      peakScu,
      missionsTotalScu,
      missionScuBreakdown,
      session.id,
      totalCapacity,
      availableScu,
      isOverCapacity,
    ],
  );

  const toggleCargoLayout = useCallback(() => {
    setCargoLayoutOpen((open) => !open);
  }, []);
  const toggleStops = useCallback(() => {
    setStopsOpen((open) => !open);
  }, []);
  const toggleMissions = useCallback(() => {
    setMissionsFocusId(null);
    setMissionsOpen((open) => !open);
  }, []);

  const { auecEarned, auecProjected } = useMemo(
    () => sessionMissionsAuecProgress(session.missions ?? []),
    [session.missions],
  );

  const xpEarned = useMemo(() => {
    return (session.missions ?? [])
      .filter((mission) => !mission.isHidden && mission.isCompleted)
      .reduce(
        (sum, mission) => sum + (estimateMissionHaulingRepXp(mission) ?? 0),
        0,
      );
  }, [session.missions]);

  const isStartLegCompleted =
    quantumOriginDeparted || session.rows.some((row) => row.isCompleted);

  const routeDistance = useMemo(() => {
    const timeline = buildRouteStopTimeline({
      rows: session.rows,
      startLocationSlug: session.startLocationSlug ?? null,
      isStartCompleted: isStartLegCompleted,
    });
    return {
      traveled: timeline.traveled,
      total: timeline.total,
    };
  }, [session.rows, session.startLocationSlug, isStartLegCompleted]);

  const elapsedSession = useMemo(
    () => ({
      startedAt: session.startedAt,
      completedAt: session.completedAt,
    }),
    [session.startedAt, session.completedAt],
  );

  const routeProgressStats = useMemo(
    () => (
      <SessionRouteProgressStats
        completedLegs={completedLegs}
        totalLegs={totalLegs}
        missionsCompleted={session.missionsCompleted ?? 0}
        missionCount={session.missionCount ?? 0}
        onboardScu={onboardScu}
        peakScu={peakScu}
        totalCapacity={totalCapacity}
        isOverCapacity={isOverCapacity}
        auecEarned={auecEarned}
        auecProjected={auecProjected}
        onMissionsClick={openMissions}
        onCapacityClick={openCargoLayout}
        cargoBayCount={cargoBayCount}
        elapsed={<SessionElapsedLabel session={elapsedSession} variant="value" />}
        isSaving={saveInFlight > 0}
      />
    ),
    [
      completedLegs,
      totalLegs,
      session.missionsCompleted,
      session.missionCount,
      onboardScu,
      peakScu,
      totalCapacity,
      isOverCapacity,
      auecEarned,
      auecProjected,
      openMissions,
      openCargoLayout,
      cargoBayCount,
      elapsedSession,
      saveInFlight,
    ],
  );

  const tripOverflowStats = useMemo(
    () => (
      <RouteTripOverflowStats
        auecEarned={auecEarned}
        auecProjected={auecProjected}
      />
    ),
    [auecEarned, auecProjected],
  );

  const onOpenContracts = useCallback(
    (missionId?: string) => {
      if (missionId) openMissions(missionId);
      else toggleMissions();
    },
    [openMissions, toggleMissions],
  );

  const tripCargoValidation = useMemo(
    () =>
      validateChecklistTripCargo(
        session.rows,
        session.startLocationSlug ?? null,
      ),
    [session.rows, session.startLocationSlug],
  );

  useEffect(() => {
    if (tripCargoValidation.ok) {
      setTripRepairError(null);
      setTripInvalidDismissed(false);
    }
  }, [tripCargoValidation.ok]);

  const repairInvalidTrip = useCallback(() => {
    const current = sessionRef.current;
    setTripRepairBusy(true);
    setTripRepairError(null);
    try {
      // Prefer rebuilding from session missions so orphan contracts (on the
      // list but missing from cargo missionIds) get wired back onto the route.
      // Include completed contracts so Repair does not wipe Done work off the table.
      const missions = current.missions ?? [];
      const fromMissions = rebuildRowsFromMissions(current, missions, {
        includeCompleted: true,
      });
      if (fromMissions.ok) {
        const validation = validateChecklistTripCargo(
          fromMissions.session.rows,
          fromMissions.session.startLocationSlug ?? null,
        );
        if (validation.ok) {
          void persistSession(fromMissions.session);
          return;
        }
      }

      // Intake merge order can drop-before-load; optimize legs for a legal visit order.
      const legs = contractLegsFromChecklistRows(
        fromMissions.ok ? fromMissions.session.rows : current.rows,
      );
      if (legs.length === 0) {
        setTripRepairError(
          fromMissions.ok
            ? "Rebuilt from contracts but route is still invalid, and no tagged cargo legs were available to optimize."
            : "No contract cargo legs found to rebuild from.",
        );
        return;
      }
      const result = optimizeTrip(legs, current.startLocationSlug ?? null);
      if (!result.ok) {
        setTripRepairError(
          result.issues[0]
            ? `Still invalid after repair (${result.issues[0].locationSlug}).`
            : "Could not build a valid route from these contracts.",
        );
        return;
      }
      const optimized = applySessionCompletionTiming({
        ...(fromMissions.ok ? fromMissions.session : current),
        missions,
        rows: recomputeDistances(
          mergePreservedQuantumRows(
            current.rows,
            checklistRowsFromTripPlan(result.plan),
          ),
        ),
      });
      const stamped = restampAllMissionBoxSizes(optimized);
      void persistSession({
        ...stamped,
        rows: applyCompletedMissionStopState(
          stamped.rows,
          stamped.missions ?? missions,
        ),
      });
    } finally {
      setTripRepairBusy(false);
    }
  }, [persistSession]);

  const selectSession = async (nextSessionId: string) => {
    if (initial || nextSessionId === routeSessionId) return;
    setTabsBusy(true);
    try {
      await activateChecklistSession(nextSessionId);
      router.push(appPaths.session(nextSessionId));
      setLoadError(null);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Failed to switch trip",
      );
    } finally {
      setTabsBusy(false);
    }
  };

  const addSession = async (sessionName: string) => {
    if (initial) return;
    setTabsBusy(true);
    try {
      const next = await createChecklistSession({
        sessionName: sessionName.trim() || "New trip",
      });
      setCreateSessionOpen(false);
      router.push(appPaths.session(next.id));
      setLoadError(null);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Failed to create trip",
      );
    } finally {
      setTabsBusy(false);
    }
  };

  const renameSession = (sessionName: string) => {
    const next = sessionName.trim();
    if (!next || next === session.sessionName) return;
    persistSession(
      applySessionCompletionTiming({
        ...session,
        sessionName: next,
      }),
    );
  };

  const tripSetupHeader = (
    <div className="flex min-w-0 items-end justify-between gap-3">
      <div className="min-w-0 flex-1 pr-2">
        <p className="whitespace-nowrap font-mono text-[0.6rem] tracking-wide text-rsi-text-muted">
          ID {session.id}
        </p>
        <SessionCreatedLabel
          className="mt-0.5"
          createdAt={
            tabs.find((tab) => tab.id === session.id)?.createdAt ??
            session.startedAt
          }
        />
      </div>
      <Button
        type="button"
        variant="secondary"
        title={
          pendingScreenshotCount > 0
            ? `${pendingScreenshotCount} pending Source shot${pendingScreenshotCount === 1 ? "" : "s"} for AI`
            : "Contract screenshots (Source)"
        }
        onClick={() => setScreenshotsOpen(true)}
        className="h-7 shrink-0 px-2.5 py-0 text-[0.55rem] tracking-[0.14em]"
      >
        Source
        {pendingScreenshotCount > 0 ? (
          <span className="inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-rsi-accent/25 px-1 font-mono text-[0.55rem] tabular-nums leading-none text-rsi-accent">
            {pendingScreenshotCount}
          </span>
        ) : null}
      </Button>
    </div>
  );

  const tripSetupFields = (
    <>
      <div className="min-w-0">
        <LocationFuzzySearch
          fullWidth
          valueSlug={session.startLocationSlug ?? null}
          onChange={(slug) => {
            persistSession(
              applySessionCompletionTiming({
                ...session,
                shipSlugs: session.shipSlugs ?? [],
                startLocationSlug: slug,
              }),
            );
          }}
        />
        {!session.startLocationSlug ? (
          <p className="mt-1 text-sm text-rsi-text-muted">
            Set where the crew begins so routing can use a start point.
          </p>
        ) : startLocation ? null : (
          <p className="mt-1 text-sm text-rsi-warn">
            Unknown start location slug: {session.startLocationSlug}
          </p>
        )}
      </div>

      <div className="min-w-0">
        <ShipSelect
          fullWidth
          valueSlug={selectedShipSlug}
          options={shipCatalog.map((ship) => ({
            slug: ship.slug,
            name: ship.name,
            cargoScu: ship.cargoScu,
          }))}
          isLoading={shipsLoading}
          error={shipsError}
          onChange={(slug) => {
            persistSession(
              applySessionCompletionTiming({
                ...session,
                shipSlugs: slug ? [slug] : [],
                startLocationSlug: session.startLocationSlug ?? null,
              }),
            );
          }}
        />
      </div>

      {loadError ? (
        <p className="text-sm text-rsi-warn">{loadError}</p>
      ) : null}
    </>
  );

  const closeSession = async (sessionId: string) => {
    if (initial) return;
    setTabsBusy(true);
    try {
      const result = await deleteChecklistSession(sessionId);
      setTabs(result.sessions);
      setActiveSessionId(result.activeSessionId);
      setLoadError(null);
      if (sessionId === routeSessionId || sessionId === session.id) {
        router.push(appPaths.session(result.activeSessionId));
      }
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Failed to close trip",
      );
    } finally {
      setTabsBusy(false);
    }
  };

  const copyTrip = async () => {
    if (initial) return;
    setTabsBusy(true);
    try {
      const next = await copyChecklistSession(session.id);
      const list = await fetchChecklistSessions();
      setTabs(list.sessions);
      setActiveSessionId(list.activeSessionId);
      setLoadError(null);
      router.push(appPaths.session(next.id));
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Failed to copy trip",
      );
    } finally {
      setTabsBusy(false);
    }
  };

  return (
    <div
      className="flex min-w-0 max-w-full flex-col overflow-x-clip"
      data-testid="session-checklist"
      data-session-id={session.id}
    >
      <CreateSessionModal
        open={createSessionOpen}
        isBusy={tabsBusy}
        onClose={() => setCreateSessionOpen(false)}
        onCreate={(name) => {
          void addSession(name);
        }}
      />

      {!isTripLoading && isTripSetupComplete ? (
        <SessionTripSideNav
          presentation="modal"
          open={tripNavOpen}
          onOpenChange={setTripNavOpen}
          header={tripSetupHeader}
        >
          {tripSetupFields}
        </SessionTripSideNav>
      ) : null}

      <TripCrashFinishModal
        open={crashFinishOpen}
        sessionName={session.sessionName}
        isBusy={crashFinishBusy}
        onClose={() => {
          if (crashFinishBusy) return;
          setCrashFinishOpen(false);
        }}
        onConfirm={async (feedback) => {
          if (crashFinishBusy) return;
          setCrashFinishBusy(true);
          try {
            await persistSession(
              finishSessionAsCrash(sessionRef.current, feedback),
            );
            setCrashFinishOpen(false);
          } finally {
            setCrashFinishBusy(false);
          }
        }}
      />

      <MissionChecklistTable
        rows={session.rows}
        focusedStopId={resolvedFocusedStopId}
        onFocusStop={setFocusedStopId}
        shipName={selectedShipName}
        shipSlug={selectedShipSlug}
        missions={session.missions ?? []}
        sessionId={session.id}
        startLocationSlug={session.startLocationSlug ?? null}
        quantumOriginDeparted={quantumOriginDeparted}
        onQuantumOriginDepartedChange={setQuantumOriginDeparted}
        onToggleCargoHandled={onToggleCargoHandled}
        onSetCargoRoleHandled={onSetCargoRoleHandled}
        onInsertQuantumTravel={onInsertQuantumTravel}
        onUpdateQuantumTravel={onUpdateQuantumTravel}
        onOpenCargoBays={toggleCargoLayout}
        onOpenStops={toggleStops}
        onOpenContracts={onOpenContracts}
        onSelectBoxBreakdown={applyBoxBreakdown}
        onSaveMissionScuDraft={applyMissionScuDraft}
        onSkipPickupAtStop={skipPickupAtStop}
        onSetPickupScuAtStop={setPickupScuAtStop}
        onSetDeliveryScuAtStop={setDeliveryScuAtStop}
        isLoading={isTripLoading}
        toolbarStart={routeProgressStats}
        distanceTraveled={routeDistance.traveled}
        distanceTotal={routeDistance.total}
        hideCompleted={hideCompleted}
        onHideCompletedChange={setHideCompleted}
        prioritizePickup={prioritizePickup}
        onOpenSummary={isTripComplete ? openTripSummary : undefined}
        tripSummary={
          isTripComplete && !summaryDismissed
            ? {
                sessionName: session.sessionName,
                elapsedLabel: tripElapsedLabel,
                contractsDone: session.missionsCompleted ?? 0,
                stopsDone: completedLegs,
                peakScu,
                auecEarned,
                xpEarned,
                distanceTotal: routeDistance.total,
                isBusy: tabsBusy,
                onContinue: dismissTripSummary,
                onRunAgain: () => {
                  void copyTrip();
                },
              }
            : null
        }
        onToggle={onToggleStop}
        aboveChecklist={
          <>
            <div className="flex min-w-0 flex-col items-stretch gap-2">
              <div className="flex w-full min-w-0 justify-start">
                <SessionTabs
                  sessions={tabs}
                  activeSessionId={
                    routeSessionId ?? activeSessionId ?? session.id
                  }
                  showActiveTrip={false}
                  onSelect={(id) => {
                    void selectSession(id);
                  }}
                  onCreate={() => {
                    if (initial) return;
                    setCreateSessionOpen(true);
                  }}
                  onClose={(id) => {
                    void closeSession(id);
                  }}
                  isBusy={tabsBusy}
                />
              </div>
              <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-2">
                <SessionNameField
                  name={session.sessionName}
                  disabled={Boolean(initial) || tabsBusy}
                  onRename={renameSession}
                  compact
                  className="max-w-[min(100%,14rem)] sm:max-w-[18rem]"
                />
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  {!isTripLoading && isTripSetupComplete ? (
                    <button
                      type="button"
                      aria-expanded={tripNavOpen}
                      aria-controls="session-trip-panel"
                      title={tripNavOpen ? "Close setup" : "Open setup"}
                      onClick={() => setTripNavOpen((open) => !open)}
                      className={[
                        "inline-flex h-9 shrink-0 items-center rounded-rsi border border-rsi-border bg-rsi-surface/80 px-3 font-mono text-[0.55rem] uppercase tracking-[0.14em] text-rsi-text-secondary transition-colors",
                        "hover:border-rsi-border-strong hover:bg-rsi-surface-raised hover:text-rsi-text",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-rsi-bg",
                        tripNavOpen
                          ? "border-rsi-accent/50 text-rsi-accent"
                          : "",
                      ].join(" ")}
                    >
                      Setup
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setCatalogOpen(true)}
                    className={[
                      "inline-flex h-9 shrink-0 items-center rounded-rsi border border-rsi-border bg-rsi-surface/80 px-3 font-mono text-[0.55rem] uppercase tracking-[0.14em] text-rsi-text-secondary transition-colors",
                      "hover:border-rsi-border-strong hover:bg-rsi-surface-raised hover:text-rsi-text",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-rsi-bg",
                    ].join(" ")}
                  >
                    Find a Contract
                  </button>
                <RouteChecklistMenu
                  hideCompleted={hideCompleted}
                  completedCount={completedLegs}
                  onToggleHistory={() =>
                    setHideCompleted((value) => !value)
                  }
                  prioritizePickup={prioritizePickup}
                  onPrioritizePickupChange={setPrioritizePickup}
                  onCopyTrip={initial ? undefined : copyTrip}
                    onRepairTrip={
                      !tripCargoValidation.ok && tripInvalidDismissed
                        ? repairInvalidTrip
                        : undefined
                    }
                    isRepairingTrip={tripRepairBusy}
                    onLogCrash={
                      initial || isSessionFinished(session)
                        ? undefined
                        : () => setCrashFinishOpen(true)
                    }
                    canLogCrash={!isSessionFinished(session)}
                    onOpenSummary={
                      isTripComplete ? openTripSummary : undefined
                    }
                    overflowStats={tripOverflowStats}
                  />
                </div>
              </div>
            </div>

            {!isTripLoading && !isTripSetupComplete ? (
              <SessionTripSideNav
                presentation="panel"
                forceExpanded
                open
                onOpenChange={setTripNavOpen}
                header={tripSetupHeader}
              >
                {tripSetupFields}
              </SessionTripSideNav>
            ) : null}

            {!tripCargoValidation.ok && !tripInvalidDismissed ? (
              <TripPlanInvalidBanner
                issues={tripCargoValidation.issues}
                isRepairing={tripRepairBusy}
                repairError={tripRepairError}
                onRepair={repairInvalidTrip}
                onDismiss={() => setTripInvalidDismissed(true)}
              />
            ) : null}
          </>
        }
      />

      <SessionScreenshotsPanel
        open={screenshotsOpen}
        sessionId={session.id}
        onClose={() => setScreenshotsOpen(false)}
      />

      <SessionCatalogMissionsPanel
        open={catalogOpen}
        sessionId={session.id}
        sessionName={session.sessionName}
        onClose={() => setCatalogOpen(false)}
        onAdded={(addResult) => {
          if (addResult.sessionId && addResult.sessionId !== session.id) {
            setCatalogOpen(false);
            router.push(appPaths.session(addResult.sessionId));
            return;
          }
          void (async () => {
            try {
              const result = await fetchChecklist(null, session.id);
              if (result.session) {
                if (result.etag) etagRef.current = result.etag;
                setSession(result.session);
                setLoadError(null);
              }
              const list = await fetchChecklistSessions();
              setTabs(list.sessions);
            } catch (error) {
              setLoadError(
                error instanceof Error
                  ? error.message
                  : "Failed to refresh trip",
              );
            }
          })();
        }}
      />

      <SessionStopsTimelineModal
        open={stopsOpen}
        rows={session.rows}
        startLocationSlug={session.startLocationSlug ?? null}
        isStartCompleted={isStartLegCompleted}
        onClose={closeStops}
        onResetTrip={onResetTrip}
        onReorderStops={onReorderStops}
      />

      <SessionCargoLayoutModal
        open={cargoLayoutOpen}
        rows={session.rows}
        shipSlug={selectedShipSlug}
        focusedStopId={resolvedFocusedStopId}
        sessionId={session.id}
        headerAside={inventoryAside}
        onClose={closeCargoLayout}
      />

      <SessionMissionsModal
        open={missionsOpen}
        missions={session.missions ?? []}
        rows={session.rows}
        sessionId={session.id}
        focusMissionId={missionsFocusId}
        onClose={closeMissions}
        onToggleHidden={handleMissionToggleHidden}
        onToggleCompleted={handleMissionToggleCompleted}
        onRemoveMission={handleMissionRemove}
        onSelectBoxBreakdown={applyBoxBreakdown}
        onSaveMissionScuDraft={applyMissionScuDraft}
      />
    </div>
  );
}
