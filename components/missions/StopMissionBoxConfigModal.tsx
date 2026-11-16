"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CommodityIcon } from "@/components/missions/CommodityIcon";
import { MissionBoxBreakdownPicker } from "@/components/missions/MissionBoxBreakdownPicker";
import { StopMissionScreenshots } from "@/components/missions/StopMissionScreenshots";
import { Button } from "@/components/ui/Button";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { resolveCommodityColorHex } from "@/lib/fixtures/commodityColors";
import type { ScuBoxSplits } from "@/lib/missions/catalogMission";
import { scuBoxSplitsForScu } from "@/lib/missions/catalogMission";
import { cargoBoxSplits } from "@/lib/missions/cargoBoxSplits";
import {
  boxCountsFromBreakdown,
  breakdownKey,
  enumerateBoxBreakdowns,
  type BoxBreakdownOption,
} from "@/lib/missions/boxBreakdownOptions";
import {
  missionScuAmounts,
  type MissionScuDraft,
} from "@/lib/missions/missionScuAmounts";
import type { HaulingChecklistRow } from "@/lib/missions/sessionChecklist";

import { screenshotRefsForMission } from "@/lib/missions/rowMissionScreenshots";
import type { SessionMission } from "@/lib/missions/sessionMissions";
import { missionTotalScu } from "@/lib/missions/sessionMissionObjectives";

export type SelectBoxBreakdownOptions = {
  /** Re-greedy other cargo lines with this mix’s preferred max. */
  applyPreferredMaxToRemaining?: boolean;
  /**
   * When propagating, skip already-corrected lines (default true).
   * Total-style picks pass false so one choice restyles every cargo type.
   */
  onlyUncorrected?: boolean;
};

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
   * Persist draft mission + nested delivery SCU. Caller should run
   * `missionScuAmounts.applyDraft` (validates delivery sums === totals).
   */
  onSaveScuDraft?: (draft: MissionScuDraft) => void;
};

type CargoLine = {
  commoditySlug: string;
  commodity: string;
  scu: number;
};

/**
 * Total crate mix for a style option: primary keeps the exact mix;
 * other cargo types use greedy fills under that preferred max.
 */
function aggregateSimpleStyleSplits(
  primarySlug: string,
  primaryBreakdown: ScuBoxSplits,
  lines: CargoLine[],
  styleMax: number,
): ScuBoxSplits {
  const map: Record<string, ScuBoxSplits> = {};
  for (const line of lines) {
    map[line.commoditySlug] =
      line.commoditySlug === primarySlug
        ? primaryBreakdown
        : scuBoxSplitsForScu(line.scu, styleMax);
  }
  return cargoBoxSplits.aggregate(map);
}

function ScuAmountInput({
  value,
  disabled,
  ariaLabel,
  onCommit,
  unlockOnClick = false,
  isUserCorrected = false,
}: {
  value: number;
  disabled?: boolean;
  ariaLabel: string;
  onCommit: (scu: number) => void;
  /** Location SCU: stay locked until the player clicks to edit. */
  unlockOnClick?: boolean;
  /** Player has overridden this stop (kept out of auto-rebalance). */
  isUserCorrected?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(String(value));
  const [isEditing, setIsEditing] = useState(false);
  useEffect(() => {
    setText(String(value));
  }, [value]);

  useEffect(() => {
    if (!isEditing) return;
    const node = inputRef.current;
    if (!node) return;
    node.focus();
    node.select();
  }, [isEditing]);

  const commit = () => {
    const parsed = Math.max(0, Math.floor(Number(text) || 0));
    setText(String(parsed));
    if (parsed !== value) onCommit(parsed);
  };

  const isLocked = Boolean(unlockOnClick && !isEditing && !disabled);

  return (
    <label className="inline-flex items-center gap-1.5">
      <span className="sr-only">{ariaLabel}</span>
      <input
        ref={inputRef}
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        disabled={disabled}
        readOnly={isLocked}
        value={text}
        aria-label={ariaLabel}
        aria-readonly={isLocked || undefined}
        title={
          isLocked
            ? "Click to edit — remaining stops rebalance"
            : isUserCorrected
              ? "Player override — excluded from auto-rebalance"
              : undefined
        }
        onPointerDown={(event) => {
          if (!isLocked) return;
          // Unlock before the browser treats the click as a dead read-only hit.
          event.preventDefault();
          setIsEditing(true);
        }}
        onChange={(event) => {
          if (isLocked) return;
          setText(event.target.value);
        }}
        onBlur={() => {
          commit();
          if (unlockOnClick) setIsEditing(false);
        }}
        onKeyDown={(event) => {
          if (isLocked) {
            event.preventDefault();
            return;
          }
          if (event.key === "Enter") {
            event.preventDefault();
            (event.target as HTMLInputElement).blur();
          }
        }}
        className={[
          "w-16 rounded-rsi border bg-rsi-bg-deep/60 px-2 py-1 font-mono text-sm tabular-nums text-rsi-text outline-none",
          isUserCorrected || isEditing
            ? "border-rsi-accent/55"
            : "border-rsi-border",
          isLocked
            ? "cursor-pointer hover:border-rsi-accent/40"
            : "focus:border-rsi-accent",
          disabled ? "cursor-not-allowed opacity-50" : "",
        ].join(" ")}
      />
      <span className="font-mono text-[0.55rem] uppercase tracking-[0.12em] text-rsi-text-muted">
        SCU
      </span>
    </label>
  );
}

function ExpandChevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className={[
        "h-3.5 w-3.5 shrink-0 text-rsi-text-muted transition-transform",
        expanded ? "rotate-90" : "",
      ].join(" ")}
      fill="currentColor"
    >
      <path d="M7.05 4.55a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 1 1-1.06-1.06L10.69 10 7.05 6.36a.75.75 0 0 1 0-1.06Z" />
    </svg>
  );
}

function draftsEqual(a: MissionScuDraft, b: MissionScuDraft): boolean {
  if (a.commodities.length !== b.commodities.length) return false;
  if (a.deliveries.length !== b.deliveries.length) return false;
  for (const [index, line] of a.commodities.entries()) {
    const other = b.commodities[index];
    if (!other) return false;
    if (line.commoditySlug !== other.commoditySlug || line.scu !== other.scu) {
      return false;
    }
  }
  for (const [index, line] of a.deliveries.entries()) {
    const other = b.deliveries[index];
    if (!other) return false;
    if (
      line.commoditySlug !== other.commoditySlug ||
      line.locationSlug !== other.locationSlug ||
      line.scu !== other.scu ||
      Boolean(line.isUserCorrected) !== Boolean(other.isUserCorrected)
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Correct crate sizes and SCU amounts for a session contract — condensed
 * cargo totals with expandable nested delivery SCU, plus crate-mix dropdowns.
 * SCU edits stay in a draft until Save (delivery sums must match totals).
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

  const isDirty = canEditScu && !draftsEqual(draft, baseline);

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
              ? "Edit cargo totals, expand a type, click a stop SCU to override it — other stops rebalance. Save when delivery stops sum to each cargo total."
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
                <CargoScuDraftSection
                  lines={lines}
                  draft={draft}
                  expandedSlugs={expandedSlugs}
                  disabled={disabled}
                  isDirty={isDirty}
                  saveError={saveError}
                  onToggle={toggleExpanded}
                  onChangeCommodity={setCommodityScu}
                  onChangeDelivery={setDeliveryScu}
                  onReset={handleCancelDraft}
                  onSave={handleSave}
                />
              ) : null}

              <BoxConfigTile
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

function CargoScuDraftSection({
  lines,
  draft,
  expandedSlugs,
  disabled,
  isDirty,
  saveError,
  onToggle,
  onChangeCommodity,
  onChangeDelivery,
  onReset,
  onSave,
}: {
  lines: CargoLine[];
  draft: MissionScuDraft;
  expandedSlugs: Set<string>;
  disabled: boolean;
  isDirty: boolean;
  saveError: string | null;
  onToggle: (commoditySlug: string) => void;
  onChangeCommodity: (commoditySlug: string, scu: number) => void;
  onChangeDelivery: (
    commoditySlug: string,
    locationSlug: string,
    scu: number,
  ) => void;
  onReset: () => void;
  onSave: () => void;
}) {
  return (
    <section className="rounded-rsi border border-rsi-border/80 bg-rsi-bg-deep/40 px-3 py-3 sm:px-4">
      <p className="font-mono text-[0.55rem] uppercase tracking-[0.16em] text-rsi-text-muted">
        Mission SCU
      </p>
      <ul className="mt-2.5 space-y-2">
        {lines.map((line) => {
          const cargoColor =
            resolveCommodityColorHex(null, null, line.commoditySlug) ??
            "var(--rsi-text-secondary)";
          const deliveries = draft.deliveries.filter(
            (entry) => entry.commoditySlug === line.commoditySlug,
          );
          const hasDeliveries = deliveries.length > 0;
          const expanded = expandedSlugs.has(line.commoditySlug);
          const deliverySum = deliveries.reduce(
            (sum, entry) => sum + Math.max(0, Math.floor(entry.scu)),
            0,
          );
          const matches =
            !hasDeliveries || deliverySum === Math.max(0, Math.floor(line.scu));

          return (
            <li
              key={line.commoditySlug}
              className="rounded-rsi border border-rsi-border/40 bg-rsi-surface/30"
            >
              <div className="flex flex-wrap items-center gap-2 px-2.5 py-2 sm:gap-3">
                {hasDeliveries ? (
                  <button
                    type="button"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-rsi text-rsi-text-secondary hover:bg-rsi-surface-raised hover:text-rsi-text"
                    aria-expanded={expanded}
                    aria-label={
                      expanded
                        ? `Hide ${line.commodity} delivery SCU`
                        : `Show ${line.commodity} delivery SCU`
                    }
                    onClick={() => onToggle(line.commoditySlug)}
                  >
                    <ExpandChevron expanded={expanded} />
                  </button>
                ) : (
                  <span className="inline-flex h-7 w-7" aria-hidden />
                )}
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <CommodityIcon
                    commoditySlug={line.commoditySlug}
                    label={line.commodity}
                    showTooltip={false}
                  />
                  <div className="min-w-0">
                    <p
                      className="truncate text-sm font-medium tracking-wide"
                      style={{ color: cargoColor }}
                    >
                      {line.commodity}
                    </p>
                    {hasDeliveries ? (
                      <p
                        className={[
                          "font-mono text-[0.55rem] uppercase tracking-[0.12em]",
                          matches
                            ? "text-rsi-text-muted"
                            : "text-rsi-danger",
                        ].join(" ")}
                      >
                        Total SCU: {deliverySum}/{line.scu}
                      </p>
                    ) : null}
                  </div>
                </div>
                <ScuAmountInput
                  value={line.scu}
                  disabled={disabled}
                  ariaLabel={`${line.commodity} mission SCU`}
                  onCommit={(scu) => onChangeCommodity(line.commoditySlug, scu)}
                />
              </div>

              {hasDeliveries && expanded ? (
                <ul className="space-y-2 border-t border-rsi-border/40 px-2.5 py-2.5 pl-11 sm:pl-12">
                  {deliveries.map((delivery) => (
                    <li
                      key={`${delivery.locationSlug}:${delivery.commoditySlug}`}
                      className="flex flex-wrap items-center justify-between gap-3"
                    >
                      <p className="min-w-0 truncate text-sm text-rsi-text-secondary">
                        {delivery.locationLabel}
                      </p>
                      <ScuAmountInput
                        value={delivery.scu}
                        disabled={disabled}
                        unlockOnClick
                        isUserCorrected={Boolean(delivery.isUserCorrected)}
                        ariaLabel={`${delivery.locationLabel} ${delivery.commodity} delivery SCU`}
                        onCommit={(scu) =>
                          onChangeDelivery(
                            delivery.commoditySlug,
                            delivery.locationSlug,
                            scu,
                          )
                        }
                      />
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>

      {isDirty || saveError ? (
        <div className="mt-3 space-y-2 border-t border-rsi-border/40 pt-3">
          {saveError ? (
            <p className="text-sm text-rsi-danger" role="alert">
              {saveError}
            </p>
          ) : (
            <p className="font-mono text-[0.55rem] uppercase tracking-[0.12em] text-rsi-text-muted">
              Unsaved SCU changes
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onReset}>
              Reset
            </Button>
            <Button type="button" variant="primary" onClick={onSave}>
              Save
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function BoxConfigTile({
  mission,
  primaryLine,
  lines,
  disabled,
  onSelectTotal,
  onSelectCargo,
}: {
  mission: SessionMission;
  primaryLine: CargoLine;
  lines: CargoLine[];
  disabled: boolean;
  onSelectTotal: (breakdown: ScuBoxSplits) => void;
  onSelectCargo: (commoditySlug: string, breakdown: ScuBoxSplits) => void;
}) {
  const isMultiCargo = lines.length > 1;

  const primarySelected =
    mission.scuCargoBoxSplits?.[primaryLine.commoditySlug] ??
    mission.scuCargoBoxSplitsAutoSelected?.[primaryLine.commoditySlug] ??
    scuBoxSplitsForScu(primaryLine.scu, mission.scuMaxContainerSize ?? null);
  const primaryAuto =
    mission.scuCargoBoxSplitsAutoSelected?.[primaryLine.commoditySlug] ??
    scuBoxSplitsForScu(primaryLine.scu, mission.scuMaxContainerSize ?? null);

  const totalAuto = cargoBoxSplits.autoSelectedAggregate(mission);
  const totalSelected = cargoBoxSplits.selectedAggregate(mission);

  const totalStyleOptions = useMemo(() => {
    const primaryOptions = enumerateBoxBreakdowns(
      primaryLine.scu,
      mission.scuMaxContainerSize,
      16,
    );
    return primaryOptions.map((option): BoxBreakdownOption & {
      value: ScuBoxSplits;
    } => {
      const preferredMax = cargoBoxSplits.preferredMaxFromSplits(
        option.breakdown,
      );
      const styleMax =
        preferredMax != null
          ? cargoBoxSplits.effectivePreferredMax(mission, preferredMax)
          : null;
      const total =
        styleMax != null && isMultiCargo
          ? aggregateSimpleStyleSplits(
              primaryLine.commoditySlug,
              option.breakdown,
              lines,
              styleMax,
            )
          : option.breakdown;
      const boxCounts = boxCountsFromBreakdown(total);
      return {
        ...option,
        id: `total:${option.id}`,
        breakdown: total,
        boxCounts,
        boxCount: boxCounts.reduce((sum, entry) => sum + entry.count, 0),
        label: option.label,
        value: option.breakdown,
        isDefault: breakdownKey(option.breakdown) === breakdownKey(primaryAuto),
      };
    });
  }, [
    primaryLine.commoditySlug,
    primaryLine.scu,
    primaryAuto,
    mission,
    lines,
    isMultiCargo,
  ]);

  return (
    <div className="space-y-3 rounded-rsi border border-rsi-border/80 bg-rsi-bg-deep/40 px-3 py-3 sm:px-4 sm:py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium tracking-wide text-rsi-text">
            {isMultiCargo ? "Total" : "Crate mix"}
          </p>
          {isMultiCargo ? (
            <p className="font-mono text-[0.55rem] uppercase tracking-[0.12em] text-rsi-text-muted">
              All cargo
            </p>
          ) : null}
        </div>
        <MissionBoxBreakdownPicker
          totalScu={primaryLine.scu}
          scuMaxContainerSize={mission.scuMaxContainerSize}
          selected={isMultiCargo ? totalSelected : primarySelected}
          autoSelected={isMultiCargo ? totalAuto : primaryAuto}
          options={isMultiCargo ? totalStyleOptions : undefined}
          onSelect={onSelectTotal}
          disabled={disabled}
          label={null}
          optionLimit={16}
        />
      </div>

      {isMultiCargo ? (
        <ul className="space-y-2.5 border-t border-rsi-border/50 pt-3">
          {lines.map((line) => {
            const cargoColor =
              resolveCommodityColorHex(null, null, line.commoditySlug) ??
              "var(--rsi-text-secondary)";
            const selected =
              mission.scuCargoBoxSplits?.[line.commoditySlug] ??
              mission.scuCargoBoxSplitsAutoSelected?.[line.commoditySlug] ??
              scuBoxSplitsForScu(line.scu, mission.scuMaxContainerSize ?? null);
            const autoSelected =
              mission.scuCargoBoxSplitsAutoSelected?.[line.commoditySlug] ??
              scuBoxSplitsForScu(line.scu, mission.scuMaxContainerSize ?? null);
            return (
              <li
                key={line.commoditySlug}
                className="flex flex-wrap items-center justify-between gap-3"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <CommodityIcon
                    commoditySlug={line.commoditySlug}
                    label={line.commodity}
                    showTooltip={false}
                  />
                  <div className="min-w-0">
                    <p
                      className="truncate text-sm font-medium tracking-wide"
                      style={{ color: cargoColor }}
                    >
                      {line.commodity}
                    </p>
                    <p className="font-mono text-[0.55rem] uppercase tracking-[0.12em] text-rsi-text-muted">
                      {line.scu} SCU
                    </p>
                  </div>
                </div>
                <MissionBoxBreakdownPicker
                  totalScu={line.scu}
                  scuMaxContainerSize={mission.scuMaxContainerSize}
                  selected={selected}
                  autoSelected={autoSelected}
                  onSelect={(breakdown) =>
                    onSelectCargo(line.commoditySlug, breakdown)
                  }
                  disabled={disabled}
                  color={cargoColor}
                  label={null}
                  optionLimit={16}
                />
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
