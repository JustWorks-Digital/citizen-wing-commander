"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { CargoBoxCountIcons } from "@/components/ships/CargoBoxSizeIcon";
import type { ScuBoxSplits } from "@/lib/missions/catalogMission";
import { scuBoxSplitsForScu } from "@/lib/missions/catalogMission";
import {
  boxCountsFromBreakdown,
  breakdownKey,
  enumerateBoxBreakdowns,
  type BoxBreakdownOption,
} from "@/lib/missions/boxBreakdownOptions";

export type BoxBreakdownPickerOption = BoxBreakdownOption & {
  /** Value passed to `onSelect` (defaults to `breakdown`). */
  value?: ScuBoxSplits;
};

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

type MenuPosition = {
  top: number;
  left: number;
  minWidth: number;
  maxHeight: number;
  openUp: boolean;
};

/** Match options by box count (exact first, then digit substring). */
export function matchesBoxCountQuery(
  boxCount: number,
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const asText = String(boxCount);
  const withLabel = `${boxCount} boxes`;
  if (withLabel.includes(needle) || asText.includes(needle)) return true;
  const digits = needle.replace(/\D/g, "");
  if (!digits) return false;
  return asText.includes(digits);
}

function boxCountQueryRank(boxCount: number, query: string): number {
  const needle = query.trim().toLowerCase();
  if (!needle) return 0;
  const asText = String(boxCount);
  const digits = needle.replace(/\D/g, "");
  if (asText === needle || asText === digits) return 0;
  if (asText.startsWith(digits || needle)) return 1;
  return 2;
}

export type MissionBoxBreakdownPickerProps = {
  totalScu: number;
  maxContainerScu?: number | null;
  selected?: ScuBoxSplits | null;
  /** Captured greedy/capped default for comparison with `selected`. */
  autoSelected?: ScuBoxSplits | null;
  onSelect: (breakdown: ScuBoxSplits) => void;
  disabled?: boolean;
  /** Override enumerated options (e.g. aggregate style previews). */
  options?: BoxBreakdownPickerOption[];
  /** Icon tint (default accent when selected). */
  color?: string;
  /** Field label above the trigger; pass `null` to hide. */
  label?: string | null;
  className?: string;
  /** Max enumerated options when `options` is omitted. */
  optionLimit?: number;
};

/**
 * Compact dropdown of box-type options for a session contract.
 * Menu portals to `document.body` so modal overflow cannot clip it.
 * Search filters by number of boxes.
 */
export function MissionBoxBreakdownPicker({
  totalScu,
  maxContainerScu = null,
  selected = null,
  autoSelected = null,
  onSelect,
  disabled = false,
  options: optionsProp,
  color,
  label = "Box types",
  className,
  optionLimit = 10,
}: MissionBoxBreakdownPickerProps) {
  const listId = useId();
  const searchId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);

  const enumerated = useMemo(
    () => enumerateBoxBreakdowns(totalScu, maxContainerScu, optionLimit),
    [totalScu, maxContainerScu, optionLimit],
  );
  // Enumerated rows are valid picker options (`value` optional).
  const options: BoxBreakdownPickerOption[] = optionsProp ?? enumerated;

  const filteredOptions = useMemo(() => {
    const matched = options.filter((option) =>
      matchesBoxCountQuery(option.boxCount, query),
    );
    if (!query.trim()) return matched;
    return [...matched].sort(
      (a, b) =>
        boxCountQueryRank(a.boxCount, query) -
          boxCountQueryRank(b.boxCount, query) ||
        a.boxCount - b.boxCount,
    );
  }, [options, query]);

  const autoId = useMemo(() => {
    if (autoSelected) return breakdownKey(autoSelected);
    if (totalScu <= 0) return null;
    return breakdownKey(scuBoxSplitsForScu(totalScu, maxContainerScu));
  }, [autoSelected, totalScu, maxContainerScu]);

  const selectedId = useMemo(() => {
    if (selected) return breakdownKey(selected);
    return autoId;
  }, [selected, autoId]);

  const isUserCorrected = Boolean(autoId && selectedId && selectedId !== autoId);

  const selectedOption = useMemo(() => {
    if (selectedId) {
      const byDisplay = options.find(
        (option) => breakdownKey(option.breakdown) === selectedId,
      );
      if (byDisplay) return byDisplay;
      const byValue = options.find((option) => {
        const valueId = breakdownKey(option.value ?? option.breakdown);
        return option.id === selectedId || valueId === selectedId;
      });
      if (byValue) return byValue;
    }
    // Custom / overridden mix — keep picker mounted; trigger uses `selected`.
    if (selected) return null;
    return options[0] ?? null;
  }, [options, selectedId, selected]);

  const closeMenu = () => {
    setOpen(false);
    setQuery("");
  };

  const updateMenuPosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const gap = 4;
    const viewportPad = 8;
    const idealHeight = 320;
    const spaceBelow = window.innerHeight - rect.bottom - viewportPad;
    const spaceAbove = rect.top - viewportPad;
    // Prefer the side with more room (ties open upward for modal layouts).
    const openUp = spaceAbove >= spaceBelow;
    const available = Math.max(0, (openUp ? spaceAbove : spaceBelow) - gap);
    const maxHeight = Math.min(idealHeight, available);
    const minWidth = Math.max(rect.width, 320);
    let left = rect.left;
    if (left + minWidth > window.innerWidth - viewportPad) {
      left = Math.min(
        rect.right - minWidth,
        window.innerWidth - viewportPad - minWidth,
      );
      left = Math.max(viewportPad, left);
    }
    setMenuPosition({
      top: openUp ? rect.top - gap : rect.bottom + gap,
      left,
      minWidth,
      maxHeight: Math.max(96, maxHeight),
      openUp,
    });
  };

  const displayOptions = useMemo(() => {
    if (!menuPosition?.openUp) return filteredOptions;
    // Current amount nearest the trigger; more options extend upward.
    return [...filteredOptions].reverse();
  }, [filteredOptions, menuPosition?.openUp]);

  useLayoutEffect(() => {
    if (!open) {
      setMenuPosition(null);
      return;
    }
    updateMenuPosition();
    const onReposition = (event?: Event) => {
      // List scroll fires capture-phase window scroll — ignore it or the
      // menu re-anchors every frame and wheel feels broken.
      const target = event?.target;
      if (
        target instanceof Node &&
        menuRef.current?.contains(target)
      ) {
        return;
      }
      updateMenuPosition();
    };
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, filteredOptions.length, query]);

  useLayoutEffect(() => {
    if (!open || !menuPosition) return;
    const list = menuRef.current?.querySelector('[role="listbox"]');
    const selectedEl = list?.querySelector(
      '[role="option"][aria-selected="true"]',
    );
    if (!(list instanceof HTMLElement) || !(selectedEl instanceof HTMLElement)) {
      return;
    }
    // Scroll only the list — never ancestors (modal / body).
    const listRect = list.getBoundingClientRect();
    const optionRect = selectedEl.getBoundingClientRect();
    if (optionRect.top < listRect.top) {
      list.scrollTop -= listRect.top - optionRect.top;
    } else if (optionRect.bottom > listRect.bottom) {
      list.scrollTop += optionRect.bottom - listRect.bottom;
    }
  }, [open, menuPosition, displayOptions, selectedId]);

  useEffect(() => {
    if (!open) return;
    const id = window.requestAnimationFrame(() => {
      searchRef.current?.focus();
      searchRef.current?.select();
    });
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      closeMenu();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (disabled) closeMenu();
  }, [disabled]);

  if (options.length === 0) return null;
  if (!selectedOption && !selected) return null;

  const triggerCounts = selected
    ? boxCountsFromBreakdown(selected)
    : (selectedOption?.boxCounts ?? []);
  const triggerBoxCount = triggerCounts.reduce(
    (sum, entry) => sum + entry.count,
    0,
  );
  const iconColor = color ?? "var(--rsi-accent)";
  const triggerCorrected =
    isUserCorrected || (selected != null && selectedOption == null);

  const menu =
    open && menuPosition && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              // Always pin with `top` (never `bottom`) so maxHeight + list
              // scroll stay stable while the menu is open.
              top: menuPosition.openUp
                ? menuPosition.top - menuPosition.maxHeight
                : menuPosition.top,
              left: menuPosition.left,
              minWidth: menuPosition.minWidth,
              height: menuPosition.maxHeight,
              zIndex: 80,
            }}
            className="flex flex-col overflow-hidden rounded-rsi border border-rsi-border bg-rsi-surface shadow-rsi-panel"
          >
            <div className="shrink-0 border-b border-rsi-border/80 p-2">
              <label htmlFor={searchId} className="sr-only">
                Search by number of boxes
              </label>
              <input
                ref={searchRef}
                id={searchId}
                type="search"
                inputMode="numeric"
                value={query}
                placeholder="Filter by box count…"
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && filteredOptions[0]) {
                    event.preventDefault();
                    const option = filteredOptions[0]!;
                    onSelect(option.value ?? option.breakdown);
                    closeMenu();
                  }
                }}
                className="w-full rounded-rsi border border-rsi-border bg-rsi-bg-deep/60 px-2.5 py-1.5 font-mono text-[0.7rem] text-rsi-text outline-none placeholder:text-rsi-text-muted focus:border-rsi-accent"
              />
            </div>
            <ul
              id={listId}
              role="listbox"
              aria-label={label ?? "Box type options"}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
            >
              {displayOptions.length === 0 ? (
                <li className="px-2.5 py-2 font-mono text-[0.6rem] text-rsi-text-muted">
                  No mixes with that box count
                </li>
              ) : (
                displayOptions.map((option) => {
                  const value = option.value ?? option.breakdown;
                  const valueId = breakdownKey(value);
                  const isSelected =
                    selectedOption != null &&
                    (option.id === selectedOption.id ||
                      valueId === selectedId ||
                      breakdownKey(option.breakdown) === selectedId);
                  return (
                    <li key={option.id} role="presentation">
                      <button
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        disabled={disabled}
                        title={option.label}
                        onClick={() => {
                          onSelect(value);
                          closeMenu();
                        }}
                        className={[
                          "flex w-full items-center justify-start gap-6 px-3 py-2.5 text-left transition-colors",
                          isSelected
                            ? "bg-rsi-accent-muted/40"
                            : "hover:bg-rsi-bg-deep/60",
                          disabled
                            ? "cursor-not-allowed opacity-50"
                            : "cursor-pointer",
                        ].join(" ")}
                      >
                        <span className="shrink-0 whitespace-nowrap font-mono text-sm tabular-nums text-rsi-text-muted">
                          {option.boxCount} boxes
                          {autoId &&
                          (option.id === autoId || valueId === autoId)
                            ? " (A)"
                            : ""}
                        </span>
                        <CargoBoxCountIcons
                          boxCounts={option.boxCounts}
                          color={
                            isSelected
                              ? iconColor
                              : (color ?? "var(--rsi-text-muted)")
                          }
                          className="flex-nowrap gap-x-2 [&_svg]:!size-7 [&_span]:text-xs"
                        />
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>,
          document.body,
        )
      : null;

  return (
    <div
      ref={rootRef}
      className={["relative w-fit max-w-full", className].filter(Boolean).join(" ")}
    >
      {label != null ? (
        <p className="font-mono text-[0.55rem] uppercase tracking-[0.16em] text-rsi-text-muted">
          {label}
        </p>
      ) : null}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((prev) => !prev)}
        className={[
          "flex w-fit max-w-full items-center gap-3 rounded-rsi border px-3 py-2.5 text-left transition-colors",
          label != null ? "mt-1.5" : "",
          open
            ? "border-rsi-accent bg-rsi-accent-muted/30"
            : "border-rsi-border bg-rsi-surface/80 hover:border-rsi-border-strong",
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        ].join(" ")}
      >
        <span className="flex items-center justify-start gap-3">
          <span className="shrink-0 whitespace-nowrap font-mono text-sm tabular-nums text-rsi-text-muted">
            {triggerBoxCount} boxes
            {autoId && selectedId === autoId && !triggerCorrected
              ? " (A)"
              : ""}
            {triggerCorrected ? " (M)" : ""}
          </span>
          <CargoBoxCountIcons
            boxCounts={triggerCounts}
            color={iconColor}
            className="flex-nowrap gap-x-2 [&_svg]:!size-7 [&_span]:text-xs"
          />
        </span>
        <ChevronDownIcon open={open} />
      </button>
      {menu}
    </div>
  );
}
