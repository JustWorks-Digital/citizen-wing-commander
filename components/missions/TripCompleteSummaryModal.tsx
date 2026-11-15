"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { type DistanceToNext } from "@/lib/missions/mockSession";
import { AUEC_TITLE, SCU_TITLE } from "@/lib/ui/abbrevTitles";

export type TripCompleteSummaryModalProps = {
  open: boolean;
  sessionName: string;
  /** Formatted total time (e.g. 1h 12m). */
  elapsedLabel: string;
  /** Contracts finished (count only). */
  contractsDone: number;
  /** Stops finished (count only). */
  stopsDone: number;
  /** Peak SCU aboard during the trip. */
  peakScu: number;
  /** aUEC earned on completed contracts. */
  auecEarned: number;
  /** Approximate hauling reputation XP from completed contracts. */
  xpEarned: number;
  /** Trip distance (prefer total; shown rounded). */
  distanceTotal: DistanceToNext | null;
  isBusy?: boolean;
  onClose: () => void;
  /** Duplicate trip plan into a new session with progress cleared. */
  onRunAgain: () => void;
};

function formatAuec(amount: number): string {
  const n = Math.floor(Math.max(0, amount));
  return n.toLocaleString("en-US");
}

/** Round distance for the finish report (less precision noise). */
export function formatRoundedDistance(distance: DistanceToNext | null): string {
  if (!distance) return "—";
  const abs = Math.abs(distance.value);
  let rounded: number;
  if (abs >= 100) rounded = Math.round(distance.value);
  else if (abs >= 10) rounded = Math.round(distance.value * 10) / 10;
  else rounded = Math.round(distance.value * 100) / 100;
  return `${String(rounded)} ${distance.unit}`;
}

function SummaryRow({
  label,
  value,
  title,
  action,
  preserveCase = false,
}: {
  label: string;
  value: ReactNode;
  title?: string;
  action?: ReactNode;
  /** Keep label casing (e.g. aUEC) instead of CSS uppercase. */
  preserveCase?: boolean;
}) {
  return (
    <tr className="border-t border-rsi-border/80 first:border-t-0">
      <th
        scope="row"
        title={title}
        className={[
          "px-3 py-2.5 text-left font-mono text-[0.6rem] font-normal tracking-[0.14em] text-rsi-text-muted sm:px-3.5",
          preserveCase ? "normal-case" : "uppercase",
        ].join(" ")}
      >
        {label}
      </th>
      <td className="px-3 py-2.5 text-right font-mono text-sm tabular-nums tracking-wide text-rsi-text sm:px-3.5 sm:text-base">
        <div className="flex items-center justify-end gap-2">
          {action}
          <span>{value}</span>
        </div>
      </td>
    </tr>
  );
}

/**
 * End-of-trip report when every stop is done — single summary table,
 * plus Run again / Continue.
 */
export function TripCompleteSummaryModal({
  open,
  sessionName,
  elapsedLabel,
  contractsDone,
  stopsDone,
  peakScu,
  auecEarned,
  xpEarned,
  distanceTotal,
  isBusy = false,
  onClose,
  onRunAgain,
}: TripCompleteSummaryModalProps) {
  const titleId = useId();
  const [isAuecSplit, setIsAuecSplit] = useState(false);

  useEffect(() => {
    if (!open) return;
    setIsAuecSplit(false);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isBusy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, isBusy, onClose]);

  if (!open) return null;

  const distanceLabel = formatRoundedDistance(distanceTotal);
  const auecHalf = Math.floor(Math.max(0, auecEarned) / 2);
  const auecDisplay = isAuecSplit ? auecHalf : auecEarned;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-rsi-bg-deep/85 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(event) => {
        if (event.target === event.currentTarget && !isBusy) onClose();
      }}
    >
      <div className="relative w-full max-w-md rounded-rsi border border-rsi-border bg-rsi-surface shadow-rsi-panel">
        <div className="relative border-b border-rsi-border px-4 py-4 pr-12 sm:px-5">
          <ModalCloseButton
            label="Continue"
            onClick={onClose}
            disabled={isBusy}
          />
          <button
            type="button"
            disabled={isBusy}
            onClick={onClose}
            aria-label="Finished — mark summary done and continue"
            title="Mark done"
            className={[
              "group mx-auto flex flex-col items-center gap-1.5 rounded-rsi px-3 py-1 transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-rsi-surface",
              "disabled:cursor-wait disabled:opacity-60",
            ].join(" ")}
          >
            <span
              aria-hidden
              className={[
                "inline-flex size-11 items-center justify-center rounded-full border-2 border-rsi-success/60 bg-rsi-success-muted text-xl leading-none text-rsi-success ring-1 ring-inset ring-rsi-success/20",
                "transition-transform group-hover:scale-105 group-hover:border-rsi-success group-active:scale-95",
              ].join(" ")}
            >
              ✓
            </span>
            <span className="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-rsi-success">
              Finished
            </span>
            <span className="font-mono text-[0.5rem] uppercase tracking-[0.16em] text-rsi-text-muted transition-colors group-hover:text-rsi-text-secondary">
              Mark done
            </span>
          </button>
          <h2
            id={titleId}
            className="mt-2 text-center font-sans text-sm font-semibold tracking-wide text-rsi-text sm:text-base"
          >
            {sessionName.trim() || "Hauling trip"}
          </h2>
        </div>

        <div className="grid grid-cols-3 divide-x divide-rsi-border border-b border-rsi-border">
          {(
            [
              { label: "Time", value: elapsedLabel },
              { label: "Contracts", value: String(contractsDone) },
              { label: "Stops", value: String(stopsDone) },
            ] as const
          ).map((cell) => (
            <div key={cell.label} className="px-2 py-1.5 text-center sm:px-3">
              <p className="font-mono text-[0.5rem] uppercase tracking-[0.14em] text-rsi-text-muted">
                {cell.label}
              </p>
              <p className="mt-0.5 font-mono text-sm tabular-nums tracking-wide text-rsi-text sm:text-base">
                {cell.value}
              </p>
            </div>
          ))}
        </div>

        <table className="w-full border-collapse">
          <tbody>
            {distanceTotal != null ? (
              <SummaryRow label="Distance" value={distanceLabel} />
            ) : null}
            <SummaryRow
              label="Peak SCU"
              value={peakScu}
              title={SCU_TITLE}
            />
            {auecEarned > 0 ? (
              <SummaryRow
                label="aUEC"
                preserveCase
                title={AUEC_TITLE}
                value={
                  <span className="inline-flex flex-col items-end gap-0.5">
                    <span>+{formatAuec(auecDisplay)}</span>
                    {isAuecSplit ? (
                      <span className="font-mono text-[0.55rem] text-rsi-text-muted">
                        of {formatAuec(auecEarned)}
                      </span>
                    ) : null}
                  </span>
                }
                action={
                  <button
                    type="button"
                    aria-pressed={isAuecSplit}
                    title={
                      isAuecSplit
                        ? "Show full payout"
                        : "Split evenly for two pilots"
                    }
                    onClick={() => setIsAuecSplit((value) => !value)}
                    className={[
                      "shrink-0 rounded-rsi border px-1.5 py-0.5 font-mono text-[0.5rem] uppercase tracking-[0.12em] transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
                      isAuecSplit
                        ? "border-rsi-accent/50 bg-rsi-accent-muted/40 text-rsi-accent"
                        : "border-rsi-border text-rsi-text-muted hover:border-rsi-border-strong hover:text-rsi-text-secondary",
                    ].join(" ")}
                  >
                    {isAuecSplit ? "Full" : "Split ½"}
                  </button>
                }
              />
            ) : null}
            {xpEarned > 0 ? (
              <SummaryRow
                label="XP"
                value={`+${xpEarned.toLocaleString("en-US")}`}
              />
            ) : null}
          </tbody>
        </table>

        <div className="flex flex-col gap-2 border-t border-rsi-border px-4 py-3 sm:flex-row-reverse sm:items-center sm:px-5">
          <button
            type="button"
            disabled={isBusy}
            onClick={onRunAgain}
            className="inline-flex min-h-9 flex-1 items-center justify-center rounded-rsi border border-rsi-accent/50 bg-rsi-accent-muted/40 px-3 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-rsi-accent transition-colors hover:border-rsi-accent hover:bg-rsi-accent-muted/60 disabled:cursor-wait disabled:opacity-60"
          >
            Run again
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={onClose}
            className="inline-flex min-h-9 flex-1 items-center justify-center rounded-rsi border border-rsi-border bg-rsi-bg-deep/80 px-3 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-rsi-text-secondary transition-colors hover:border-rsi-border-strong hover:text-rsi-text disabled:opacity-60"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
