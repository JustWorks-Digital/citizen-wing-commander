"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { getShipIconSrc } from "@/lib/fixtures";

export type ShipSelectOption = {
  slug: string;
  name: string;
  cargoScu: number;
};

export type ShipSelectProps = {
  valueSlug: string | null;
  options: ShipSelectOption[];
  onChange: (slug: string | null) => void;
  label?: string;
  disabled?: boolean;
  isLoading?: boolean;
  error?: string | null;
};

function shipOptionLabel(ship: ShipSelectOption): string {
  return `${ship.name} · ${ship.cargoScu} SCU`;
}

function filterShips(
  options: ShipSelectOption[],
  query: string,
): ShipSelectOption[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return options;
  return options.filter((ship) => {
    const haystack = `${ship.name} ${ship.cargoScu} ${ship.slug}`.toLowerCase();
    return haystack.includes(needle);
  });
}

function ShipThumb({
  slug,
  className = "h-6 w-10",
}: {
  slug: string | null | undefined;
  className?: string;
}) {
  const src = getShipIconSrc(slug);
  return (
    <span
      aria-hidden
      className={[
        "inline-flex shrink-0 items-center justify-center overflow-hidden",
        className,
      ].join(" ")}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- fixture static assets
        <img src={src} alt="" className="size-full object-contain" />
      ) : (
        <span className="size-full rounded-sm bg-rsi-bg-deep/40" />
      )}
    </span>
  );
}

/**
 * Session ship picker — SearchableSelect-style chrome with ship badge art.
 */
export function ShipSelect({
  valueSlug,
  options,
  onChange,
  label = "Ship",
  disabled = false,
  isLoading = false,
  error = null,
}: ShipSelectProps) {
  const listId = useId();
  const inputId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);

  const selected = useMemo(
    () => options.find((ship) => ship.slug === valueSlug) ?? null,
    [options, valueSlug],
  );
  const filtered = useMemo(
    () => filterShips(options, query),
    [options, query],
  );
  const isDisabled = disabled || isLoading || options.length === 0;
  const closedLabel = selected ? shipOptionLabel(selected) : "";
  const displayValue = open ? query : closedLabel;
  const canClear = Boolean(selected) && !isDisabled;
  const placeholder = isLoading ? "Loading ships…" : "Select a ship…";

  useEffect(() => {
    setHighlight(0);
  }, [query, open]);

  const dismiss = () => {
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
  };

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        dismiss();
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        dismiss();
      }
    };
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const selectShip = (ship: ShipSelectOption) => {
    onChange(ship.slug === valueSlug ? null : ship.slug);
    setOpen(false);
    setQuery("");
  };

  const clearSelection = () => {
    onChange(null);
    setQuery("");
    setOpen(false);
  };

  return (
    <div
      ref={rootRef}
      className="relative w-full min-w-0 md:max-w-md"
      onMouseDown={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest("input, button, [role='listbox']")) return;
        if (target.closest("label")) return;
        // Empty chrome on the label row (or elsewhere in the field) — deselect.
        dismiss();
      }}
    >
      <div className="mb-1 flex min-h-[1rem] items-center">
        <label
          htmlFor={inputId}
          className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-rsi-text-muted"
        >
          {label}
        </label>
      </div>
      <div
        className={[
          "relative flex w-full items-center gap-2 rounded-rsi border border-rsi-border bg-rsi-bg-deep",
          !open && selected ? "pl-2.5" : "pl-3",
          canClear ? "pr-9" : "pr-3",
          "focus-within:ring-2 focus-within:ring-inset focus-within:ring-[var(--rsi-ring)]",
          isDisabled ? "cursor-not-allowed opacity-60" : "",
        ].join(" ")}
      >
        {!open && selected ? (
          <ShipThumb slug={selected.slug} className="pointer-events-none h-6 w-10" />
        ) : null}
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          disabled={isDisabled}
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
            if (
              !open &&
              (event.key === "Backspace" || event.key === "Delete") &&
              selected &&
              !query
            ) {
              event.preventDefault();
              clearSelection();
              return;
            }
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
              if (choice) selectShip(choice);
            }
          }}
          className={[
            "min-w-0 flex-1 border-0 bg-transparent py-2 text-sm text-rsi-text placeholder:text-rsi-text-muted",
            "focus-visible:outline-none",
            isDisabled ? "cursor-not-allowed" : "",
          ].join(" ")}
        />
        {canClear ? (
          <button
            type="button"
            aria-label={`Clear ${label}`}
            title="Clear"
            onMouseDown={(event) => {
              event.preventDefault();
              clearSelection();
            }}
            className={[
              "absolute top-1/2 right-1.5 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-rsi text-rsi-text-muted transition-colors",
              "hover:bg-rsi-surface-raised hover:text-rsi-text",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
            ].join(" ")}
          >
            <svg
              aria-hidden
              viewBox="0 0 16 16"
              className="size-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        ) : null}
      </div>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className="absolute z-30 mt-1 max-h-48 w-full overflow-y-auto rounded-rsi border border-rsi-border bg-rsi-surface shadow-rsi-panel"
        >
          {filtered.length === 0 ? (
            <li className="px-2.5 py-1.5 text-xs text-rsi-text-muted">
              {query.trim() ? "No matches" : "No options"}
            </li>
          ) : (
            filtered.map((ship, index) => {
              const isSelected = ship.slug === valueSlug;
              const isHighlighted = index === highlight;
              return (
                <li key={ship.slug} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setHighlight(index)}
                    onClick={() => selectShip(ship)}
                    className={[
                      "flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left text-xs transition-colors",
                      isHighlighted
                        ? "bg-rsi-accent-muted/40 text-rsi-text"
                        : "text-rsi-text-secondary hover:bg-rsi-bg-deep/60",
                      isSelected ? "text-rsi-accent" : "",
                    ].join(" ")}
                  >
                    <ShipThumb slug={ship.slug} className="h-7 w-12" />
                    <span className="min-w-0 truncate">
                      {shipOptionLabel(ship)}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      ) : null}

      {error ? (
        <p className="mt-1 text-sm text-rsi-warn">{error}</p>
      ) : null}
      {!error && !isLoading && options.length === 0 ? (
        <p className="mt-1 text-sm text-rsi-text-muted">
          No selectable ships in the database. Run{" "}
          <span className="font-mono text-rsi-text-secondary">
            npm run db:sync-ships
          </span>
          .
        </p>
      ) : null}
    </div>
  );
}
