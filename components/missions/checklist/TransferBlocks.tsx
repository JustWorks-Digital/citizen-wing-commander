"use client";

import type { ReactNode } from "react";
import {
  getLocationImageSrc,
  getLocationShortName,
  getShipIconSrc,
} from "@/lib/fixtures";
import type { ScuTransfer } from "@/lib/missions/cargoInventory";
import { SCU_TITLE } from "@/lib/ui/abbrevTitles";
import { SpaceshipIcon } from "./ChecklistIcons";

/** Compact chevrons for receipt header (from → to). */
export function TransferArrow() {
  return (
    <span
      aria-hidden
      className="flex shrink-0 self-center px-3 text-rsi-text-muted sm:px-5"
    >
      <svg
        viewBox="0 0 30 20"
        className="h-3.5 w-[1.15rem]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M4 3 L12 10 L4 17"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M15.5 3 L23.5 10 L15.5 17"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function transferToneClasses(isDone: boolean): {
  strike: string;
  mute: string;
} {
  return {
    strike: "",
    mute: isDone ? "text-rsi-text-muted" : "",
  };
}

/** Inline thumb + name — one header unit, not a tall stacked column. */
function TransferEndpointInline({
  kind,
  name,
  imageSrc,
  isDone,
  mute,
}: {
  kind: "station" | "ship";
  name: string;
  imageSrc: string | null;
  isDone: boolean;
  mute: string;
}) {
  return (
    <div className="flex w-fit max-w-full min-w-0 items-center gap-2">
      <span
        aria-hidden
        className={[
          "inline-flex h-8 w-12 shrink-0 items-center justify-center overflow-hidden rounded-rsi",
          kind === "station"
            ? "border border-rsi-border/70 bg-rsi-bg-deep/50"
            : "",
        ].join(" ")}
      >
        {imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element -- fixture static assets
          <img
            src={imageSrc}
            alt=""
            className={
              kind === "ship"
                ? "h-full w-auto max-w-full object-contain"
                : "size-full object-cover"
            }
          />
        ) : kind === "ship" ? (
          <SpaceshipIcon className="h-4 w-7 text-rsi-text-muted" />
        ) : (
          <span className="size-full bg-rsi-bg-deep/40" />
        )}
      </span>
      <p
        className={[
          "min-w-0 font-mono text-[0.6rem] uppercase leading-tight tracking-[0.12em]",
          kind === "station" ? "truncate" : "whitespace-nowrap",
          isDone ? mute : "text-rsi-text-secondary",
        ].join(" ")}
        title={name}
      >
        {name}
      </p>
    </div>
  );
}

function TransferDoneStamp() {
  return (
    <span
      aria-hidden
      className="pointer-events-none inline-flex rotate-[-18deg] select-none text-rsi-success"
    >
      <svg
        viewBox="0 0 120 120"
        className="size-[3.75rem] sm:size-[4.25rem]"
        role="img"
      >
        <circle
          cx="60"
          cy="60"
          r="54"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          opacity="0.8"
        />
        <circle
          cx="60"
          cy="60"
          r="46"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="3 2.5"
          opacity="0.55"
        />
        <path
          d="M36 64 L52 78 L86 44"
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.75"
        />
      </svg>
    </span>
  );
}

export function TransferBlockFrame({
  title,
  isDone,
  tone,
  children,
}: {
  title: string;
  isDone: boolean;
  tone: "pickup" | "delivery";
  children: ReactNode;
}) {
  /** Hairline only — role tint lives on the parent Pick up / Drop off shell. */
  const surface =
    tone === "pickup"
      ? "border-rsi-accent/30 bg-rsi-bg-deep/25"
      : "border-rsi-gold/30 bg-rsi-bg-deep/25";
  const doneLabel = tone === "pickup" ? "Loaded" : "Unloaded";

  return (
    <div
      className={[
        "relative overflow-hidden rounded-rsi border px-3 py-2.5",
        surface,
        isDone ? "opacity-75 text-rsi-text-muted" : "",
      ].join(" ")}
      title={isDone ? `${title} — ${doneLabel}` : title}
      aria-label={isDone ? `${title}. ${doneLabel}.` : undefined}
    >
      {isDone ? (
        <span className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center">
          <TransferDoneStamp />
        </span>
      ) : null}
      {children}
    </div>
  );
}

export function transferScuDigitCols(transfer: ScuTransfer): number {
  return Math.max(
    String(transfer.before).length,
    String(transfer.amount).length,
    String(transfer.after).length,
    1,
  );
}

export function TransferScuLine({
  amount,
  suffix,
  tone,
  strike,
  mute,
  isDone,
  digitCols = null,
}: {
  amount: string;
  suffix: string;
  tone: string;
  strike: string;
  mute: string;
  isDone: boolean;
  digitCols?: number | null;
}) {
  const signed = /^([+−+-])(.*)$/.exec(amount);
  const sign = signed?.[1] ?? "";
  const digits = signed?.[2] ?? amount;
  const alignUnder = digitCols != null && digitCols > 0;

  return (
    <p
      className={[
        "flex items-baseline font-mono text-sm leading-5 tabular-nums tracking-wide",
        isDone ? mute : tone,
        strike,
      ].join(" ")}
    >
      <span
        className="inline-grid items-baseline"
        style={{
          gridTemplateColumns: alignUnder
            ? `1ch ${digitCols}ch`
            : "1ch auto",
        }}
      >
        <span className="text-end">{sign}</span>
        <span className={alignUnder ? "text-end" : undefined}>{digits}</span>
      </span>
      {suffix ? (
        <span
          className={[
            "ml-1 text-[0.65rem] font-normal tracking-wide no-underline",
            isDone ? "" : "text-rsi-text-muted",
          ].join(" ")}
        >
          {suffix.startsWith("SCU") ? (
            <>
              <span title={SCU_TITLE}>SCU</span>
              {suffix.slice(3)}
            </>
          ) : (
            suffix
          )}
        </span>
      ) : null}
    </p>
  );
}

type ReceiptRow = {
  label: string;
  /** Signed or plain digit string shown before the optional unit. */
  amount: string;
  showScu?: boolean;
  tone: string;
  /** Emphasize as the closing balance line. */
  isBalance?: boolean;
};

function TransferReceiptTable({
  rows,
  isDone,
  mute,
}: {
  rows: ReceiptRow[];
  isDone: boolean;
  mute: string;
}) {
  return (
    <table className="mt-2 w-full border-collapse font-mono text-sm tabular-nums">
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.label}
            className={
              row.isBalance
                ? [
                    "border-t",
                    isDone ? "border-rsi-divider" : "border-rsi-border-strong",
                  ].join(" ")
                : undefined
            }
          >
            <th
              scope="row"
              className={[
                "py-0.5 pr-3 text-left text-[0.65rem] font-normal tracking-wide",
                isDone ? mute : "text-rsi-text-muted",
              ].join(" ")}
            >
              {row.label}
            </th>
            <td
              className={[
                "py-0.5 text-right leading-5 tracking-wide",
                isDone ? mute : row.tone,
              ].join(" ")}
            >
              {row.amount}
              {row.showScu ? (
                <>
                  {" "}
                  <span
                    className={[
                      "text-[0.65rem] font-normal",
                      isDone ? "" : "text-rsi-text-muted",
                    ].join(" ")}
                    title={SCU_TITLE}
                  >
                    SCU
                  </span>
                </>
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

type TransferBlockSharedProps = {
  location: string;
  locationSlug: string;
  shipName: string;
  shipSlug?: string | null;
  transfer: ScuTransfer;
  isDone: boolean;
};

/**
 * Compact transfer receipt: inline from→to thumbs, then a tight ledger table.
 * Pickup = station → ship; drop-off = ship → station.
 */
function TransferReceiptBlock({
  location,
  locationSlug,
  shipName,
  shipSlug = null,
  transfer,
  isDone,
  tone,
}: TransferBlockSharedProps & { tone: "pickup" | "delivery" }) {
  const { mute } = transferToneClasses(isDone);
  const stationShortName = getLocationShortName(locationSlug);
  const stationImageSrc = getLocationImageSrc(locationSlug);
  const shipImageSrc = getShipIconSrc(shipSlug);

  const from =
    tone === "pickup"
      ? {
          kind: "station" as const,
          name: stationShortName,
          imageSrc: stationImageSrc,
        }
      : {
          kind: "ship" as const,
          name: shipName,
          imageSrc: shipImageSrc,
        };
  const to =
    tone === "pickup"
      ? {
          kind: "ship" as const,
          name: shipName,
          imageSrc: shipImageSrc,
        }
      : {
          kind: "station" as const,
          name: stationShortName,
          imageSrc: stationImageSrc,
        };

  const title =
    tone === "pickup"
      ? `Load ${transfer.amount} SCU from ${location}`
      : `Transfer ${transfer.amount} SCU to ${location}`;

  const transferRow: ReceiptRow =
    tone === "pickup"
      ? {
          label: "Loading",
          amount: `+${transfer.amount}`,
          tone: "text-rsi-success",
        }
      : {
          label: "Unloading",
          amount: `−${transfer.amount}`,
          tone: "text-rsi-danger",
        };

  const rows: ReceiptRow[] = [
    {
      label: "Aboard",
      amount: String(transfer.before),
      showScu: true,
      tone: "text-rsi-text-muted",
    },
    transferRow,
    {
      label: "New total",
      amount: String(transfer.after),
      showScu: true,
      tone: "text-rsi-text",
      isBalance: true,
    },
  ];

  return (
    <TransferBlockFrame title={title} isDone={isDone} tone={tone}>
      <div className="relative z-[2] flex w-full min-w-0 items-center">
        {/* Content-sized; station capped, ship keeps full name. Short rows pack left. */}
        <div
          className={[
            "min-w-0 w-fit",
            from.kind === "station" ? "max-w-[11rem]" : "",
          ].join(" ")}
        >
          <TransferEndpointInline
            kind={from.kind}
            name={from.name}
            imageSrc={from.imageSrc}
            isDone={isDone}
            mute={mute}
          />
        </div>
        <TransferArrow />
        <div
          className={[
            "min-w-0 w-fit",
            to.kind === "station" ? "max-w-[11rem]" : "",
          ].join(" ")}
        >
          <TransferEndpointInline
            kind={to.kind}
            name={to.name}
            imageSrc={to.imageSrc}
            isDone={isDone}
            mute={mute}
          />
        </div>
      </div>
      <div className="relative z-[2]">
        <TransferReceiptTable rows={rows} isDone={isDone} mute={mute} />
      </div>
    </TransferBlockFrame>
  );
}

export function PickupTransferBlock(props: TransferBlockSharedProps) {
  return <TransferReceiptBlock {...props} tone="pickup" />;
}

export function DeliveryTransferBlock(props: TransferBlockSharedProps) {
  return <TransferReceiptBlock {...props} tone="delivery" />;
}
