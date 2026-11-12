"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";

export type CreateSessionModalProps = {
  open: boolean;
  isBusy?: boolean;
  onClose: () => void;
  onCreate: (sessionName: string) => void;
};

/** Name prompt before creating a new hauling trip tab. */
export function CreateSessionModal({
  open,
  isBusy = false,
  onClose,
  onCreate,
}: CreateSessionModalProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [draft, setDraft] = useState("New trip");

  useEffect(() => {
    if (!open) return;
    setDraft("New trip");
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isBusy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, isBusy, onClose]);

  useEffect(() => {
    if (!open) return;
    const node = inputRef.current;
    if (!node) return;
    node.focus();
    node.select();
  }, [open]);

  if (!open) return null;

  const submit = () => {
    const next = draft.trim() || "New trip";
    onCreate(next);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-rsi-bg-deep/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-session-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !isBusy) onClose();
      }}
    >
      <div className="relative w-full max-w-sm rounded-rsi border border-rsi-border bg-rsi-surface p-5 pr-12 shadow-rsi-panel sm:pr-14">
        <ModalCloseButton
          label="Dismiss"
          onClick={onClose}
          disabled={isBusy}
        />
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-rsi-accent">
          Trips
        </p>
        <h2
          id="create-session-title"
          className="mt-2 text-base font-semibold tracking-wide text-rsi-text"
        >
          New trip
        </h2>
        <p className="mt-2 text-sm text-rsi-text-secondary">
          Give this tab a name you can find later. You can rename it anytime.
        </p>
        <label
          htmlFor={inputId}
          className="mt-4 block font-mono text-[0.55rem] uppercase tracking-[0.16em] text-rsi-text-muted"
        >
          Trip name
        </label>
        <input
          ref={inputRef}
          id={inputId}
          value={draft}
          disabled={isBusy}
          maxLength={120}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            }
          }}
          className={[
            "mt-1.5 w-full rounded-rsi border border-rsi-border bg-rsi-bg-deep px-3 py-2",
            "text-sm text-rsi-text outline-none",
            "focus-visible:border-rsi-accent/50 focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
            "disabled:opacity-60",
          ].join(" ")}
        />
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button variant="ghost" disabled={isBusy} onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={isBusy} onClick={submit}>
            Create
          </Button>
        </div>
      </div>
    </div>
  );
}
