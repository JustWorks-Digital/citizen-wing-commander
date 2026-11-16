"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  CATALOG_TABLE_COLUMN_KEYS,
  CATALOG_TABLE_COLUMN_LABELS,
  toggleCatalogTableColumn,
  type CatalogTableColumnKey,
} from "@/lib/missions/catalogTableColumnPrefs";

export type CatalogColumnsMenuProps = {
  visibleKeys: CatalogTableColumnKey[];
  onChange: (next: CatalogTableColumnKey[]) => void;
  className?: string;
};

/** Labeled Columns control for the catalog filters toolbar. */
export function CatalogColumnsMenu({
  visibleKeys,
  onChange,
  className,
}: CatalogColumnsMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const visibleSet = useMemo(() => new Set(visibleKeys), [visibleKeys]);
  const onlyOneVisible = visibleKeys.length <= 1;
  const hiddenCount = CATALOG_TABLE_COLUMN_KEYS.length - visibleKeys.length;

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
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={["relative inline-flex shrink-0", className]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
        className={[
          "inline-flex items-center gap-1.5 rounded-rsi border border-rsi-border bg-rsi-bg-deep/60 px-2 py-1 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-rsi-text-muted transition-colors",
          "hover:border-rsi-border-strong hover:text-rsi-text",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--rsi-ring)]",
          open ? "border-rsi-accent/50 text-rsi-accent" : "",
        ].join(" ")}
      >
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          className="size-3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <path d="M2.5 3.5h11M2.5 8h11M2.5 12.5h11" />
        </svg>
        Columns
        {hiddenCount > 0 ? (
          <span className="rounded-sm bg-rsi-accent-muted/50 px-1 text-[0.55rem] text-rsi-accent">
            −{hiddenCount}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Table columns"
          className="absolute top-full right-0 z-40 mt-1.5 w-44 rounded-rsi border border-rsi-border bg-rsi-surface px-2 py-2 shadow-rsi-panel"
        >
          <ul className="flex flex-col gap-0.5">
            {CATALOG_TABLE_COLUMN_KEYS.map((key) => {
              const checked = visibleSet.has(key);
              const disabled = checked && onlyOneVisible;
              return (
                <li key={key}>
                  <label
                    role="menuitemcheckbox"
                    aria-checked={checked}
                    className={[
                      "flex items-center gap-2 rounded-rsi px-1.5 py-1 font-mono text-[0.65rem] uppercase tracking-[0.1em] transition-colors",
                      disabled
                        ? "cursor-not-allowed text-rsi-text-muted/50"
                        : "cursor-pointer text-rsi-text-secondary hover:bg-rsi-bg-deep/50 hover:text-rsi-text",
                    ].join(" ")}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() =>
                        onChange(toggleCatalogTableColumn(visibleKeys, key))
                      }
                      className="size-3 accent-[var(--rsi-accent)]"
                    />
                    {CATALOG_TABLE_COLUMN_LABELS[key]}
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
