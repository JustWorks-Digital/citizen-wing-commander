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
  createChecklistSession,
  deleteChecklistSession,
  fetchChecklist,
  fetchChecklistSessions,
  saveChecklist,
} from "@/lib/api/checklistApi";
import { updateCatalogMissionScuBoxSplits } from "@/lib/api/catalogMissionsApi";
import {
  fetchSelectableShips,
  type CatalogShip,
} from "@/lib/api/shipsApi";
import type { ScuBoxSplits } from "@/lib/missions/catalogMission";
import { appPaths } from "@/lib/appPaths";
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
  type SessionChecklistModel,
} from "@/lib/missions/mockSession";
import { cargoInventory } from "@/lib/missions/cargoInventory";
import {
  removeMissionAndRebuildRoute,
  setMissionScuBoxSplits,
  setMissionCompletedAndRebuildRoute,
  setMissionHiddenAndRebuildRoute,
} from "@/lib/missions/rebuildSessionRoute";
import { SELECTABLE_SHIP_SLUGS } from "@/lib/ships/selectableShips";
import {
  emptySessionChecklist,
  type SessionTabSummary,
} from "@/lib/missions/sessionChecklist";
import {
  insertQuantumTravelAfter,
  updateChecklistRowLocation,
  updateQuantumTravelEndpoints,
} from "@/lib/missions/quantumTravel";
import {
  reorderChecklistStops,
  resetTripProgress,
} from "@/lib/missions/reorderStops";
import { syncMissionsForStopCompletion } from "@/lib/missions/expectedCompletions";
import { listLocationShops } from "@/lib/fixtures/locationShops";
import {
  defaultFocusedStopId,
  HaulingChecklistTable,
  needsQuantumOriginRow,
  QUANTUM_ORIGIN_ROW_ID,
} from "./HaulingChecklistTable";
import { SessionCatalogMissionsPanel } from "./SessionCatalogMissionsPanel";
import { SessionMissionsModal } from "./SessionMissionsModal";
import { SessionScreenshotsPanel } from "./SessionScreenshotsPanel";
import { SessionElapsedLabel } from "./SessionElapsedLabel";
import { SessionCargoLayoutModal } from "./SessionCargoLayoutModal";
import { SessionStopsTimelineModal } from "./SessionStopsTimelineModal";
import { sessionMissionsAuecProgress } from "@/lib/missions/sessionMissionObjectives";
import {
  SessionContractScuGrid,
  SessionInventoryStat,
  SessionRouteProgressStats,
  SessionSourceStat,
} from "./SessionStatsStrip";
import { CreateSessionModal } from "./CreateSessionModal";
import { SessionNameField } from "./SessionNameField";
import { SessionTabs } from "./SessionTabs";

export type SessionChecklistViewProps = {
  /** Route param — which session this page is showing. */
  sessionId?: string;
  /** Storybook / offline override (skips network). */
  initial?: SessionChecklistModel;
};

/** Near-live while the tab is focused; slower when backgrounded. */
const POLL_VISIBLE_MS = 1500;
const POLL_HIDDEN_MS = 12000;

export function SessionChecklistView({
  sessionId: routeSessionId,
  initial,
}: SessionChecklistViewProps) {
  const router = useRouter();
  const [session, setSession] = useState<SessionChecklistModel>(
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
    initial
      ? [
          {
            id: initial.id,
            sessionName: initial.sessionName,
            updatedAt: initial.updatedAt,
            missionCount: initial.missionCount,
            rowCount: initial.rows.length,
          },
        ]
      : [],
  );
  const [activeSessionId, setActiveSessionId] = useState<string | null>(
    initial?.id ?? routeSessionId ?? null,
  );
  const [tabsBusy, setTabsBusy] = useState(false);
  const [createSessionOpen, setCreateSessionOpen] = useState(false);
  const [missionsOpen, setMissionsOpen] = useState(false);
  const [missionsFocusId, setMissionsFocusId] = useState<string | null>(null);
  const [stopsOpen, setStopsOpen] = useState(false);
  const [cargoLayoutOpen, setCargoLayoutOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [screenshotsOpen, setScreenshotsOpen] = useState(false);
  const [focusedStopId, setFocusedStopId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [shipCatalog, setShipCatalog] = useState<CatalogShip[]>([]);
  const [shipsLoading, setShipsLoading] = useState(true);
  const [shipsError, setShipsError] = useState<string | null>(null);
  const etagRef = useRef<string | null>(null);
  const savingRef = useRef(false);
  /** False until the first successful GET for this route id (loading placeholder must not win the poll race). */
  const hydratedFromServerRef = useRef(Boolean(initial));
  const sessionRef = useRef(session);
  const activeIdRef = useRef(activeSessionId);
  const routerRef = useRef(router);
  sessionRef.current = session;
  activeIdRef.current = activeSessionId;
  routerRef.current = router;

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
        document.visibilityState === "visible"
          ? POLL_VISIBLE_MS
          : POLL_HIDDEN_MS;
      timer = window.setTimeout(() => {
        void load().finally(schedule);
      }, delay);
    };

    const refreshTabs = async () => {
      const list = await fetchChecklistSessions();
      if (cancelled) return;
      setTabs(list.sessions);
      const stillExists = list.sessions.some(
        (tab) => tab.id === routeSessionId,
      );
      if (!stillExists && list.activeSessionId) {
        routerRef.current.replace(appPaths.session(list.activeSessionId));
      }
    };

    const applyRemote = (next: SessionChecklistModel) => {
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
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error ? error.message : "Failed to load checklist",
          );
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
  }, [session.id]);

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
  const startLocation = session.startLocationSlug
    ? getLocationBySlug(session.startLocationSlug)
    : undefined;

  const persistSession = useCallback((next: SessionChecklistModel) => {
    // Never PUT the Loading… placeholder — that would wipe a real trip.
    if (!initial && !hydratedFromServerRef.current) {
      return Promise.resolve();
    }
    savingRef.current = true;
    // Stamp locally so in-flight polls can't overwrite with a pre-save body.
    const stamped: SessionChecklistModel = {
      ...next,
      updatedAt: new Date().toISOString(),
    };
    // Optimistic UI first; defer server echo so packing / grid don't re-run twice urgently.
    setSession(stamped);
    return saveChecklist(stamped)
      .then((result) => {
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
                  }
                : tab,
            ),
          );
        });
        setLoadError(null);
      })
      .catch(() => {
        setLoadError("Failed to save checklist");
      })
      .finally(() => {
        savingRef.current = false;
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
        showContractBreakdown={false}
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

  const contractsFooter = useMemo(
    () => (
      <SessionContractScuGrid
        missionScuBreakdown={missionScuBreakdown}
        sessionId={session.id}
      />
    ),
    [missionScuBreakdown, session.id],
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

  const routeProgressStats = useMemo(
    () => (
      <SessionRouteProgressStats
        completedLegs={completedLegs}
        totalLegs={totalLegs}
        missionsCompleted={session.missionsCompleted ?? 0}
        missionCount={session.missionCount ?? 0}
        onboardScu={onboardScu}
        totalCapacity={totalCapacity}
        isOverCapacity={isOverCapacity}
        auecEarned={auecEarned}
        auecProjected={auecProjected}
        onMissionsClick={openMissions}
        onStopsClick={openStops}
        onCapacityClick={openCargoLayout}
        cargoBayCount={cargoBayCount}
      />
    ),
    [
      completedLegs,
      totalLegs,
      session.missionsCompleted,
      session.missionCount,
      onboardScu,
      totalCapacity,
      isOverCapacity,
      auecEarned,
      auecProjected,
      openMissions,
      openStops,
      openCargoLayout,
      cargoBayCount,
    ],
  );

  const elapsedToolbar = useMemo(
    () => (
      <SessionElapsedLabel
        session={{
          startedAt: session.startedAt,
          completedAt: session.completedAt,
        }}
      />
    ),
    [session.startedAt, session.completedAt],
  );

  const onToggleCargoHandled = useCallback(
    (rowId: string, cargoIndex: number) => {
      persistSession(
        applySessionCompletionTiming({
          ...sessionRef.current,
          shipSlugs: sessionRef.current.shipSlugs ?? [],
          startLocationSlug: sessionRef.current.startLocationSlug ?? null,
          rows: sessionRef.current.rows.map((row) => {
            if (row.id !== rowId) return row;
            return {
              ...row,
              cargoDeliveries: row.cargoDeliveries.map((cargo, index) =>
                index === cargoIndex
                  ? { ...cargo, isHandled: !cargo.isHandled }
                  : cargo,
              ),
            };
          }),
        }),
      );
    },
    [persistSession],
  );

  const onToggleStop = useCallback(
    (rowId: string) => {
      const current = sessionRef.current;
      const target = current.rows.find((row) => row.id === rowId);
      if (!target) return Promise.resolve();
      const stopIsCompleted = !target.isCompleted;
      const missions = syncMissionsForStopCompletion({
        missions: current.missions ?? [],
        rows: current.rows,
        rowId,
        stopIsCompleted,
      });
      const counted = missions.filter((mission) => !mission.isHidden);
      return persistSession(
        applySessionCompletionTiming({
          ...current,
          shipSlugs: current.shipSlugs ?? [],
          startLocationSlug: current.startLocationSlug ?? null,
          rows: current.rows.map((row) =>
            row.id === rowId
              ? { ...row, isCompleted: stopIsCompleted }
              : row,
          ),
          missions,
          missionCount: counted.length,
          missionsCompleted: counted.filter((mission) => mission.isCompleted)
            .length,
        }),
      );
    },
    [persistSession],
  );

  const onInsertQuantumTravel = useCallback(
    (input: {
      afterRowId: string;
      fromSlug: string;
      toSlug: string;
      reasonShopSlug?: string | null;
    }) => {
      const current = sessionRef.current;
      persistSession(
        applySessionCompletionTiming({
          ...current,
          shipSlugs: current.shipSlugs ?? [],
          startLocationSlug: current.startLocationSlug ?? null,
          rows: insertQuantumTravelAfter(
            current.rows,
            input.afterRowId,
            {
              fromSlug: input.fromSlug,
              toSlug: input.toSlug,
              reasonShopSlug: input.reasonShopSlug ?? null,
            },
          ),
        }),
      );
    },
    [persistSession],
  );

  const onUpdateQuantumTravel = useCallback(
    (input: { rowId: string; fromSlug?: string; toSlug?: string }) => {
      const current = sessionRef.current;

      if (input.rowId === QUANTUM_ORIGIN_ROW_ID) {
        let startLocationSlug = current.startLocationSlug ?? null;
        let rows = current.rows;
        if (input.fromSlug) {
          startLocationSlug = input.fromSlug;
        }
        if (input.toSlug && rows[0]) {
          const updated = updateChecklistRowLocation(
            rows,
            rows[0].id,
            input.toSlug,
          );
          if (!updated.ok) {
            setLoadError(updated.error);
            return;
          }
          rows = updated.rows;
        }
        persistSession(
          applySessionCompletionTiming({
            ...current,
            shipSlugs: current.shipSlugs ?? [],
            startLocationSlug,
            rows,
          }),
        );
        return;
      }

      const updated = updateQuantumTravelEndpoints(
        current.rows,
        input.rowId,
        {
          fromSlug: input.fromSlug,
          toSlug: input.toSlug,
        },
        {
          isReasonValidAtDestination: (reasonShopSlug, toSlug) =>
            listLocationShops(toSlug).some(
              (shop) => shop.slug === reasonShopSlug,
            ),
        },
      );
      if (!updated.ok) {
        setLoadError(updated.error);
        return;
      }
      persistSession(
        applySessionCompletionTiming({
          ...current,
          shipSlugs: current.shipSlugs ?? [],
          startLocationSlug: current.startLocationSlug ?? null,
          rows: updated.rows,
        }),
      );
    },
    [persistSession],
  );

  const applyBoxBreakdown = (
    missionId: string,
    commoditySlug: string,
    breakdown: ScuBoxSplits,
    options?: {
      applyPreferredMaxToRemaining?: boolean;
      onlyUncorrected?: boolean;
    },
  ) => {
    const result = setMissionScuBoxSplits(
      session,
      missionId,
      breakdown,
      commoditySlug,
      options,
    );
    if (!result.ok) {
      setLoadError(result.error);
      return;
    }
    persistSession(result.session);
    const updatedMission =
      result.session.missions?.find((mission) => mission.id === missionId) ??
      null;
    const catalogId = updatedMission?.catalogMissionId ?? null;
    if (!catalogId || !updatedMission?.scuBoxSplits) return;
    void updateCatalogMissionScuBoxSplits({
      missionId: catalogId,
      scuBoxSplits: updatedMission.scuBoxSplits,
      scuCargoBoxSplits: updatedMission.scuCargoBoxSplits,
    }).catch(() => {
      setLoadError("Saved on trip, but failed to update catalog default");
    });
  };

  const onReorderStops = useCallback(
    (orderedIds: string[]) => {
      const current = sessionRef.current;
      const result = reorderChecklistStops(current.rows, orderedIds);
      if (!result.ok) {
        setLoadError(result.error);
        return;
      }
      persistSession(
        applySessionCompletionTiming({
          ...current,
          rows: result.rows,
        }),
      );
    },
    [persistSession],
  );

  const onResetTrip = useCallback(() => {
    persistSession(resetTripProgress(sessionRef.current));
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

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <SessionTabs
        sessions={tabs}
        activeSessionId={routeSessionId ?? activeSessionId ?? session.id}
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

      <CreateSessionModal
        open={createSessionOpen}
        isBusy={tabsBusy}
        onClose={() => setCreateSessionOpen(false)}
        onCreate={(name) => {
          void addSession(name);
        }}
      />

      <div className="min-w-0">
        <p className="mb-1 font-mono text-[0.65rem] uppercase tracking-[0.22em] text-rsi-accent">
          Trip
        </p>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <SessionNameField
              name={session.sessionName}
              disabled={Boolean(initial) || tabsBusy}
              onRename={renameSession}
            />
            <p className="mt-1 font-mono text-[0.65rem] tracking-wide text-rsi-text-muted">
              ID {session.id}
            </p>
          </div>
          <SessionSourceStat
            className="shrink-0"
            onMissionsClick={() => setCatalogOpen(true)}
            onClick={() => setScreenshotsOpen(true)}
          />
        </div>
        <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-start md:gap-4">
          <div className="min-w-0 flex-1">
            <LocationFuzzySearch
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
          <div className="flex min-w-0 flex-1 md:justify-end">
            <ShipSelect
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
        </div>
        {loadError ? (
          <p className="mt-1 text-sm text-rsi-warn">{loadError}</p>
        ) : null}
      </div>

      <HaulingChecklistTable
        rows={session.rows}
        focusedStopId={resolvedFocusedStopId}
        onFocusStop={setFocusedStopId}
        shipName={selectedShipName}
        missions={session.missions ?? []}
        sessionId={session.id}
        startLocationSlug={session.startLocationSlug ?? null}
        onToggleCargoHandled={onToggleCargoHandled}
        onInsertQuantumTravel={onInsertQuantumTravel}
        onUpdateQuantumTravel={onUpdateQuantumTravel}
        onOpenCargoBays={toggleCargoLayout}
        onOpenStops={toggleStops}
        onOpenContracts={(missionId) => {
          if (missionId) openMissions(missionId);
          else toggleMissions();
        }}
        onSelectBoxBreakdown={applyBoxBreakdown}
        toolbarStart={routeProgressStats}
        toolbarEnd={elapsedToolbar}
        onToggle={onToggleStop}
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
        onAdded={() => {
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
        footerAside={contractsFooter}
        onClose={closeCargoLayout}
      />

      <SessionMissionsModal
        open={missionsOpen}
        missions={session.missions ?? []}
        rows={session.rows}
        focusMissionId={missionsFocusId}
        onClose={closeMissions}
        onToggleHidden={(missionId, isHidden) => {
          const result = setMissionHiddenAndRebuildRoute(
            session,
            missionId,
            isHidden,
          );
          if (!result.ok) {
            setLoadError(result.error);
            return;
          }
          persistSession(result.session);
        }}
        onToggleCompleted={(missionId, isCompleted) => {
          const result = setMissionCompletedAndRebuildRoute(
            session,
            missionId,
            isCompleted,
          );
          if (!result.ok) {
            setLoadError(result.error);
            return;
          }
          persistSession(result.session);
        }}
        onRemoveMission={(missionId) => {
          const result = removeMissionAndRebuildRoute(session, missionId);
          if (!result.ok) {
            setLoadError(result.error);
            return;
          }
          persistSession(result.session);
        }}
        onSelectBoxBreakdown={applyBoxBreakdown}
      />
    </div>
  );
}
