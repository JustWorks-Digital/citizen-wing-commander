"use client";

import { Spinner } from "@/components/ui/Spinner";

/** Clear the sticky trip toolbar while the Done control pins in a tall stop card. */
export const STICKY_DONE_TOP = "sticky top-20 z-[15] sm:top-24";

export function DoneCheckbox({
  location,
  step,
  isCompleted,
  isActive = false,
  isPending = false,
  compact = false,
  onToggle,
}: {
  location: string;
  step: number | string;
  isCompleted: boolean;
  isActive?: boolean;
  isPending?: boolean;
  /** Smaller circle + mark for condensed Done strips. */
  compact?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={isCompleted}
      aria-busy={isPending}
      disabled={isPending}
      aria-label={
        isPending
          ? `Stop ${step}, updating: ${location}`
          : `Stop ${step}, mark done: ${location}`
      }
      title={isPending ? "Updating stop…" : undefined}
      onClick={(event) => {
        event.stopPropagation();
        if (isPending) return;
        onToggle();
      }}
      className={[
        "group inline-flex shrink-0 items-center justify-center rounded-full border transition-colors",
        compact ? "size-5" : "size-8",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-rsi-bg",
        isPending
          ? "cursor-wait border-rsi-accent/50 bg-rsi-bg-deep/40 text-rsi-accent"
          : isCompleted
            ? "border-rsi-success/50 bg-rsi-success-muted text-rsi-success"
            : isActive
              ? "border-rsi-text-secondary/70 bg-rsi-bg-deep/40 text-rsi-text-secondary hover:border-rsi-text hover:text-rsi-accent"
              : "border-rsi-border bg-rsi-bg-deep/40 text-rsi-text-muted/50 hover:border-rsi-border-strong hover:text-rsi-accent",
      ].join(" ")}
    >
      {isPending ? (
        <Spinner className={compact ? "size-2.5" : "size-4"} />
      ) : isCompleted ? (
        <span
          aria-hidden
          className={[
            "leading-none",
            compact ? "text-[0.65rem]" : "text-base",
          ].join(" ")}
        >
          ✓
        </span>
      ) : (
        <>
          <span
            aria-hidden
            className={[
              "font-mono tabular-nums leading-none tracking-wide group-hover:hidden",
              compact ? "text-[0.55rem]" : "text-[0.7rem]",
              isActive ? "text-rsi-text-secondary" : "",
            ].join(" ")}
          >
            {step}
          </span>
          <span
            aria-hidden
            className={[
              "hidden leading-none group-hover:inline",
              compact ? "text-[0.65rem]" : "text-base",
            ].join(" ")}
          >
            ✓
          </span>
        </>
      )}
    </button>
  );
}

/** Touch-friendly stop complete control for narrow layouts. */
export function DoneStopButton({
  location,
  step,
  isCompleted,
  isPending = false,
  onToggle,
}: {
  location: string;
  step: number | string;
  isCompleted: boolean;
  isPending?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={isCompleted}
      aria-busy={isPending}
      disabled={isPending}
      aria-label={
        isPending
          ? `Stop ${step}, updating: ${location}`
          : isCompleted
            ? `Stop ${step}, mark incomplete: ${location}`
            : `Stop ${step}, complete: ${location}`
      }
      title={isPending ? "Updating stop…" : undefined}
      onClick={(event) => {
        event.stopPropagation();
        if (isPending) return;
        onToggle();
      }}
      className={[
        "inline-flex min-h-10 w-full items-center justify-center gap-2.5 rounded-rsi border px-3 font-mono text-[0.65rem] uppercase tracking-[0.14em] transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-rsi-bg",
        isPending
          ? "cursor-wait border-rsi-accent/50 bg-rsi-bg-deep/70 text-rsi-accent"
          : isCompleted
            ? "border-rsi-success/50 bg-rsi-success-muted text-rsi-success"
            : "border-rsi-border bg-rsi-bg-deep/70 text-rsi-text-secondary active:border-rsi-accent/50 active:text-rsi-accent",
      ].join(" ")}
    >
      {isPending ? (
        <Spinner className="size-3.5" />
      ) : (
        <span
          aria-hidden
          className={[
            "inline-flex size-4 shrink-0 items-center justify-center rounded-[3px] border",
            isCompleted
              ? "border-rsi-success bg-rsi-success text-rsi-bg-deep"
              : "border-rsi-text-secondary/70 bg-transparent",
          ].join(" ")}
        >
          {isCompleted ? (
            <svg
              viewBox="0 0 12 12"
              className="size-2.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2.5 6.2 L4.8 8.5 L9.5 3.5" />
            </svg>
          ) : null}
        </span>
      )}
      {isPending ? "Updating…" : isCompleted ? "Complete" : "In progress"}
    </button>
  );
}
