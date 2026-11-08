"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import {
  describeCargoDeliveries,
  getCommodityIconSrc,
  getLocationBySlug,
  sumCargoScuByRole,
} from "@/lib/fixtures";
import { resolveCommodityColorHex } from "@/lib/fixtures/commodityColors";
import {
  formatDistanceToNext,
  type HaulingChecklistRow,
  type LegKind,
  type ShipStorageLocation,
} from "@/lib/missions/mockSession";
import type { CargoGridStorageLocation } from "@/lib/ships/cargoGrids";
import type { CargoPlacementSegment } from "@/lib/ships/cargoGridPlacement";
import { CargoStorageGridModal } from "./CargoStorageGridModal";
import { OutdoorFreightBadge } from "./OutdoorFreightBadge";

export type HaulingChecklistTableProps = {
  rows: HaulingChecklistRow[];
  onToggle: (rowId: string) => void;
  /** Active session ship — used for precise bay grid View. */
  shipSlug?: string | null;
};

type StorageGridViewTarget = {
  zone: CargoGridStorageLocation;
  locationLabel: string;
  segments: CargoPlacementSegment[];
  rowId: string;
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

function zoneForCargoLine(
  row: HaulingChecklistRow,
  line: CargoLine,
): ShipStorageLocation {
  const delivery = row.cargoDeliveries.find((entry) => {
    if (entry.commoditySlug !== line.commoditySlug) return false;
    if (entry.scu !== line.scu) return false;
    if (line.role == null) return true;
    const role = entry.role ?? (row.legKind === "both" ? null : row.legKind);
    return role === line.role;
  });
  return delivery?.shipStorageLocation ?? row.shipStorageLocation;
}

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
  step,
  isCompleted,
  onToggle,
}: {
  location: string;
  step: number;
  isCompleted: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={isCompleted}
      aria-label={`Stop ${step}, mark done: ${location}`}
      onClick={onToggle}
      className={[
        "group inline-flex size-9 shrink-0 items-center justify-center rounded-rsi border transition-colors sm:size-8",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-rsi-bg",
        isCompleted
          ? "border-rsi-success/50 bg-rsi-success-muted text-rsi-success"
          : "border-rsi-border bg-rsi-bg-deep/40 text-rsi-text-muted/50 hover:border-rsi-border-strong hover:text-rsi-accent",
      ].join(" ")}
    >
      {isCompleted ? (
        <span aria-hidden className="text-base leading-none">
          ✓
        </span>
      ) : (
        <>
          <span
            aria-hidden
            className="font-mono text-[0.7rem] tabular-nums leading-none tracking-wide group-hover:hidden"
          >
            {step}
          </span>
          <span
            aria-hidden
            className="hidden text-base leading-none group-hover:inline"
          >
            ✓
          </span>
        </>
      )}
    </button>
  );
}

function CargoGroups({
  row,
  cargoLines,
  locationLabel,
  onViewCargo,
}: {
  row: HaulingChecklistRow;
  cargoLines: CargoLine[];
  locationLabel: string;
  onViewCargo?: (target: StorageGridViewTarget) => void;
}) {
  const groups = groupCargoLines(cargoLines);

  return (
    <div className="flex flex-col gap-5 text-sm md:gap-2">
      {groups.map((group, groupIndex) => {
        const roleClass =
          group.role === "pickup"
            ? "text-rsi-accent"
            : group.role === "delivery"
              ? "text-rsi-success"
              : "text-rsi-text-muted";
        const doneClass = row.isCompleted
          ? "line-through opacity-70 decoration-rsi-success/40"
          : "";
        const prevRole = groups[groupIndex - 1]?.role;
        const showRoleDivider =
          groupIndex > 0 &&
          prevRole != null &&
          group.role != null &&
          prevRole !== group.role;

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
            className={[
              "flex flex-col gap-0.5",
              showRoleDivider
                ? "border-t border-rsi-divider pt-2 md:pt-1.5"
                : "",
            ].join(" ")}
          >
            {group.role ? (
              <span
                className={`font-mono text-[0.65rem] uppercase tracking-[0.16em] ${roleClass}`}
              >
                {group.role === "pickup" ? "Pickup" : "Delivery"}
              </span>
            ) : null}
            {group.items.map((line, index) => {
              const cargoHex = resolveCommodityColorHex(
                line.color,
                line.color2,
                line.commoditySlug,
              );
              const iconSrc = getCommodityIconSrc(line.commoditySlug);
              const canView =
                Boolean(onViewCargo) &&
                line.scu != null &&
                line.commoditySlug != null &&
                line.commodityName != null;
              const content = (
                <>
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
                </>
              );
              const className = [
                "inline-flex items-center gap-1.5 font-medium tabular-nums",
                doneClass,
                canView ? "cursor-pointer text-left" : "",
              ].join(" ");

              if (canView) {
                return (
                  <button
                    key={`${row.id}-cargo-${group.role}-${index}`}
                    type="button"
                    className={className}
                    style={cargoHex ? { color: cargoHex } : undefined}
                    aria-label={`View ${line.commodityName} bay grid`}
                    onClick={() => {
                      const zone = zoneForCargoLine(row, line);
                      onViewCargo?.({
                        zone,
                        locationLabel,
                        rowId: row.id,
                        segments: [
                          {
                            commoditySlug: line.commoditySlug!,
                            commodityName: line.commodityName!,
                            scu: line.scu!,
                            color: line.color,
                            color2: line.color2,
                          },
                        ],
                      });
                    }}
                  >
                    {content}
                  </button>
                );
              }

              return (
                <span
                  key={`${row.id}-cargo-${group.role}-${index}`}
                  className={className}
                  style={cargoHex ? { color: cargoHex } : undefined}
                >
                  {content}
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

const LOCATION_TITLE_MAX_CHARS = 28;

function LocationHeader({
  row,
  location,
  hasOutdoorFreightElevator,
  isCopied,
  onCopy,
  align = "start",
}: {
  row: HaulingChecklistRow;
  location: string;
  hasOutdoorFreightElevator: boolean;
  isCopied: boolean;
  onCopy: () => void;
  align?: "start" | "end";
}) {
  const locationLabel =
    location.length > LOCATION_TITLE_MAX_CHARS
      ? `${location.slice(0, LOCATION_TITLE_MAX_CHARS - 1)}…`
      : location;

  return (
    <div
      className={[
        "flex flex-col gap-2",
        align === "end" ? "w-full items-stretch" : "",
      ].join(" ")}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <span
          className={[
            "whitespace-nowrap text-left text-base font-medium",
            row.isCompleted
              ? "text-rsi-text-muted line-through decoration-rsi-success/60"
              : "text-rsi-text",
          ].join(" ")}
          title={location}
        >
          {locationLabel}
        </span>
        <button
          type="button"
          aria-label={
            isCopied ? `Copied ${location}` : `Copy starmap name: ${location}`
          }
          title={isCopied ? "Copied" : "Copy for starmap"}
          onClick={onCopy}
          className={[
            "inline-flex size-5 shrink-0 items-center justify-center rounded-rsi border transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-rsi-bg",
            isCopied
              ? "border-rsi-success/50 bg-rsi-success-muted text-rsi-success"
              : "border-transparent text-rsi-text-muted hover:border-rsi-border hover:bg-rsi-bg-deep/40 hover:text-rsi-accent",
          ].join(" ")}
        >
          <CopyIcon className="size-3" />
        </button>
      </div>
      <div
        className={[
          "flex flex-wrap items-center gap-2",
          align === "end" ? "justify-end" : "",
        ].join(" ")}
      >
        {legKindBadges(row.legKind).map((badge) => (
          <Badge key={badge.label} variant={badge.variant} size="sm">
            {badge.label}
          </Badge>
        ))}
        {hasOutdoorFreightElevator ? (
          <OutdoorFreightBadge locationSlug={row.locationSlug} />
        ) : null}
      </div>
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
          "text-sm",
          totalAlign,
          row.isCompleted ? "text-rsi-text-muted line-through" : "text-rsi-text",
        ].join(" ")}
      >
        {total}
        <span className="ml-1 text-[0.65rem] font-normal tracking-wide text-rsi-text-muted no-underline">
          SCU
        </span>
      </span>
    </div>
  );
}

function MetaGrid({
  row,
  scu,
}: {
  row: HaulingChecklistRow;
  scu: { pickup: number; delivery: number; total: number };
}) {
  return (
    <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-rsi-divider/80 pt-3 text-sm">
      <div>
        <dt className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-rsi-text-muted">
          Total
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
          Next Distance
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

function equalizeTableRowHeights(tbody: HTMLTableSectionElement) {
  const trs = [...tbody.querySelectorAll<HTMLTableRowElement>(":scope > tr")].filter(
    (tr) => !tr.querySelector(":scope > td[colspan]"),
  );
  for (const tr of trs) {
    tr.style.height = "";
  }
  let maxHeight = 0;
  for (const tr of trs) {
    maxHeight = Math.max(maxHeight, tr.getBoundingClientRect().height);
  }
  if (maxHeight <= 0) return;
  const height = `${Math.ceil(maxHeight)}px`;
  for (const tr of trs) {
    tr.style.height = height;
  }
}

export function HaulingChecklistTable({
  rows,
  onToggle,
  shipSlug = null,
}: HaulingChecklistTableProps) {
  const [copiedRowId, setCopiedRowId] = useState<string | null>(null);
  const [hideCompleted, setHideCompleted] = useState(false);
  const [gridView, setGridView] = useState<StorageGridViewTarget | null>(null);
  const desktopTbodyRef = useRef<HTMLTableSectionElement>(null);
  const completedCount = rows.filter((row) => row.isCompleted).length;
  const visibleRows = hideCompleted
    ? rows.filter((row) => !row.isCompleted)
    : rows;

  useLayoutEffect(() => {
    const tbody = desktopTbodyRef.current;
    if (!tbody) return;

    const sync = () => {
      equalizeTableRowHeights(tbody);
    };

    sync();
    window.addEventListener("resize", sync);
    return () => {
      window.removeEventListener("resize", sync);
      for (const tr of tbody.querySelectorAll<HTMLTableRowElement>(":scope > tr")) {
        tr.style.height = "";
      }
    };
  }, [hideCompleted, rows]);

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
    <div className="flex flex-wrap items-center justify-end gap-2 border-b border-rsi-divider bg-rsi-bg-deep/40 px-3 py-2">
      {hideCompleted && completedCount > 0 ? (
        <p className="mr-auto font-mono text-[0.65rem] uppercase tracking-[0.18em] text-rsi-text-secondary">
          {completedCount} hidden
        </p>
      ) : null}
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

  const stepById = new Map(rows.map((row, index) => [row.id, index + 1]));

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
          const isCopied = copiedRowId === row.id;
          const step = stepById.get(row.id) ?? 0;

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
                  step={step}
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
                    <CargoGroups
                      row={row}
                      cargoLines={cargoLines}
                      locationLabel={location}
                      onViewCargo={setGridView}
                    />
                  </div>
                  <MetaGrid row={row} scu={scu} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Desktop: table */}
      <div className="hidden overflow-x-auto md:block">
        <table
          className={[
            "w-full min-w-[40rem] border-collapse text-left",
            /* Row rule under data cells; location starts at name (px-4), not into step col */
            "[&_tbody_tr:not(:last-child)_td:nth-child(2)]:relative",
            "[&_tbody_tr:not(:last-child)_td:nth-child(2)]:after:pointer-events-none",
            "[&_tbody_tr:not(:last-child)_td:nth-child(2)]:after:absolute",
            "[&_tbody_tr:not(:last-child)_td:nth-child(2)]:after:right-0",
            "[&_tbody_tr:not(:last-child)_td:nth-child(2)]:after:bottom-0",
            "[&_tbody_tr:not(:last-child)_td:nth-child(2)]:after:left-4",
            "[&_tbody_tr:not(:last-child)_td:nth-child(2)]:after:h-px",
            "[&_tbody_tr:not(:last-child)_td:nth-child(2)]:after:bg-rsi-divider/80",
            "[&_tbody_tr:not(:last-child)_td:nth-child(n+3)]:shadow-[inset_0_-1px_0_0_var(--rsi-divider)]",
          ].join(" ")}
        >
          <thead>
            <tr className="border-b border-rsi-divider bg-rsi-bg-deep/50">
              <th
                scope="col"
                className="w-14 px-2 py-3 text-center font-mono text-[0.65rem] font-medium uppercase tracking-[0.2em] text-rsi-text-muted"
              >
                <span className="sr-only">Stop and done</span>
              </th>
              <th
                scope="col"
                className="min-w-[10rem] px-4 py-3 text-left font-mono text-[0.65rem] font-medium uppercase tracking-[0.2em] text-rsi-text-muted"
              >
                Location
              </th>
              <th
                scope="col"
                className="min-w-[12rem] px-4 py-3 text-left font-mono text-[0.65rem] font-medium uppercase tracking-[0.2em] text-rsi-text-muted"
              >
                Cargo
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-left font-mono text-[0.65rem] font-medium uppercase tracking-[0.2em] text-rsi-text-muted"
              >
                Total
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-left font-mono text-[0.65rem] font-medium uppercase tracking-[0.2em] text-rsi-text-muted"
              >
                Next Distance
              </th>
            </tr>
          </thead>
          <tbody ref={desktopTbodyRef}>
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
            {visibleRows.map((row, rowIndex) => {
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
              const isCopied = copiedRowId === row.id;
              const step = stepById.get(row.id) ?? 0;
              const isFirstStep = rowIndex === 0;
              const isLastStep = rowIndex === visibleRows.length - 1;

              return (
                <tr
                  key={row.id}
                  aria-checked={row.isCompleted}
                  className={[
                    "transition-colors",
                    row.isCompleted
                      ? "bg-rsi-success-muted/40 shadow-[inset_3px_0_0_0_var(--rsi-success)]"
                      : "",
                  ].join(" ")}
                >
                  <td className="relative px-2 py-2 text-center align-middle">
                    {/* Stop at checkbox edge: size-9 → 1.125rem half; sm:size-8 → 1rem half */}
                    {!isFirstStep ? (
                      <span
                        aria-hidden
                        className="absolute top-0 left-1/2 h-[calc(50%-1.125rem)] w-px -translate-x-1/2 bg-rsi-border-strong sm:h-[calc(50%-1rem)]"
                      />
                    ) : null}
                    {!isLastStep ? (
                      <span
                        aria-hidden
                        className="absolute top-[calc(50%+1.125rem)] bottom-0 left-1/2 w-px -translate-x-1/2 bg-rsi-border-strong sm:top-[calc(50%+1rem)]"
                      />
                    ) : null}
                    <span className="relative z-10 inline-flex">
                      <DoneCheckbox
                        location={location}
                        step={step}
                        isCompleted={row.isCompleted}
                        onToggle={() => onToggle(row.id)}
                      />
                    </span>
                  </td>
                  <td className="px-4 py-3 text-left align-middle">
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
                  </td>
                  <td className="px-4 py-3 text-left align-middle">
                    <CargoGroups
                      row={row}
                      cargoLines={cargoLines}
                      locationLabel={location}
                      onViewCargo={setGridView}
                    />
                  </td>
                  <td className="px-4 py-3 text-right align-middle">
                    <ScuTotalDisplay
                      row={row}
                      pickup={scu.pickup}
                      delivery={scu.delivery}
                      total={scu.total}
                    />
                  </td>
                  <td
                    className={[
                      "px-4 py-3 text-right align-middle font-mono text-sm tabular-nums",
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

      <CargoStorageGridModal
        open={gridView != null}
        onClose={() => setGridView(null)}
        shipSlug={shipSlug}
        zone={gridView?.zone ?? "front"}
        locationLabel={gridView?.locationLabel ?? ""}
        segments={gridView?.segments ?? []}
        rows={rows}
        rowId={gridView?.rowId ?? null}
      />
    </div>
  );
}
