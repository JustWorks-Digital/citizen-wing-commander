"use client";

import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { Spinner } from "@/components/ui/Spinner";

export type TripCrashFinishModalProps = {
  open: boolean;
  sessionName: string;
  isBusy?: boolean;
  onClose: () => void;
  /** Persist crash finish with optional incident notes. */
  onConfirm: (feedback: string) => void | Promise<void>;
};

/**
 * ⋯ menu → Crash out: end the trip as `finishStatus: crash` with incident notes.
 */
export function TripCrashFinishModal({
  open,
  sessionName,
  isBusy = false,
  onClose,
  onConfirm,
}: TripCrashFinishModalProps) {
  const titleId = useId();
  const feedbackId = useId();
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    if (!open) return;
    setFeedback("");
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
      <div className="relative w-full max-w-md rounded-rsi border border-rsi-danger/40 bg-rsi-surface shadow-rsi-panel">
        <ModalCloseButton onClick={onClose} disabled={isBusy} />
        <div className="border-b border-rsi-border px-4 py-4 sm:px-5">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-rsi-danger">
            Crash finish
          </p>
          <h2
            id={titleId}
            className="mt-1 font-sans text-sm font-semibold tracking-wide text-rsi-text sm:text-base"
          >
            {sessionName.trim() || "Hauling trip"}
          </h2>
          <p className="mt-1.5 text-xs leading-snug text-rsi-text-secondary">
            End this session as crashed and stop the timer. Optional notes are
            stored on the trip for the incident log.
          </p>
        </div>

        <form
          className="flex flex-col gap-3 px-4 py-4 sm:px-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (isBusy) return;
            void onConfirm(feedback);
          }}
        >
          <label
            htmlFor={feedbackId}
            className="font-mono text-[0.55rem] uppercase tracking-[0.14em] text-rsi-text-muted"
          >
            Incident notes
          </label>
          <textarea
            id={feedbackId}
            value={feedback}
            disabled={isBusy}
            rows={5}
            placeholder="What happened? (ship loss, disconnect, soft-death…)"
            onChange={(event) => setFeedback(event.target.value)}
            className={[
              "w-full resize-y rounded-rsi border border-rsi-border bg-rsi-bg-deep/70 px-3 py-2 text-sm leading-snug text-rsi-text outline-none",
              "placeholder:text-rsi-text-muted/70",
              "focus:border-rsi-danger/50 focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
              "disabled:cursor-wait disabled:opacity-60",
            ].join(" ")}
          />
          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              disabled={isBusy}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              disabled={isBusy}
              aria-busy={isBusy || undefined}
            >
              {isBusy ? (
                <Spinner className="size-3.5" label="Ending as crash" />
              ) : null}
              End as crash
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
