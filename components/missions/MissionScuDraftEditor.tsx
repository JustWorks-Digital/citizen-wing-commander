"use client";

import { useEffect, useRef, useState } from "react";
import { CommodityIcon } from "@/components/missions/CommodityIcon";
import { Button } from "@/components/ui/Button";
import { resolveCommodityColorHex } from "@/lib/fixtures/commodityColors";
import type {
  MissionScuDraft,
  MissionScuDraftStop,
} from "@/lib/missions/missionScuAmounts";

export type MissionScuDraftCargoLine = {
  commoditySlug: string;
  commodity: string;
  scu: number;
};

export type MissionScuDraftEditorProps = {
  lines: MissionScuDraftCargoLine[];
  draft: MissionScuDraft;
  expandedSlugs: Set<string>;
  disabled: boolean;
  isDirty: boolean;
  saveError: string | null;
  onToggle: (commoditySlug: string) => void;
  onChangeCommodity: (commoditySlug: string, scu: number) => void;
  onChangeDelivery: (
    commoditySlug: string,
    locationSlug: string,
    scu: number,
  ) => void;
  onChangePickup: (
    commoditySlug: string,
    locationSlug: string,
    scu: number,
  ) => void;
  /** Zero this pick-up stop and rebalance remaining pick-up stops. */
  onSkipPickup: (commoditySlug: string, locationSlug: string) => void;
  onReset: () => void;
  onSave: () => void;
};

function ScuAmountInput({
  value,
  disabled,
  ariaLabel,
  onCommit,
  unlockOnClick = false,
  isUserCorrected = false,
}: {
  value: number;
  disabled?: boolean;
  ariaLabel: string;
  onCommit: (scu: number) => void;
  /** Location SCU: stay locked until the player clicks to edit. */
  unlockOnClick?: boolean;
  /** Player has overridden this stop (kept out of auto-rebalance). */
  isUserCorrected?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(String(value));
  const [isEditing, setIsEditing] = useState(false);
  useEffect(() => {
    setText(String(value));
  }, [value]);

  useEffect(() => {
    if (!isEditing) return;
    const node = inputRef.current;
    if (!node) return;
    node.focus();
    node.select();
  }, [isEditing]);

  const commit = () => {
    const parsed = Math.max(0, Math.floor(Number(text) || 0));
    setText(String(parsed));
    if (parsed !== value) onCommit(parsed);
  };

  const isLocked = Boolean(unlockOnClick && !isEditing && !disabled);

  return (
    <label className="inline-flex items-center gap-1.5">
      <span className="sr-only">{ariaLabel}</span>
      <input
        ref={inputRef}
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        disabled={disabled}
        readOnly={isLocked}
        value={text}
        aria-label={ariaLabel}
        aria-readonly={isLocked || undefined}
        title={
          isLocked
            ? "Click to edit — remaining stops rebalance"
            : isUserCorrected
              ? "Player override — excluded from auto-rebalance"
              : undefined
        }
        onPointerDown={(event) => {
          if (!isLocked) return;
          // Unlock before the browser treats the click as a dead read-only hit.
          event.preventDefault();
          setIsEditing(true);
        }}
        onChange={(event) => {
          if (isLocked) return;
          setText(event.target.value);
        }}
        onBlur={() => {
          commit();
          if (unlockOnClick) setIsEditing(false);
        }}
        onKeyDown={(event) => {
          if (isLocked) {
            event.preventDefault();
            return;
          }
          if (event.key === "Enter") {
            event.preventDefault();
            (event.target as HTMLInputElement).blur();
          }
        }}
        className={[
          "w-16 rounded-rsi border bg-rsi-bg-deep/60 px-2 py-1 font-mono text-sm tabular-nums text-rsi-text outline-none",
          isUserCorrected || isEditing
            ? "border-rsi-accent/55"
            : "border-rsi-border",
          isLocked
            ? "cursor-pointer hover:border-rsi-accent/40"
            : "focus:border-rsi-accent",
          disabled ? "cursor-not-allowed opacity-50" : "",
        ].join(" ")}
      />
      <span className="font-mono text-[0.55rem] uppercase tracking-[0.12em] text-rsi-text-muted">
        SCU
      </span>
    </label>
  );
}

function ExpandChevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className={[
        "h-3.5 w-3.5 shrink-0 text-rsi-text-muted transition-transform",
        expanded ? "rotate-90" : "",
      ].join(" ")}
      fill="currentColor"
    >
      <path d="M7.05 4.55a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 1 1-1.06-1.06L10.69 10 7.05 6.36a.75.75 0 0 1 0-1.06Z" />
    </svg>
  );
}

function roleSum(stops: MissionScuDraftStop[], commoditySlug: string): number {
  return stops
    .filter((line) => line.commoditySlug === commoditySlug)
    .reduce((sum, line) => sum + Math.max(0, Math.floor(line.scu)), 0);
}

function stopsEqual(
  a: MissionScuDraftStop[],
  b: MissionScuDraftStop[],
): boolean {
  if (a.length !== b.length) return false;
  for (const [index, line] of a.entries()) {
    const other = b[index];
    if (!other) return false;
    if (
      line.commoditySlug !== other.commoditySlug ||
      line.locationSlug !== other.locationSlug ||
      line.scu !== other.scu ||
      Boolean(line.isUserCorrected) !== Boolean(other.isUserCorrected)
    ) {
      return false;
    }
  }
  return true;
}

/** Compare SCU drafts for dirty-state (commodity + Pick up/Deliver lines). */
export function missionScuDraftsEqual(
  a: MissionScuDraft,
  b: MissionScuDraft,
): boolean {
  if (a.commodities.length !== b.commodities.length) return false;
  if (!stopsEqual(a.pickups ?? [], b.pickups ?? [])) return false;
  if (!stopsEqual(a.deliveries, b.deliveries)) return false;
  for (const [index, line] of a.commodities.entries()) {
    const other = b.commodities[index];
    if (!other) return false;
    if (line.commoditySlug !== other.commoditySlug || line.scu !== other.scu) {
      return false;
    }
  }
  return true;
}

function StopSection({
  title,
  sum,
  total,
  stops,
  disabled,
  role,
  onChange,
  onSkip,
}: {
  title: string;
  sum: number;
  total: number;
  stops: MissionScuDraftStop[];
  disabled: boolean;
  role: "pickup" | "delivery";
  onChange: (commoditySlug: string, locationSlug: string, scu: number) => void;
  onSkip?: (commoditySlug: string, locationSlug: string) => void;
}) {
  const matches = sum === total;
  const roleColor =
    role === "pickup" ? "text-rsi-accent" : "text-rsi-gold";
  const roleBorder =
    role === "pickup" ? "border-rsi-accent/45" : "border-rsi-gold/45";
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p
          className={[
            "w-fit border-b pb-0.5 font-mono text-[0.55rem] uppercase tracking-[0.14em]",
            roleColor,
            roleBorder,
          ].join(" ")}
        >
          {title}
        </p>
        <p
          className={[
            "font-mono text-[0.55rem] uppercase tracking-[0.12em] tabular-nums",
            matches ? roleColor : "text-rsi-danger",
          ].join(" ")}
          title={matches ? undefined : `Stops sum to ${sum} SCU, need ${total}`}
        >
          {total}
        </p>
      </div>
      <ul className="space-y-2">
        {stops.map((stop) => (
          <li
            key={`${role}:${stop.locationSlug}:${stop.commoditySlug}`}
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <p className="min-w-0 flex-1 truncate text-sm text-rsi-text-secondary">
              {stop.locationLabel}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {role === "pickup" && onSkip && stop.scu > 0 && !disabled ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="!min-h-0 !px-2 !py-1 font-mono text-[0.55rem] uppercase tracking-[0.12em]"
                  aria-label={`Skip pick up at ${stop.locationLabel}`}
                  title="Ignore this pick up — remaining stops absorb the SCU"
                  onClick={() =>
                    onSkip(stop.commoditySlug, stop.locationSlug)
                  }
                >
                  Skip
                </Button>
              ) : null}
              <ScuAmountInput
                value={stop.scu}
                disabled={disabled}
                unlockOnClick
                isUserCorrected={Boolean(stop.isUserCorrected)}
                ariaLabel={`${stop.locationLabel} ${stop.commodity} ${role === "pickup" ? "pick up" : "delivery"} SCU`}
                onCommit={(scu) =>
                  onChange(stop.commoditySlug, stop.locationSlug, scu)
                }
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Condensed cargo totals with expandable Pick up / Deliver SCU.
 * Edits stay in a draft until Save (role sums must match totals).
 */
export function MissionScuDraftEditor({
  lines,
  draft,
  expandedSlugs,
  disabled,
  isDirty,
  saveError,
  onToggle,
  onChangeCommodity,
  onChangeDelivery,
  onChangePickup,
  onSkipPickup,
  onReset,
  onSave,
}: MissionScuDraftEditorProps) {
  const pickups = draft.pickups ?? [];
  return (
    <section className="rounded-rsi border border-rsi-border/80 bg-rsi-bg-deep/40 px-3 py-3 sm:px-4">
      <p className="font-mono text-[0.55rem] uppercase tracking-[0.16em] text-rsi-text-muted">
        Mission SCU
      </p>
      <ul className="mt-2.5 space-y-2">
        {lines.map((line) => {
          const cargoColor =
            resolveCommodityColorHex(null, null, line.commoditySlug) ??
            "var(--rsi-text-secondary)";
          const commodityPickups = pickups.filter(
            (entry) => entry.commoditySlug === line.commoditySlug,
          );
          const commodityDeliveries = draft.deliveries.filter(
            (entry) => entry.commoditySlug === line.commoditySlug,
          );
          const hasStops =
            commodityPickups.length > 0 || commodityDeliveries.length > 0;
          const expanded = expandedSlugs.has(line.commoditySlug);
          const pickupSum = roleSum(pickups, line.commoditySlug);
          const deliverySum = roleSum(draft.deliveries, line.commoditySlug);
          const total = Math.max(0, Math.floor(line.scu));
          const matches =
            (commodityPickups.length === 0 || pickupSum === total) &&
            (commodityDeliveries.length === 0 || deliverySum === total);

          return (
            <li
              key={line.commoditySlug}
              className="rounded-rsi border border-rsi-border/40 bg-rsi-surface/30"
            >
              <div className="flex flex-wrap items-center gap-2 px-2.5 py-2 sm:gap-3">
                {hasStops ? (
                  <button
                    type="button"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-rsi text-rsi-text-secondary hover:bg-rsi-surface-raised hover:text-rsi-text"
                    aria-expanded={expanded}
                    aria-label={
                      expanded
                        ? `Hide ${line.commodity} stop SCU`
                        : `Show ${line.commodity} stop SCU`
                    }
                    onClick={() => onToggle(line.commoditySlug)}
                  >
                    <ExpandChevron expanded={expanded} />
                  </button>
                ) : (
                  <span className="inline-flex h-7 w-7" aria-hidden />
                )}
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <CommodityIcon
                    commoditySlug={line.commoditySlug}
                    label={line.commodity}
                    showTooltip={false}
                  />
                  <p
                    className="min-w-0 truncate text-sm font-medium tracking-wide"
                    style={{ color: cargoColor }}
                    title={
                      hasStops && !matches
                        ? [
                            commodityPickups.length > 0
                              ? `Pick up ${pickupSum}/${total}`
                              : null,
                            commodityDeliveries.length > 0
                              ? `Deliver ${deliverySum}/${total}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")
                        : undefined
                    }
                  >
                    {line.commodity}
                  </p>
                </div>
                <ScuAmountInput
                  value={line.scu}
                  disabled={disabled}
                  ariaLabel={`${line.commodity} mission SCU`}
                  onCommit={(scu) => onChangeCommodity(line.commoditySlug, scu)}
                />
              </div>

              {hasStops && expanded ? (
                <div className="space-y-4 border-t border-rsi-border/40 px-2.5 py-2.5 pl-11 sm:pl-12">
                  {commodityPickups.length > 0 ? (
                    <StopSection
                      title="Pick up"
                      sum={pickupSum}
                      total={total}
                      stops={commodityPickups}
                      disabled={disabled}
                      role="pickup"
                      onChange={onChangePickup}
                      onSkip={onSkipPickup}
                    />
                  ) : null}
                  {commodityDeliveries.length > 0 ? (
                    <StopSection
                      title="Deliver"
                      sum={deliverySum}
                      total={total}
                      stops={commodityDeliveries}
                      disabled={disabled}
                      role="delivery"
                      onChange={onChangeDelivery}
                    />
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {isDirty || saveError ? (
        <div className="mt-3 space-y-2 border-t border-rsi-border/40 pt-3">
          {saveError ? (
            <p className="text-sm text-rsi-danger" role="alert">
              {saveError}
            </p>
          ) : (
            <p className="font-mono text-[0.55rem] uppercase tracking-[0.12em] text-rsi-text-muted">
              Unsaved SCU changes
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onReset}>
              Reset
            </Button>
            <Button type="button" variant="primary" onClick={onSave}>
              Save
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
