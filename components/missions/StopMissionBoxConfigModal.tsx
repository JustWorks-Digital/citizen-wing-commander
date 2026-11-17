"use client";

import { useEffect, useMemo, useState } from "react";
import { MissionBoxMixSection } from "@/components/missions/MissionBoxMixSection";
import {
  MissionScuDraftEditor,
  missionScuDraftsEqual,
} from "@/components/missions/MissionScuDraftEditor";
import { StopMissionScreenshots } from "@/components/missions/StopMissionScreenshots";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { cargoBoxSplits } from "@/lib/missions/cargoBoxSplits";
import type { ScuBoxSplits } from "@/lib/missions/catalogMission";
import {
  missionScuAmounts,
  type MissionScuDraft,
} from "@/lib/missions/missionScuAmounts";
import type { HaulingChecklistRow } from "@/lib/missions/sessionChecklist";
import { screenshotRefsForMission } from "@/lib/missions/rowMissionScreenshots";
import type { SessionMission } from "@/lib/missions/sessionMissions";
import { missionTotalScu } from "@/lib/missions/sessionMissionObjectives";
import type { SelectBoxBreakdownOptions } from "@/lib/missions/stopMissionBoxConfig";

export type { SelectBoxBreakdownOptions } from "@/lib/missions/stopMissionBoxConfig";

export type StopMissionBoxConfigModalProps = {
  mission: SessionMission;
  /** Route rows — used for live per-location SCU amounts. */
  rows?: HaulingChecklistRow[] | null;
  /** Session id — resolves Source screenshot URLs for the header. */
  sessionId?: string | null;
  onClose: () => void;
  /**
   * Persist one commodity’s crate mix.
   * Total-row picks also pass `applyPreferredMaxToRemaining`.
   */
  onSelectBoxBreakdown: (
    commoditySlug: string,
    breakdown: ScuBoxSplits,
    options?: SelectBoxBreakdownOptions,
  ) => void;
  /**
   * Persist draft mission + nested Pick up/Deliver SCU. Caller should run
   * `missionScuAmounts.applyDraft` (validates role sums === totals).
   */
  onSaveScuDraft?: (draft: MissionScuDraft) => void;
};

/**
 * Correct crate sizes and SCU amounts for a session contract — condensed
 * cargo totals with expandable Pick up / Deliver SCU, plus crate-mix dropdowns.
 * SCU edits stay in a draft until Save (role sums must match totals).
 */
export function StopMissionBoxConfigModal({
  mission,
  rows = null,
  sessionId = null,
  onClose,
  onSelectBoxBreakdown,
  onSaveScuDraft,
}: StopMissionBoxConfigModalProps) {
  const reward =
    mission.rewardDisplay ??
    (mission.rewardAuec > 0
      ? `${mission.rewardAuec.toLocaleString()} aUEC`
      : null);
  const disabled = mission.isCompleted;
  const canEditScu = !disabled && Boolean(onSaveScuDraft);
  const sourceRefs = useMemo(
    () => (sessionId ? screenshotRefsForMission(mission, sessionId) : []),
    [mission, sessionId],
  );

  const baseline = useMemo(
    () => missionScuAmounts.draftFromMission(mission, rows),
    [mission, rows],
  );
  const [draft, setDraft] = useState<MissionScuDraft>(baseline);
  const [expandedSlugs, setExpandedSlugs] = useState<Set<string>>(
    () => new Set(),
  );
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(baseline);
    setSaveError(null);
  }, [baseline]);

  const isDirty = canEditScu && !missionScuDraftsEqual(draft, baseline);

  const ready = useMemo(() => cargoBoxSplits.withDefaults(mission), [mission]);
  const lines = useMemo(() => {
    const bySlug = new Map(
      draft.commodities.map((line) => [line.commoditySlug, line]),
    );
    return [...cargoBoxSplits.commodityLines(ready)]
      .map((line) => {
        const draftLine = bySlug.get(line.commoditySlug);
        return draftLine ? { ...line, scu: draftLine.scu } : line;
      })
      .sort(
        (a, b) =>
          b.scu - a.scu || a.commoditySlug.localeCompare(b.commoditySlug),
      );
  }, [ready, draft.commodities]);
  const isMultiCargo = lines.length > 1;
  const primaryLine = lines[0] ?? null;
  const missionScu = draft.commodities.reduce(
    (sum, line) => sum + Math.max(0, Math.floor(line.scu)),
    0,
  );
  const liveMissionScu = missionTotalScu(mission);

  const selectTotalStyle = (breakdown: ScuBoxSplits) => {
    if (!primaryLine) return;
    onSelectBoxBreakdown(primaryLine.commoditySlug, breakdown, {
      applyPreferredMaxToRemaining: true,
      onlyUncorrected: false,
    });
    if (!isMultiCargo) onClose();
  };

  const selectCargoStyle = (commoditySlug: string, breakdown: ScuBoxSplits) => {
    onSelectBoxBreakdown(commoditySlug, breakdown);
    if (!isMultiCargo) onClose();
  };

  const setCommodityScu = (commoditySlug: string, scu: number) => {
    setSaveError(null);
    setDraft((prev) =>
      missionScuAmounts.setCommodityScuInDraft(prev, commoditySlug, scu),
    );
  };

  const setDeliveryScu = (
    commoditySlug: string,
    locationSlug: string,
    scu: number,
  ) => {
    setSaveError(null);
    setDraft((prev) =>
      missionScuAmounts.setDeliveryScuInDraft(
        prev,
        commoditySlug,
        locationSlug,
        scu,
      ),
    );
  };

  const setPickupScu = (
    commoditySlug: string,
    locationSlug: string,
    scu: number,
  ) => {
    setSaveError(null);
    setDraft((prev) =>
      missionScuAmounts.setPickupScuInDraft(
        prev,
        commoditySlug,
        locationSlug,
        scu,
      ),
    );
  };

  const skipPickup = (commoditySlug: string, locationSlug: string) => {
    setSaveError(null);
    setDraft((prev) =>
      missionScuAmounts.skipPickupInDraft(prev, commoditySlug, locationSlug),
    );
  };

  const toggleExpanded = (commoditySlug: string) => {
    setExpandedSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(commoditySlug)) next.delete(commoditySlug);
      else next.add(commoditySlug);
      return next;
    });
  };

  const handleSave = () => {
    if (!onSaveScuDraft) return;
    const check = missionScuAmounts.validateDraft(draft);
    if (!check.ok) {
      setSaveError(check.error);
      return;
    }
    setSaveError(null);
    onSaveScuDraft(draft);
  };

  const handleCancelDraft = () => {
    setDraft(baseline);
    setSaveError(null);
  };

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

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
        <header className="relative shrink-0 border-b border-rsi-divider px-4 py-3 pr-12 sm:px-6 sm:py-4 sm:pr-14">
          <ModalCloseButton onClick={onClose} />
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-rsi-accent">
            Box types
          </p>
          <div className="mt-0.5 flex min-w-0 items-center gap-2">
            <h2 className="min-w-0 truncate text-base font-semibold tracking-wide text-rsi-text sm:text-lg">
              {mission.title}
            </h2>
            {sourceRefs.length > 0 ? (
              <StopMissionScreenshots
                refs={sourceRefs}
                variant="inline"
                className="shrink-0"
              />
            ) : null}
          </div>
          <p className="mt-1 truncate font-mono text-[0.55rem] uppercase tracking-[0.12em] text-rsi-text-muted">
            {[
              mission.contractor || null,
              reward,
              (canEditScu ? missionScu : liveMissionScu) > 0
                ? `${canEditScu ? missionScu : liveMissionScu} SCU`
                : null,
            ]
              .filter(Boolean)
              .join(" · ") || "—"}
          </p>
          {mission.cargoSummary ? (
            <p className="mt-1 truncate text-[0.65rem] text-rsi-text-secondary">
              {mission.cargoSummary}
            </p>
          ) : null}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          <p className="text-sm text-rsi-text-secondary">
            {canEditScu
              ? "Edit cargo totals, expand a type for Pick up / Deliver stops. Override a stop SCU or Skip a pick up — other stops rebalance. Save when Pick up and Deliver each sum to the cargo total."
              : isMultiCargo
                ? "Set the total crate style, or adjust each cargo type."
                : "Pick the crate mix that matches the contract."}
          </p>

          {lines.length === 0 || !primaryLine ? (
            <p className="mt-4 text-sm text-rsi-text-muted">
              No cargo on this contract.
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              {canEditScu ? (
                <MissionScuDraftEditor
                  lines={lines}
                  draft={draft}
                  expandedSlugs={expandedSlugs}
                  disabled={disabled}
                  isDirty={isDirty}
                  saveError={saveError}
                  onToggle={toggleExpanded}
                  onChangeCommodity={setCommodityScu}
                  onChangeDelivery={setDeliveryScu}
                  onChangePickup={setPickupScu}
                  onSkipPickup={skipPickup}
                  onReset={handleCancelDraft}
                  onSave={handleSave}
                />
              ) : null}

              <MissionBoxMixSection
                mission={ready}
                primaryLine={primaryLine}
                lines={lines}
                disabled={disabled}
                onSelectTotal={selectTotalStyle}
                onSelectCargo={selectCargoStyle}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
