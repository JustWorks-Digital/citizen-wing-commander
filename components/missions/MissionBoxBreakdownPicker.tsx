"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CargoBoxCountIcons } from "@/components/ships/CargoBoxSizeIcon";
import type { ScuBoxSplits } from "@/lib/missions/catalogMission";
import { scuBoxSplitsForScu } from "@/lib/missions/catalogMission";
import { enumerateBoxBreakdowns } from "@/lib/missions/boxBreakdownOptions";

function breakdownId(breakdown: ScuBoxSplits): string {
  return `8:${breakdown.scuEight}|4:${breakdown.scuFour}|2:${breakdown.scuTwo}|1:${breakdown.scuOne}`;
}

function ChevronDownIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className={[
        "h-3.5 w-3.5 shrink-0 text-rsi-text-muted transition-transform",
        open ? "rotate-180" : "",
      ].join(" ")}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export type MissionBoxBreakdownPickerProps = {
  totalScu: number;
  maxContainerScu?: number | null;
  selected?: ScuBoxSplits | null;
  onSelect: (breakdown: ScuBoxSplits) => void;
  disabled?: boolean;
};

/**
 * Compact dropdown of box-type options for a session contract.
 * One line per option; greedy default is marked.
 */
export function MissionBoxBreakdownPicker({
  totalScu,
  maxContainerScu = null,
  selected = null,
  onSelect,
  disabled = false,
}: MissionBoxBreakdownPickerProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const options = useMemo(
    () => enumerateBoxBreakdowns(totalScu, maxContainerScu, 10),
    [totalScu, maxContainerScu],
  );

  const selectedId = useMemo(() => {
    if (selected) return breakdownId(selected);
    return breakdownId(scuBoxSplitsForScu(totalScu, maxContainerScu));
  }, [selected, totalScu, maxContainerScu]);

  const selectedOption =
    options.find((option) => option.id === selectedId) ?? options[0] ?? null;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  if (totalScu <= 0 || options.length === 0 || !selectedOption) return null;

  return (
    <div ref={rootRef} className="relative mt-3 w-fit max-w-full">
      <p className="font-mono text-[0.55rem] uppercase tracking-[0.16em] text-rsi-text-muted">
        Box types
      </p>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((prev) => !prev)}
        className={[
          "mt-1.5 flex w-fit max-w-full items-center gap-2 rounded-rsi border px-2.5 py-1.5 text-left transition-colors",
          open
            ? "border-rsi-accent bg-rsi-accent-muted/30"
            : "border-rsi-border bg-rsi-surface/80 hover:border-rsi-border-strong",
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        ].join(" ")}
      >
        <span className="flex items-center justify-start gap-2">
          <CargoBoxCountIcons
            boxCounts={selectedOption.boxCounts}
            color="var(--rsi-accent)"
            className="flex-nowrap"
          />
          <span
            aria-hidden
            className="h-3 w-px shrink-0 bg-rsi-border"
          />
          <span className="shrink-0 font-mono text-[0.6rem] tabular-nums text-rsi-text-muted">
            {selectedOption.boxCount} boxes
            {selectedOption.isDefault ? " (default)" : ""}
          </span>
        </span>
        <ChevronDownIcon open={open} />
      </button>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Box type options"
          className="absolute z-20 mt-1 max-h-56 w-max min-w-full overflow-y-auto rounded-rsi border border-rsi-border bg-rsi-surface shadow-rsi-panel"
        >
          {options.map((option) => {
            const isSelected = option.id === selectedId;
            return (
              <li key={option.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={disabled}
                  title={option.label}
                  onClick={() => {
                    onSelect(option.breakdown);
                    setOpen(false);
                  }}
                  className={[
                    "flex w-full items-center justify-start gap-2 px-2.5 py-1.5 text-left transition-colors",
                    isSelected
                      ? "bg-rsi-accent-muted/40"
                      : "hover:bg-rsi-bg-deep/60",
                    disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
                  ].join(" ")}
                >
                  <CargoBoxCountIcons
                    boxCounts={option.boxCounts}
                    color={
                      isSelected
                        ? "var(--rsi-accent)"
                        : "var(--rsi-text-muted)"
                    }
                    className="flex-nowrap"
                  />
                  <span
                    aria-hidden
                    className="h-3 w-px shrink-0 bg-rsi-border"
                  />
                  <span className="shrink-0 font-mono text-[0.6rem] tabular-nums text-rsi-text-muted">
                    {option.boxCount} boxes
                    {option.isDefault ? " (default)" : ""}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
