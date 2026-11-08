"use client";

import { useState } from "react";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import {
  describeCargoDeliveries,
  getCommodityIconSrc,
  getLocationBySlug,
  sumCargoScuByRole,
} from "@/lib/fixtures";
import { namedCommodityColorToHex } from "@/lib/fixtures/commodityColors";
import {
  describeShipStorageLines,
  formatDistanceToNext,
  type HaulingChecklistRow,
  type LegKind,
} from "@/lib/missions/mockSession";
import { OutdoorFreightIcon } from "./OutdoorFreightIcon";

export type HaulingChecklistTableProps = {
  rows: HaulingChecklistRow[];
  onToggle: (rowId: string) => void;
};

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="5.5"
        y="5.5"
        width="8"
        height="8"
        rx="1.25"
        stroke="currentColor"
        strokeWidth="1.25"
      />
      <path
        d="M10.5 5.5V4.25A1.25 1.25 0 0 0 9.25 3H4.25A1.25 1.25 0 0 0 3 4.25v5A1.25 1.25 0 0 0 4.25 10.5H5.5"
        stroke="currentColor"
        strokeWidth="1.25"
      />
    </svg>
  );
}

function legKindBadges(legKind: LegKind): { label: string; variant: BadgeVariant }[] {
  if (legKind === "pickup") {
    return [{ label: "Pickup", variant: "accent" }];
  }
  if (legKind === "delivery") {
    return [{ label: "Delivery", variant: "success" }];
  }
  return [
    { label: "Pickup", variant: "accent" },
    { label: "Delivery", variant: "success" },
  ];
}

type CargoLine = ReturnType<typeof describeCargoDeliveries>[number];

function groupCargoLines(lines: CargoLine[]): {
  role: "pickup" | "delivery" | null;
  items: CargoLine[];
}[] {
  const order: ("pickup" | "delivery" | null)[] = ["pickup", "delivery", null];
  const groups: { role: "pickup" | "delivery" | null; items: CargoLine[] }[] =
    [];
  for (const role of order) {
    const items = lines.filter(
      (line) =>
        line.role === role && line.scu != null && line.commodityName,
    );
    if (items.length > 0) groups.push({ role, items });
  }
  if (groups.length === 0) {
    return [{ role: null, items: lines }];
  }
  return groups;
}

function DoneCheckbox({
  location,
  isCompleted,
  onToggle,
}: {
  location: string;
  isCompleted: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={isCompleted}
      aria-label={`Mark done: ${location}`}
      onClick={onToggle}
      className={[
        "inline-flex size-9 shrink-0 items-center justify-center rounded-rsi border transition-colors sm:size-8",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-rsi-bg",
        isCompleted
          ? "border-rsi-success/50 bg-rsi-success-muted text-rsi-success"
          : "border-rsi-border bg-rsi-bg-deep/40 text-transparent hover:border-rsi-border-strong",
      ].join(" ")}
    >
      <span aria-hidden className="text-base leading-none">
        ✓
      </span>
    </button>
  );
}

function CargoGroups({
  row,
  cargoLines,
}: {
  row: HaulingChecklistRow;
  cargoLines: CargoLine[];
}) {
  return (
    <div className="flex flex-col gap-2 text-sm">
      {groupCargoLines(cargoLines).map((group) => {
        const roleClass =
          group.role === "pickup"
            ? "text-rsi-accent"
            : group.role === "delivery"
              ? "text-rsi-success"
              : "text-rsi-text-muted";
        const doneClass = row.isCompleted
          ? "line-through opacity-70 decoration-rsi-success/40"
          : "";

        if (group.items.length === 1 && group.items[0]?.scu == null) {
          return (
            <span
              key={`${row.id}-cargo-empty`}
              className={`text-rsi-text-secondary ${doneClass}`}
            >
              —
            </span>
          );
        }

        return (
          <div
            key={`${row.id}-cargo-${group.role ?? "none"}`}
            className="flex flex-col gap-0.5"
          >
            {group.role ? (
              <span
                className={`font-mono text-[0.65rem] uppercase tracking-[0.16em] ${roleClass}`}
              >
                {group.role === "pickup" ? "Pickup" : "Delivery"}
              </span>
            ) : null}
            {group.items.map((line, index) => {
              const cargoHex =
                namedCommodityColorToHex(line.color) ??
                namedCommodityColorToHex(line.color2);
              const iconSrc = getCommodityIconSrc(line.commoditySlug);
              return (
                <span
                  key={`${row.id}-cargo-${group.role}-${index}`}
                  className={`inline-flex items-center gap-1.5 pl-3 font-medium tabular-nums ${doneClass}`}
                  style={cargoHex ? { color: cargoHex } : undefined}
                >
                  <span
                    aria-hidden
                    className="inline-block size-4 shrink-0 bg-current"
                    style={{
                      WebkitMaskImage: `url(${iconSrc})`,
                      maskImage: `url(${iconSrc})`,
                      WebkitMaskSize: "contain",
                      maskSize: "contain",
                      WebkitMaskRepeat: "no-repeat",
                      maskRepeat: "no-repeat",
                      WebkitMaskPosition: "center",
                      maskPosition: "center",
                    }}
                  />
                  {line.scu} {line.commodityName}
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function LocationHeader({
  row,
  location,
  hasOutdoorFreightElevator,
  isCopied,
  onCopy,
}: {
  row: HaulingChecklistRow;
  location: string;
  hasOutdoorFreightElevator: boolean;
  isCopied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        {legKindBadges(row.legKind).map((badge) => (
          <Badge key={badge.label} variant={badge.variant}>
            {badge.label}
          </Badge>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <span
          className={[
            "text-sm font-medium",
            row.isCompleted
              ? "text-rsi-text-muted line-through decoration-rsi-success/60"
              : "text-rsi-text",
          ].join(" ")}
        >
          {location}
        </span>
        <button
          type="button"
          aria-label={
            isCopied ? `Copied ${location}` : `Copy starmap name: ${location}`
          }
          title={isCopied ? "Copied" : "Copy for starmap"}
          onClick={onCopy}
          className={[
            "inline-flex size-8 shrink-0 items-center justify-center rounded-rsi border transition-colors sm:size-7",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-rsi-bg",
            isCopied
              ? "border-rsi-success/50 bg-rsi-success-muted text-rsi-success"
              : "border-transparent text-rsi-text-muted hover:border-rsi-border hover:bg-rsi-bg-deep/40 hover:text-rsi-accent",
          ].join(" ")}
        >
          <CopyIcon className="size-3.5" />
        </button>
      </div>
      {hasOutdoorFreightElevator ? (
        <div className="mt-0.5 flex items-center gap-1.5 text-rsi-text-secondary">
          <OutdoorFreightIcon locationSlug={row.locationSlug} />
          <span className="font-mono text-[0.65rem] uppercase tracking-[0.14em]">
            Outdoor freight
          </span>
        </div>
      ) : null}
    </div>
  );
}

function ScuTotalDisplay({
  row,
  pickup,
  delivery,
  total,
  align = "end",
}: {
  row: HaulingChecklistRow;
  pickup: number;
  delivery: number;
  total: number;
  /** Mobile meta row: start; desktop table column: end. */
  align?: "start" | "end";
}) {
  const showBreakdown = row.legKind === "both" && (pickup > 0 || delivery > 0);
  const done = row.isCompleted
    ? "line-through opacity-70 decoration-rsi-success/40"
    : "";
  const crossAlign = align === "start" ? "items-start" : "items-end";
  const totalAlign = align === "start" ? "self-start" : "self-end";

  return (
    <div
      className={[
        "inline-flex min-w-[2.75rem] flex-col font-mono tabular-nums",
        crossAlign,
      ].join(" ")}
    >
      {showBreakdown ? (
        <>
          <div
            className={[
              "flex flex-col gap-1 text-xs leading-tight",
              crossAlign,
            ].join(" ")}
          >
            {pickup > 0 ? (
              <span
                className={["text-rsi-accent", done].join(" ")}
                title={`Pickup ${pickup} SCU`}
              >
                {pickup}
                <span className="sr-only"> pickup</span>
              </span>
            ) : null}
            {delivery > 0 ? (
              <span
                className={["text-rsi-success", done].join(" ")}
                title={`Delivery ${delivery} SCU`}
              >
                {delivery}
                <span className="sr-only"> delivery</span>
              </span>
            ) : null}
          </div>
          <div
            aria-hidden
            className="my-1.5 w-full min-w-[2.75rem] border-t border-rsi-border-strong"
          />
        </>
      ) : null}
      <span
        className={[
          "relative text-sm",
          totalAlign,
          row.isCompleted ? "text-rsi-text-muted line-through" : "text-rsi-text",
        ].join(" ")}
      >
        {total}
        <span className="absolute left-full top-1/2 ml-1 -translate-y-1/2 text-[0.65rem] font-normal tracking-wide text-rsi-text-muted no-underline">
          SCU
        </span>
      </span>
    </div>
  );
}

function MetaGrid({
  row,
  scu,
  storageLines,
}: {
  row: HaulingChecklistRow;
  scu: { pickup: number; delivery: number; total: number };
  storageLines: ReturnType<typeof describeShipStorageLines>;
}) {
  return (
    <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-rsi-divider/80 pt-3 text-sm sm:grid-cols-3">
      <div>
        <dt className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-rsi-text-muted">
          SCU total
        </dt>
        <dd className="mt-0.5">
          <ScuTotalDisplay
            row={row}
            pickup={scu.pickup}
            delivery={scu.delivery}
            total={scu.total}
            align="start"
          />
        </dd>
      </div>
      <div>
        <dt className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-rsi-text-muted">
          Ship storage
        </dt>
        <dd className="mt-0.5">
          <div className="flex flex-col gap-0.5">
            {storageLines.map((line, index) => {
              const roleClass =
                line.role === "pickup"
                  ? "text-rsi-accent"
                  : line.role === "delivery"
                    ? "text-rsi-success"
                    : "text-rsi-text-secondary";
              return (
                <span
                  key={`${row.id}-storage-${index}`}
                  className={[
                    roleClass,
                    row.isCompleted
                      ? "line-through opacity-70 decoration-rsi-success/40"
                      : "",
                  ].join(" ")}
                >
                  {line.label}
                </span>
              );
            })}
          </div>
        </dd>
      </div>
      <div className="col-span-2 sm:col-span-1">
        <dt className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-rsi-text-muted">
          Distance to next
        </dt>
        <dd
          className={[
            "mt-0.5 font-mono tabular-nums",
            row.isCompleted
              ? "text-rsi-text-muted line-through"
              : "text-rsi-text-secondary",
          ].join(" ")}
        >
          {formatDistanceToNext(row.distanceToNext)}
        </dd>
      </div>
    </dl>
  );
}

export function HaulingChecklistTable({
  rows,
  onToggle,
}: HaulingChecklistTableProps) {
  const [copiedRowId, setCopiedRowId] = useState<string | null>(null);
  const [hideCompleted, setHideCompleted] = useState(true);
  const completedCount = rows.filter((row) => row.isCompleted).length;
  const visibleRows = hideCompleted
    ? rows.filter((row) => !row.isCompleted)
    : rows;

  async function copyStarmapName(rowId: string, name: string) {
    try {
      await navigator.clipboard.writeText(name);
      setCopiedRowId(rowId);
      window.setTimeout(() => {
        setCopiedRowId((current) => (current === rowId ? null : current));
      }, 1500);
    } catch {
      // Clipboard may be denied; leave UI unchanged.
    }
  }

  const toolbar = (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rsi-divider bg-rsi-bg-deep/40 px-3 py-2">
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-rsi-text-muted">
        Missions
        {hideCompleted && completedCount > 0 ? (
          <span className="text-rsi-text-secondary">
            {" "}
            · {completedCount} hidden
          </span>
        ) : null}
      </p>
      <button
        type="button"
        aria-pressed={hideCompleted}
        disabled={completedCount === 0}
        onClick={() => setHideCompleted((value) => !value)}
        className={[
          "rounded-rsi border px-2.5 py-1.5 font-mono text-[0.65rem] uppercase tracking-[0.16em] transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-rsi-bg",
          "disabled:cursor-not-allowed disabled:opacity-40",
          hideCompleted
            ? "border-rsi-accent/40 bg-rsi-accent-muted/40 text-rsi-accent"
            : "border-rsi-border bg-rsi-surface text-rsi-text-secondary hover:border-rsi-border-strong hover:text-rsi-text",
        ].join(" ")}
      >
        {hideCompleted ? "Show completed" : "Hide completed"}
      </button>
    </div>
  );

  const emptyMessage =
    rows.length === 0
      ? "No missions yet"
      : "All missions complete — show completed to review";

  return (
    <div className="rounded-rsi border border-rsi-border bg-rsi-surface/90 shadow-rsi-panel">
      {toolbar}

      {/* Mobile: stacked cards (no horizontal scroll) */}
      <ul className="flex flex-col md:hidden">
        {visibleRows.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-rsi-text-muted">
            {emptyMessage}
          </li>
        ) : null}
        {visibleRows.map((row) => {
          const locationFixture = getLocationBySlug(row.locationSlug);
          const location = locationFixture?.name ?? row.locationSlug;
          const cargoFallbackRole =
            row.legKind === "both" ? null : row.legKind;
          const cargoLines = describeCargoDeliveries(
            row.cargoDeliveries,
            cargoFallbackRole,
          );
          const scu = sumCargoScuByRole(
            row.cargoDeliveries,
            row.legKind === "both" ? null : row.legKind,
          );
          const storageLines = describeShipStorageLines(row);
          const isCopied = copiedRowId === row.id;

          return (
            <li
              key={row.id}
              aria-checked={row.isCompleted}
              className={[
                "border-b border-rsi-divider/80 px-3 py-3 last:border-b-0",
                row.isCompleted
                  ? "bg-rsi-success-muted/40 shadow-[inset_3px_0_0_0_var(--rsi-success)]"
                  : "",
              ].join(" ")}
            >
              <div className="flex gap-3">
                <DoneCheckbox
                  location={location}
                  isCompleted={row.isCompleted}
                  onToggle={() => onToggle(row.id)}
                />
                <div className="min-w-0 flex-1">
                  <LocationHeader
                    row={row}
                    location={location}
                    hasOutdoorFreightElevator={Boolean(
                      locationFixture?.hasOutdoorFreightElevator,
                    )}
                    isCopied={isCopied}
                    onCopy={() => {
                      void copyStarmapName(row.id, location);
                    }}
                  />
                  <div className="mt-3">
                    <CargoGroups row={row} cargoLines={cargoLines} />
                  </div>
                  <MetaGrid
                    row={row}
                    scu={scu}
                    storageLines={storageLines}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Desktop: table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[40rem] border-collapse text-left">
          <thead>
            <tr className="border-b border-rsi-divider bg-rsi-bg-deep/50">
              <th
                scope="col"
                className="w-12 px-3 py-3 font-mono text-[0.65rem] font-medium uppercase tracking-[0.2em] text-rsi-text-muted"
              >
                <span className="sr-only">Done</span>
              </th>
              <th
                scope="col"
                className="px-4 py-3 font-mono text-[0.65rem] font-medium uppercase tracking-[0.2em] text-rsi-text-muted"
              >
                Location / cargo
              </th>
              <th
                scope="col"
                className="px-4 py-3 font-mono text-[0.65rem] font-medium uppercase tracking-[0.2em] text-rsi-text-muted"
              >
                SCU total
              </th>
              <th
                scope="col"
                className="px-4 py-3 font-mono text-[0.65rem] font-medium uppercase tracking-[0.2em] text-rsi-text-muted"
              >
                Ship storage location
              </th>
              <th
                scope="col"
                className="px-4 py-3 font-mono text-[0.65rem] font-medium uppercase tracking-[0.2em] text-rsi-text-muted"
              >
                Distance to next
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-sm text-rsi-text-muted"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : null}
            {visibleRows.map((row) => {
              const locationFixture = getLocationBySlug(row.locationSlug);
              const location = locationFixture?.name ?? row.locationSlug;
              const cargoFallbackRole =
                row.legKind === "both" ? null : row.legKind;
              const cargoLines = describeCargoDeliveries(
                row.cargoDeliveries,
                cargoFallbackRole,
              );
              const scu = sumCargoScuByRole(
                row.cargoDeliveries,
                row.legKind === "both" ? null : row.legKind,
              );
              const storageLines = describeShipStorageLines(row);
              const isCopied = copiedRowId === row.id;

              return (
                <tr
                  key={row.id}
                  aria-checked={row.isCompleted}
                  className={[
                    "border-b border-rsi-divider/80 last:border-b-0 transition-colors",
                    row.isCompleted
                      ? "bg-rsi-success-muted/40 shadow-[inset_3px_0_0_0_var(--rsi-success)]"
                      : "",
                  ].join(" ")}
                >
                  <td className="px-3 py-2 text-center">
                    <DoneCheckbox
                      location={location}
                      isCompleted={row.isCompleted}
                      onToggle={() => onToggle(row.id)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <LocationHeader
                      row={row}
                      location={location}
                      hasOutdoorFreightElevator={Boolean(
                        locationFixture?.hasOutdoorFreightElevator,
                      )}
                      isCopied={isCopied}
                      onCopy={() => {
                        void copyStarmapName(row.id, location);
                      }}
                    />
                    <div className="mt-3">
                      <CargoGroups row={row} cargoLines={cargoLines} />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <ScuTotalDisplay
                      row={row}
                      pickup={scu.pickup}
                      delivery={scu.delivery}
                      total={scu.total}
                    />
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex flex-col gap-0.5">
                      {storageLines.map((line, index) => {
                        const roleClass =
                          line.role === "pickup"
                            ? "text-rsi-accent"
                            : line.role === "delivery"
                              ? "text-rsi-success"
                              : "text-rsi-text-secondary";
                        return (
                          <span
                            key={`${row.id}-storage-${index}`}
                            className={[
                              roleClass,
                              row.isCompleted
                                ? "line-through opacity-70 decoration-rsi-success/40"
                                : "",
                            ].join(" ")}
                          >
                            {line.label}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td
                    className={[
                      "px-4 py-3 font-mono text-sm tabular-nums",
                      row.isCompleted
                        ? "text-rsi-text-muted line-through"
                        : "text-rsi-text-secondary",
                    ].join(" ")}
                  >
                    {formatDistanceToNext(row.distanceToNext)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
