"use client";

import { useEffect, useId, type ReactNode } from "react";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import type { HaulingChecklistRow } from "@/lib/missions/mockSession";
import { CargoBayLayout } from "./CargoBayLayout";

export type SessionCargoLayoutModalProps = {
  open: boolean;
  rows: HaulingChecklistRow[];
  shipSlug?: string | null;
  focusedStopId?: string | null;
  sessionId?: string | null;
  /** Inventory / capacity aside shown beside the Cargo layout title. */
  headerAside?: ReactNode;
  onClose: () => void;
};

/**
 * Centered Cargo layout modal — CargoBayLayout panel opened from the sticky
 * Cargo bay control. Height follows content.
 * Close X sits in the backdrop above the panel so it does not steal bay width.
 */
export function SessionCargoLayoutModal({
  open,
  rows,
  shipSlug = null,
  focusedStopId = null,
  sessionId = null,
  headerAside = null,
  onClose,
}: SessionCargoLayoutModalProps) {
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-rsi-bg-deep/85 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="relative flex w-full max-w-[min(96rem,100%)] flex-col items-stretch">
        <div className="pointer-events-none absolute inset-x-0 bottom-full mb-2 flex justify-end">
          <ModalCloseButton
            label="Dismiss"
            onClick={onClose}
            className="pointer-events-auto static top-auto right-auto rounded-rsi border border-rsi-border bg-rsi-bg-deep/90 shadow-rsi-panel"
          />
        </div>
        <h2 id={titleId} className="sr-only">
          Cargo layout
        </h2>
        <CargoBayLayout
          rows={rows}
          shipSlug={shipSlug}
          focusedStopId={focusedStopId}
          sessionId={sessionId}
          headerAside={headerAside}
          className="max-h-[min(85vh,52rem)] overflow-y-auto overscroll-contain"
        />
      </div>
    </div>
  );
}
