"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  applySessionCompletionTiming,
  formatSessionDuration,
  getSessionElapsedMs,
  type SessionChecklistModel,
} from "@/lib/missions/mockSession";
import {
  estimateMissionsTotalScu,
  estimateOnboardScu,
  estimatePeakOnboardScu,
} from "@/lib/missions/cargoInventory";
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
import { CargoBayLayout } from "./CargoBayLayout";
import {
  defaultFocusedStopId,
  HaulingChecklistTable,
} from "./HaulingChecklistTable";
import { SessionCatalogMissionsPanel } from "./SessionCatalogMissionsPanel";
import { SessionMissionsModal } from "./SessionMissionsModal";
import { SessionScreenshotsPanel } from "./SessionScreenshotsPanel";
import {
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
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [screenshotsOpen, setScreenshotsOpen] = useState(false);
  const [focusedStopId, setFocusedStopId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [shipCatalog, setShipCatalog] = useState<CatalogShip[]>([]);
  const [shipsLoading, setShipsLoading] = useState(true);
  const [shipsError, setShipsError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const etagRef = useRef<string | null>(null);
  const savingRef = useRef(false);
  const sessionRef = useRef(session);
  const activeIdRef = useRef(activeSessionId);
  sessionRef.current = session;
  activeIdRef.current = activeSessionId;

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
    setNowMs(Date.now());
  }, []);

  useEffect(() => {
    if (initial) return;
    if (!routeSessionId) return;

    setActiveSessionId(routeSessionId);
    activeIdRef.current = routeSessionId;
    etagRef.current = null;

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
        router.replace(appPaths.session(list.activeSessionId));
      }
    };

    const applyRemote = (next: SessionChecklistModel) => {
      if (savingRef.current) return;
      if (next.id !== routeSessionId) return;
      const current = sessionRef.current;
      if (
        current.id === next.id &&
        current.updatedAt &&
        next.updatedAt === current.updatedAt
      ) {
        return;
      }
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
  }, [initial, routeSessionId, router]);

  useEffect(() => {
    if (session.completedAt || nowMs == null) return;
    const tick = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(tick);
  }, [session.completedAt, nowMs]);

  useEffect(() => {
    setFocusedStopId(null);
  }, [session.id]);

  const resolvedFocusedStopId = useMemo(() => {
    if (
      focusedStopId &&
      session.rows.some((row) => row.id === focusedStopId)
    ) {
      return focusedStopId;
    }
    return defaultFocusedStopId(session.rows);
  }, [focusedStopId, session.rows]);

  const selectedShipSlug = session.shipSlugs?.[0] ?? null;
  const shipBySlug = new Map(shipCatalog.map((ship) => [ship.slug, ship]));
  const totalCapacity =
    session.shipSlugs?.reduce((total, slug) => {
      const fromCatalog = shipBySlug.get(slug)?.cargoScu;
      if (typeof fromCatalog === "number") return total + fromCatalog;
      return total + (getShipBySlug(slug)?.cargoScu ?? 0);
    }, 0) ?? sumShipCargoScu(session.shipSlugs ?? []);
  const onboardScu = estimateOnboardScu(session.rows);
  const peakScu = estimatePeakOnboardScu(session.rows);
  const missionsTotalScu = estimateMissionsTotalScu(
    session.missions,
    session.rows,
  );
  const isOverCapacity =
    totalCapacity > 0 && onboardScu > totalCapacity;
  /** Remaining bay for more missions vs planned peak load. */
  const availableScu =
    totalCapacity > 0 ? totalCapacity - peakScu : null;
  const elapsedLabel =
    nowMs == null
      ? "—"
      : formatSessionDuration(getSessionElapsedMs(session, nowMs));
  const isComplete = Boolean(session.completedAt);
  const totalLegs = session.rows.length;
  const completedLegs = session.rows.filter((row) => row.isCompleted).length;
  const startLocation = session.startLocationSlug
    ? getLocationBySlug(session.startLocationSlug)
    : undefined;

  const persistSession = (next: SessionChecklistModel) => {
    savingRef.current = true;
    setSession(next);
    void saveChecklist(next)
      .then((result) => {
        etagRef.current = result.etag;
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
        setLoadError(null);
      })
      .catch(() => {
        setLoadError("Failed to save checklist");
      })
      .finally(() => {
        savingRef.current = false;
      });
  };

  const applyBoxBreakdown = (
    missionId: string,
    breakdown: ScuBoxSplits,
  ) => {
    const result = setMissionScuBoxSplits(session, missionId, breakdown);
    if (!result.ok) {
      setLoadError(result.error);
      return;
    }
    persistSession(result.session);
    const catalogId =
      result.session.missions?.find((mission) => mission.id === missionId)
        ?.catalogMissionId ?? null;
    if (!catalogId) return;
    void updateCatalogMissionScuBoxSplits({
      missionId: catalogId,
      scuBoxSplits: breakdown,
    }).catch(() => {
      setLoadError("Saved on session, but failed to update catalog default");
    });
  };

  const selectSession = async (nextSessionId: string) => {
    if (initial || nextSessionId === routeSessionId) return;
    setTabsBusy(true);
    try {
      await activateChecklistSession(nextSessionId);
      router.push(appPaths.session(nextSessionId));
      setLoadError(null);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Failed to switch session",
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
        sessionName: sessionName.trim() || "New session",
      });
      setCreateSessionOpen(false);
      router.push(appPaths.session(next.id));
      setLoadError(null);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Failed to create session",
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
        error instanceof Error ? error.message : "Failed to close session",
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
          Session
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
          <div className="min-w-0 flex-1">
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
        <p className="mt-3 text-sm text-rsi-text-secondary">
          <span className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-rsi-text-muted">
            Total time
          </span>
          <span
            className={[
              "mt-1 block font-mono text-lg tabular-nums tracking-wide",
              isComplete ? "text-rsi-success" : "text-rsi-text",
            ].join(" ")}
          >
            {elapsedLabel}
            {isComplete ? " · complete" : ""}
          </span>
        </p>
        {loadError ? (
          <p className="mt-1 text-sm text-rsi-warn">{loadError}</p>
        ) : null}
      </div>

      <CargoBayLayout
        rows={session.rows}
        shipSlug={selectedShipSlug}
        focusedStopId={resolvedFocusedStopId}
        headerAside={
          <SessionInventoryStat
            onboardScu={onboardScu}
            peakScu={peakScu}
            missionsTotalScu={missionsTotalScu}
            totalCapacity={totalCapacity}
            availableScu={availableScu}
            isOverCapacity={isOverCapacity}
          />
        }
      />

      <HaulingChecklistTable
        rows={session.rows}
        focusedStopId={resolvedFocusedStopId}
        onFocusStop={setFocusedStopId}
        missions={session.missions ?? []}
        sessionId={session.id}
        onSelectBoxBreakdown={applyBoxBreakdown}
        onToggleCargoHandled={(rowId, cargoIndex) => {
          persistSession(
            applySessionCompletionTiming({
              ...session,
              shipSlugs: session.shipSlugs ?? [],
              startLocationSlug: session.startLocationSlug ?? null,
              rows: session.rows.map((row) => {
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
        }}
        toolbarStart={
          <SessionRouteProgressStats
            completedLegs={completedLegs}
            totalLegs={totalLegs}
            missionsCompleted={session.missionsCompleted ?? 0}
            missionCount={session.missionCount ?? 0}
            onMissionsClick={() => setMissionsOpen(true)}
          />
        }
        onToggle={(rowId) => {
          persistSession(
            applySessionCompletionTiming({
              ...session,
              shipSlugs: session.shipSlugs ?? [],
              startLocationSlug: session.startLocationSlug ?? null,
              rows: session.rows.map((row) =>
                row.id === rowId
                  ? { ...row, isCompleted: !row.isCompleted }
                  : row,
              ),
            }),
          );
        }}
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
                  : "Failed to refresh session",
              );
            }
          })();
        }}
      />

      <SessionMissionsModal
        open={missionsOpen}
        missions={session.missions ?? []}
        onClose={() => setMissionsOpen(false)}
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
