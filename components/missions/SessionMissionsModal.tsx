"use client";

import { useEffect, useState } from "react";
import type { SessionMission } from "@/lib/missions/sessionMissions";
import { MobiglasMissionDetail } from "./MobiglasMissionDetail";

export type SessionMissionsModalProps = {
  open: boolean;
  missions: SessionMission[];
  onClose: () => void;
  onRemoveMission: (missionId: string) => void;
};

export function SessionMissionsModal({
  open,
  missions,
  onClose,
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
          <div className="flex items-center gap-2">
            {selected ? (
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="rounded-rsi border border-rsi-border px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-rsi-text-secondary hover:border-rsi-border-strong hover:text-rsi-text"
              >
                Back
              </button>
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
              {missions.map((mission) => (
                <li key={mission.id} className="relative">
                  <button
                    type="button"
                    onClick={() => setSelectedId(mission.id)}
                    className="flex h-full w-full flex-col items-start rounded-rsi border border-rsi-border bg-rsi-bg-deep/50 p-4 pr-12 text-left transition-colors hover:border-rsi-border-strong hover:bg-rsi-surface-raised"
                  >
                    <span className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-rsi-accent">
                      {mission.rewardDisplay ??
                        `${Math.round(mission.rewardAuec / 1000)}k`}
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
                  <button
                    type="button"
                    aria-label={`Remove ${mission.title}`}
                    title="Remove mission and rebuild route"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRemoveMission(mission.id);
                      if (selectedId === mission.id) setSelectedId(null);
                    }}
                    className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-rsi border border-rsi-border bg-rsi-surface text-rsi-text-secondary hover:border-rsi-danger/50 hover:bg-rsi-danger-muted hover:text-rsi-danger"
                  >
                    <span aria-hidden className="text-lg leading-none">
                      ×
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
