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

const DEFAULT_TRIP_NAME = "New trip";

const RANDOM_PREFIXES = [
  "Covalex",
  "Hurston",
  "Stanton",
  "MicroTech",
  "ArcCorp",
  "Crusader",
  "Pyro",
  "Everus",
  "Tressler",
  "Lorville",
] as const;

const RANDOM_ROLES = [
  "haul",
  "run",
  "relay",
  "loop",
  "circuit",
  "freight",
  "drop",
  "pickup",
  "route",
  "leg",
] as const;

const RANDOM_TAGS = [
  "ice",
  "waste",
  "stims",
  "ore",
  "food",
  "fuel",
  "ammo",
  "local",
  "stellar",
  "planetary",
] as const;

function pickRandom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

/** Short hauling-flavored trip name for the create modal. */
export function randomTripName(): string {
  return `${pickRandom(RANDOM_PREFIXES)} ${pickRandom(RANDOM_ROLES)} — ${pickRandom(RANDOM_TAGS)}`;
}

/** Name prompt before creating a new hauling trip tab. */
export function CreateSessionModal({
  open,
  isBusy = false,
  onClose,
  onCreate,
}: CreateSessionModalProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [draft, setDraft] = useState(DEFAULT_TRIP_NAME);

  // Reset draft only when the modal opens — not on parent re-renders
  // (inline onClose / isBusy flips were wiping typed names mid-edit).
  useEffect(() => {
    if (!open) return;
    setDraft(DEFAULT_TRIP_NAME);
  }, [open]);

  useEffect(() => {
    if (!open) return;
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
    const next = draft.trim() || DEFAULT_TRIP_NAME;
    onCreate(next);
  };

  const applyRandomName = () => {
    const next = randomTripName();
    setDraft(next);
    requestAnimationFrame(() => {
      const node = inputRef.current;
      if (!node) return;
      node.focus();
      node.select();
    });
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
        <div className="mt-4 flex items-baseline justify-between gap-3">
          <label
            htmlFor={inputId}
            className="font-mono text-[0.55rem] uppercase tracking-[0.16em] text-rsi-text-muted"
          >
            Trip name
          </label>
          <button
            type="button"
            disabled={isBusy}
            onClick={applyRandomName}
            className={[
              "font-mono text-[0.55rem] uppercase tracking-[0.16em] text-rsi-accent",
              "underline-offset-2 hover:underline",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
              "disabled:cursor-not-allowed disabled:opacity-50",
            ].join(" ")}
          >
            Random
          </button>
        </div>
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
