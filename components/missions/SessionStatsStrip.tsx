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
import {
  formatDistanceToNext,
  type DistanceToNext,
} from "@/lib/missions/mockSession";
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
        "mt-0.5 max-w-full whitespace-nowrap font-mono text-[0.65rem] leading-none tabular-nums tracking-wide text-rsi-text sm:mt-1.5 sm:text-sm",
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
}: {
  current: number | string;
  total: number | string;
  currentClassName?: string;
}) {
  return (
    <span className="inline whitespace-nowrap">
      <span className={currentClassName}>{current}</span>
      <span className="mx-0.5 text-rsi-text-muted">/</span>
      <span>{total}</span>
    </span>
  );
}

/** Compact single-row strip (horizontal scroll on narrow viewports). */
const stripClass =
  "flex w-full min-w-0 max-w-full flex-nowrap items-stretch divide-x divide-rsi-border overflow-x-auto overscroll-x-contain rounded-rsi border border-rsi-border bg-rsi-bg-deep/55 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden";

const cellClass =
  "flex shrink-0 flex-col justify-center px-2 py-1 text-left first:pl-2.5 last:pr-2.5 sm:min-w-[4.5rem] sm:px-3 sm:py-2 sm:first:pl-3.5 sm:last:pr-3.5";

const interactiveCellClass = [
  cellClass,
  "transition-colors hover:bg-rsi-surface-raised/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--rsi-ring)]",
].join(" ");

export type SessionSourceStatProps = {
  /** Opens the contracts catalog for this session. */
  onMissionsClick?: () => void;
  /** Opens session screenshots / source intake. */
  onClick?: () => void;
  /** Pending Source shots awaiting AI parse (badge on Source). */
  pendingScreenshotCount?: number;
  className?: string;
};

/** Header actions: Contracts catalog + Source screenshots. */
export function SessionSourceStat({
  onMissionsClick,
  onClick,
  pendingScreenshotCount = 0,
  className,
}: SessionSourceStatProps) {
  const actionLabelClass =
    "font-mono text-[0.5rem] uppercase leading-none tracking-[0.14em] text-rsi-text-muted sm:text-[0.55rem] sm:tracking-[0.16em]";
  const pending =
    Number.isFinite(pendingScreenshotCount) && pendingScreenshotCount > 0
      ? Math.floor(pendingScreenshotCount)
      : 0;
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
          <span className="sm:hidden">Contracts</span>
          <span className="hidden sm:inline">Contracts List</span>
        </span>
      </button>
      <button
        type="button"
        onClick={onClick}
        className={[
          interactiveCellClass,
          "min-w-0 flex-1 items-center justify-center gap-1.5 px-3 py-2 sm:flex-none sm:px-3",
        ].join(" ")}
        title={
          pending > 0
            ? `${pending} pending Source shot${pending === 1 ? "" : "s"} for AI`
            : "Contract screenshots (Source)"
        }
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
  /** Distance already flown (completed legs). */
  distanceTraveled?: DistanceToNext | null;
  /** Full route distance. */
  distanceTotal?: DistanceToNext | null;
  onMissionsClick?: () => void;
  /** Opens the route stops timeline modal. */
  onStopsClick?: () => void;
  /** Opens the storage bays (cargo) modal. */
  onCapacityClick?: () => void;
  /**
   * Physical cargo holds on the selected ship (from the grid sketch).
   * Kept for callers; toolbar label is Bay / Bays.
   */
  cargoBayCount?: number;
  /** Optional control rendered just right of the route progress strip. */
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

/** Contracts + Stops + Storage bays + Distance + aUEC for the checklist toolbar. */
export function SessionRouteProgressStats({
  completedLegs,
  totalLegs,
  missionsCompleted,
  missionCount,
  onboardScu,
  totalCapacity,
  isOverCapacity = false,
  auecEarned = 0,
  auecProjected = 0,
  distanceTraveled = null,
  distanceTotal = null,
  onMissionsClick,
  onStopsClick,
  onCapacityClick,
  cargoBayCount: _cargoBayCount = 1,
  trailing = null,
  className,
}: SessionRouteProgressStatsProps) {
  const capacityLabel = totalCapacity > 0 ? totalCapacity : "—";
  const showAuec = auecProjected > 0 || auecEarned > 0;
  const traveledLabel = formatDistanceToNext(distanceTraveled);
  const totalDistanceLabel = formatDistanceToNext(distanceTotal);
  const showDistance = Boolean(distanceTotal || distanceTraveled);
  const stopsBody = (
    <>
      <StatLabel>Stop</StatLabel>
      <StatValue>
        <Fraction current={completedLegs} total={totalLegs} />
      </StatValue>
    </>
  );
  const capacityBody = (
    <>
      <StatLabel title="Bay">Bay</StatLabel>
      <StatValue>
        <Fraction
          current={onboardScu}
          total={capacityLabel}
          currentClassName={isOverCapacity ? "text-rsi-warn" : undefined}
        />
        <span
          className="ml-1 text-[0.45rem] uppercase tracking-[0.1em] text-rsi-text-muted sm:text-[0.5rem] sm:tracking-[0.12em]"
          title={SCU_TITLE}
        >
          SCU
        </span>
      </StatValue>
    </>
  );
  const auecBody = (
    <>
      <StatLabel title={AUEC_TITLE}>
        <span className="normal-case">aUEC</span>
      </StatLabel>
      <StatValue>
        <Fraction
          current={formatToolbarAuec(auecEarned)}
          total={formatToolbarAuec(auecProjected)}
          currentClassName={
            auecEarned > 0 && auecEarned >= auecProjected
              ? "text-rsi-success"
              : undefined
          }
        />
      </StatValue>
    </>
  );
  const distanceBody = (
    <>
      <StatLabel title="Distance">
        <span className="sm:hidden">Dist</span>
        <span className="hidden sm:inline">Distance</span>
      </StatLabel>
      <StatValue>
        <Fraction current={traveledLabel} total={totalDistanceLabel} />
      </StatValue>
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
        aria-label="Route progress"
      >
        <button
          type="button"
          onClick={onMissionsClick}
          className={interactiveCellClass}
        >
          <StatLabel>Contract</StatLabel>
          <StatValue>
            <Fraction current={missionsCompleted} total={missionCount} />
          </StatValue>
        </button>
        {onStopsClick ? (
          <button
            type="button"
            onClick={onStopsClick}
            className={interactiveCellClass}
          >
            {stopsBody}
          </button>
        ) : (
          <div className={cellClass}>{stopsBody}</div>
        )}
        {onCapacityClick ? (
          <button
            type="button"
            onClick={onCapacityClick}
            className={interactiveCellClass}
            title="Open bays"
            aria-label="Open bays"
          >
            {capacityBody}
          </button>
        ) : (
          <div className={cellClass}>{capacityBody}</div>
        )}
        {showDistance ? (
          <div
            className={cellClass}
            title={`Traveled ${traveledLabel}; trip total ${totalDistanceLabel}`}
            aria-label={`Trip distance ${traveledLabel} of ${totalDistanceLabel}`}
          >
            {distanceBody}
          </div>
        ) : null}
        {showAuec ? (
          <div
            className={[cellClass, "shrink-0"].join(" ")}
            title={`Projected payout ${formatToolbarAuecExact(auecProjected)} aUEC; earned ${formatToolbarAuecExact(auecEarned)} aUEC from completed contracts`}
            aria-label={`aUEC ${formatToolbarAuecExact(auecEarned)} of ${formatToolbarAuecExact(auecProjected)}`}
          >
            {auecBody}
          </div>
        ) : null}
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

function InventoryLine({
  value,
  label,
  valueClassName,
}: {
  value: ReactNode;
  label: string;
  valueClassName?: string;
}) {
  return (
    <p className="font-mono text-[0.65rem] leading-none tabular-nums tracking-wide text-rsi-text-secondary">
      <span className={valueClassName}>{value}</span>
      <span className="ml-1 text-[0.5rem] uppercase tracking-[0.12em] text-rsi-text-muted">
        {label}
      </span>
    </p>
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
 * Stop transfer SCU by cargo type — left of Contracts in the cargo-bays footer.
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
      className={["flex w-fit max-w-full shrink-0 justify-start", className]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className={[stripClass, "h-auto !w-fit max-w-full items-center"].join(
          " ",
        )}
        role="group"
        aria-label={`${title} cargo`}
      >
        <div className="flex h-auto w-max max-w-full flex-col gap-1.5 px-2 py-1.5">
          <p className="font-mono text-[0.5rem] uppercase leading-none tracking-[0.12em] text-rsi-text-muted">
            {title}
          </p>
          <ul
            className="grid w-max grid-flow-col auto-cols-max gap-x-3 gap-y-1.5 overflow-x-auto"
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
  missionScuBreakdown = [],
  sessionId = null,
  totalCapacity,
  availableScu,
  isOverCapacity = false,
  className,
  /** When false, omit the per-contract grid (render it separately in the footer). */
  showContractBreakdown = false,
}: SessionInventoryStatProps & { showContractBreakdown?: boolean }) {
  const capacityLabel = totalCapacity > 0 ? totalCapacity : "—";
  const availableLabel = availableScu == null ? "—" : availableScu;
  const isPeakOverCapacity =
    totalCapacity > 0 && peakScu > totalCapacity;
  const isOverAvailable = availableScu != null && availableScu < 0;

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
        aria-label={`Contracts total ${missionsTotalScu} SCU`}
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
        </div>
      </div>
      <div
        className={[stripClass, "!w-fit max-w-full"].join(" ")}
        role="group"
        aria-label={`Inventory ${onboardScu} of ${totalCapacity > 0 ? totalCapacity : "unknown"} onboard, peak ${peakScu}, ${availableLabel} free`}
      >
        <div className="flex w-fit flex-col justify-center gap-1 px-2 py-1 text-right">
          <InventoryLine
            value={
              <>
                <Fraction
                  current={onboardScu}
                  total={capacityLabel}
                  currentClassName={
                    isOverCapacity ? "text-rsi-warn" : undefined
                  }
                />
              </>
            }
            label="current"
            valueClassName="text-rsi-text tabular-nums"
          />
          <InventoryLine
            value={peakScu}
            label="peak"
            valueClassName={
              isPeakOverCapacity
                ? "text-rsi-danger"
                : "text-rsi-text tabular-nums"
            }
          />
          <InventoryLine
            value={availableLabel}
            label="free"
            valueClassName={
              isOverAvailable ? "text-rsi-danger" : "text-rsi-text tabular-nums"
            }
          />
        </div>
      </div>
    </div>
  );
}
