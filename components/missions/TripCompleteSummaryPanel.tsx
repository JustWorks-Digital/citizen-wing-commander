"use client";

import { useState, type ReactNode } from "react";
import { TransferScuLine } from "@/components/missions/checklist/TransferBlocks";
import type { DistanceToNext } from "@/lib/missions/sessionChecklist";

import { AUEC_TITLE, SCU_TITLE } from "@/lib/ui/abbrevTitles";

export type TripCompleteSummaryPanelProps = {
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
  /** Duplicate trip plan into a new session with progress cleared. */
  onRunAgain: () => void;
  /**
   * Optional acknowledge action (modal / embedded Continue).
   * Omitted when Continue is not offered.
   */
  onContinue?: () => void;
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
          "whitespace-nowrap px-3 py-2.5 text-left font-mono text-[0.6rem] font-normal tracking-[0.14em] text-rsi-text-muted sm:px-3.5",
          preserveCase ? "normal-case" : "uppercase",
        ].join(" ")}
      >
        {label}
      </th>
      <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono text-sm tabular-nums tracking-wide text-rsi-text sm:px-3.5 sm:text-base">
        <div className="flex items-center justify-end gap-2">
          {action}
          <span>{value}</span>
        </div>
      </td>
    </tr>
  );
}

/**
 * End-of-trip report body — used inline in the checklist when every stop is
 * done, and inside the optional modal wrapper. Width hugs content so stats
 * stay readable on one line.
 */
export function TripCompleteSummaryPanel({
  sessionName,
  elapsedLabel,
  contractsDone,
  stopsDone,
  peakScu,
  auecEarned,
  xpEarned,
  distanceTotal,
  isBusy = false,
  onRunAgain,
  onContinue,
}: TripCompleteSummaryPanelProps) {
  const [isAuecSplit, setIsAuecSplit] = useState(false);

  const distanceLabel = formatRoundedDistance(distanceTotal);
  const auecHalf = Math.floor(Math.max(0, auecEarned) / 2);
  const auecDigitCols = Math.max(
    formatAuec(auecEarned).length,
    formatAuec(auecHalf).length,
    1,
  );
  const auecStrike = "";
  const auecMute = "text-rsi-text-muted";

  return (
    <div
      id="trip-complete-summary"
      className="inline-flex w-fit max-w-full flex-col overflow-hidden rounded-rsi border border-rsi-border bg-rsi-surface"
    >
      <div className="border-b border-rsi-border px-4 py-4 sm:px-5">
        {onContinue ? (
          <button
            type="button"
            disabled={isBusy}
            onClick={onContinue}
            aria-label="Completed — continue"
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
              Completed
            </span>
          </button>
        ) : (
          <div className="mx-auto flex flex-col items-center gap-1.5 px-3 py-1">
            <span
              aria-hidden
              className="inline-flex size-11 items-center justify-center rounded-full border-2 border-rsi-success/60 bg-rsi-success-muted text-xl leading-none text-rsi-success ring-1 ring-inset ring-rsi-success/20"
            >
              ✓
            </span>
            <span className="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-rsi-success">
              Completed
            </span>
          </div>
        )}
        <h2 className="mt-2 max-w-[18rem] truncate text-center font-sans text-sm font-semibold tracking-wide text-rsi-text sm:text-base">
          {sessionName.trim() || "Hauling trip"}
        </h2>
      </div>

      {(
        [
          [
            { label: "Contracts", value: String(contractsDone) },
            { label: "Stops", value: String(stopsDone) },
          ],
          [
            { label: "Distance", value: distanceLabel },
            { label: "Time", value: elapsedLabel },
          ],
        ] as const
      ).map((row) => (
        <div
          key={row.map((cell) => cell.label).join("-")}
          className="grid w-full grid-cols-2 divide-x divide-rsi-border border-b border-rsi-border"
        >
          {row.map((cell) => (
            <div
              key={cell.label}
              className="min-w-0 whitespace-nowrap px-3 py-1.5 text-center sm:px-4"
            >
              <p className="font-mono text-[0.5rem] uppercase tracking-[0.14em] text-rsi-text-muted">
                {cell.label}
              </p>
              <p className="mt-0.5 font-mono text-sm tabular-nums tracking-wide text-rsi-text sm:text-base">
                {cell.value}
              </p>
            </div>
          ))}
        </div>
      ))}

      <table className="w-full border-collapse">
        <tbody>
          <SummaryRow label="Peak SCU" value={peakScu} title={SCU_TITLE} />
          {auecEarned > 0 ? (
            <SummaryRow
              label="aUEC"
              preserveCase
              title={AUEC_TITLE}
              value={
                isAuecSplit ? (
                  <div className="ml-auto w-fit text-left">
                    <TransferScuLine
                      amount={`+${formatAuec(auecEarned)}`}
                      suffix="÷2"
                      tone="text-rsi-text-muted"
                      strike={auecStrike}
                      mute={auecMute}
                      isDone={false}
                      digitCols={auecDigitCols}
                    />
                    <div
                      aria-hidden
                      className="mb-1 border-t border-rsi-border-strong"
                    />
                    <TransferScuLine
                      amount={`+${formatAuec(auecHalf)}`}
                      suffix=""
                      tone="text-rsi-text"
                      strike={auecStrike}
                      mute={auecMute}
                      isDone={false}
                      digitCols={auecDigitCols}
                    />
                  </div>
                ) : (
                  `+${formatAuec(auecEarned)}`
                )
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

      <div
        className={[
          "grid w-full gap-2 border-t border-rsi-border px-4 py-3 sm:px-5",
          onContinue ? "grid-cols-2" : "grid-cols-1",
        ].join(" ")}
      >
        {onContinue ? (
          <button
            type="button"
            disabled={isBusy}
            onClick={onContinue}
            className="inline-flex min-h-9 w-full items-center justify-center rounded-rsi border border-rsi-border bg-rsi-bg-deep/80 px-3 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-rsi-text-secondary transition-colors hover:border-rsi-border-strong hover:text-rsi-text disabled:opacity-60"
          >
            Continue
          </button>
        ) : null}
        <button
          type="button"
          disabled={isBusy}
          onClick={onRunAgain}
          className="inline-flex min-h-9 w-full items-center justify-center rounded-rsi border border-rsi-accent/50 bg-rsi-accent-muted/40 px-3 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-rsi-accent transition-colors hover:border-rsi-accent hover:bg-rsi-accent-muted/60 disabled:cursor-wait disabled:opacity-60"
        >
          Run again
        </button>
      </div>
    </div>
  );
}
