"use client";

import { useEffect, useRef, useState } from "react";
import { CommodityIcon } from "@/components/missions/CommodityIcon";
import { Button } from "@/components/ui/Button";
import { resolveCommodityColorHex } from "@/lib/fixtures/commodityColors";
import type { MissionScuDraft } from "@/lib/missions/missionScuAmounts";

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

/** Compare SCU drafts for dirty-state (commodity + delivery lines). */
export function missionScuDraftsEqual(
  a: MissionScuDraft,
  b: MissionScuDraft,
): boolean {
  if (a.commodities.length !== b.commodities.length) return false;
  if (a.deliveries.length !== b.deliveries.length) return false;
  for (const [index, line] of a.commodities.entries()) {
    const other = b.commodities[index];
    if (!other) return false;
    if (line.commoditySlug !== other.commoditySlug || line.scu !== other.scu) {
      return false;
    }
  }
  for (const [index, line] of a.deliveries.entries()) {
    const other = b.deliveries[index];
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

/**
 * Condensed cargo totals with expandable nested delivery SCU.
 * Edits stay in a draft until Save (delivery sums must match totals).
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
  onReset,
  onSave,
}: MissionScuDraftEditorProps) {
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
          const deliveries = draft.deliveries.filter(
            (entry) => entry.commoditySlug === line.commoditySlug,
          );
          const hasDeliveries = deliveries.length > 0;
          const expanded = expandedSlugs.has(line.commoditySlug);
          const deliverySum = deliveries.reduce(
            (sum, entry) => sum + Math.max(0, Math.floor(entry.scu)),
            0,
          );
          const matches =
            !hasDeliveries || deliverySum === Math.max(0, Math.floor(line.scu));

          return (
            <li
              key={line.commoditySlug}
              className="rounded-rsi border border-rsi-border/40 bg-rsi-surface/30"
            >
              <div className="flex flex-wrap items-center gap-2 px-2.5 py-2 sm:gap-3">
                {hasDeliveries ? (
                  <button
                    type="button"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-rsi text-rsi-text-secondary hover:bg-rsi-surface-raised hover:text-rsi-text"
                    aria-expanded={expanded}
                    aria-label={
                      expanded
                        ? `Hide ${line.commodity} delivery SCU`
                        : `Show ${line.commodity} delivery SCU`
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
                  <div className="min-w-0">
                    <p
                      className="truncate text-sm font-medium tracking-wide"
                      style={{ color: cargoColor }}
                    >
                      {line.commodity}
                    </p>
                    {hasDeliveries ? (
                      <p
                        className={[
                          "font-mono text-[0.55rem] uppercase tracking-[0.12em]",
                          matches
                            ? "text-rsi-text-muted"
                            : "text-rsi-danger",
                        ].join(" ")}
                      >
                        Total SCU: {deliverySum}/{line.scu}
                      </p>
                    ) : null}
                  </div>
                </div>
                <ScuAmountInput
                  value={line.scu}
                  disabled={disabled}
                  ariaLabel={`${line.commodity} mission SCU`}
                  onCommit={(scu) => onChangeCommodity(line.commoditySlug, scu)}
                />
              </div>

              {hasDeliveries && expanded ? (
                <ul className="space-y-2 border-t border-rsi-border/40 px-2.5 py-2.5 pl-11 sm:pl-12">
                  {deliveries.map((delivery) => (
                    <li
                      key={`${delivery.locationSlug}:${delivery.commoditySlug}`}
                      className="flex flex-wrap items-center justify-between gap-3"
                    >
                      <p className="min-w-0 truncate text-sm text-rsi-text-secondary">
                        {delivery.locationLabel}
                      </p>
                      <ScuAmountInput
                        value={delivery.scu}
                        disabled={disabled}
                        unlockOnClick
                        isUserCorrected={Boolean(delivery.isUserCorrected)}
                        ariaLabel={`${delivery.locationLabel} ${delivery.commodity} delivery SCU`}
                        onCommit={(scu) =>
                          onChangeDelivery(
                            delivery.commoditySlug,
                            delivery.locationSlug,
                            scu,
                          )
                        }
                      />
                    </li>
                  ))}
                </ul>
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
