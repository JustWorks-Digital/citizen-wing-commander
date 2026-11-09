"use client";

import { useState, type ReactNode } from "react";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import {
  describeCargoDeliveries,
  getCommodityIconSrc,
  getLocationBySlug,
  sumCargoScuByRole,
} from "@/lib/fixtures";
import { resolveCommodityColorHex } from "@/lib/fixtures/commodityColors";
import type { ScuBoxSplits } from "@/lib/missions/catalogMission";
import {
  formatDistanceToNext,
  type HaulingChecklistRow,
  type LegKind,
} from "@/lib/missions/mockSession";
import { screenshotRefsForRow } from "@/lib/missions/rowMissionScreenshots";
import type { SessionMission } from "@/lib/missions/sessionMissions";
import { OutdoorFreightBadge } from "./OutdoorFreightBadge";
import { StopDeliveryBayPreview } from "./StopDeliveryBayPreview";
import { StopMissionScreenshots } from "./StopMissionScreenshots";
import { StopRelatedMissions } from "./StopRelatedMissions";

export type HaulingChecklistTableProps = {
  rows: HaulingChecklistRow[];
  onToggle: (rowId: string) => void;
  /** Stop shown in cargo layout — any stop, including completed. */
  focusedStopId?: string | null;
  /** Click a row (not checkbox / copy) to preview that stop. */
  onFocusStop?: (rowId: string) => void;
  /** Left side of the toolbar (e.g. Deliveries / Missions stats). */
  toolbarStart?: ReactNode;
  /** Session missions — used to attach contract screenshot refs per stop. */
  missions?: SessionMission[];
  /** Session id (screenshot batch) for image URLs. */
  sessionId?: string | null;
  /** Persist crate-mix correction from a stop mission tile. */
  onSelectBoxBreakdown?: (
    missionId: string,
    breakdown: ScuBoxSplits,
  ) => void;
};

/** Default focus: first incomplete stop, else last stop. */
export function defaultFocusedStopId(
  rows: HaulingChecklistRow[],
): string | null {
  return (
    rows.find((row) => !row.isCompleted)?.id ??
    rows[rows.length - 1]?.id ??
    null
  );
}

function checklistRowToneClass(
  isCompleted: boolean,
  isFocused: boolean,
): string {
  if (isFocused && isCompleted) {
    return "cursor-pointer bg-rsi-success-muted/50 shadow-[inset_3px_0_0_0_var(--rsi-accent)]";
  }
  if (isFocused) {
    return "cursor-pointer bg-rsi-accent-muted/45 shadow-[inset_3px_0_0_0_var(--rsi-accent)]";
  }
  if (isCompleted) {
    return "cursor-pointer bg-rsi-success-muted/40 shadow-[inset_3px_0_0_0_var(--rsi-success)] hover:bg-rsi-success-muted/55";
  }
  return "cursor-pointer hover:bg-rsi-surface-raised/35";
}

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
  step,
  isCompleted,
  isActive = false,
  onToggle,
}: {
  location: string;
  step: number;
  isCompleted: boolean;
  isActive?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={isCompleted}
      aria-label={`Stop ${step}, mark done: ${location}`}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      className={[
        "group inline-flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors sm:size-8",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-rsi-bg",
        isCompleted
          ? "border-rsi-success/50 bg-rsi-success-muted text-rsi-success"
          : isActive
            ? "border-rsi-text-secondary/70 bg-rsi-bg-deep/40 text-rsi-text-secondary hover:border-rsi-text hover:text-rsi-accent"
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
            className={[
              "font-mono text-[0.7rem] tabular-nums leading-none tracking-wide group-hover:hidden",
              isActive ? "text-rsi-text-secondary" : "",
            ].join(" ")}
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
}: {
  row: HaulingChecklistRow;
  cargoLines: CargoLine[];
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
              return (
                <span
                  key={`${row.id}-cargo-${group.role}-${index}`}
                  className={[
                    "inline-flex items-center gap-1.5 font-medium tabular-nums",
                    doneClass,
                  ].join(" ")}
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
          onClick={(event) => {
            event.stopPropagation();
            onCopy();
          }}
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

function TotalMeta({
  row,
  scu,
}: {
  row: HaulingChecklistRow;
  scu: { pickup: number; delivery: number; total: number };
}) {
  return (
    <div className="mt-3 border-t border-rsi-divider/80 pt-3 text-sm">
      <p className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-rsi-text-muted">
        Total
      </p>
      <div className="mt-0.5">
        <ScuTotalDisplay
          row={row}
          pickup={scu.pickup}
          delivery={scu.delivery}
          total={scu.total}
          align="start"
        />
      </div>
    </div>
  );
}

function NextDistanceMeta({ row }: { row: HaulingChecklistRow }) {
  return (
    <div className="mt-3 border-t border-rsi-divider/80 pt-3 text-sm">
      <p className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-rsi-text-muted">
        Next Distance
      </p>
      <p
        className={[
          "mt-0.5 font-mono tabular-nums",
          row.isCompleted
            ? "text-rsi-text-muted line-through"
            : "text-rsi-text-secondary",
        ].join(" ")}
      >
        {formatDistanceToNext(row.distanceToNext)}
      </p>
    </div>
  );
}

export function HaulingChecklistTable({
  rows,
  onToggle,
  focusedStopId = null,
  onFocusStop,
  toolbarStart = null,
  missions = [],
  sessionId = null,
  onSelectBoxBreakdown,
}: HaulingChecklistTableProps) {
  const [copiedRowId, setCopiedRowId] = useState<string | null>(null);
  const [hideCompleted, setHideCompleted] = useState(false);
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
    <div className="flex flex-wrap items-center gap-2 border-b border-rsi-divider bg-rsi-bg-deep/40 px-3 py-2">
      {toolbarStart}
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {hideCompleted && completedCount > 0 ? (
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-rsi-text-secondary">
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
    </div>
  );

  const emptyMessage =
    rows.length === 0
      ? "No missions yet"
      : "All missions complete — show completed to review";

  const stepById = new Map(rows.map((row, index) => [row.id, index + 1]));
  const activeRowId =
    focusedStopId && rows.some((row) => row.id === focusedStopId)
      ? focusedStopId
      : defaultFocusedStopId(rows);

  return (
    <div className="rounded-rsi border border-rsi-border bg-rsi-surface/90 shadow-rsi-panel">
      {toolbar}

      <ul className="flex flex-col">
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
          const isFocused = row.id === activeRowId;

          return (
            <li
              key={row.id}
              aria-checked={row.isCompleted}
              aria-current={isFocused ? "step" : undefined}
              className={[
                "border-b border-rsi-divider/80 px-3 py-3 last:border-b-0",
                checklistRowToneClass(row.isCompleted, isFocused),
              ].join(" ")}
              onClick={() => onFocusStop?.(row.id)}
            >
              <div className="flex gap-3">
                <DoneCheckbox
                  location={location}
                  step={step}
                  isCompleted={row.isCompleted}
                  isActive={isFocused}
                  onToggle={() => onToggle(row.id)}
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:gap-4">
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
                      {sessionId ? (
                        <StopMissionScreenshots
                          refs={screenshotRefsForRow(missions, row, sessionId)}
                        />
                      ) : null}
                      <TotalMeta row={row} scu={scu} />
                      <NextDistanceMeta row={row} />
                    </div>
                    <StopDeliveryBayPreview
                      row={row}
                      className="hidden w-full md:block md:w-1/2 md:shrink-0 md:self-start"
                    />
                  </div>
                  <StopRelatedMissions
                    row={row}
                    missions={missions}
                    onSelectBoxBreakdown={onSelectBoxBreakdown}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
