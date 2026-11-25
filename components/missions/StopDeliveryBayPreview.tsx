"use client";

import { memo, useMemo, useState } from "react";
import type { HaulingChecklistRow } from "@/lib/missions/sessionChecklist";

import { cargoBoxSplits } from "@/lib/missions/cargoBoxSplits";
import {
  isScuBoxSplitsUncertain,
  resolveScuBoxSplitsCertainty,
  type ScuBoxSplitsIndicators,
} from "@/lib/missions/scuCertainty";
import { commoditySlugOf } from "@/lib/missions/missionScuShared";
import type { SessionMission } from "@/lib/missions/sessionMissions";
import {
  planPickupHangarStacks,
  planStopCargoStacks,
  stopCargoRole,
  type StopCargoStacksPlan,
} from "@/lib/missions/stopDeliveryBoxes";
import { Spinner } from "@/components/ui/Spinner";
import { StopDeliveryStacksView } from "./StopDeliveryStacksView";

export type StopDeliveryBayPreviewProps = {
  row: HaulingChecklistRow;
  /** Full route — required for pickup hangar piles by delivery location. */
  rows?: HaulingChecklistRow[];
  /** Session missions — used for crate-mix certainty on under-stack labels. */
  missions?: SessionMission[];
  className?: string;
  /** Click under-stack cargo label to edit that mission’s box mix. */
  onEditMissionBoxes?: (missionId: string) => void;
  /**
   * Double-click under-stack SCU on pick-up pad to edit quantity;
   * remaining pick-ups rebalance. 0 clears.
   */
  onSetPickupScu?: (
    missionId: string,
    commoditySlug: string,
    scu: number,
  ) => void;
  /**
   * Double-click under-stack SCU on drop-off pad to edit quantity;
   * remaining drop-offs rebalance. 0 clears.
   */
  onSetDeliveryScu?: (
    missionId: string,
    commoditySlug: string,
    scu: number,
  ) => void;
  /** Pending keys `missionId::commoditySlug::locationSlug` while SCU save runs. */
  pendingSetStopScuKeys?: ReadonlySet<string>;
  /**
   * Show only one pad graph. Omit to render both (delivery then pickup).
   * Used to align each graph with its left-side Pickup / Drop off section.
   */
  role?: "pickup" | "delivery";
  /** Mark all cargo of a role handled (Unloaded / Loaded header checkbox). */
  onSetCargoRoleHandled?: (
    role: "pickup" | "delivery",
    handled: boolean,
  ) => void | Promise<void>;
  /** Pending keys `pickup` / `delivery` while role handled save runs. */
  pendingCargoRoleKeys?: ReadonlySet<"pickup" | "delivery">;
  /** When true, omit the header checkbox. */
  hideRoleHandledCheckbox?: boolean;
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

/** Shared so Unloaded matches Loaded when All / Per location is present. */
const graphHeaderClass =
  "flex min-h-9 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-rsi-border px-2.5 py-1.5";

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

/** Role handled mark — checkbox + label; clicking either toggles. */
export function CargoRoleHandledCheckbox({
  role,
  checked,
  isPending,
  onToggle,
}: {
  role: "pickup" | "delivery";
  checked: boolean;
  isPending: boolean;
  onToggle: () => void;
}) {
  const label = role === "pickup" ? "Loaded" : "Unloaded";
  const labelTone =
    role === "pickup" ? "text-rsi-accent" : "text-rsi-gold";
  // Checked mark matches Pick up / Drop off tab title check (ChecklistCargoTiles).
  const markTone = isPending
    ? "cursor-wait border border-rsi-accent/50 text-rsi-accent"
    : checked
      ? "bg-rsi-success/80 text-rsi-bg-deep opacity-90 shadow-[0_0_0_1px_rgba(0,0,0,0.25)]"
      : "border border-rsi-border bg-transparent text-transparent group-hover:border-rsi-border-strong";
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-busy={isPending || undefined}
      disabled={isPending}
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.stopPropagation();
        if (isPending) return;
        onToggle();
      }}
      className={[
        "group inline-flex min-w-0 items-center gap-2 rounded-rsi",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
        isPending ? "cursor-wait" : "cursor-pointer",
      ].join(" ")}
    >
      <span
        className={[
          "inline-flex size-3.5 shrink-0 items-center justify-center rounded-full transition-colors",
          markTone,
        ].join(" ")}
        aria-hidden
      >
        {isPending ? (
          <Spinner className="size-2.5" label={label} />
        ) : checked ? (
          <svg
            viewBox="0 0 12 12"
            className="size-2.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2.5 6.2 L4.8 8.5 L9.5 3.5" />
          </svg>
        ) : null}
      </span>
      <span
        className={[
          "font-mono text-[0.5rem] uppercase tracking-[0.12em]",
          labelTone,
        ].join(" ")}
      >
        {label}
      </span>
    </button>
  );
}

/**
 * Per-stop pickup/delivery crates on generic flat 3D pads (not the ship bay).
 * Pass `role` to render a single graph (aligned with that left-side section).
 * Without `role`, both render (drop off then pickup).
 * Pickup can toggle All (by commodity) vs Per location (by delivery location).
 */
export const StopDeliveryBayPreview = memo(function StopDeliveryBayPreview({
  row,
  rows,
  missions = [],
  className,
  onEditMissionBoxes,
  onSetPickupScu,
  onSetDeliveryScu,
  pendingSetStopScuKeys,
  role,
  onSetCargoRoleHandled,
  pendingCargoRoleKeys,
  hideRoleHandledCheckbox = false,
}: StopDeliveryBayPreviewProps) {
  const [pickupMode, setPickupMode] = useState<PickupPadMode>("cargo");
  const [deliveryPeel, setDeliveryPeel] = useState(true);
  const [pickupPeel, setPickupPeel] = useState(true);

  const showDelivery = role == null || role === "delivery";
  const showPickup = role == null || role === "pickup";
  const deliveryRoleHandled = stopCargoRole.isHandled(row, "delivery");
  const pickupRoleHandled = stopCargoRole.isHandled(row, "pickup");
  const deliveryHandled = deliveryRoleHandled || row.isCompleted;
  const pickupHandled = pickupRoleHandled || row.isCompleted;
  const deliveryPending = Boolean(pendingCargoRoleKeys?.has("delivery"));
  const pickupPending = Boolean(pendingCargoRoleKeys?.has("pickup"));
  const canToggleRole = Boolean(onSetCargoRoleHandled) && !row.isCompleted;

  /**
   * Keyed by `missionId::commoditySlug`. Certainty + override are both
   * per commodity (certainty falls back to mission-level when unset).
   */
  const boxSplitIndicatorsByMissionId = useMemo(() => {
    const map = new Map<string, ScuBoxSplitsIndicators>();
    for (const mission of missions) {
      const withDefaults = cargoBoxSplits.withDefaults(mission);
      const lines = Object.keys(withDefaults.scuCargoBoxSplits ?? {});
      for (const commoditySlug of lines) {
        const uncertain = isScuBoxSplitsUncertain(
          resolveScuBoxSplitsCertainty(mission, commoditySlug),
        );
        const overridden = cargoBoxSplits.isUserCorrected(
          mission,
          commoditySlug,
        );
        if (!uncertain && !overridden) continue;
        map.set(`${mission.id}::${commoditySlug}`, {
          uncertain,
          overridden,
        });
      }
    }
    return map;
  }, [missions]);

  const maxStopScuBySlug = useMemo(() => {
    const map = new Map<string, number>();
    for (const mission of missions) {
      for (const line of mission.cargo) {
        const slug = commoditySlugOf(line.commodity);
        if (!slug) continue;
        const scu = Math.max(0, Math.floor(Number(line.scu) || 0));
        map.set(slug, Math.max(map.get(slug) ?? 0, scu));
      }
    }
    return map;
  }, [missions]);

  const canEditStopScu = !row.isCompleted;

  const deliveryPlan = useMemo(
    () => (showDelivery ? planStopCargoStacks(row, "delivery") : null),
    [row, showDelivery],
  );
  const pickupCargoPlan = useMemo(
    () => (showPickup ? planStopCargoStacks(row, "pickup") : null),
    [row, showPickup],
  );
  const pickupPilePlan = useMemo(() => {
    if (!showPickup || !rows || rows.length === 0) return null;
    return planPickupHangarStacks(rows, row.id);
  }, [rows, row.id, showPickup]);

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

  const fillDesktop =
    "md:flex md:h-full md:min-h-0 md:flex-1 md:flex-col";

  return (
    <div
      className={[
        "flex min-w-0 flex-col gap-2",
        fillDesktop,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={(event) => event.stopPropagation()}
    >
      {deliveryPlan ? (
        <section
          className={[
            "relative min-w-0 rounded-rsi border border-rsi-border bg-rsi-bg-deep/30",
            fillDesktop,
          ].join(" ")}
        >
          <div className={graphHeaderClass}>
            <div className="flex min-w-0 items-center gap-2">
              {!hideRoleHandledCheckbox &&
              (onSetCargoRoleHandled || deliveryHandled) ? (
                <CargoRoleHandledCheckbox
                  role="delivery"
                  checked={deliveryHandled}
                  isPending={deliveryPending}
                  onToggle={() => {
                    if (!canToggleRole || !onSetCargoRoleHandled) return;
                    void onSetCargoRoleHandled(
                      "delivery",
                      !deliveryRoleHandled,
                    );
                  }}
                />
              ) : (
                <p className="font-mono text-[0.5rem] uppercase tracking-[0.12em] text-rsi-gold">
                  Unloaded
                </p>
              )}
            </div>
            {showDeliveryPeel ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <PadPeelButton
                  pressed={deliveryPeel}
                  onPressedChange={setDeliveryPeel}
                />
              </div>
            ) : null}
          </div>
          <div className="relative flex min-h-0 flex-1 flex-col p-1.5">
            <StopDeliveryStacksView
              plan={deliveryPlan}
              peelStack={deliveryPeel}
              onPeelStackChange={setDeliveryPeel}
              hidePeel
              fillAvailableHeight
              className="md:h-full"
              onEditMissionBoxes={onEditMissionBoxes}
              boxSplitIndicatorsByMissionId={boxSplitIndicatorsByMissionId}
              onSetStopScu={
                canEditStopScu ? onSetDeliveryScu : undefined
              }
              maxStopScuBySlug={maxStopScuBySlug}
              pendingSetStopScuKeys={pendingSetStopScuKeys}
              locationSlug={row.locationSlug}
            />
            {deliveryHandled ? (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                <GraphCompletedStamp />
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
      {pickupPlan ? (
        <section
          className={[
            "relative min-w-0 rounded-rsi border border-rsi-border bg-rsi-bg-deep/30",
            fillDesktop,
          ].join(" ")}
        >
          <div className={graphHeaderClass}>
            <div className="flex min-w-0 items-center gap-2">
              {!hideRoleHandledCheckbox &&
              (onSetCargoRoleHandled || pickupHandled) ? (
                <CargoRoleHandledCheckbox
                  role="pickup"
                  checked={pickupHandled}
                  isPending={pickupPending}
                  onToggle={() => {
                    if (!canToggleRole || !onSetCargoRoleHandled) return;
                    void onSetCargoRoleHandled("pickup", !pickupRoleHandled);
                  }}
                />
              ) : (
                <p className="font-mono text-[0.5rem] uppercase tracking-[0.12em] text-rsi-accent">
                  Loaded
                </p>
              )}
            </div>
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
                    aria-label="Pick up pad grouping"
                    className="inline-flex rounded-rsi border border-rsi-border bg-rsi-bg-deep/70 p-0.5"
                  >
                    {(
                      [
                        { id: "cargo", label: "All" },
                        { id: "piles", label: "Per location" },
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
          <div className="relative flex min-h-0 flex-1 flex-col p-1.5">
            <StopDeliveryStacksView
              plan={pickupPlan}
              peelStack={pickupPeel}
              onPeelStackChange={setPickupPeel}
              hidePeel
              fillAvailableHeight
              className="md:h-full"
              onEditMissionBoxes={onEditMissionBoxes}
              boxSplitIndicatorsByMissionId={boxSplitIndicatorsByMissionId}
              onSetStopScu={canEditStopScu ? onSetPickupScu : undefined}
              maxStopScuBySlug={maxStopScuBySlug}
              pendingSetStopScuKeys={pendingSetStopScuKeys}
              locationSlug={row.locationSlug}
            />
            {pickupHandled ? (
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
