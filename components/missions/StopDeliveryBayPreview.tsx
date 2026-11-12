"use client";

import { memo, useMemo, useState } from "react";
import type { HaulingChecklistRow } from "@/lib/missions/mockSession";
import {
  planPickupHangarStacks,
  planStopCargoStacks,
  type StopCargoStacksPlan,
} from "@/lib/missions/stopDeliveryBoxes";
import { StopDeliveryStacksView } from "./StopDeliveryStacksView";

export type StopDeliveryBayPreviewProps = {
  row: HaulingChecklistRow;
  /** Full route — required for pickup hangar piles by delivery location. */
  rows?: HaulingChecklistRow[];
  className?: string;
  /** Double-click under-stack cargo label to edit that mission’s box mix. */
  onEditMissionBoxes?: (missionId: string) => void;
};

function GraphCompletedStamp() {
  return (
    <span
      aria-hidden
      className="pointer-events-none inline-flex rotate-[-22deg] select-none"
    >
      <svg
        viewBox="0 0 120 120"
        className="size-[5.5rem] text-rsi-success sm:size-[6.5rem]"
        role="img"
      >
        <circle
          cx="60"
          cy="60"
          r="54"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          opacity="0.75"
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
          opacity="0.7"
        />
      </svg>
    </span>
  );
}

type PickupPadMode = "cargo" | "piles";

const padToggleClass = [
  "rounded-[calc(var(--radius-rsi)-2px)] px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-[0.12em] transition-colors",
].join(" ");

function PadPeelButton({
  pressed,
  onPressedChange,
}: {
  pressed: boolean;
  onPressedChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => onPressedChange(!pressed)}
      className={[
        "rounded-rsi border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-[0.12em] transition-colors",
        pressed
          ? "border-rsi-accent/50 bg-rsi-accent-muted/40 text-rsi-accent"
          : "border-rsi-border bg-rsi-bg-deep/70 text-rsi-text-muted hover:border-rsi-border-strong hover:text-rsi-text",
      ].join(" ")}
    >
      Peel
    </button>
  );
}

function planCanPeel(plan: StopCargoStacksPlan): boolean {
  return plan.heightCells > 1;
}

/**
 * Per-stop pickup/delivery crates on generic flat 3D pads (not the ship bay).
 * When both exist: delivery first, pickup below.
 * Pickup can toggle Cargo (by commodity) vs Piles (by delivery location).
 */
export const StopDeliveryBayPreview = memo(function StopDeliveryBayPreview({
  row,
  rows,
  className,
  onEditMissionBoxes,
}: StopDeliveryBayPreviewProps) {
  const [pickupMode, setPickupMode] = useState<PickupPadMode>("cargo");
  const [deliveryPeel, setDeliveryPeel] = useState(true);
  const [pickupPeel, setPickupPeel] = useState(true);

  const deliveryPlan = useMemo(
    () => planStopCargoStacks(row, "delivery"),
    [row],
  );
  const pickupCargoPlan = useMemo(
    () => planStopCargoStacks(row, "pickup"),
    [row],
  );
  const pickupPilePlan = useMemo(() => {
    if (!rows || rows.length === 0) return null;
    return planPickupHangarStacks(rows, row.id);
  }, [rows, row.id]);

  const pickupPlan =
    pickupMode === "piles" && pickupPilePlan
      ? pickupPilePlan
      : pickupCargoPlan;
  const showPickupModes = Boolean(pickupCargoPlan && pickupPilePlan);
  const showDeliveryPeel = deliveryPlan ? planCanPeel(deliveryPlan) : false;
  const showPickupPeel = pickupPlan ? planCanPeel(pickupPlan) : false;

  if (!deliveryPlan && !pickupPlan) {
    return null;
  }

  return (
    <div
      className={["flex min-w-0 flex-col gap-2", className]
        .filter(Boolean)
        .join(" ")}
      onClick={(event) => event.stopPropagation()}
    >
      {deliveryPlan ? (
        <section className="relative min-w-0 rounded-rsi border border-rsi-border bg-rsi-bg-deep/30">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rsi-border px-2.5 py-1.5">
            <p className="font-mono text-[0.5rem] uppercase tracking-[0.12em] text-rsi-gold">
              Drop off
            </p>
            {showDeliveryPeel ? (
              <PadPeelButton
                pressed={deliveryPeel}
                onPressedChange={setDeliveryPeel}
              />
            ) : null}
          </div>
          <div className="relative p-1.5">
            <StopDeliveryStacksView
              plan={deliveryPlan}
              peelStack={deliveryPeel}
              onPeelStackChange={setDeliveryPeel}
              hidePeel
              onEditMissionBoxes={onEditMissionBoxes}
            />
            {row.isCompleted ? (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                <GraphCompletedStamp />
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
      {pickupPlan ? (
        <section className="relative min-w-0 rounded-rsi border border-rsi-border bg-rsi-bg-deep/30">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rsi-border px-2.5 py-1.5">
            <p className="font-mono text-[0.5rem] uppercase tracking-[0.12em] text-rsi-accent">
              Pickup
            </p>
            {showPickupPeel || showPickupModes ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {showPickupPeel ? (
                  <PadPeelButton
                    pressed={pickupPeel}
                    onPressedChange={setPickupPeel}
                  />
                ) : null}
                {showPickupModes ? (
                  <div
                    role="tablist"
                    aria-label="Pickup pad grouping"
                    className="inline-flex rounded-rsi border border-rsi-border bg-rsi-bg-deep/70 p-0.5"
                  >
                    {(
                      [
                        { id: "cargo", label: "Cargo" },
                        { id: "piles", label: "Piles" },
                      ] as const
                    ).map((tab) => {
                      const selected = pickupMode === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          role="tab"
                          aria-selected={selected}
                          onClick={() => setPickupMode(tab.id)}
                          className={[
                            padToggleClass,
                            selected
                              ? "bg-rsi-accent-muted/45 text-rsi-accent"
                              : "text-rsi-text-muted hover:text-rsi-text",
                          ].join(" ")}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="relative p-1.5">
            <StopDeliveryStacksView
              plan={pickupPlan}
              peelStack={pickupPeel}
              onPeelStackChange={setPickupPeel}
              hidePeel
              onEditMissionBoxes={onEditMissionBoxes}
            />
            {row.isCompleted ? (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                <GraphCompletedStamp />
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
});
