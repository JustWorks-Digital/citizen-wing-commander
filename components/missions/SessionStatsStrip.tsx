"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  ImageLightbox,
  type ImageLightboxItem,
} from "@/components/ui/ImageLightbox";
import { SourceIcon } from "@/components/ui/SourceIcon";
import { getCommodityBySlug } from "@/lib/fixtures";
import { resolveCommodityColorHex } from "@/lib/fixtures/commodityColors";
import type {
  MissionScuBreakdownItem,
  StopTransferCommodityScu,
} from "@/lib/missions/cargoInventory";
import { screenshotUrlFromLogicalPath } from "@/lib/missions/catalogScreenshotUrl";
import { resolveMissionTitle } from "@/lib/missions/missionRank";
import { formatDistanceToNext, type DistanceToNext } from "@/lib/missions/sessionChecklist";

import { Spinner } from "@/components/ui/Spinner";
import { AUEC_TITLE, SCU_TITLE } from "@/lib/ui/abbrevTitles";

function StatLabel({
  children,
  title,
}: {
  children: ReactNode;
  title?: string;
}) {
  return (
    <p
      className="font-mono text-[0.45rem] uppercase leading-none tracking-[0.12em] text-rsi-text-muted sm:text-[0.55rem] sm:tracking-[0.16em]"
      title={title}
    >
      {children}
    </p>
  );
}

function StatValue({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={[
        "mt-0.5 max-w-full whitespace-nowrap font-mono text-[0.7rem] leading-none tabular-nums tracking-wide text-rsi-text sm:mt-1 sm:text-sm",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </p>
  );
}

function Fraction({
  current,
  total,
  currentClassName,
  totalClassName,
}: {
  current: number | string;
  total: number | string;
  currentClassName?: string;
  totalClassName?: string;
}) {
  return (
    <span className="inline whitespace-nowrap">
      <span className={currentClassName}>{current}</span>
      <span className="mx-0.5 text-rsi-text-muted">/</span>
      <span className={totalClassName}>{total}</span>
    </span>
  );
}

/** Compact single-row strip (horizontal scroll on narrow viewports). */
const stripClass =
  "flex w-full min-w-0 max-w-full flex-nowrap items-stretch divide-x divide-rsi-border overflow-x-auto overscroll-x-contain rounded-rsi border border-rsi-border bg-rsi-bg-deep/55 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden";

const cellClass =
  "flex shrink-0 flex-col justify-center px-2.5 py-1 text-left first:pl-3 last:pr-3 sm:min-w-[4.5rem] sm:px-3 sm:py-1.5 sm:first:pl-3.5 sm:last:pr-3.5";

const interactiveCellClass = [
  cellClass,
  // Raised fill vs strip `bg-rsi-bg-deep` so Contract / Stop / Bay read as clickable.
  "bg-rsi-surface/80 transition-colors hover:bg-rsi-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--rsi-ring)]",
].join(" ");

/** Vertical section label — absolutely positioned so it does not inflate strip height. */
function StripSpine({
  label,
  title,
}: {
  label: string;
  /** Full phrase when `label` is abbreviated. */
  title?: string;
}) {
  return (
    <span
      className="relative w-5 shrink-0 self-stretch border-r border-rsi-border bg-rsi-bg-deep/55 sm:w-6"
      title={title}
      aria-hidden
    >
      <span className="absolute inset-0 flex items-center justify-center font-mono text-[0.5rem] uppercase leading-none tracking-[0.18em] text-rsi-text-muted [writing-mode:vertical-rl] rotate-180">
        {label}
      </span>
    </span>
  );
}

export type SessionSourceStatProps = {
  /** Opens the contracts catalog for this session. */
  onMissionsClick?: () => void;
  /** Opens session screenshots / source intake. */
  onClick?: () => void;
  /** Pending Source shots awaiting AI parse (badge on Source). */
  pendingScreenshotCount?: number;
  className?: string;
  /** Full-width stacked rows (trip panel). */
  stacked?: boolean;
  /** Text links, no border / fill (trip header under Expand). */
  plain?: boolean;
};

/** Header actions: Contracts catalog + Source screenshots. */
export function SessionSourceStat({
  onMissionsClick,
  onClick,
  pendingScreenshotCount = 0,
  className,
  stacked = false,
  plain = false,
}: SessionSourceStatProps) {
  const actionLabelClass =
    "font-mono text-[0.5rem] uppercase leading-none tracking-[0.14em] text-rsi-text-muted sm:text-[0.55rem] sm:tracking-[0.16em]";
  const pending =
    Number.isFinite(pendingScreenshotCount) && pendingScreenshotCount > 0
      ? Math.floor(pendingScreenshotCount)
      : 0;
  const sourceTitle =
    pending > 0
      ? `${pending} pending Source shot${pending === 1 ? "" : "s"} for AI`
      : "Contract screenshots (Source)";

  if (plain) {
    const plainBtnClass = [
      "inline-flex items-center gap-1 rounded-sm px-0.5 py-0.5 transition-colors",
      "hover:text-rsi-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
      actionLabelClass,
    ].join(" ");
    return (
      <div
        className={["flex flex-wrap items-center justify-end gap-x-3 gap-y-1", className]
          .filter(Boolean)
          .join(" ")}
        role="group"
        aria-label="Trip actions"
      >
        <button type="button" onClick={onMissionsClick} className={plainBtnClass}>
          Find a Contract
        </button>
        <button
          type="button"
          onClick={onClick}
          title={sourceTitle}
          className={plainBtnClass}
        >
          Source
          {pending > 0 ? (
            <span className="inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-rsi-accent/25 px-1 font-mono text-[0.55rem] tabular-nums leading-none text-rsi-accent">
              {pending}
            </span>
          ) : null}
        </button>
      </div>
    );
  }

  if (stacked) {
    const stackedBtnClass = [
      "flex min-w-0 flex-1 items-center justify-center gap-1.5 px-2 py-2.5 transition-colors",
      "hover:bg-rsi-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--rsi-ring)]",
    ].join(" ");
    return (
      <div
        className={[
          "flex w-full min-w-0 divide-x divide-rsi-border overflow-hidden rounded-rsi border border-rsi-border bg-rsi-surface/80",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        role="group"
        aria-label="Trip actions"
      >
        <button type="button" onClick={onMissionsClick} className={stackedBtnClass}>
          <span className={actionLabelClass}>Find a Contract</span>
        </button>
        <button
          type="button"
          onClick={onClick}
          title={sourceTitle}
          className={stackedBtnClass}
        >
          <span className={actionLabelClass}>Source</span>
          {pending > 0 ? (
            <span className="inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-rsi-accent/25 px-1 font-mono text-[0.55rem] tabular-nums leading-none text-rsi-accent">
              {pending}
            </span>
          ) : null}
        </button>
      </div>
    );
  }

  return (
    <div
      className={[stripClass, "sm:w-auto", className].filter(Boolean).join(" ")}
      role="group"
      aria-label="Trip actions"
    >
      <button
        type="button"
        onClick={onMissionsClick}
        className={[
          interactiveCellClass,
          "min-w-0 flex-1 items-center justify-center px-3 py-2 sm:flex-none sm:px-3",
        ].join(" ")}
      >
        <span className={actionLabelClass}>
          <span className="sm:hidden">Find</span>
          <span className="hidden sm:inline">Find a Contract</span>
        </span>
      </button>
      <button
        type="button"
        onClick={onClick}
        className={[
          interactiveCellClass,
          "min-w-0 flex-1 items-center justify-center gap-1.5 px-3 py-2 sm:flex-none sm:px-3",
        ].join(" ")}
        title={sourceTitle}
      >
        <span className={actionLabelClass}>Source</span>
        {pending > 0 ? (
          <span className="inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-rsi-accent/25 px-1 font-mono text-[0.55rem] tabular-nums leading-none text-rsi-accent">
            {pending}
          </span>
        ) : null}
      </button>
    </div>
  );
}

export type SessionRouteProgressStatsProps = {
  completedLegs: number;
  totalLegs: number;
  missionsCompleted: number;
  missionCount: number;
  /** SCU currently aboard (completed stops). */
  onboardScu: number;
  /** Highest SCU aboard if the full route is flown as planned. */
  peakScu: number;
  /** Ship cargo bay capacity in SCU. */
  totalCapacity: number;
  isOverCapacity?: boolean;
  /**
   * aUEC from completed contracts so far.
   * Shown with `auecProjected` as earned / total payout.
   */
  auecEarned?: number;
  /** Sum of aUEC across visible (non-hidden) session contracts. */
  auecProjected?: number;
  /** @deprecated Distance lives in the Stops rail. */
  distanceTraveled?: DistanceToNext | null;
  /** @deprecated Distance lives in the Stops rail. */
  distanceTotal?: DistanceToNext | null;
  onMissionsClick?: () => void;
  /** @deprecated Stops open from the Stops rail / mobile Stops section. */
  onStopsClick?: () => void;
  /** Opens the storage bays (cargo) modal. */
  onCapacityClick?: () => void;
  /**
   * Focused stop — SCU onto ship (pick up). Shown stacked with
   * `stopDeliveryScu` to the right of Capacity. Omit both to hide.
   */
  stopPickupScu?: number | null;
  /** Focused stop — SCU off ship (drop off). */
  stopDeliveryScu?: number | null;
  /**
   * Physical cargo holds on the selected ship (from the grid sketch).
   * Kept for callers; toolbar label is Bay / Bays.
   */
  cargoBayCount?: number;
  /** Trip elapsed — Time cell in the Distance / aUEC / Time strip. */
  elapsed?: ReactNode;
  /**
   * Trip save in flight — shown left of Distance in the trip strip so it
   * does not push Distance / aUEC / Time.
   */
  isSaving?: boolean;
  /** Optional control to the right of the trip strip (kept outside overflow). */
  trailing?: ReactNode;
  className?: string;
};

/** Full aUEC for tooltips / a11y. */
function formatToolbarAuecExact(amount: number): string {
  return Math.floor(amount).toLocaleString("en-US");
}

/** Compact toolbar aUEC — `99.5k`, `1.2M` (exact value stays in title). */
function formatToolbarAuec(amount: number): string {
  const n = Math.floor(Math.max(0, amount));
  if (n < 1000) return String(n);
  if (n < 1_000_000) {
    if (n % 1000 === 0) return `${n / 1000}k`;
    const tenths = Math.round(n / 100) / 10;
    return `${String(tenths).replace(/\.0$/, "")}k`;
  }
  if (n % 1_000_000 === 0) return `${n / 1_000_000}M`;
  const tenths = Math.round(n / 100_000) / 10;
  return `${String(tenths).replace(/\.0$/, "")}M`;
}

/**
 * aUEC for the ⋯ menu on small phones (hidden from the strip below `sm`).
 * Distance lives in the Stops rail.
 */
export function RouteTripOverflowStats({
  auecEarned = 0,
  auecProjected = 0,
}: Pick<SessionRouteProgressStatsProps, "auecEarned" | "auecProjected">) {
  const showAuec = auecProjected > 0 || auecEarned > 0;
  if (!showAuec) return null;

  return (
    <div className="flex flex-col gap-1.5 font-mono text-[0.65rem] tabular-nums tracking-wide text-rsi-text">
      <div
        title={`Projected payout ${formatToolbarAuecExact(auecProjected)} aUEC; earned ${formatToolbarAuecExact(auecEarned)} aUEC from completed contracts`}
      >
        <span
          className="text-[0.45rem] tracking-[0.14em] text-rsi-text-muted"
          title={AUEC_TITLE}
        >
          aUEC{" "}
        </span>
        <Fraction
          current={formatToolbarAuec(auecEarned)}
          total={formatToolbarAuec(auecProjected)}
          currentClassName={
            auecEarned > 0 && auecEarned >= auecProjected
              ? "text-rsi-success"
              : undefined
          }
        />
      </div>
    </div>
  );
}

/** Tiny flow arrow — up = onto ship, down = off ship. */
function StopTransferFlowArrow({ inbound }: { inbound: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 12 12"
      className="size-2.5 shrink-0 sm:size-3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {inbound ? (
        <path d="M6 9.5 V3.5 M3.5 5.75 L6 3.25 L8.5 5.75" />
      ) : (
        <path d="M6 2.5 V8.5 M3.5 6.25 L6 8.75 L8.5 6.25" />
      )}
    </svg>
  );
}

/**
 * Cargo strip left (Cargo | Aboard/capacity | Peak | Stop in/out);
 * Progress strip right (Prog | Contracts as completed + aUEC | Time).
 * Time stays in the strip. Distance lives in the Stops rail.
 */
export function SessionRouteProgressStats({
  completedLegs: _completedLegs,
  totalLegs: _totalLegs,
  missionsCompleted,
  missionCount,
  onboardScu,
  peakScu,
  totalCapacity,
  isOverCapacity = false,
  auecEarned = 0,
  auecProjected = 0,
  distanceTraveled: _distanceTraveled = null,
  distanceTotal: _distanceTotal = null,
  onMissionsClick,
  onStopsClick: _onStopsClick,
  onCapacityClick,
  stopPickupScu = null,
  stopDeliveryScu = null,
  cargoBayCount: _cargoBayCount = 1,
  elapsed = null,
  isSaving = false,
  trailing = null,
  className,
}: SessionRouteProgressStatsProps) {
  const capacityLabel = totalCapacity > 0 ? totalCapacity : "—";
  const showAuec = auecProjected > 0 || auecEarned > 0;
  const isPeakOverCapacity =
    totalCapacity > 0 && peakScu > totalCapacity;
  const showStopTransfer =
    stopPickupScu != null || stopDeliveryScu != null;
  const stopPickup = Math.max(0, Math.floor(stopPickupScu ?? 0));
  const stopDelivery = Math.max(0, Math.floor(stopDeliveryScu ?? 0));
  const bayAria = showStopTransfer
    ? `Cargo ${onboardScu} of ${capacityLabel} SCU aboard, peak ${peakScu} SCU, stop pick up ${stopPickup} SCU, drop off ${stopDelivery} SCU`
    : `Cargo ${onboardScu} of ${capacityLabel} SCU aboard, peak ${peakScu} SCU`;
  const scuUnit = (
    <span
      className="ml-1 text-[0.45rem] uppercase tracking-[0.1em] text-rsi-text-muted sm:text-[0.5rem] sm:tracking-[0.12em]"
      title={SCU_TITLE}
    >
      SCU
    </span>
  );
  const stopTransferBody = showStopTransfer ? (
    <div
      className="flex items-center gap-0.5"
      title={`This stop: ${stopPickup} ${SCU_TITLE} onto ship, ${stopDelivery} ${SCU_TITLE} off ship`}
    >
      <div className="flex flex-col justify-center gap-0.5">
        <p className="flex items-center gap-1 font-mono text-[0.65rem] leading-none tabular-nums tracking-wide text-rsi-accent sm:text-[0.7rem]">
          <StopTransferFlowArrow inbound />
          <span>{stopPickup}</span>
        </p>
        <p className="flex items-center gap-1 font-mono text-[0.65rem] leading-none tabular-nums tracking-wide text-rsi-gold sm:text-[0.7rem]">
          <StopTransferFlowArrow inbound={false} />
          <span>{stopDelivery}</span>
        </p>
      </div>
      {scuUnit}
    </div>
  ) : null;
  const aboardCapacityBody = (
    <>
      <StatLabel title={`SCU currently aboard / ship capacity (${SCU_TITLE})`}>
        Aboard
      </StatLabel>
      <StatValue>
        <Fraction
          current={onboardScu}
          total={capacityLabel}
          currentClassName={isOverCapacity ? "text-rsi-warn" : undefined}
        />
        {scuUnit}
      </StatValue>
    </>
  );
  const peakBody = (
    <>
      <StatLabel title="Highest SCU aboard during this trip">Peak</StatLabel>
      <StatValue>
        <span className={isPeakOverCapacity ? "text-rsi-warn" : undefined}>
          {peakScu}
        </span>
        {scuUnit}
      </StatValue>
    </>
  );
  const contractsAuecTitle = showAuec
    ? `${missionsCompleted} of ${missionCount} contracts completed; projected ${formatToolbarAuecExact(auecProjected)} aUEC; earned ${formatToolbarAuecExact(auecEarned)} aUEC`
    : `${missionsCompleted} of ${missionCount} contracts completed`;
  const contractsAuecAria = showAuec
    ? `${missionsCompleted} of ${missionCount} contracts completed, aUEC ${formatToolbarAuecExact(auecEarned)} of ${formatToolbarAuecExact(auecProjected)}`
    : `${missionsCompleted} of ${missionCount} contracts completed`;
  const contractsAuecBody = (
    <>
      <StatLabel title={contractsAuecTitle}>Contracts</StatLabel>
      <div className="mt-0.5 flex items-center sm:mt-1">
        <StatValue className="!mt-0 pr-2.5 sm:pr-3">
          <Fraction
            current={missionsCompleted}
            total={missionCount}
            totalClassName="text-rsi-text-secondary"
          />
        </StatValue>
        {showAuec ? (
          <StatValue
            className="!mt-0 flex items-baseline border-l border-rsi-border pl-2.5 sm:pl-3"
          >
            <Fraction
              current={formatToolbarAuec(auecEarned)}
              total={formatToolbarAuec(auecProjected)}
              currentClassName={
                auecEarned > 0 && auecEarned >= auecProjected
                  ? "text-rsi-success"
                  : undefined
              }
              totalClassName="text-rsi-text-secondary"
            />
            <span
              className="ml-1 text-[0.45rem] tracking-[0.1em] text-rsi-text-muted sm:text-[0.5rem] sm:tracking-[0.12em]"
              title={AUEC_TITLE}
            >
              aUEC
            </span>
          </StatValue>
        ) : null}
      </div>
    </>
  );

  return (
    <div
      className={["flex w-full min-w-0 max-w-full items-center gap-2", className]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className={[stripClass, "!w-fit max-w-full"].join(" ")}
        role="group"
        aria-label={bayAria}
      >
        {onCapacityClick ? (
          <button
            type="button"
            onClick={onCapacityClick}
            className={[
              interactiveCellClass,
              "flex-row items-stretch gap-0 !p-0",
            ].join(" ")}
            title="Open bays"
            aria-label={`Cargo ${onboardScu} of ${capacityLabel} SCU aboard, peak ${peakScu} SCU`}
          >
            <StripSpine label="Cargo" />
            <span className={`${cellClass} border-0`}>
              {aboardCapacityBody}
            </span>
            <span
              className={`${cellClass} border-0 border-l border-rsi-border`}
            >
              {peakBody}
            </span>
          </button>
        ) : (
          <>
            <StripSpine label="Cargo" />
            <div className={cellClass}>{aboardCapacityBody}</div>
            <div className={cellClass}>{peakBody}</div>
          </>
        )}
        {stopTransferBody ? (
          <div className={[cellClass, "shrink-0"].join(" ")}>{stopTransferBody}</div>
        ) : null}
      </div>
      <div className="ml-auto flex min-w-0 max-w-full shrink-0 items-center gap-1.5 sm:gap-2">
        {isSaving ? (
          <span
            className="inline-flex shrink-0 items-center gap-1 font-mono text-[0.55rem] uppercase tracking-[0.12em] text-rsi-accent sm:gap-1.5 sm:text-[0.6rem] sm:tracking-[0.14em]"
            role="status"
            aria-live="polite"
          >
            <Spinner className="size-3 sm:size-3.5" label="Saving trip" />
            <span className="hidden sm:inline">Saving…</span>
          </span>
        ) : null}
        <div
          className={[stripClass, "!w-fit max-w-full"].join(" ")}
          role="group"
          aria-label="Progress — contracts, payout and time"
        >
          <button
            type="button"
            onClick={onMissionsClick}
            className={[
              interactiveCellClass,
              "flex-row items-stretch gap-0 !p-0",
            ].join(" ")}
            title={contractsAuecTitle}
            aria-label={contractsAuecAria}
          >
            <StripSpine label="Prog" title="Progress" />
            <span className={`${cellClass} border-0`}>
              {contractsAuecBody}
            </span>
          </button>
          {elapsed ? (
            <div
              className={[cellClass, "shrink-0"].join(" ")}
              title="Total time"
              aria-label="Trip time"
            >
              <StatLabel>Time</StatLabel>
              <StatValue>{elapsed}</StatValue>
            </div>
          ) : null}
        </div>
      </div>
      {trailing}
    </div>
  );
}

export type SessionInventoryStatProps = {
  /** SCU aboard from completed stops so far. */
  onboardScu: number;
  /** Highest SCU aboard if the full route is flown as planned. */
  peakScu: number;
  /** Sum of cargo SCU across agreed contracts. */
  missionsTotalScu: number;
  /**
   * SCU actually placed on the All-tab bay grid (packing / Manual).
   * Shown under Contracts total as placed / ship capacity. Omit to hide.
   */
  gridPlacedScu?: number | null;
  /** Per-mission SCU rows — optional beside Contracts total when showContractBreakdown. */
  missionScuBreakdown?: MissionScuBreakdownItem[];
  /** Session UUID — resolves contract screenshot URLs for the source icon. */
  sessionId?: string | null;
  totalCapacity: number;
  /**
   * Bay headroom for more mission cargo (`capacity − peak`).
   * Negative when the planned peak exceeds capacity. Null when capacity unknown.
   */
  availableScu: number | null;
  isOverCapacity?: boolean;
  /**
   * Unstable overflow SCU in use (past snapped ship capacity), when the ship
   * has overflow grids. Separate from capacity; capacity + overflow = total bay.
   */
  overflowScu?: number;
  /** Geometric overflow reserve capacity (0 when the ship has none). */
  overflowCapacity?: number;
  className?: string;
};

function resolveSessionScreenshotUrl(
  logicalPath: string,
  sessionId: string,
): string | null {
  const parts = logicalPath.trim().split("/").filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length === 1) {
    return screenshotUrlFromLogicalPath(`${sessionId}/${parts[0]}`);
  }
  return screenshotUrlFromLogicalPath(logicalPath);
}

function ContractSourceButton({
  item,
  sessionId,
}: {
  item: MissionScuBreakdownItem;
  sessionId: string;
}) {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const galleryItems = useMemo((): ImageLightboxItem[] => {
    const caption = `${item.title}\n${item.scu} SCU`;
    const items: ImageLightboxItem[] = [];
    for (const logicalPath of item.screenshots) {
      const url = resolveSessionScreenshotUrl(logicalPath, sessionId);
      if (!url) continue;
      const filename =
        logicalPath.split("/").filter(Boolean).at(-1) ?? logicalPath;
      items.push({
        src: url,
        alt: filename,
        title: filename,
        caption,
      });
    }
    return items;
  }, [item, sessionId]);

  const canOpen = galleryItems.length > 0;

  return (
    <>
      <button
        type="button"
        disabled={!canOpen}
        title={
          canOpen
            ? galleryItems.length > 1
              ? `View ${galleryItems.length} source screenshots`
              : "View source screenshot"
            : "No source screenshot on file"
        }
        aria-label="View source"
        onClick={() => {
          if (!canOpen) return;
          setGalleryIndex(0);
          setGalleryOpen(true);
        }}
        className={[
          "inline-flex size-4 shrink-0 items-center justify-center rounded-rsi border transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
          canOpen
            ? "border-rsi-border bg-rsi-bg-deep/70 text-rsi-text-secondary hover:border-rsi-accent/50 hover:text-rsi-accent"
            : "cursor-not-allowed border-rsi-border/50 text-rsi-text-muted opacity-40",
        ].join(" ")}
      >
        <SourceIcon className="size-2" />
      </button>
      {galleryOpen && galleryItems.length > 0 ? (
        <ImageLightbox
          src={galleryItems[galleryIndex]?.src ?? galleryItems[0]!.src}
          alt={galleryItems[galleryIndex]?.alt}
          title={galleryItems[galleryIndex]?.title}
          caption={galleryItems[galleryIndex]?.caption}
          items={galleryItems}
          index={galleryIndex}
          onIndexChange={setGalleryIndex}
          onClose={() => setGalleryOpen(false)}
        />
      ) : null}
    </>
  );
}

/** One cell in the cargo-bay current/peak/overflow/free quadrant grid. */
function InventoryQuadrant({
  value,
  label,
  valueClassName,
  className,
}: {
  value: ReactNode;
  label: string;
  valueClassName?: string;
  className?: string;
}) {
  return (
    <div
      className={[
        "flex min-w-[4.5rem] flex-col justify-center gap-0.5 px-2 py-1.5 text-left",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <p className="font-mono text-[0.45rem] uppercase leading-none tracking-[0.12em] text-rsi-text-muted">
        {label}
      </p>
      <p
        className={[
          "font-mono text-[0.7rem] leading-none tabular-nums tracking-wide text-rsi-text",
          valueClassName,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {value}
      </p>
    </div>
  );
}

export type SessionCurrentStopPickupGridProps = {
  /** Pickup / delivery SCU by cargo type at this stop. */
  transfers: StopTransferCommodityScu[];
  /** Location name used as the section title. */
  stopLabel?: string | null;
  className?: string;
};

/**
 * Stop transfer SCU by cargo type — under the cargo-bay graphs.
 * Sized to content (no inner scroll for typical 2-column stop lists).
 */
export function SessionCurrentStopPickupGrid({
  transfers,
  stopLabel = null,
  className,
}: SessionCurrentStopPickupGridProps) {
  if (transfers.length === 0) return null;

  const rowsPerColumn = Math.min(4, transfers.length);
  const title = stopLabel?.trim() || "Transfer";

  return (
    <div
      className={["w-fit max-w-full shrink-0", className]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className="rounded-rsi border border-rsi-border bg-rsi-bg-deep/55 px-2 py-1.5"
        role="group"
        aria-label={`${title} cargo`}
      >
        <div className="flex w-max max-w-full flex-col gap-1.5">
          <p className="font-mono text-[0.5rem] uppercase leading-none tracking-[0.12em] text-rsi-text-muted">
            {title}
          </p>
          <ul
            className="grid w-max grid-flow-col auto-cols-max gap-x-3 gap-y-1.5"
            style={{
              gridTemplateRows: `repeat(${rowsPerColumn}, auto)`,
            }}
          >
            {transfers.map((item) => {
              const name =
                getCommodityBySlug(item.commoditySlug)?.name ??
                item.commoditySlug;
              const cargoHex = resolveCommodityColorHex(
                null,
                null,
                item.commoditySlug,
              );
              const actionLabel =
                item.action === "pickup" ? "pickup" : "delivery";
              return (
                <li
                  key={`${item.action}:${item.commoditySlug}`}
                  className="flex min-w-0 max-w-[14rem] items-center gap-1"
                  title={`${name} - ${item.scu} ${SCU_TITLE} ${actionLabel}`}
                >
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-[2px] border border-rsi-border/60"
                    style={{
                      backgroundColor: cargoHex ?? "var(--rsi-text-muted)",
                    }}
                  />
                  <span className="min-w-0 truncate text-[0.6rem] leading-none text-rsi-text-secondary">
                    {name}
                  </span>
                  <span className="shrink-0 font-mono text-[0.55rem] leading-none tabular-nums tracking-wide text-rsi-text">
                    {item.scu}
                    <span
                      className="ml-0.5 text-[0.45rem] uppercase tracking-[0.1em] text-rsi-text-muted"
                      title={SCU_TITLE}
                    >
                      SCU
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

export type SessionContractScuGridProps = {
  missionScuBreakdown: MissionScuBreakdownItem[];
  sessionId?: string | null;
  className?: string;
};

/**
 * Per-contract SCU grid: 4 per column, fills across columns.
 * Optional inventory aside / Storybook — not shown in the storage-bays footer.
 */
export function SessionContractScuGrid({
  missionScuBreakdown,
  sessionId = null,
  className,
}: SessionContractScuGridProps) {
  if (missionScuBreakdown.length === 0) return null;

  const rowsPerColumn = Math.min(4, missionScuBreakdown.length);

  return (
    <div
      className={["inline-flex w-max max-w-none shrink-0 justify-start", className]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className="flex h-auto w-max items-center overflow-visible rounded-rsi border border-rsi-border bg-rsi-bg-deep/55"
        role="group"
        aria-label="Per-contract SCU"
      >
        <div className="flex w-max flex-col gap-1.5 px-2 py-1.5">
          <p className="font-mono text-[0.5rem] uppercase leading-none tracking-[0.12em] text-rsi-text-muted">
            Contracts
          </p>
          <ul
            className="grid w-max grid-flow-col auto-cols-max gap-x-3 gap-y-0.5"
            style={{
              gridTemplateRows: `repeat(${rowsPerColumn}, auto)`,
            }}
          >
            {missionScuBreakdown.map((item) => {
              const label = resolveMissionTitle(item) || item.title;
              return (
                <li
                  key={item.missionId}
                  className="flex min-w-0 max-w-[13rem] items-center gap-1"
                  title={item.title}
                >
                  <span className="min-w-0 truncate text-[0.6rem] leading-none text-rsi-text-secondary">
                    {label}:
                  </span>
                  <span className="shrink-0 font-mono text-[0.55rem] leading-none tabular-nums tracking-wide text-rsi-text">
                    {item.scu}
                    <span
                      className="ml-0.5 text-[0.45rem] uppercase tracking-[0.1em] text-rsi-text-muted"
                      title={SCU_TITLE}
                    >
                      SCU
                    </span>
                  </span>
                  {sessionId ? (
                    <ContractSourceButton item={item} sessionId={sessionId} />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

/** Inventory telemetry for the cargo-layout header (totals + bay load). */
export function SessionInventoryStat({
  onboardScu,
  peakScu,
  missionsTotalScu,
  gridPlacedScu = null,
  missionScuBreakdown = [],
  sessionId = null,
  totalCapacity,
  availableScu,
  isOverCapacity = false,
  overflowScu = 0,
  overflowCapacity = 0,
  className,
  /** When false, omit the per-contract grid (render it separately in the footer). */
  showContractBreakdown = false,
}: SessionInventoryStatProps & { showContractBreakdown?: boolean }) {
  const capacityLabel = totalCapacity > 0 ? totalCapacity : "—";
  const availableLabel = availableScu == null ? "—" : availableScu;
  const bayWithOverflow =
    totalCapacity > 0 ? totalCapacity + overflowCapacity : 0;
  const isPeakOverCapacity =
    totalCapacity > 0 && peakScu > bayWithOverflow;
  const isPeakUsingOverflow =
    overflowCapacity > 0 &&
    totalCapacity > 0 &&
    peakScu > totalCapacity &&
    peakScu <= bayWithOverflow;
  const isOverAvailable = availableScu != null && availableScu < 0;
  const showGridPlaced = gridPlacedScu != null;
  const isGridOverCapacity =
    showGridPlaced && totalCapacity > 0 && gridPlacedScu > totalCapacity;
  const contractsAria = showGridPlaced
    ? `Contracts total ${missionsTotalScu} SCU, on grid ${gridPlacedScu} of ${capacityLabel} SCU`
    : `Contracts total ${missionsTotalScu} SCU`;

  return (
    <div
      className={["flex flex-wrap items-stretch justify-end gap-1.5", className]
        .filter(Boolean)
        .join(" ")}
    >
      {showContractBreakdown && missionScuBreakdown.length > 0 ? (
        <SessionContractScuGrid
          missionScuBreakdown={missionScuBreakdown}
          sessionId={sessionId}
          className="max-w-[min(100%,28rem)]"
        />
      ) : null}
      <div
        className={[stripClass, "!w-fit max-w-full"].join(" ")}
        role="group"
        aria-label={contractsAria}
      >
        <div className="flex w-fit flex-col items-end justify-center gap-0.5 px-2 py-1 text-right">
          <p className="font-mono text-[0.5rem] uppercase leading-none tracking-[0.12em] text-rsi-text-muted">
            Contracts total
          </p>
          <p className="font-mono text-sm leading-none tabular-nums tracking-wide text-rsi-text">
            {missionsTotalScu}
            <span
              className="ml-1.5 text-[0.55rem] uppercase tracking-[0.12em] text-rsi-text-muted"
              title={SCU_TITLE}
            >
              SCU
            </span>
          </p>
          {showGridPlaced ? (
            <>
              <div
                aria-hidden
                className="my-1 w-full border-t border-rsi-border"
              />
              <p className="font-mono text-[0.5rem] uppercase leading-none tracking-[0.12em] text-rsi-text-muted">
                On grid
              </p>
              <p className="font-mono text-xs leading-none tabular-nums tracking-wide text-rsi-text">
                <Fraction
                  current={gridPlacedScu}
                  total={capacityLabel}
                  currentClassName={
                    isGridOverCapacity ? "text-rsi-warn" : undefined
                  }
                />
                <span
                  className="ml-1.5 text-[0.5rem] uppercase tracking-[0.12em] text-rsi-text-muted"
                  title={SCU_TITLE}
                >
                  SCU
                </span>
              </p>
            </>
          ) : null}
        </div>
      </div>
      <div
        className={[
          stripClass,
          "!w-fit max-w-full !overflow-hidden divide-x-0",
        ].join(" ")}
        role="group"
        aria-label={`Inventory ${onboardScu} of ${totalCapacity > 0 ? totalCapacity : "unknown"} onboard, peak ${peakScu}, ${availableLabel} free, overflow ${overflowScu}`}
      >
        <div className="grid w-fit grid-cols-2 divide-x divide-y divide-rsi-border">
          <InventoryQuadrant
            label="current"
            value={
              <Fraction
                current={onboardScu}
                total={capacityLabel}
                currentClassName={isOverCapacity ? "text-rsi-warn" : undefined}
              />
            }
          />
          <InventoryQuadrant
            label="peak"
            value={peakScu}
            valueClassName={
              isPeakOverCapacity
                ? "text-rsi-danger"
                : isPeakUsingOverflow
                  ? "text-rsi-warn"
                  : undefined
            }
          />
          <InventoryQuadrant
            label="overflow"
            value={
              <Fraction
                current={overflowScu}
                total={overflowCapacity}
                currentClassName={overflowScu > 0 ? "text-rsi-warn" : undefined}
              />
            }
          />
          <InventoryQuadrant
            label="free"
            value={availableLabel}
            valueClassName={isOverAvailable ? "text-rsi-danger" : undefined}
          />
        </div>
      </div>
    </div>
  );
}
