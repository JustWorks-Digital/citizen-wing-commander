"use client";

import { useMemo } from "react";
import { CargoBoxCountIcons } from "@/components/ships/CargoBoxSizeIcon";
import type { CargoBoxBreakdown } from "@/lib/missions/catalogMission";
import { boxBreakdownForScu } from "@/lib/missions/catalogMission";
import { enumerateBoxBreakdowns } from "@/lib/missions/boxBreakdownOptions";

function breakdownId(breakdown: CargoBoxBreakdown): string {
  return `8:${breakdown.size8}|4:${breakdown.size4}|2:${breakdown.size2}|1:${breakdown.size1}`;
}

export type MissionBoxBreakdownPickerProps = {
  totalScu: number;
  maxContainerScu?: number | null;
  selected?: CargoBoxBreakdown | null;
  onSelect: (breakdown: CargoBoxBreakdown) => void;
  disabled?: boolean;
};

/**
 * Row of selectable crate-mix options for a session contract.
 * Greedy default is marked; user pick drives 2D/3D bay packing.
 */
export function MissionBoxBreakdownPicker({
  totalScu,
  maxContainerScu = null,
  selected = null,
  onSelect,
  disabled = false,
}: MissionBoxBreakdownPickerProps) {
  const options = useMemo(
    () => enumerateBoxBreakdowns(totalScu, maxContainerScu, 10),
    [totalScu, maxContainerScu],
  );

  const selectedId = useMemo(() => {
    if (selected) return breakdownId(selected);
    return breakdownId(boxBreakdownForScu(totalScu, maxContainerScu));
  }, [selected, totalScu, maxContainerScu]);

  if (totalScu <= 0 || options.length === 0) return null;

  return (
    <div className="mt-3">
      <p className="font-mono text-[0.55rem] uppercase tracking-[0.16em] text-rsi-text-muted">
        Crate mix
      </p>
      <div
        className="mt-1.5 flex gap-1.5 overflow-x-auto pb-1"
        role="listbox"
        aria-label="Cargo crate breakdown options"
      >
        {options.map((option) => {
          const isSelected = option.id === selectedId;
          return (
            <button
              key={option.id}
              type="button"
              role="option"
              aria-selected={isSelected}
              disabled={disabled}
              title={option.label}
              onClick={() => onSelect(option.breakdown)}
              className={[
                "shrink-0 rounded-rsi border px-2 py-1.5 transition-colors",
                isSelected
                  ? "border-rsi-accent bg-rsi-accent-muted/40"
                  : "border-rsi-border bg-rsi-surface/80 hover:border-rsi-border-strong",
                disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
              ].join(" ")}
            >
              <CargoBoxCountIcons
                boxCounts={option.boxCounts}
                color={
                  isSelected ? "var(--rsi-accent)" : "var(--rsi-text-muted)"
                }
                className="justify-center"
              />
              <span className="mt-1 block text-center font-mono text-[0.55rem] tabular-nums text-rsi-text-muted">
                {option.boxCount} boxes
                {option.isDefault ? " · auto" : ""}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
