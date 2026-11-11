"use client";

import { useId, type ReactNode } from "react";

export type SwitchProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Visible label to the left of the track. */
  label: ReactNode;
  /** Accessible name when label text is not enough. */
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
};

/**
 * Compact label + switch row for legend settings and similar chrome.
 */
export function Switch({
  checked,
  onCheckedChange,
  label,
  ariaLabel,
  disabled = false,
  className,
}: SwitchProps) {
  const labelId = useId();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={ariaLabel ? undefined : labelId}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={[
        "flex w-full min-w-0 items-center justify-between gap-2 text-left",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
        disabled ? "cursor-default opacity-50" : "cursor-pointer",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span
        id={labelId}
        className="min-w-0 font-mono text-[0.55rem] uppercase tracking-[0.1em] text-rsi-text-secondary"
      >
        {label}
      </span>
      <span
        aria-hidden
        className={[
          "relative inline-flex h-3.5 w-6 shrink-0 items-center rounded-full border transition-colors",
          checked
            ? "border-rsi-accent/55 bg-rsi-accent-muted/55"
            : "border-rsi-border bg-rsi-bg-deep/70",
        ].join(" ")}
      >
        <span
          className={[
            "pointer-events-none absolute top-1/2 size-2.5 -translate-y-1/2 rounded-full transition-[left,background-color]",
            checked
              ? "left-[calc(100%-0.7rem)] bg-rsi-accent"
              : "left-0.5 bg-rsi-text-muted",
          ].join(" ")}
        />
      </span>
    </button>
  );
}
