"use client";

import type { ReactNode } from "react";

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
  onClick?: () => void;
  className?: string;
};

/** Opens session screenshots / source intake. */
export function SessionSourceStat({
  onClick,
  className,
}: SessionSourceStatProps) {
  return (
    <div
      className={[stripClass, className].filter(Boolean).join(" ")}
      role="group"
      aria-label="Source"
    >
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
  onMissionsClick?: () => void;
  className?: string;
};

/** Deliveries + Missions telemetry for the checklist toolbar. */
export function SessionRouteProgressStats({
  completedLegs,
  totalLegs,
  missionsCompleted,
  missionCount,
  onMissionsClick,
  className,
}: SessionRouteProgressStatsProps) {
  const deliveryLabel = totalLegs === 1 ? "Delivery" : "Deliveries";

  return (
    <div
      className={[stripClass, className].filter(Boolean).join(" ")}
      role="group"
      aria-label="Route progress"
    >
      <div className={cellClass}>
        <StatLabel>{deliveryLabel}</StatLabel>
        <StatValue>
          <Fraction current={completedLegs} total={totalLegs} />
        </StatValue>
      </div>
      <button
        type="button"
        onClick={onMissionsClick}
        className={interactiveCellClass}
      >
        <StatLabel>Missions</StatLabel>
        <StatValue>
          <Fraction current={missionsCompleted} total={missionCount} />
        </StatValue>
      </button>
    </div>
  );
}

export type SessionInventoryStatProps = {
  /** SCU aboard from completed stops so far. */
  onboardScu: number;
  /** Highest SCU aboard if the full route is flown as planned. */
  peakScu: number;
  /** Sum of cargo SCU across agreed missions. */
  missionsTotalScu: number;
  totalCapacity: number;
  /**
   * Bay headroom for more mission cargo (`capacity − peak`).
   * Negative when the planned peak exceeds capacity. Null when capacity unknown.
   */
  availableScu: number | null;
  isOverCapacity?: boolean;
  className?: string;
};

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

/** Inventory telemetry for the cargo-layout header (missions total + bay load). */
export function SessionInventoryStat({
  onboardScu,
  peakScu,
  missionsTotalScu,
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
      <div
        className={stripClass}
        role="group"
        aria-label={`Missions total ${missionsTotalScu} SCU`}
      >
        <div className="flex w-fit flex-col items-end justify-center gap-1 px-2.5 py-1.5 text-right">
          <p className="font-mono text-[0.5rem] uppercase leading-none tracking-[0.12em] text-rsi-text-muted">
            Missions total
          </p>
          <p className="font-mono text-sm leading-none tabular-nums tracking-wide text-rsi-text">
            {missionsTotalScu}
            <span className="ml-1.5 text-[0.55rem] uppercase tracking-[0.12em] text-rsi-text-muted">
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
