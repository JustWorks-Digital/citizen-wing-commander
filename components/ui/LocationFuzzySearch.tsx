"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { getLocationBySlug } from "@/lib/fixtures";
import { searchLocations } from "@/lib/sessions/resolveRefs";

export type LocationFuzzySearchProps = {
  valueSlug: string | null;
  onChange: (slug: string | null) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
};

export function LocationFuzzySearch({
  valueSlug,
  onChange,
  label = "Start location",
  placeholder = "Search locations…",
  disabled = false,
}: LocationFuzzySearchProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = valueSlug ? getLocationBySlug(valueSlug) : undefined;
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      setQuery(selected?.name ?? "");
    }
  }, [selected?.name, isOpen, valueSlug]);

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    return searchLocations(q, 8);
  }, [query]);

  useEffect(() => {
    setHighlight(0);
  }, [query]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const pick = (slug: string) => {
    onChange(slug);
    setIsOpen(false);
    setQuery(getLocationBySlug(slug)?.name ?? slug);
  };

  const clear = () => {
    onChange(null);
    setQuery("");
    setIsOpen(false);
  };

  return (
    <div ref={rootRef} className="relative w-full max-w-md">
      <label className="mb-1 block font-mono text-[0.65rem] uppercase tracking-[0.18em] text-rsi-text-muted">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          type="search"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listId}
          aria-autocomplete="list"
          disabled={disabled}
          value={query}
          placeholder={placeholder}
          autoComplete="off"
          className={[
            "w-full rounded-rsi border border-rsi-border bg-rsi-bg-deep px-3 py-2",
            "font-sans text-sm text-rsi-text placeholder:text-rsi-text-muted",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
            "disabled:cursor-not-allowed disabled:opacity-50",
          ].join(" ")}
          onFocus={() => setIsOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setIsOpen(true);
              setHighlight((i) =>
                results.length === 0 ? 0 : Math.min(i + 1, results.length - 1),
              );
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setHighlight((i) => Math.max(i - 1, 0));
            } else if (event.key === "Enter") {
              event.preventDefault();
              const hit = results[highlight];
              if (hit) pick(hit.slug);
            } else if (event.key === "Escape") {
              setIsOpen(false);
            }
          }}
        />
        {valueSlug ? (
          <button
            type="button"
            disabled={disabled}
            onClick={clear}
            className="shrink-0 rounded-rsi border border-rsi-border px-3 py-2 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-rsi-text-secondary hover:border-rsi-border-strong hover:text-rsi-text disabled:opacity-50"
          >
            Clear
          </button>
        ) : null}
      </div>
      {isOpen && results.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-rsi border border-rsi-border bg-rsi-surface shadow-rsi-panel"
        >
          {results.map((loc, index) => (
            <li key={loc.slug} role="option" aria-selected={index === highlight}>
              <button
                type="button"
                className={[
                  "flex w-full flex-col items-start px-3 py-2 text-left text-sm",
                  index === highlight
                    ? "bg-rsi-accent-muted text-rsi-text"
                    : "text-rsi-text hover:bg-rsi-surface-raised",
                ].join(" ")}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => pick(loc.slug)}
              >
                <span className="font-medium tracking-wide">{loc.name}</span>
                <span className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-rsi-text-muted">
                  {[loc.parentName, loc.type].filter(Boolean).join(" · ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {isOpen && query.trim() && results.length === 0 ? (
        <p className="absolute z-20 mt-1 w-full rounded-rsi border border-rsi-border bg-rsi-surface px-3 py-2 text-sm text-rsi-text-muted shadow-rsi-panel">
          No locations match
        </p>
      ) : null}
    </div>
  );
}
