"use client";

import { useEffect, useId } from "react";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";

export const ROUTE_CHECKLIST_SHORTCUTS = [
  { key: "B", action: "Cargo bays" },
  { key: "S", action: "Stops" },
  { key: "C", action: "Contracts" },
  { key: "H", action: "Hide / show history" },
  { key: "D", action: "Mark step done" },
  { key: ";", action: "Show / hide recorder" },
] as const;

export type RouteChecklistControlsModalProps = {
  open: boolean;
  onClose: () => void;
};

/**
 * Read-only keyboard shortcut reference from the route checklist ⋯ → Controls.
 */
export function RouteChecklistControlsModal({
  open,
  onClose,
}: RouteChecklistControlsModalProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-rsi-bg-deep/85 px-3 pt-14 pb-3 sm:px-6 sm:pt-16 sm:pb-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-sm rounded-rsi border border-rsi-border bg-rsi-surface shadow-rsi-panel">
        <ModalCloseButton onClick={onClose} />
        <div className="border-b border-rsi-border px-4 py-4 sm:px-5">
          <h2
            id={titleId}
            className="font-sans text-sm font-semibold tracking-wide text-rsi-text sm:text-base"
          >
            Controls
          </h2>
        </div>
        <ul className="flex flex-col gap-1 px-3 py-3 sm:px-4 sm:py-4">
          {ROUTE_CHECKLIST_SHORTCUTS.map((item) => (
            <li
              key={item.key}
              className="flex min-h-8 items-center justify-between gap-3 rounded-rsi px-2 py-1.5"
            >
              <span className="text-sm leading-snug text-rsi-text-secondary">
                {item.action}
              </span>
              <kbd className="inline-flex shrink-0 items-center rounded border border-rsi-border bg-rsi-bg-deep px-2 py-1 font-mono text-[0.65rem] leading-none tabular-nums text-rsi-text">
                {item.key}
              </kbd>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
