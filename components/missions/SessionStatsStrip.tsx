"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  ImageLightbox,
  type ImageLightboxItem,
} from "@/components/ui/ImageLightbox";
import { SourceIcon } from "@/components/ui/SourceIcon";
import type { MissionScuBreakdownItem } from "@/lib/missions/cargoInventory";
import { screenshotUrlFromLogicalPath } from "@/lib/missions/catalogScreenshotUrl";
import { stripRankFromTitle } from "@/lib/missions/missionRank";
import { SCU_TITLE } from "@/lib/ui/abbrevTitles";

function StatLabel({ children }: { children: string }) {
  return (
    <p className="font-mono text-[0.55rem] uppercase leading-none tracking-[0.16em] text-rsi-text-muted">
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
        "mt-1.5 font-mono text-sm leading-none tabular-nums tracking-wide text-rsi-text",
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
    <>
      <span className={currentClassName}>{current}</span>
      <span className="mx-0.5 text-rsi-text-muted">/</span>
      <span>{total}</span>
    </>
  );
}

const stripClass =
  "inline-flex max-w-full flex-nowrap items-stretch divide-x divide-rsi-border overflow-x-auto rounded-rsi border border-rsi-border bg-rsi-bg-deep/55";

const cellClass =
  "flex min-w-[4.5rem] flex-col justify-center px-3 py-2 text-left first:pl-3.5 last:pr-3.5";

const interactiveCellClass = [
  cellClass,
  "transition-colors hover:bg-rsi-surface-raised/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--rsi-ring)]",
].join(" ");

export type SessionSourceStatProps = {
  /** Opens the contracts catalog for this session. */
  onMissionsClick?: () => void;
  /** Opens session screenshots / source intake. */
  onClick?: () => void;
  className?: string;
};

/** Header actions: Contracts catalog + Source screenshots. */
export function SessionSourceStat({
  onMissionsClick,
  onClick,
  className,
}: SessionSourceStatProps) {
  return (
    <div
      className={[stripClass, className].filter(Boolean).join(" ")}
      role="group"
      aria-label="Session actions"
    >
      <button
        type="button"
        onClick={onMissionsClick}
        className={[
          interactiveCellClass,
          "items-center justify-center",
        ].join(" ")}
      >
        <span className="font-mono text-[0.55rem] uppercase leading-none tracking-[0.16em] text-rsi-text-muted">
          Contracts List
        </span>
      </button>
      <button
        type="button"
        onClick={onClick}
        className={[
          interactiveCellClass,
          "items-center justify-center",
        ].join(" ")}
      >
        <span className="font-mono text-[0.55rem] uppercase leading-none tracking-[0.16em] text-rsi-text-muted">
          Source
        </span>
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
  onMissionsClick?: () => void;
  /** Opens the route stops timeline modal. */
  onStopsClick?: () => void;
  /** Opens the Cargo layout modal. */
  onCapacityClick?: () => void;
  /**
   * Physical cargo holds on the selected ship (from the grid sketch).
   * Drives singular / plural “Cargo bay(s)” label. Defaults to 1.
   */
  cargoBayCount?: number;
  className?: string;
};

/** Contracts + Stops + Cargo bay telemetry for the checklist toolbar. */
export function SessionRouteProgressStats({
  completedLegs,
  totalLegs,
  missionsCompleted,
  missionCount,
  onboardScu,
  totalCapacity,
  isOverCapacity = false,
  onMissionsClick,
  onStopsClick,
  onCapacityClick,
  cargoBayCount = 1,
  className,
}: SessionRouteProgressStatsProps) {
  const stopsLabel = totalLegs === 1 ? "Stop" : "Stops";
  const cargoBayLabel = cargoBayCount === 1 ? "Cargo bay" : "Cargo bays";
  const capacityLabel = totalCapacity > 0 ? totalCapacity : "—";
  const stopsBody = (
    <>
      <StatLabel>{stopsLabel}</StatLabel>
      <StatValue>
        <Fraction current={completedLegs} total={totalLegs} />
      </StatValue>
    </>
  );
  const capacityBody = (
    <>
      <StatLabel>{cargoBayLabel}</StatLabel>
      <StatValue>
        <Fraction
          current={onboardScu}
          total={capacityLabel}
          currentClassName={isOverCapacity ? "text-rsi-warn" : undefined}
        />
      </StatValue>
    </>
  );

  return (
    <div
      className={[stripClass, className].filter(Boolean).join(" ")}
      role="group"
      aria-label="Route progress"
    >
      <button
        type="button"
        onClick={onMissionsClick}
        className={interactiveCellClass}
      >
        <StatLabel>Contracts</StatLabel>
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
          title={`Open ${cargoBayLabel.toLowerCase()}`}
          aria-label={`Open ${cargoBayLabel.toLowerCase()}`}
        >
          {capacityBody}
        </button>
      ) : (
        <div className={cellClass}>{capacityBody}</div>
      )}
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
  /** Per-mission / per-contract SCU rows — shown left of Contracts total. */
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
          "inline-flex size-5 shrink-0 items-center justify-center rounded-rsi border transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
          canOpen
            ? "border-rsi-border bg-rsi-bg-deep/70 text-rsi-text-secondary hover:border-rsi-accent/50 hover:text-rsi-accent"
            : "cursor-not-allowed border-rsi-border/50 text-rsi-text-muted opacity-40",
        ].join(" ")}
      >
        <SourceIcon className="size-2.5" />
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

/** Inventory telemetry for the cargo-layout header (contracts + bay load). */
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
}: SessionInventoryStatProps) {
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
      {missionScuBreakdown.length > 0 ? (
        <div
          className={stripClass}
          role="group"
          aria-label="Per-contract SCU"
        >
          <div className="flex max-w-[min(100%,22rem)] flex-col justify-center gap-1 px-2.5 py-1.5 text-right">
            <p className="font-mono text-[0.5rem] uppercase leading-none tracking-[0.12em] text-rsi-text-muted">
              Contracts
            </p>
            <ul className="flex flex-col gap-0.5">
              {missionScuBreakdown.map((item) => {
                const { title, rank } = stripRankFromTitle(item.title);
                const label = [rank, title || item.title]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <li
                    key={item.missionId}
                    className="flex min-w-0 items-center justify-end gap-1.5"
                    title={item.title}
                  >
                    <span className="min-w-0 truncate text-left text-[0.65rem] leading-none text-rsi-text-secondary">
                      {label}
                    </span>
                    <span className="shrink-0 font-mono text-[0.65rem] leading-none tabular-nums tracking-wide text-rsi-text">
                      {item.scu}
                      <span
                        className="ml-1 text-[0.5rem] uppercase tracking-[0.12em] text-rsi-text-muted"
                        title={SCU_TITLE}
                      >
                        SCU
                      </span>
                    </span>
                    {sessionId ? (
                      <ContractSourceButton
                        item={item}
                        sessionId={sessionId}
                      />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : null}
      <div
        className={stripClass}
        role="group"
        aria-label={`Contracts total ${missionsTotalScu} SCU`}
      >
        <div className="flex w-fit flex-col items-end justify-center gap-1 px-2.5 py-1.5 text-right">
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
        className={stripClass}
        role="group"
        aria-label={`Inventory ${onboardScu} of ${totalCapacity > 0 ? totalCapacity : "unknown"} onboard, peak ${peakScu}, ${availableLabel} available`}
      >
        <div className="flex w-fit flex-col justify-center gap-1 px-2.5 py-1.5 text-right">
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
            label="available"
            valueClassName={
              isOverAvailable ? "text-rsi-danger" : "text-rsi-text tabular-nums"
            }
          />
        </div>
      </div>
    </div>
  );
}
