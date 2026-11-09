"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

export type SearchableSelectProps = {
  label: string;
  /** Selected values (multi-select). */
  values: string[];
  options: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  /** When false, label is only used for accessibility (default true). */
  showLabel?: boolean;
  disabled?: boolean;
};

function filterOptions(options: string[], query: string): string[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return options;
  return options.filter((option) => option.toLowerCase().includes(needle));
}

function summarizeSelection(values: string[]): string {
  if (values.length === 0) return "";
  if (values.length === 1) return values[0]!;
  if (values.length === 2) return `${values[0]}, ${values[1]}`;
  return `${values.length} selected`;
}

/**
 * Compact searchable multi-select for filter bars and similar chrome.
 */
export function SearchableSelect({
  label,
  values,
  options,
  onChange,
  placeholder = "",
  showLabel = true,
  disabled = false,
}: SearchableSelectProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);

  const selectedSet = useMemo(() => new Set(values), [values]);

  const filtered = useMemo(
    () => filterOptions(options, query),
    [options, query],
  );

  useEffect(() => {
    setHighlight(0);
  }, [query, open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    };
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = (option: string) => {
    if (selectedSet.has(option)) {
      onChange(values.filter((value) => value !== option));
    } else {
      onChange([...values, option]);
    }
  };

  const closedLabel = summarizeSelection(values);
  const displayValue = open ? query : closedLabel;

  return (
    <div ref={rootRef} className="relative min-w-0">
      {showLabel ? (
        <label className="mb-1 block font-mono text-[0.55rem] uppercase tracking-[0.16em] text-rsi-text-muted">
          {label}
        </label>
      ) : null}
      <input
        type="search"
        role="combobox"
        aria-label={showLabel ? undefined : label}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-multiselectable="true"
        disabled={disabled}
        value={displayValue}
        placeholder={closedLabel || placeholder}
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (!open && (event.key === "ArrowDown" || event.key === "Enter")) {
            setOpen(true);
            return;
          }
          if (!open) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setHighlight((prev) =>
              Math.min(prev + 1, Math.max(filtered.length - 1, 0)),
            );
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setHighlight((prev) => Math.max(prev - 1, 0));
          } else if (event.key === "Enter") {
            event.preventDefault();
            const choice = filtered[highlight];
            if (choice !== undefined) toggle(choice);
          }
        }}
        className={[
          "w-full rounded-rsi border border-rsi-border bg-rsi-bg-deep/60 px-2.5 py-1.5",
          "text-xs text-rsi-text placeholder:text-rsi-text-muted",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
          disabled ? "cursor-not-allowed opacity-60" : "",
        ].join(" ")}
      />

      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          aria-multiselectable="true"
          className="absolute z-30 mt-1 max-h-48 w-full overflow-y-auto rounded-rsi border border-rsi-border bg-rsi-surface shadow-rsi-panel"
        >
          {filtered.length === 0 ? (
            <li className="px-2.5 py-1.5 text-xs text-rsi-text-muted">
              {query.trim() ? "No matches" : "No options"}
            </li>
          ) : (
            filtered.map((option, index) => {
              const isSelected = selectedSet.has(option);
              const isHighlighted = index === highlight;
              return (
                <li key={option} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setHighlight(index)}
                    onClick={() => toggle(option)}
                    className={[
                      "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs transition-colors",
                      isHighlighted
                        ? "bg-rsi-accent-muted/40 text-rsi-text"
                        : "text-rsi-text-secondary hover:bg-rsi-bg-deep/60",
                      isSelected ? "text-rsi-text" : "",
                    ].join(" ")}
                  >
                    <span
                      aria-hidden
                      className={[
                        "inline-flex size-3.5 shrink-0 items-center justify-center rounded-sm border text-[0.55rem]",
                        isSelected
                          ? "border-rsi-accent bg-rsi-accent text-rsi-bg"
                          : "border-rsi-border text-transparent",
                      ].join(" ")}
                    >
                      ✓
                    </span>
                    <span className="min-w-0 truncate">{option}</span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}
