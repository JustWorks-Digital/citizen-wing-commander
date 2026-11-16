"use client";

import { useState } from "react";
import { LocationFuzzySearch } from "@/components/ui/LocationFuzzySearch";
import { getLocationBySlug } from "@/lib/fixtures";
import { listLocationShops } from "@/lib/fixtures/locationShops";
import type { HaulingChecklistRow } from "@/lib/missions/sessionChecklist";
import { LocationHeader } from "./ChecklistLocationHeader";

export function QuantumTravelComposer({
  fromSlug,
  onCancel,
  onConfirm,
}: {
  fromSlug: string;
  onCancel: () => void;
  onConfirm: (input: { toSlug: string; reasonShopSlug: string }) => void;
}) {
  const [toSlug, setToSlug] = useState<string | null>(null);
  const [reasonShopSlug, setReasonShopSlug] = useState<string>("");
  const locationFixture = getLocationBySlug(fromSlug);
  const location = locationFixture?.name ?? fromSlug;
  const shops = toSlug ? listLocationShops(toSlug) : [];
  const stubRow: HaulingChecklistRow = {
    id: "quantum-draft",
    routeAction: "quantum",
    locationSlug: fromSlug,
    cargoDeliveries: [],
    shipStorageLocation: "front",
    distanceToNext: null,
    isCompleted: false,
  };

  return (
    <li className="scroll-mt-20 border-b border-rsi-divider/80 bg-rsi-accent-muted/20 px-3 py-3 sm:scroll-mt-24">
      <div className="flex gap-3">
        <div className="hidden h-14 w-8 shrink-0 md:block" aria-hidden />
        <div className="flex min-w-0 flex-1 flex-col gap-3 md:flex-row md:items-start md:gap-4">
          <div className="min-w-0 flex-1">
            <p className="mb-1 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-rsi-text-muted">
              Current location
            </p>
            <LocationHeader
              row={stubRow}
              location={location}
              hasOutdoorFreightElevator={Boolean(
                locationFixture?.hasOutdoorFreightElevator,
              )}
              isCopied={false}
              onCopy={() => undefined}
              compact
              showTravelChevron
            />
          </div>
          <div
            className="flex w-full min-w-0 flex-col gap-3 md:w-1/2 md:shrink-0"
            onClick={(event) => event.stopPropagation()}
          >
            <LocationFuzzySearch
              label="Desired location"
              placeholder="Search destination…"
              valueSlug={toSlug}
              onChange={(slug) => {
                setToSlug(slug);
                setReasonShopSlug("");
              }}
            />
            <div>
              <label className="mb-1 block font-mono text-[0.65rem] uppercase tracking-[0.18em] text-rsi-text-muted">
                Reason
              </label>
              <select
                value={reasonShopSlug}
                disabled={!toSlug || shops.length === 0}
                onChange={(event) => setReasonShopSlug(event.target.value)}
                className={[
                  "w-full rounded-rsi border border-rsi-border bg-rsi-bg-deep px-3 py-2",
                  "font-sans text-sm text-rsi-text",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                ].join(" ")}
              >
                <option value="">
                  {!toSlug
                    ? "Select a destination first"
                    : shops.length === 0
                      ? "No shops listed for this location"
                      : "Select shop…"}
                </option>
                {shops.map((shop) => (
                  <option key={shop.slug} value={shop.slug}>
                    {shop.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={!toSlug || !reasonShopSlug}
                onClick={() => {
                  if (!toSlug || !reasonShopSlug) return;
                  onConfirm({ toSlug, reasonShopSlug });
                }}
                className={[
                  "rounded-rsi border px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-[0.16em] transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
                  toSlug && reasonShopSlug
                    ? "border-rsi-accent/50 bg-rsi-accent-muted/40 text-rsi-accent hover:border-rsi-accent"
                    : "cursor-not-allowed border-rsi-border text-rsi-text-muted opacity-50",
                ].join(" ")}
              >
                Add quantum
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-rsi-text-muted hover:text-rsi-text"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}
