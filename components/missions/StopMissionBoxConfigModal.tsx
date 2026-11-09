"use client";

import { useMemo } from "react";
import { CargoBoxCountIcons } from "@/components/ships/CargoBoxSizeIcon";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import type { ScuBoxSplits } from "@/lib/missions/catalogMission";
import { scuBoxSplitsForScu } from "@/lib/missions/catalogMission";
import { enumerateBoxBreakdowns } from "@/lib/missions/boxBreakdownOptions";
import { missionTotalScu } from "@/lib/missions/sessionMissionObjectives";
import type { SessionMission } from "@/lib/missions/sessionMissions";

export type StopMissionBoxConfigModalProps = {
  mission: SessionMission;
  onClose: () => void;
  onSelectBoxBreakdown: (breakdown: ScuBoxSplits) => void;
};

function breakdownId(breakdown: ScuBoxSplits): string {
  return `8:${breakdown.scuEight}|4:${breakdown.scuFour}|2:${breakdown.scuTwo}|1:${breakdown.scuOne}`;
}

/**
 * Quick modal to correct auto-selected crate sizes for a session mission.
 * Options are large clickable tiles (not a dropdown).
 */
export function StopMissionBoxConfigModal({
  mission,
  onClose,
  onSelectBoxBreakdown,
}: StopMissionBoxConfigModalProps) {
  const totalScu = missionTotalScu(mission);
  const reward =
    mission.rewardDisplay ??
    (mission.rewardAuec > 0
      ? `${mission.rewardAuec.toLocaleString()} aUEC`
      : null);
  const disabled = mission.isCompleted;

  const options = useMemo(
    () => enumerateBoxBreakdowns(totalScu, mission.maxContainerScu, 12),
    [totalScu, mission.maxContainerScu],
  );

  const selectedId = useMemo(() => {
    if (mission.scuBoxSplits) return breakdownId(mission.scuBoxSplits);
    return breakdownId(scuBoxSplitsForScu(totalScu, mission.maxContainerScu));
  }, [mission.scuBoxSplits, totalScu, mission.maxContainerScu]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-rsi-bg-deep/80 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Box types for ${mission.title}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[100dvh] w-full max-w-2xl flex-col overflow-hidden border-rsi-border bg-rsi-surface shadow-rsi-panel sm:max-h-[90vh] sm:rounded-rsi sm:border">
        <header className="relative shrink-0 border-b border-rsi-divider px-4 py-3 pr-12 sm:px-5 sm:py-4 sm:pr-14">
          <ModalCloseButton onClick={onClose} />
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-rsi-accent">
            Box types
          </p>
          <h2 className="mt-0.5 truncate text-base font-semibold tracking-wide text-rsi-text">
            {mission.title}
          </h2>
          <p className="mt-1 truncate font-mono text-[0.55rem] uppercase tracking-[0.12em] text-rsi-text-muted">
            {[mission.contractor || null, reward].filter(Boolean).join(" · ") ||
              "—"}
          </p>
          {mission.cargoSummary ? (
            <p className="mt-1 truncate text-[0.65rem] text-rsi-text-secondary">
              {mission.cargoSummary}
            </p>
          ) : null}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
          <p className="text-sm text-rsi-text-secondary">
            Tap the crate mix that matches the contract.
          </p>

          {options.length === 0 || totalScu <= 0 ? (
            <p className="mt-4 text-sm text-rsi-text-muted">
              No box options for this cargo total.
            </p>
          ) : (
            <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {options.map((option) => {
                const isSelected = option.id === selectedId;
                return (
                  <li key={option.id}>
                    <button
                      type="button"
                      disabled={disabled}
                      aria-pressed={isSelected}
                      title={option.label}
                      onClick={() => {
                        if (disabled) return;
                        onSelectBoxBreakdown(option.breakdown);
                        onClose();
                      }}
                      className={[
                        "flex w-full flex-col items-start gap-2 rounded-rsi border px-3 py-3 text-left transition-colors",
                        isSelected
                          ? "border-rsi-accent bg-rsi-accent-muted/35"
                          : "border-rsi-border bg-rsi-bg-deep/40 hover:border-rsi-border-strong hover:bg-rsi-bg-deep/60",
                        disabled
                          ? "cursor-not-allowed opacity-50"
                          : "cursor-pointer",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-rsi-bg",
                      ].join(" ")}
                    >
                      <CargoBoxCountIcons
                        boxCounts={option.boxCounts}
                        color={
                          isSelected
                            ? "var(--rsi-accent)"
                            : "var(--rsi-text-secondary)"
                        }
                        className="gap-x-2.5 [&_svg]:size-7 [&_span]:text-sm"
                      />
                      <p className="font-mono text-[0.55rem] uppercase tracking-[0.12em] text-rsi-text-muted">
                        {option.boxCount} boxes
                        {option.isDefault ? " (default)" : ""}
                      </p>
                    </button>
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
