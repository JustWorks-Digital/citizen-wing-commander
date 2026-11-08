"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  activateChecklistSession,
  createChecklistSession,
  deleteChecklistSession,
  fetchChecklist,
  fetchChecklistSessions,
  saveChecklist,
} from "@/lib/api/checklistApi";
import { appPaths } from "@/lib/appPaths";
import { LocationFuzzySearch } from "@/components/ui/LocationFuzzySearch";
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
  estimateMissionCargoScu,
  estimateOnboardScu,
} from "@/lib/missions/cargoInventory";
import {
  removeMissionAndRebuildRoute,
  setMissionCompletedAndRebuildRoute,
  setMissionHiddenAndRebuildRoute,
} from "@/lib/missions/rebuildSessionRoute";
import {
  emptySessionChecklist,
  type SessionTabSummary,
} from "@/lib/missions/sessionChecklist";
import { CargoBayLayout } from "./CargoBayLayout";
import { HaulingChecklistTable } from "./HaulingChecklistTable";
import { SessionMissionsModal } from "./SessionMissionsModal";
import { SessionScreenshotsPanel } from "./SessionScreenshotsPanel";
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
  const [missionsOpen, setMissionsOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const etagRef = useRef<string | null>(null);
  const savingRef = useRef(false);
  const sessionRef = useRef(session);
  const activeIdRef = useRef(activeSessionId);
  sessionRef.current = session;
  activeIdRef.current = activeSessionId;

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

  const shipLabels = (session.shipSlugs ?? []).map((slug) => {
    const ship = getShipBySlug(slug);
    return ship
      ? `${ship.name} (${ship.cargoScu} SCU)`
      : slug;
  });
  const totalCapacity = sumShipCargoScu(session.shipSlugs ?? []);
  const onboardScu = estimateOnboardScu(session.rows);
  const missionCargoScu = estimateMissionCargoScu(
    session.missions,
    session.rows,
  );
  const isOverCapacity =
    totalCapacity > 0 && onboardScu > totalCapacity;
  const isMissionOverCapacity =
    totalCapacity > 0 && missionCargoScu > totalCapacity;
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

  const addSession = async () => {
    if (initial) return;
    setTabsBusy(true);
    try {
      const next = await createChecklistSession({ sessionName: "New session" });
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
          void addSession();
        }}
        onClose={(id) => {
          void closeSession(id);
        }}
        isBusy={tabsBusy}
      />

      <div className="min-w-0">
        <p className="mb-1 font-mono text-[0.65rem] uppercase tracking-[0.22em] text-rsi-accent">
          Session
        </p>
        <h2 className="text-lg font-semibold tracking-wide break-words text-rsi-text sm:text-xl">
          {session.sessionName}
        </h2>
        <p className="mt-1 font-mono text-[0.65rem] tracking-wide text-rsi-text-muted">
          ID {session.id}
          <span className="text-rsi-text-muted/70"> · MCP sessionId</span>
        </p>
        <div className="mt-3">
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
        <p className="mt-3 text-sm text-rsi-text-secondary">
          <span className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-rsi-text-muted">
            Ships
          </span>
          <span className="mt-1 block text-rsi-text">
            {shipLabels.length > 0 ? shipLabels.join(" · ") : "None set"}
          </span>
          {shipLabels.length > 0 ? (
            <span className="mt-1 block font-mono text-xs text-rsi-text-muted">
              Combined cargo capacity {totalCapacity} SCU
            </span>
          ) : null}
        </p>
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

      <CargoBayLayout rows={session.rows} />

      <SessionScreenshotsPanel sessionId={session.id} />

      <div className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-3 sm:gap-3">
        <div className="flex h-full flex-col justify-start rounded-rsi border border-rsi-border bg-rsi-bg-deep/60 px-3 py-3 font-mono tabular-nums tracking-wide shadow-rsi-panel sm:px-4">
          <p className="mb-1 text-[0.6rem] uppercase leading-none tracking-[0.16em] text-rsi-text-muted sm:text-[0.65rem] sm:tracking-[0.18em]">
            Inventory
          </p>
          {/* Mobile: stacked SCU lines with border dividers */}
          <dl className="divide-y divide-rsi-border sm:hidden">
            <div className="flex items-baseline justify-between gap-2 py-1.5 first:pt-0">
              <dt className="text-[0.55rem] uppercase tracking-[0.14em] text-rsi-text-muted">
                Onboard
              </dt>
              <dd
                className={[
                  "text-base leading-none",
                  isOverCapacity ? "text-rsi-warn" : "text-rsi-accent",
                ].join(" ")}
              >
                {onboardScu}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-2 py-1.5">
              <dt className="text-[0.55rem] uppercase tracking-[0.14em] text-rsi-text-muted">
                Ship capacity
              </dt>
              <dd className="text-base leading-none text-rsi-text">
                {totalCapacity > 0 ? totalCapacity : "—"}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-2 py-1.5 last:pb-0">
              <dt className="text-[0.55rem] uppercase tracking-[0.14em] text-rsi-text-muted">
                Mission
              </dt>
              <dd
                className={[
                  "text-base leading-none",
                  totalCapacity <= 0
                    ? "text-rsi-text"
                    : isMissionOverCapacity
                      ? "text-rsi-danger"
                      : "text-rsi-success",
                ].join(" ")}
              >
                {missionCargoScu}
              </dd>
            </div>
          </dl>
          {/* sm+: compact inline totals */}
          <p className="hidden text-lg leading-none text-rsi-text sm:block">
            <span
              className={
                isOverCapacity ? "text-rsi-warn" : "text-rsi-accent"
              }
            >
              {onboardScu}
            </span>
            <span className="text-rsi-text-muted" aria-hidden>
              {" · "}
            </span>
            <span>{totalCapacity > 0 ? totalCapacity : "—"}</span>
            <span className="text-rsi-text-muted" aria-hidden>
              {" · "}
            </span>
            <span
              className={
                totalCapacity <= 0
                  ? "text-rsi-text"
                  : isMissionOverCapacity
                    ? "text-rsi-danger"
                    : "text-rsi-success"
              }
            >
              {missionCargoScu}
            </span>
          </p>
          <p className="mt-0.5 text-[0.6rem] uppercase leading-none tracking-[0.14em] text-rsi-text-muted">
            SCU
            {totalCapacity > 0
              ? ` · ${Math.max(0, totalCapacity - onboardScu)} free`
              : ""}
          </p>
        </div>
        <div className="flex h-full flex-col justify-start rounded-rsi border border-rsi-border bg-rsi-bg-deep/60 px-3 py-3 font-mono tabular-nums tracking-wide shadow-rsi-panel sm:px-4">
          <p className="mb-1 text-[0.6rem] uppercase leading-none tracking-[0.16em] text-rsi-text-muted sm:text-[0.65rem] sm:tracking-[0.18em]">
            Complete
          </p>
          <p className="text-base leading-none text-rsi-text sm:text-lg">
            <span>{completedLegs}</span>
            <span className="text-rsi-text-muted"> / </span>
            <span>{totalLegs}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => setMissionsOpen(true)}
          className="flex h-full flex-col items-stretch justify-start rounded-rsi border border-rsi-border bg-rsi-bg-deep/60 px-3 py-3 text-left font-mono tabular-nums tracking-wide shadow-rsi-panel transition-colors hover:border-rsi-border-strong hover:bg-rsi-surface-raised sm:px-4"
        >
          <p className="mb-1 text-[0.6rem] uppercase leading-none tracking-[0.16em] text-rsi-text-muted sm:text-[0.65rem] sm:tracking-[0.18em]">
            Missions
          </p>
          <p className="text-base leading-none text-rsi-text sm:text-lg">
            <span>{session.missionsCompleted ?? 0}</span>
            <span className="text-rsi-text-muted"> / </span>
            <span>{session.missionCount ?? 0}</span>
          </p>
        </button>
      </div>

      <HaulingChecklistTable
        rows={session.rows}
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
      />
    </div>
  );
}
