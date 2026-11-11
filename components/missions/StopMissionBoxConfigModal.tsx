"use client";

import { useMemo } from "react";
import { CargoBoxCountIcons } from "@/components/ships/CargoBoxSizeIcon";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import type { ScuBoxSplits } from "@/lib/missions/catalogMission";
import { scuBoxSplitsForScu } from "@/lib/missions/catalogMission";
import {
  boxCountsFromBreakdown,
  enumerateBoxBreakdowns,
} from "@/lib/missions/boxBreakdownOptions";
import { autoSelectedMissionScuBoxSplits } from "@/lib/missions/rebuildSessionRoute";
import { missionTotalScu } from "@/lib/missions/sessionMissionObjectives";
import type { SessionMission } from "@/lib/missions/sessionMissions";

export type StopMissionBoxConfigModalProps = {
  mission: SessionMission;
  onClose: () => void;
  onSelectBoxBreakdown: (breakdown: ScuBoxSplits) => void;
};

function breakdownId(breakdown: ScuBoxSplits): string {
  return [
    `32:${breakdown.scuThirtyTwo ?? 0}`,
    `16:${breakdown.scuSixteen ?? 0}`,
    `8:${breakdown.scuEight}`,
    `4:${breakdown.scuFour}`,
    `2:${breakdown.scuTwo}`,
    `1:${breakdown.scuOne}`,
  ].join("|");
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

  const autoSelected = useMemo(
    () =>
      mission.scuBoxSplitsAutoSelected ??
      autoSelectedMissionScuBoxSplits(mission),
    [mission],
  );

  const selectedSplits = useMemo(
    () =>
      mission.scuBoxSplits ??
      autoSelected ??
      scuBoxSplitsForScu(totalScu, mission.maxContainerScu),
    [mission.scuBoxSplits, autoSelected, totalScu, mission.maxContainerScu],
  );

  const selectedId = breakdownId(selectedSplits);
  const autoId = autoSelected ? breakdownId(autoSelected) : null;
  const isUserCorrected = Boolean(autoId && selectedId !== autoId);

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

          {autoSelected ? (
            <div className="mt-3 space-y-1.5 rounded-rsi border border-rsi-border/80 bg-rsi-bg-deep/40 px-3 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p
                  className={[
                    "font-mono text-[0.55rem] uppercase tracking-[0.12em]",
                    isUserCorrected
                      ? "text-rsi-text-muted"
                      : "text-rsi-accent",
                  ].join(" ")}
                >
                  {isUserCorrected
                    ? "Auto-selected (manual override)"
                    : "Auto-selected"}
                </p>
                <CargoBoxCountIcons
                  boxCounts={boxCountsFromBreakdown(autoSelected)}
                  color={
                    isUserCorrected
                      ? "var(--rsi-text-muted)"
                      : "var(--rsi-accent)"
                  }
                  className="gap-x-1.5 [&_svg]:size-4 [&_span]:text-[0.65rem]"
                />
              </div>
              {isUserCorrected ? (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-rsi-border/50 pt-1.5">
                  <p className="font-mono text-[0.55rem] uppercase tracking-[0.12em] text-rsi-accent">
                    User-selected
                  </p>
                  <CargoBoxCountIcons
                    boxCounts={boxCountsFromBreakdown(selectedSplits)}
                    color="var(--rsi-accent)"
                    className="gap-x-1.5 [&_svg]:size-4 [&_span]:text-[0.65rem]"
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {options.length === 0 || totalScu <= 0 ? (
            <p className="mt-4 text-sm text-rsi-text-muted">
              No box options for this cargo total.
            </p>
          ) : (
            <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {options.map((option) => {
                const isSelected = option.id === selectedId;
                const isAuto = autoId != null && option.id === autoId;
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
                        {isAuto ? " (auto)" : ""}
                        {isSelected && isUserCorrected ? " · selected" : ""}
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
