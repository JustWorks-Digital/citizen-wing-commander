"use client";

import { useEffect, useId, type ReactNode } from "react";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";

export type SessionTripSideNavProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * `panel` — in-flow section (setup / incomplete).
   * `modal` — centered dialog toggled by an external control.
   */
  presentation?: "panel" | "modal";
  /**
   * When true (panel only), body stays visible and the expand chevron is hidden.
   * Use while name / start / ship still need filling.
   */
  forceExpanded?: boolean;
  /** Trip name / id / created / Source. */
  header?: ReactNode;
  /** Compact label when panel is collapsed (ignored when forceExpanded). */
  collapsedLabel?: ReactNode;
  /** Start, ship, and related fields. */
  children?: ReactNode;
};

function ExpandChevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className={[
        "size-3.5 shrink-0 transition-transform",
        open ? "rotate-180" : "",
      ].join(" ")}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M5 7.5 L10 12.5 L15 7.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Trip setup chrome — inline panel while incomplete, or a modal once name /
 * start / ship are set (toggled from outside).
 */
export function SessionTripSideNav({
  open,
  onOpenChange,
  presentation = "panel",
  forceExpanded = false,
  header = null,
  collapsedLabel = null,
  children = null,
}: SessionTripSideNavProps) {
  const titleId = useId();
  const bodyExpanded = forceExpanded || open;

  useEffect(() => {
    if (presentation !== "modal" || !open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [presentation, open, onOpenChange]);

  useEffect(() => {
    if (presentation !== "modal" || !open) return;
    const html = document.documentElement;
    const body = document.body;
    const scrollY = window.scrollY;
    const previous = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyLeft: body.style.left,
      bodyRight: body.style.right,
      bodyWidth: body.style.width,
    };
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    return () => {
      html.style.overflow = previous.htmlOverflow;
      body.style.overflow = previous.bodyOverflow;
      body.style.position = previous.bodyPosition;
      body.style.top = previous.bodyTop;
      body.style.left = previous.bodyLeft;
      body.style.right = previous.bodyRight;
      body.style.width = previous.bodyWidth;
      window.scrollTo(0, scrollY);
    };
  }, [presentation, open]);

  if (presentation === "modal") {
    if (!open) return null;
    return (
      <div
        className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-rsi-bg-deep/80 px-4 pt-14 pb-4 backdrop-blur-sm sm:items-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => {
          if (event.target === event.currentTarget) onOpenChange(false);
        }}
      >
        <div
          id="session-trip-panel"
          className="relative my-4 w-full max-w-lg rounded-rsi border border-rsi-border bg-rsi-surface p-4 shadow-rsi-panel sm:my-0 sm:p-5"
        >
          <ModalCloseButton
            label="Close trip"
            onClick={() => onOpenChange(false)}
          />
          <p
            id={titleId}
            className="mb-3 font-mono text-[0.55rem] uppercase tracking-[0.18em] text-rsi-accent"
          >
            Trip
          </p>
          {header}
          {children ? (
            <div className="mt-3 flex min-w-0 flex-col gap-3 border-t border-rsi-divider/60 pt-3">
              {children}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <section
      id="session-trip-panel"
      aria-label="Trip"
      className="rounded-rsi border border-rsi-border bg-rsi-surface/90 shadow-rsi-panel"
    >
      <div className="flex min-w-0 items-start gap-2 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          {bodyExpanded
            ? (header ?? (
                <p className="font-mono text-[0.55rem] uppercase tracking-[0.18em] text-rsi-text-muted">
                  Trip
                </p>
              ))
            : (collapsedLabel ??
              header ?? (
                <p className="font-mono text-[0.55rem] uppercase tracking-[0.18em] text-rsi-text-muted">
                  Trip
                </p>
              ))}
        </div>
        {forceExpanded ? null : (
          <button
            type="button"
            aria-expanded={open}
            aria-controls="session-trip-panel-body"
            title={open ? "Collapse trip" : "Expand trip"}
            onClick={() => onOpenChange(!open)}
            className={[
              "inline-flex size-8 shrink-0 items-center justify-center self-start rounded-rsi border border-rsi-border text-rsi-text-muted transition-colors",
              "hover:border-rsi-border-strong hover:bg-rsi-bg-deep/50 hover:text-rsi-text",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-rsi-bg",
            ].join(" ")}
          >
            <ExpandChevron open={open} />
            <span className="sr-only">
              {open ? "Collapse trip" : "Expand trip"}
            </span>
          </button>
        )}
      </div>

      {bodyExpanded && children ? (
        <div
          id="session-trip-panel-body"
          className="flex min-w-0 flex-col gap-3 border-t border-rsi-divider/60 px-3 py-3"
        >
          {children}
        </div>
      ) : null}
    </section>
  );
}
