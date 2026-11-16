"use client";

import { useEffect, useMemo, useState } from "react";
import { CommodityIcon } from "@/components/missions/CommodityIcon";
import { MissionBoxBreakdownPicker } from "@/components/missions/MissionBoxBreakdownPicker";
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
  type MissionStationScuLine,
} from "@/lib/missions/missionScuAmounts";
import type { HaulingChecklistRow } from "@/lib/missions/mockSession";
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
  /** Route rows — used for live per-station SCU amounts. */
  rows?: HaulingChecklistRow[] | null;
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
  /** Persist a mission-level commodity SCU total. */
  onChangeCommodityScu?: (commoditySlug: string, scu: number) => void;
  /** Persist SCU for one commodity at one collect/deliver station. */
  onChangeStationScu?: (input: {
    role: "pickup" | "delivery";
    locationKey: string;
    commoditySlug: string;
    scu: number;
  }) => void;
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
}: {
  value: number;
  disabled?: boolean;
  ariaLabel: string;
  onCommit: (scu: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = () => {
    const parsed = Math.max(0, Math.floor(Number(draft) || 0));
    setDraft(String(parsed));
    if (parsed !== value) onCommit(parsed);
  };

  return (
    <label className="inline-flex items-center gap-1.5">
      <span className="sr-only">{ariaLabel}</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        disabled={disabled}
        value={draft}
        aria-label={ariaLabel}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            (event.target as HTMLInputElement).blur();
          }
        }}
        className="w-16 rounded-rsi border border-rsi-border bg-rsi-bg-deep/60 px-2 py-1 font-mono text-sm tabular-nums text-rsi-text outline-none focus:border-rsi-accent disabled:cursor-not-allowed disabled:opacity-50"
      />
      <span className="font-mono text-[0.55rem] uppercase tracking-[0.12em] text-rsi-text-muted">
        SCU
      </span>
    </label>
  );
}

/**
 * Correct crate sizes and SCU amounts for a session contract — mission totals,
 * per-station collect/deliver amounts, and crate-mix dropdowns.
 */
export function StopMissionBoxConfigModal({
  mission,
  rows = null,
  onClose,
  onSelectBoxBreakdown,
  onChangeCommodityScu,
  onChangeStationScu,
}: StopMissionBoxConfigModalProps) {
  const reward =
    mission.rewardDisplay ??
    (mission.rewardAuec > 0
      ? `${mission.rewardAuec.toLocaleString()} aUEC`
      : null);
  const disabled = mission.isCompleted;
  const canEditScu =
    !disabled && Boolean(onChangeCommodityScu || onChangeStationScu);

  const ready = useMemo(() => cargoBoxSplits.withDefaults(mission), [mission]);
  const lines = useMemo(
    () =>
      [...cargoBoxSplits.commodityLines(ready)].sort(
        (a, b) =>
          b.scu - a.scu || a.commoditySlug.localeCompare(b.commoditySlug),
      ),
    [ready],
  );
  const isMultiCargo = lines.length > 1;
  const primaryLine = lines[0] ?? null;
  const stationLines = useMemo(
    () => missionScuAmounts.stationLines(mission, rows),
    [mission, rows],
  );
  const pickupStations = stationLines.filter((line) => line.role === "pickup");
  const deliveryStations = stationLines.filter(
    (line) => line.role === "delivery",
  );
  const showStations =
    Boolean(onChangeStationScu) &&
    (pickupStations.length > 0 || deliveryStations.length > 0);
  const missionScu = missionTotalScu(mission);

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
          <h2 className="mt-0.5 truncate text-base font-semibold tracking-wide text-rsi-text sm:text-lg">
            {mission.title}
          </h2>
          <p className="mt-1 truncate font-mono text-[0.55rem] uppercase tracking-[0.12em] text-rsi-text-muted">
            {[
              mission.contractor || null,
              reward,
              missionScu > 0 ? `${missionScu} SCU` : null,
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
              ? isMultiCargo
                ? "Correct mission or station SCU, then set crate styles."
                : "Correct SCU amounts, then pick the crate mix."
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
              {onChangeCommodityScu ? (
                <MissionScuSection
                  lines={lines}
                  disabled={disabled}
                  onChange={onChangeCommodityScu}
                />
              ) : null}

              {showStations ? (
                <StationScuSection
                  pickupStations={pickupStations}
                  deliveryStations={deliveryStations}
                  disabled={disabled}
                  onChange={onChangeStationScu!}
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

function MissionScuSection({
  lines,
  disabled,
  onChange,
}: {
  lines: CargoLine[];
  disabled: boolean;
  onChange: (commoditySlug: string, scu: number) => void;
}) {
  return (
    <section className="rounded-rsi border border-rsi-border/80 bg-rsi-bg-deep/40 px-3 py-3 sm:px-4">
      <p className="font-mono text-[0.55rem] uppercase tracking-[0.16em] text-rsi-text-muted">
        Mission SCU
      </p>
      <ul className="mt-2.5 space-y-2.5">
        {lines.map((line) => {
          const cargoColor =
            resolveCommodityColorHex(null, null, line.commoditySlug) ??
            "var(--rsi-text-secondary)";
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
                <p
                  className="truncate text-sm font-medium tracking-wide"
                  style={{ color: cargoColor }}
                >
                  {line.commodity}
                </p>
              </div>
              <ScuAmountInput
                value={line.scu}
                disabled={disabled}
                ariaLabel={`${line.commodity} mission SCU`}
                onCommit={(scu) => onChange(line.commoditySlug, scu)}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function StationScuSection({
  pickupStations,
  deliveryStations,
  disabled,
  onChange,
}: {
  pickupStations: MissionStationScuLine[];
  deliveryStations: MissionStationScuLine[];
  disabled: boolean;
  onChange: (input: {
    role: "pickup" | "delivery";
    locationKey: string;
    commoditySlug: string;
    scu: number;
  }) => void;
}) {
  const renderGroup = (
    title: string,
    stations: MissionStationScuLine[],
  ) => {
    if (stations.length === 0) return null;
    return (
      <div>
        <p className="font-mono text-[0.55rem] uppercase tracking-[0.16em] text-rsi-text-muted">
          {title}
        </p>
        <ul className="mt-2 space-y-2.5">
          {stations.map((line) => (
            <li
              key={`${line.role}:${line.locationSlug}:${line.commoditySlug}`}
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium tracking-wide text-rsi-text">
                  {line.locationLabel}
                </p>
                <p className="truncate font-mono text-[0.55rem] uppercase tracking-[0.12em] text-rsi-text-muted">
                  {line.commodity}
                </p>
              </div>
              <ScuAmountInput
                value={line.scu}
                disabled={disabled}
                ariaLabel={`${line.locationLabel} ${line.commodity} ${line.role} SCU`}
                onCommit={(scu) =>
                  onChange({
                    role: line.role,
                    locationKey: line.locationKey,
                    commoditySlug: line.commoditySlug,
                    scu,
                  })
                }
              />
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <section className="space-y-3 rounded-rsi border border-rsi-border/80 bg-rsi-bg-deep/40 px-3 py-3 sm:px-4">
      <p className="font-mono text-[0.55rem] uppercase tracking-[0.16em] text-rsi-text-muted">
        Station SCU
      </p>
      {renderGroup("Collect", pickupStations)}
      {renderGroup("Deliver", deliveryStations)}
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
    scuBoxSplitsForScu(primaryLine.scu, mission.maxContainerScu ?? null);
  const primaryAuto =
    mission.scuCargoBoxSplitsAutoSelected?.[primaryLine.commoditySlug] ??
    scuBoxSplitsForScu(primaryLine.scu, mission.maxContainerScu ?? null);

  const totalAuto =
    mission.scuBoxSplitsAutoSelected ??
    cargoBoxSplits.aggregate(mission.scuCargoBoxSplitsAutoSelected);
  const totalSelected =
    mission.scuBoxSplits ??
    cargoBoxSplits.aggregate(mission.scuCargoBoxSplits) ??
    totalAuto;

  const totalStyleOptions = useMemo(() => {
    const primaryOptions = enumerateBoxBreakdowns(
      primaryLine.scu,
      mission.maxContainerScu,
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
          maxContainerScu={mission.maxContainerScu}
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
              scuBoxSplitsForScu(line.scu, mission.maxContainerScu ?? null);
            const autoSelected =
              mission.scuCargoBoxSplitsAutoSelected?.[line.commoditySlug] ??
              scuBoxSplitsForScu(line.scu, mission.maxContainerScu ?? null);
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
                  maxContainerScu={mission.maxContainerScu}
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
