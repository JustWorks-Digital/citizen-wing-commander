"use client";

import { useEffect, useId, useRef, useState } from "react";

const SHORTCUTS = [
  { key: "B", action: "Cargo bays" },
  { key: "S", action: "Stops" },
  { key: "C", action: "Contracts" },
  { key: "H", action: "Hide / show history" },
  { key: "D", action: "Mark step done" },
] as const;

/**
 * Tiny sticky-toolbar Controls link with a compact keyboard-shortcut panel.
 */
export function SessionControlsHelp({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

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
      className={[
        "relative flex shrink-0 items-center self-center",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
        className={[
          "inline-flex items-center font-mono text-[0.5rem] uppercase leading-none tracking-[0.14em] text-rsi-text-muted transition-colors",
          "hover:text-rsi-text",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-rsi-bg",
        ].join(" ")}
      >
        Controls
      </button>
      {open ? (
        <div
          role="dialog"
          aria-labelledby={titleId}
          className="absolute top-full left-0 z-40 mt-1.5 w-44 rounded-rsi border border-rsi-border bg-rsi-surface px-2.5 py-2 shadow-rsi-panel"
        >
          <p
            id={titleId}
            className="mb-1.5 font-mono text-[0.45rem] uppercase leading-none tracking-[0.16em] text-rsi-text-muted"
          >
            Keyboard
          </p>
          <ul className="flex flex-col gap-1">
            {SHORTCUTS.map((item) => (
              <li
                key={item.key}
                className="flex min-h-5 items-center justify-between gap-2"
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
