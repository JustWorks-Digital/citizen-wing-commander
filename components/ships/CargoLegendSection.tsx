"use client";

import type { ReactNode } from "react";

export type CargoLegendSectionProps = {
  title: string;
  /** Stable id for aria-controls. */
  sectionId: string;
  isExpanded: boolean;
  onToggle: () => void;
  /** Top border when this is not the first visible section. */
  showBorder?: boolean;
  children: ReactNode;
};

/** Expand/collapse wrapper for a cargo bay legend block. */
export function CargoLegendSection({
  title,
  sectionId,
  isExpanded,
  onToggle,
  showBorder = false,
  children,
}: CargoLegendSectionProps) {
  const panelId = `cargo-legend-${sectionId}`;
  return (
    <div
      className={
        showBorder ? "border-t border-rsi-border/60 pt-1.5" : undefined
      }
    >
      <button
        type="button"
        aria-expanded={isExpanded}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex w-full items-center gap-1 py-0.5 text-left font-mono text-[0.55rem] uppercase tracking-[0.14em] text-rsi-text-muted transition-colors hover:text-rsi-text"
      >
        <span aria-hidden className="inline-block w-2.5 text-rsi-accent">
          {isExpanded ? "▾" : "▸"}
        </span>
        {title}
      </button>
      {isExpanded ? (
        <div id={panelId} className="mt-1">
          {children}
        </div>
      ) : null}
    </div>
  );
}
