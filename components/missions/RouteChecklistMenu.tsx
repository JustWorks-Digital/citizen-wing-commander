"use client";

import { useEffect, useId, useRef, useState } from "react";

const SHORTCUTS = [
  { key: "B", action: "Cargo bays" },
  { key: "S", action: "Stops" },
  { key: "C", action: "Contracts" },
  { key: "H", action: "Hide / show history" },
  { key: "D", action: "Mark step done" },
] as const;

export type RouteChecklistMenuProps = {
  hideCompleted: boolean;
  completedCount: number;
  onToggleHistory: () => void;
  className?: string;
};

/**
 * Right-edge ⋯ on the route checklist toolbar.
 * Holds Hide / Show history and the keyboard Controls list.
 */
export function RouteChecklistMenu({
  hideCompleted,
  completedCount,
  onToggleHistory,
  className,
}: RouteChecklistMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const historyLabel = hideCompleted ? "Show history" : "Hide history";

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
      className={["relative flex shrink-0 items-center", className]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Route checklist menu"
        onClick={() => setOpen((value) => !value)}
        className={[
          "inline-flex size-7 items-center justify-center rounded-rsi border border-rsi-border bg-rsi-bg-deep/95 font-mono text-sm leading-none tracking-[0.2em] text-rsi-text-secondary shadow-rsi-panel transition-colors",
          "hover:border-rsi-border-strong hover:text-rsi-text",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-rsi-bg",
        ].join(" ")}
      >
        <span aria-hidden>⋯</span>
      </button>
      {open ? (
        <div
          role="menu"
          aria-label="Route checklist menu"
          className="absolute top-full right-0 z-40 mt-1.5 w-52 rounded-rsi border border-rsi-border bg-rsi-surface px-2.5 py-2 shadow-rsi-panel"
        >
          <button
            type="button"
            role="menuitem"
            disabled={completedCount === 0}
            onClick={() => {
              onToggleHistory();
              setOpen(false);
            }}
            className={[
              "flex w-full items-center rounded-rsi px-1.5 py-1 text-left font-mono text-[0.65rem] uppercase tracking-[0.14em] text-rsi-text-secondary transition-colors",
              "hover:bg-rsi-bg-deep/70 hover:text-rsi-text",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
              "disabled:cursor-not-allowed disabled:opacity-40",
            ].join(" ")}
          >
            {historyLabel}
          </button>
          <p
            id={titleId}
            className="mt-2 mb-1.5 border-t border-rsi-divider pt-2 font-mono text-[0.45rem] uppercase leading-none tracking-[0.16em] text-rsi-text-muted"
          >
            Controls
          </p>
          <ul aria-labelledby={titleId} className="flex flex-col gap-1">
            {SHORTCUTS.map((item) => (
              <li
                key={item.key}
                className="flex min-h-5 items-center justify-between gap-2 px-1.5"
              >
                <span className="text-[0.65rem] leading-none text-rsi-text-secondary">
                  {item.action}
                </span>
                <kbd className="inline-flex items-center rounded border border-rsi-border bg-rsi-bg-deep px-1.5 py-0.5 font-mono text-[0.55rem] leading-none tabular-nums text-rsi-text">
                  {item.key}
                </kbd>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
