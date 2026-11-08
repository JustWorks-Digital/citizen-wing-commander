"use client";

import { useEffect, useState } from "react";
import type { SessionMission } from "@/lib/missions/sessionMissions";
import { MobiglasMissionDetail } from "./MobiglasMissionDetail";

export type SessionMissionsModalProps = {
  open: boolean;
  missions: SessionMission[];
  onClose: () => void;
  onToggleHidden: (missionId: string, isHidden: boolean) => void;
  onToggleCompleted: (missionId: string, isCompleted: boolean) => void;
  onRemoveMission: (missionId: string) => void;
};

function VisibilityIcon({ isHidden }: { isHidden: boolean }) {
  if (isHidden) {
    return (
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
        <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    );
  }
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function CompleteIcon({ isCompleted }: { isCompleted: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {isCompleted ? (
        <>
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </>
      ) : (
        <circle cx="12" cy="12" r="9" />
      )}
    </svg>
  );
}

export function SessionMissionsModal({
  open,
  missions,
  onClose,
  onToggleHidden,
  onToggleCompleted,
  onRemoveMission,
}: SessionMissionsModalProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) setSelectedId(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (selectedId) setSelectedId(null);
        else onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, selectedId, onClose]);

  if (!open) return null;

  const selected = missions.find((mission) => mission.id === selectedId);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-rsi-bg-deep/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={selected ? selected.title : "Session missions"}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-rsi border border-rsi-border bg-rsi-surface shadow-rsi-panel">
        <header className="flex items-center justify-between gap-3 border-b border-rsi-divider px-5 py-4">
          <div>
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-rsi-accent">
              {selected ? "Mission" : "Missions"}
            </p>
            <h2 className="text-lg font-semibold tracking-wide text-rsi-text">
              {selected ? selected.title : "Accepted contracts"}
            </h2>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {selected ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onToggleCompleted(selected.id, !selected.isCompleted);
                  }}
                  className="rounded-rsi border border-rsi-border px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-rsi-text-secondary hover:border-rsi-success/50 hover:text-rsi-success"
                >
                  {selected.isCompleted ? "Reopen" : "Complete"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onToggleHidden(selected.id, !selected.isHidden);
                  }}
                  className="rounded-rsi border border-rsi-border px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-rsi-text-secondary hover:border-rsi-border-strong hover:text-rsi-text"
                >
                  {selected.isHidden ? "Show" : "Hide"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onRemoveMission(selected.id);
                    setSelectedId(null);
                  }}
                  className="rounded-rsi border border-rsi-danger/40 px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-rsi-danger hover:bg-rsi-danger-muted"
                >
                  Remove
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="rounded-rsi border border-rsi-border px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-rsi-text-secondary hover:border-rsi-border-strong hover:text-rsi-text"
                >
                  Back
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-rsi border border-rsi-border px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-rsi-text-secondary hover:border-rsi-border-strong hover:text-rsi-text"
            >
              Close
            </button>
          </div>
        </header>

        <div className="overflow-y-auto px-5 py-5">
          {selected ? (
            <MobiglasMissionDetail
              panel={selected.mobiglas}
              screenshots={selected.screenshots}
            />
          ) : missions.length === 0 ? (
            <p className="text-sm text-rsi-text-muted">No missions in this session.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {missions.map((mission) => {
                const isHidden = Boolean(mission.isHidden);
                const isCompleted = Boolean(mission.isCompleted);
                return (
                  <li key={mission.id} className="relative">
                    <button
                      type="button"
                      onClick={() => setSelectedId(mission.id)}
                      className={[
                        "flex h-full w-full flex-col items-start rounded-rsi border p-4 pr-20 text-left transition-colors",
                        isHidden
                          ? "border-rsi-border/60 bg-rsi-bg-deep/30 opacity-55 hover:opacity-80"
                          : isCompleted
                            ? "border-rsi-success/40 bg-rsi-bg-deep/40"
                            : "border-rsi-border bg-rsi-bg-deep/50 hover:border-rsi-border-strong hover:bg-rsi-surface-raised",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "font-mono text-[0.65rem] uppercase tracking-[0.16em]",
                          isCompleted ? "text-rsi-success" : "text-rsi-accent",
                        ].join(" ")}
                      >
                        {mission.rewardDisplay ??
                          `${Math.round(mission.rewardAuec / 1000)}k`}
                        {isCompleted ? " · complete" : ""}
                        {isHidden ? " · hidden" : ""}
                      </span>
                      <span className="mt-2 font-semibold tracking-wide text-rsi-text">
                        {mission.title}
                      </span>
                      <span className="mt-1 text-xs text-rsi-text-secondary">
                        {mission.contractor}
                      </span>
                      <span className="mt-3 text-sm text-rsi-text">
                        {mission.cargoSummary}
                      </span>
                      <span className="mt-2 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-rsi-text-muted">
                        {mission.from.join(" · ")} → {mission.to.join(" · ")}
                      </span>
                    </button>
                    <div className="absolute right-2 top-2 flex gap-1">
                      <button
                        type="button"
                        aria-label={
                          isCompleted
                            ? `Reopen ${mission.title}`
                            : `Complete ${mission.title}`
                        }
                        title={
                          isCompleted
                            ? "Reopen mission (restore cargo to route)"
                            : "Complete mission (drop cargo from route)"
                        }
                        onClick={(event) => {
                          event.stopPropagation();
                          onToggleCompleted(mission.id, !isCompleted);
                        }}
                        className={[
                          "flex h-8 w-8 items-center justify-center rounded-rsi border bg-rsi-surface",
                          isCompleted
                            ? "border-rsi-success/50 text-rsi-success hover:border-rsi-success"
                            : "border-rsi-border text-rsi-text-secondary hover:border-rsi-success/50 hover:text-rsi-success",
                        ].join(" ")}
                      >
                        <CompleteIcon isCompleted={isCompleted} />
                      </button>
                      <button
                        type="button"
                        aria-label={
                          isHidden
                            ? `Show ${mission.title} in route`
                            : `Hide ${mission.title} from route`
                        }
                        title={
                          isHidden
                            ? "Show in route table"
                            : "Hide from route table"
                        }
                        onClick={(event) => {
                          event.stopPropagation();
                          onToggleHidden(mission.id, !isHidden);
                        }}
                        className={[
                          "flex h-8 w-8 items-center justify-center rounded-rsi border bg-rsi-surface",
                          isHidden
                            ? "border-rsi-accent/40 text-rsi-accent hover:border-rsi-accent"
                            : "border-rsi-border text-rsi-text-secondary hover:border-rsi-border-strong hover:text-rsi-text",
                        ].join(" ")}
                      >
                        <VisibilityIcon isHidden={isHidden} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
