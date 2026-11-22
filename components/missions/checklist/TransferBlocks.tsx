"use client";

import type { ReactNode } from "react";
import { getLocationImageSrc, getLocationShortName, getShipIconSrc } from "@/lib/fixtures";
import type { ScuTransfer } from "@/lib/missions/cargoInventory";
import { SCU_TITLE } from "@/lib/ui/abbrevTitles";
import { SpaceshipIcon } from "./ChecklistIcons";

/** Chevrons point left → right (pickup Station→Ship, drop-off Ship→Station). */
export function TransferArrow() {
  return (
    <span
      aria-hidden
      className="flex shrink-0 self-center px-3 text-rsi-text-muted sm:px-7"
    >
      <svg
        viewBox="0 0 30 20"
        className="h-4 w-[1.35rem]"
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

export function TransferColumnLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 w-fit border-b border-rsi-text-muted/45 pb-0.5 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-rsi-text-muted">
      {children}
    </p>
  );
}

/**
 * Station / ship thumb with the same quiet caption under both — one visual
 * unit. Ship stays a cutout (no plate); station keeps its photo frame only.
 */
export function TransferEndpointName({
  kind,
  name,
  imageSrc,
  isDone,
  mute,
  strike,
}: {
  kind: "station" | "ship";
  name: string;
  imageSrc: string | null;
  isDone: boolean;
  mute: string;
  strike: string;
}) {
  return (
    <div className="flex w-full min-w-0 flex-col items-start self-stretch">
      <div className="flex w-fit max-w-full flex-col items-center gap-1">
        <span
          aria-hidden
          className={[
            "inline-flex h-10 w-16 shrink-0 items-center justify-center overflow-hidden rounded-rsi",
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
            <SpaceshipIcon className="h-5 w-8 text-rsi-text-muted" />
          ) : (
            <span className="size-full bg-rsi-bg-deep/40" />
          )}
        </span>
        <p
          className={[
            "max-w-[5.5rem] text-center font-mono text-[0.55rem] uppercase leading-tight tracking-[0.12em]",
            isDone ? mute : "text-rsi-text-secondary",
            strike,
          ].join(" ")}
          title={name}
        >
          {name}
        </p>
      </div>
    </div>
  );
}

/** Large green check stamp over Station ↔ Ship when that role is marked done. */
function TransferDoneStamp() {
  return (
    <span
      aria-hidden
      className="pointer-events-none inline-flex rotate-[-18deg] select-none text-rsi-success"
    >
      <svg
        viewBox="0 0 120 120"
        className="size-[4.75rem] sm:size-[5.5rem]"
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
  /** Pickup = station→ship (accent); delivery = ship→station (gold). */
  tone: "pickup" | "delivery";
  children: ReactNode;
}) {
  const surface =
    tone === "pickup"
      ? "border-rsi-accent/20 bg-rsi-accent-muted/20"
      : "border-rsi-gold/20 bg-rsi-gold-muted/20";
  const doneLabel = tone === "pickup" ? "Picked up" : "Dropped off";

  return (
    <div
      className={[
        // Equal endpoint columns. Pickup: Station → Ship; Drop off: Ship → Station.
        // Text wraps; never truncates.
        "relative grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-x-2 overflow-hidden rounded-rsi border px-3 py-4 sm:gap-x-4 sm:px-4",
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
  /**
   * When set (column has a number above), right-align digits so ones line up
   * (e.g. 6 under 36). Omit when the signed line stands alone — keep ± flush.
   */
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
      {/* Sign gutter; optional fixed digit width when stacking under before/after. */}
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

export function PickupTransferBlock({
  location,
  locationSlug,
  shipName,
  shipSlug = null,
  transfer,
  isDone,
}: {
  location: string;
  locationSlug: string;
  shipName: string;
  shipSlug?: string | null;
  transfer: ScuTransfer;
  isDone: boolean;
}) {
  const { strike, mute } = transferToneClasses(isDone);
  const digitCols = transferScuDigitCols(transfer);
  const stationShortName = getLocationShortName(locationSlug);
  const stationImageSrc = getLocationImageSrc(locationSlug);
  const shipImageSrc = getShipIconSrc(shipSlug);

  return (
    <TransferBlockFrame
      title={`Load ${transfer.amount} SCU from ${location}`}
      isDone={isDone}
      tone="pickup"
    >
      <TransferColumnLabel>Station</TransferColumnLabel>
      <span aria-hidden className="col-start-2" />
      <TransferColumnLabel>Ship</TransferColumnLabel>

      <TransferEndpointName
        kind="station"
        name={stationShortName}
        imageSrc={stationImageSrc}
        isDone={isDone}
        mute={mute}
        strike={strike}
      />
      {/* Match thumb height so chevrons center on the images, not captions. */}
      <div className="flex h-10 items-center justify-center self-start">
        <TransferArrow />
      </div>
      <TransferEndpointName
        kind="ship"
        name={shipName}
        imageSrc={shipImageSrc}
        isDone={isDone}
        mute={mute}
        strike={strike}
      />

      <div className="col-span-3 py-5">
        <div
          aria-hidden
          className={[
            "border-t",
            isDone ? "border-rsi-divider" : "border-rsi-border-strong",
          ].join(" ")}
        />
      </div>

      <span aria-hidden className="col-start-1" />
      <div className="col-start-3 min-w-0">
        <TransferScuLine
          amount={String(transfer.before)}
          suffix="SCU"
          tone="text-rsi-text-muted"
          strike={strike}
          mute={mute}
          isDone={isDone}
          digitCols={digitCols}
        />
      </div>

      <div className="col-start-1 min-w-0">
        <TransferScuLine
          amount={`−${transfer.amount}`}
          suffix="withdrawal"
          tone="text-rsi-danger"
          strike={strike}
          mute={mute}
          isDone={isDone}
        />
      </div>
      <div className="col-start-2 flex items-center justify-center self-center">
        <TransferArrow />
      </div>
      <div className="col-start-3 min-w-0">
        <TransferScuLine
          amount={`+${transfer.amount}`}
          suffix="deposit"
          tone="text-rsi-success"
          strike={strike}
          mute={mute}
          isDone={isDone}
          digitCols={digitCols}
        />
      </div>

      <span aria-hidden className="col-start-1" />
      <div className="col-start-3 min-w-0 w-fit">
        <div
          aria-hidden
          className={[
            "mb-1 border-t",
            isDone ? "border-rsi-divider" : "border-rsi-border-strong",
          ].join(" ")}
        />
        <TransferScuLine
          amount={String(transfer.after)}
          suffix="remaining on ship"
          tone="text-rsi-text"
          strike={strike}
          mute={mute}
          isDone={isDone}
          digitCols={digitCols}
        />
      </div>
    </TransferBlockFrame>
  );
}

export function DeliveryTransferBlock({
  location,
  locationSlug,
  shipName,
  shipSlug = null,
  transfer,
  isDone,
}: {
  location: string;
  locationSlug: string;
  shipName: string;
  shipSlug?: string | null;
  transfer: ScuTransfer;
  isDone: boolean;
}) {
  const { strike, mute } = transferToneClasses(isDone);
  const digitCols = transferScuDigitCols(transfer);
  const stationShortName = getLocationShortName(locationSlug);
  const stationImageSrc = getLocationImageSrc(locationSlug);
  const shipImageSrc = getShipIconSrc(shipSlug);

  return (
    <TransferBlockFrame
      title={`Transfer ${transfer.amount} SCU to ${location}`}
      isDone={isDone}
      tone="delivery"
    >
      <TransferColumnLabel>Ship</TransferColumnLabel>
      <span aria-hidden className="col-start-2" />
      <TransferColumnLabel>Station</TransferColumnLabel>

      <TransferEndpointName
        kind="ship"
        name={shipName}
        imageSrc={shipImageSrc}
        isDone={isDone}
        mute={mute}
        strike={strike}
      />
      {/* Match thumb height so chevrons center on the images, not captions. */}
      <div className="flex h-10 items-center justify-center self-start">
        <TransferArrow />
      </div>
      <TransferEndpointName
        kind="station"
        name={stationShortName}
        imageSrc={stationImageSrc}
        isDone={isDone}
        mute={mute}
        strike={strike}
      />

      <div className="col-span-3 py-5">
        <div
          aria-hidden
          className={[
            "border-t",
            isDone ? "border-rsi-divider" : "border-rsi-border-strong",
          ].join(" ")}
        />
      </div>

      <div className="col-start-1 min-w-0">
        <TransferScuLine
          amount={String(transfer.before)}
          suffix="SCU"
          tone="text-rsi-text-muted"
          strike={strike}
          mute={mute}
          isDone={isDone}
          digitCols={digitCols}
        />
      </div>
      <span aria-hidden className="col-start-3" />

      <div className="col-start-1 min-w-0">
        <TransferScuLine
          amount={`−${transfer.amount}`}
          suffix="withdrawal"
          tone="text-rsi-danger"
          strike={strike}
          mute={mute}
          isDone={isDone}
          digitCols={digitCols}
        />
      </div>
      <div className="col-start-2 flex items-center justify-center self-center">
        <TransferArrow />
      </div>
      <div className="col-start-3 min-w-0">
        <TransferScuLine
          amount={`+${transfer.amount}`}
          suffix="deposit"
          tone="text-rsi-success"
          strike={strike}
          mute={mute}
          isDone={isDone}
        />
      </div>

      <div className="col-start-1 min-w-0 w-fit">
        <div
          aria-hidden
          className={[
            "mb-1 border-t",
            isDone ? "border-rsi-divider" : "border-rsi-border-strong",
          ].join(" ")}
        />
        <TransferScuLine
          amount={String(transfer.after)}
          suffix="remaining on ship"
          tone="text-rsi-text"
          strike={strike}
          mute={mute}
          isDone={isDone}
          digitCols={digitCols}
        />
      </div>
      <span aria-hidden className="col-start-3" />
    </TransferBlockFrame>
  );
}
