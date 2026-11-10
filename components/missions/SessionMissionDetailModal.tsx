"use client";

import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import type { SessionMission } from "@/lib/missions/sessionMissions";
import { MobiglasMissionDetail } from "./MobiglasMissionDetail";

export type SessionMissionDetailModalProps = {
  mission: SessionMission;
  onClose: () => void;
};

/** Read-only contract detail dialog (MobiGlas-style panel). */
export function SessionMissionDetailModal({
  mission,
  onClose,
}: SessionMissionDetailModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-rsi-bg-deep/80 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Contract details: ${mission.title}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[100dvh] w-full max-w-2xl flex-col overflow-hidden border-rsi-border bg-rsi-surface shadow-rsi-panel sm:max-h-[90vh] sm:rounded-rsi sm:border">
        <header className="relative shrink-0 border-b border-rsi-divider px-4 py-3 pr-12 sm:px-5 sm:py-4 sm:pr-14">
          <ModalCloseButton onClick={onClose} />
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-rsi-accent">
            Mission
          </p>
          <h2 className="mt-0.5 truncate text-base font-semibold tracking-wide text-rsi-text">
            {mission.title}
          </h2>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4">
          <MobiglasMissionDetail
            panel={mission.mobiglas}
            screenshots={mission.screenshots}
          />
        </div>
      </div>
    </div>
  );
}
