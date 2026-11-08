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
  onboardScu: number;
  totalCapacity: number;
  missionCargoScu: number;
  isOverCapacity?: boolean;
  isMissionOverCapacity?: boolean;
  className?: string;
};

/** Inventory telemetry for the cargo-layout header. */
export function SessionInventoryStat({
  onboardScu,
  totalCapacity,
  missionCargoScu,
  isOverCapacity = false,
  isMissionOverCapacity = false,
  className,
}: SessionInventoryStatProps) {
  const capacityLabel = totalCapacity > 0 ? totalCapacity : "—";

  return (
    <div
      className={[stripClass, className].filter(Boolean).join(" ")}
      role="group"
      aria-label={`Inventory ${onboardScu} of ${totalCapacity > 0 ? totalCapacity : "unknown"} SCU onboard, ${missionCargoScu} available`}
    >
      <div className={[cellClass, "min-w-[7.5rem]"].join(" ")}>
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
