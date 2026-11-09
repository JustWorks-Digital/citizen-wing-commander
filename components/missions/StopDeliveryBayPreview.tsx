"use client";

import { useMemo } from "react";
import type { HaulingChecklistRow } from "@/lib/missions/mockSession";
import { planStopCargoStacks } from "@/lib/missions/stopDeliveryBoxes";
import { StopDeliveryStacksView } from "./StopDeliveryStacksView";

export type StopDeliveryBayPreviewProps = {
  row: HaulingChecklistRow;
  className?: string;
};

/**
 * Per-stop pickup/delivery crates on generic flat 3D pads (not the ship bay).
 * When both exist: delivery first, pickup below.
 */
export function StopDeliveryBayPreview({
  row,
  className,
}: StopDeliveryBayPreviewProps) {
  const deliveryPlan = useMemo(
    () => planStopCargoStacks(row, "delivery"),
    [row],
  );
  const pickupPlan = useMemo(() => planStopCargoStacks(row, "pickup"), [row]);

  if (!deliveryPlan && !pickupPlan) {
    return null;
  }

  return (
    <div
      className={[
        "flex min-w-0 flex-col gap-2",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={(event) => event.stopPropagation()}
    >
      {deliveryPlan ? (
        <section className="min-w-0 rounded-rsi border border-rsi-border/70 bg-rsi-bg-deep/30">
          <p className="border-b border-rsi-divider/70 px-2.5 py-1.5 font-mono text-[0.5rem] uppercase tracking-[0.12em] text-rsi-success">
            Delivery
          </p>
          <div className="p-1.5">
            <StopDeliveryStacksView plan={deliveryPlan} />
          </div>
        </section>
      ) : null}
      {pickupPlan ? (
        <section className="min-w-0 rounded-rsi border border-rsi-border/70 bg-rsi-bg-deep/30">
          <p className="border-b border-rsi-divider/70 px-2.5 py-1.5 font-mono text-[0.5rem] uppercase tracking-[0.12em] text-rsi-accent">
            Pickup
          </p>
          <div className="p-1.5">
            <StopDeliveryStacksView plan={pickupPlan} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
