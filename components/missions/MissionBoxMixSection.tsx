"use client";

import { useMemo } from "react";
import { CommodityIcon } from "@/components/missions/CommodityIcon";
import { MissionBoxBreakdownPicker } from "@/components/missions/MissionBoxBreakdownPicker";
import { resolveCommodityColorHex } from "@/lib/fixtures/commodityColors";
import { cargoBoxSplits } from "@/lib/missions/cargoBoxSplits";
import type { ScuBoxSplits } from "@/lib/missions/catalogMission";
import { scuBoxSplitsForScu } from "@/lib/missions/catalogMission";
import type { SessionMission } from "@/lib/missions/sessionMissions";

export type MissionBoxMixCargoLine = {
  commoditySlug: string;
  commodity: string;
  scu: number;
};

export type MissionBoxMixSectionProps = {
  mission: SessionMission;
  primaryLine: MissionBoxMixCargoLine;
  lines: MissionBoxMixCargoLine[];
  disabled: boolean;
  onSelectTotal: (breakdown: ScuBoxSplits) => void;
  onSelectCargo: (commoditySlug: string, breakdown: ScuBoxSplits) => void;
};

/**
 * Total + per-cargo crate-mix pickers for the box-types modal.
 * Multi-cargo “Total” options come from `cargoBoxSplits.totalStyleOptions`.
 */
export function MissionBoxMixSection({
  mission,
  primaryLine,
  lines,
  disabled,
  onSelectTotal,
  onSelectCargo,
}: MissionBoxMixSectionProps) {
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

  const totalStyleOptions = useMemo(
    () =>
      cargoBoxSplits.totalStyleOptions(mission, lines, primaryLine, 16),
    [mission, lines, primaryLine],
  );

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
