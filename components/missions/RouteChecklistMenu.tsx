"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { RouteChecklistControlsModal } from "./RouteChecklistControlsModal";

export type RouteChecklistMenuProps = {
  hideCompleted: boolean;
  completedCount: number;
  onToggleHistory: () => void;
  /** Duplicate this trip into a new session tab (progress reset). */
  onCopyTrip?: () => void | Promise<void>;
  /**
   * When the invalid-trip banner was dismissed: repair from the ⋯ menu.
   */
  onRepairTrip?: () => void;
  isRepairingTrip?: boolean;
  /** Open crash-finish dialog (end trip as finishStatus crash). */
  onLogCrash?: () => void;
  /** Hide Crash out when the session is already finished. */
  canLogCrash?: boolean;
  /** Reopen the finish report when every stop is done. */
  onOpenSummary?: () => void;
  /**
   * Trip stats that leave the sticky strip on small phones (Distance, aUEC).
   * Hidden from `sm` up when those cells are back in the toolbar.
   */
  overflowStats?: ReactNode;
  className?: string;
};

/**
 * Right-edge ⋯ on the route checklist toolbar.
 * Holds Distance/aUEC on small phones, Copy trip, Hide / Show history,
 * Repair route (when the invalid banner is dismissed), Summary (when the
 * trip is complete), Controls, and Crash out.
 */
export function RouteChecklistMenu({
  hideCompleted,
  completedCount,
  onToggleHistory,
  onCopyTrip,
  onRepairTrip,
  isRepairingTrip = false,
  onLogCrash,
  canLogCrash = true,
  onOpenSummary,
  overflowStats = null,
  className,
}: RouteChecklistMenuProps) {
  const [open, setOpen] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [copyPending, setCopyPending] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
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
    <>
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
            // Match Distance/aUEC/Time strip height + border/chrome.
            "inline-flex h-[2.375rem] items-center justify-center rounded-rsi border border-rsi-border bg-rsi-bg-deep/55 px-2.5 font-mono text-sm leading-none tracking-[0.2em] text-rsi-text-secondary transition-colors sm:h-[2.875rem] sm:px-3",
            "hover:text-rsi-text",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-rsi-bg",
          ].join(" ")}
        >
          <span aria-hidden>⋯</span>
        </button>
        {open ? (
          <div
            role="menu"
            aria-label="Route checklist menu"
            className="absolute top-full right-0 z-50 mt-1.5 w-52 rounded-rsi border border-rsi-border bg-rsi-surface px-2.5 py-2 shadow-rsi-panel"
          >
            {overflowStats ? (
              <div className="mb-2 border-b border-rsi-divider px-1.5 pb-2 sm:hidden">
                {overflowStats}
              </div>
            ) : null}
            {onCopyTrip ? (
              <button
                type="button"
                role="menuitem"
                disabled={copyPending}
                aria-busy={copyPending}
                onClick={() => {
                  void (async () => {
                    setCopyPending(true);
                    try {
                      await onCopyTrip();
                      setOpen(false);
                    } finally {
                      setCopyPending(false);
                    }
                  })();
                }}
                className={[
                  "flex w-full items-center gap-2 rounded-rsi px-1.5 py-1 text-left font-mono text-[0.65rem] uppercase tracking-[0.14em] text-rsi-text-secondary transition-colors",
                  "hover:bg-rsi-bg-deep/70 hover:text-rsi-text",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                ].join(" ")}
              >
                {copyPending ? (
                  <Spinner className="size-3" label="Copying trip" />
                ) : null}
                Copy trip
              </button>
            ) : null}
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
            {onRepairTrip ? (
              <button
                type="button"
                role="menuitem"
                disabled={isRepairingTrip}
                aria-busy={isRepairingTrip}
                onClick={() => {
                  onRepairTrip();
                  setOpen(false);
                }}
                className={[
                  "flex w-full items-center gap-2 rounded-rsi px-1.5 py-1 text-left font-mono text-[0.65rem] uppercase tracking-[0.14em] text-rsi-warn transition-colors",
                  "hover:bg-rsi-bg-deep/70 hover:text-rsi-warn",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                ].join(" ")}
              >
                {isRepairingTrip ? (
                  <Spinner className="size-3" label="Repairing route" />
                ) : null}
                Repair route
              </button>
            ) : null}
            {onOpenSummary ? (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onOpenSummary();
                  setOpen(false);
                }}
                className={[
                  "flex w-full items-center rounded-rsi px-1.5 py-1 text-left font-mono text-[0.65rem] uppercase tracking-[0.14em] text-rsi-text-secondary transition-colors",
                  "hover:bg-rsi-bg-deep/70 hover:text-rsi-text",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
                ].join(" ")}
              >
                Summary
              </button>
            ) : null}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                setControlsOpen(true);
              }}
              className={[
                "flex w-full items-center rounded-rsi px-1.5 py-1 text-left font-mono text-[0.65rem] uppercase tracking-[0.14em] text-rsi-text-secondary transition-colors",
                "hover:bg-rsi-bg-deep/70 hover:text-rsi-text",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
              ].join(" ")}
            >
              Controls
            </button>
            {onLogCrash && canLogCrash ? (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onLogCrash();
                  setOpen(false);
                }}
                className={[
                  "flex w-full items-center rounded-rsi px-1.5 py-1 text-left font-mono text-[0.65rem] uppercase tracking-[0.14em] text-rsi-danger transition-colors",
                  "hover:bg-rsi-danger-muted/40 hover:text-rsi-danger",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
                ].join(" ")}
              >
                Crash out
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <RouteChecklistControlsModal
        open={controlsOpen}
        onClose={() => setControlsOpen(false)}
      />
    </>
  );
}
