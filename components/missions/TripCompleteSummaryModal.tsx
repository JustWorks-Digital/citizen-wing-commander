"use client";

import { useEffect, useId } from "react";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import {
  TripCompleteSummaryPanel,
  type TripCompleteSummaryPanelProps,
} from "@/components/missions/TripCompleteSummaryPanel";

export type TripCompleteSummaryModalProps = TripCompleteSummaryPanelProps & {
  open: boolean;
  onClose: () => void;
};

/**
 * Modal wrapper around the end-of-trip report (⋯ menu reopen).
 * Completing the last stop shows the panel inline in the checklist instead.
 */
export function TripCompleteSummaryModal({
  open,
  onClose,
  isBusy = false,
  ...panelProps
}: TripCompleteSummaryModalProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isBusy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, isBusy, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-rsi-bg-deep/85 px-3 pt-14 pb-3 sm:px-6 sm:pt-16 sm:pb-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(event) => {
        if (event.target === event.currentTarget && !isBusy) onClose();
      }}
    >
      <div className="relative w-fit max-w-full shadow-rsi-panel">
        <ModalCloseButton
          label="Continue"
          onClick={onClose}
          disabled={isBusy}
        />
        <div className="sr-only" id={titleId}>
          {panelProps.sessionName.trim() || "Hauling trip"} — finished
        </div>
        <TripCompleteSummaryPanel
          {...panelProps}
          isBusy={isBusy}
          onContinue={onClose}
        />
      </div>
    </div>
  );
}

export { formatRoundedDistance } from "@/components/missions/TripCompleteSummaryPanel";
