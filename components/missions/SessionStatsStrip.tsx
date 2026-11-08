"use client";

import type { ReactNode } from "react";

export type SessionStatsStripProps = {
  completedLegs: number;
  totalLegs: number;
  missionsCompleted: number;
  missionCount: number;
  onboardScu: number;
  totalCapacity: number;
  missionCargoScu: number;
  isOverCapacity?: boolean;
  isMissionOverCapacity?: boolean;
  onSourceClick?: () => void;
  onMissionsClick?: () => void;
  className?: string;
};

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

const cellClass =
  "flex min-w-[4.5rem] flex-col justify-center px-3 py-2 text-left first:pl-3.5 last:pr-3.5";

/**
 * Compact session telemetry for the cargo-layout header (Source, legs, missions, inventory).
 */
export function SessionStatsStrip({
  completedLegs,
  totalLegs,
  missionsCompleted,
  missionCount,
  onboardScu,
  totalCapacity,
  missionCargoScu,
  isOverCapacity = false,
  isMissionOverCapacity = false,
  onSourceClick,
  onMissionsClick,
  className,
}: SessionStatsStripProps) {
  const deliveryLabel = totalLegs === 1 ? "Delivery" : "Deliveries";
  const capacityLabel = totalCapacity > 0 ? totalCapacity : "—";

  return (
    <div
      className={[
        "inline-flex max-w-full flex-nowrap items-stretch divide-x divide-rsi-border overflow-x-auto rounded-rsi border border-rsi-border bg-rsi-bg-deep/55",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role="group"
      aria-label="Session stats"
    >
      <button
        type="button"
        onClick={onSourceClick}
        className={[
          cellClass,
          "items-center justify-center transition-colors hover:bg-rsi-surface-raised/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--rsi-ring)]",
        ].join(" ")}
      >
        <span className="font-mono text-[0.55rem] uppercase leading-none tracking-[0.16em] text-rsi-text-muted">
          Source
        </span>
      </button>

      <div className={cellClass}>
        <StatLabel>{deliveryLabel}</StatLabel>
        <StatValue>
          <Fraction current={completedLegs} total={totalLegs} />
        </StatValue>
      </div>

      <button
        type="button"
        onClick={onMissionsClick}
        className={[
          cellClass,
          "transition-colors hover:bg-rsi-surface-raised/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--rsi-ring)]",
        ].join(" ")}
      >
        <StatLabel>Missions</StatLabel>
        <StatValue>
          <Fraction current={missionsCompleted} total={missionCount} />
        </StatValue>
      </button>

      <div
        className={[cellClass, "min-w-[7.5rem]"].join(" ")}
        aria-label={`Inventory ${onboardScu} of ${totalCapacity > 0 ? totalCapacity : "unknown"} SCU onboard, ${missionCargoScu} available`}
      >
        <StatLabel>Inventory</StatLabel>
        <StatValue>
          <Fraction
            current={onboardScu}
            total={capacityLabel}
            currentClassName={isOverCapacity ? "text-rsi-warn" : undefined}
          />
          <span className="ml-1.5 font-mono text-[0.55rem] uppercase tracking-[0.12em] text-rsi-text-muted">
            SCU
          </span>
        </StatValue>
        <p className="mt-1 font-mono text-[0.65rem] leading-none tabular-nums tracking-wide text-rsi-text-secondary">
          <span
            className={
              totalCapacity > 0 && isMissionOverCapacity
                ? "text-rsi-danger"
                : undefined
            }
          >
            {missionCargoScu}
          </span>
          <span className="ml-1 text-[0.5rem] uppercase tracking-[0.12em] text-rsi-text-muted">
            available
          </span>
        </p>
      </div>
    </div>
  );
}
