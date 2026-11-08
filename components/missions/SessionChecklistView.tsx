"use client";

import { useEffect, useRef, useState } from "react";
import {
  fetchChecklist,
  saveChecklist,
} from "@/lib/api/checklistApi";
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
  mockSessionChecklist,
  type SessionChecklistModel,
} from "@/lib/missions/mockSession";
import {
  removeMissionAndRebuildRoute,
  setMissionHiddenAndRebuildRoute,
} from "@/lib/missions/rebuildSessionRoute";
import { CargoBayLayout } from "./CargoBayLayout";
import { HaulingChecklistTable } from "./HaulingChecklistTable";
import { SessionMissionsModal } from "./SessionMissionsModal";

export type SessionChecklistViewProps = {
  /** Optional override; defaults to loading the shared active checklist. */
  initial?: SessionChecklistModel;
};

/** Near-live while the tab is focused; slower when backgrounded. */
const POLL_VISIBLE_MS = 1500;
const POLL_HIDDEN_MS = 12000;

export function SessionChecklistView({
  initial,
}: SessionChecklistViewProps) {
  const [session, setSession] = useState<SessionChecklistModel>(
    initial ?? mockSessionChecklist,
  );
  const [missionsOpen, setMissionsOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const etagRef = useRef<string | null>(null);
  const savingRef = useRef(false);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  useEffect(() => {
    setNowMs(Date.now());
  }, []);

  useEffect(() => {
    if (initial) return;

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

    const applyRemote = (next: SessionChecklistModel) => {
      if (savingRef.current) return;
      const current = sessionRef.current;
      if (current.updatedAt && next.updatedAt === current.updatedAt) return;
      setSession(next);
      setLoadError(null);
    };

    const load = async () => {
      try {
        const result = await fetchChecklist(etagRef.current);
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

    void load().finally(schedule);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      if (timer != null) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [initial]);

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
        setLoadError(null);
      })
      .catch(() => {
        setLoadError("Failed to save checklist");
      })
      .finally(() => {
        savingRef.current = false;
      });
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-1 font-mono text-[0.65rem] uppercase tracking-[0.22em] text-rsi-accent">
          Session
        </p>
        <h2 className="text-xl font-semibold tracking-wide text-rsi-text">
          {session.sessionName}
        </h2>
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

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-rsi border border-rsi-border bg-rsi-bg-deep/60 px-4 py-3 font-mono tabular-nums tracking-wide shadow-rsi-panel">
          <p className="mb-1 text-[0.65rem] uppercase tracking-[0.18em] text-rsi-text-muted">
            Complete
          </p>
          <p className="text-lg text-rsi-text">
            <span className="text-rsi-success">{completedLegs}</span>
            <span className="text-rsi-text-muted"> / </span>
            <span>{totalLegs}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => setMissionsOpen(true)}
          className="rounded-rsi border border-rsi-border bg-rsi-bg-deep/60 px-4 py-3 text-left font-mono tabular-nums tracking-wide shadow-rsi-panel transition-colors hover:border-rsi-border-strong hover:bg-rsi-surface-raised"
        >
          <p className="mb-1 text-[0.65rem] uppercase tracking-[0.18em] text-rsi-text-muted">
            Missions
          </p>
          <p className="text-lg text-rsi-text">
            <span className="text-rsi-success">
              {session.missionsCompleted ?? 0}
            </span>
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
