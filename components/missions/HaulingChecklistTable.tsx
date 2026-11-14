"use client";

import {
  Fragment,
  memo,
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { RouteChecklistMenu } from "@/components/missions/RouteChecklistMenu";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { LocationFuzzySearch } from "@/components/ui/LocationFuzzySearch";
import { Spinner } from "@/components/ui/Spinner";
import {
  describeCargoDeliveries,
  getCommodityIconSrc,
  getLocationBySlug,
  getLocationImageSrc,
  getLocationShortName,
  getShipIconSrc,
  sumCargoScu,
} from "@/lib/fixtures";
import {
  getLocationShopBySlug,
  listLocationShops,
} from "@/lib/fixtures/locationShops";
import {
  commodityBadgeBackground,
  commodityBadgeBorder,
  commodityBadgeForeground,
  resolveCommodityColorHex,
} from "@/lib/fixtures/commodityColors";
import {
  formatAuecAmount,
  type ScuBoxSplits,
} from "@/lib/missions/catalogMission";
import { missionsExpectedToCompleteAtStop } from "@/lib/missions/expectedCompletions";
import {
  estimateMissionHaulingRepXp,
  estimateMissionsHaulingRepXp,
  formatHaulingRepXp,
} from "@/lib/missions/haulingRepXp";
import {
  formatDistanceToNext,
  isQuantumTravelRow,
  type HaulingChecklistRow,
  type RouteAction,
} from "@/lib/missions/mockSession";
import { abbreviateCommodityName } from "@/lib/missions/stopDeliveryBoxes";
import {
  cargoInventory,
  type ScuTransfer,
  type StopTransferLedger,
} from "@/lib/missions/cargoInventory";
import {
  resolveMissionRank,
  resolveMissionTitle,
} from "@/lib/missions/missionRank";
import {
  INSERT_AFTER_SESSION_START,
  quantumFromSlugAfter,
} from "@/lib/missions/quantumTravel";
import {
  inferCargoMissionId,
  screenshotRefsForRow,
} from "@/lib/missions/rowMissionScreenshots";
import {
  missionAuecAmount,
  missionRewardLabel,
} from "@/lib/missions/sessionMissionObjectives";
import type { SessionMission } from "@/lib/missions/sessionMissions";
import { distanceBetweenLocationSlugs } from "@/lib/starmap/distance";
import { AUEC_TITLE, SCU_TITLE } from "@/lib/ui/abbrevTitles";
import { OutdoorFreightBadge } from "./OutdoorFreightBadge";
import { StopDeliveryBayPreview } from "./StopDeliveryBayPreview";
import { StopMissionBoxConfigModal } from "./StopMissionBoxConfigModal";
import { StopMissionScreenshots } from "./StopMissionScreenshots";

/** Display-only origin row when start ≠ first stop (matches route timeline). */
export const QUANTUM_ORIGIN_ROW_ID = INSERT_AFTER_SESSION_START;

export type HaulingChecklistTableProps = {
  rows: HaulingChecklistRow[];
  /** Mark stop done/undone; return a Promise to show the checkbox spinner until save finishes. */
  onToggle: (rowId: string) => void | Promise<void>;
  /** Stop shown in cargo layout — any stop, including completed. */
  focusedStopId?: string | null;
  /** Click a row (not checkbox / copy) to preview that stop. `null` clears focus. */
  onFocusStop?: (rowId: string | null) => void;
  /** Left side of the toolbar (e.g. Missions / Stops / Cargo stats). */
  toolbarStart?: ReactNode;
  /** Shown inside the ⋯ menu (e.g. trip elapsed time). */
  toolbarEnd?: ReactNode;
  /** Session ship display name for pickup transfer labels. */
  shipName?: string | null;
  /** Primary session ship slug (Next stop badge icon). */
  shipSlug?: string | null;
  /** Session missions — used to attach contract screenshot refs per stop. */
  missions?: SessionMission[];
  /** Session id (screenshot batch) for image URLs. */
  sessionId?: string | null;
  /** Toggle shared pickup/delivery brick handled state (persisted). */
  onToggleCargoHandled?: (
    rowId: string,
    cargoIndex: number,
  ) => void | Promise<void>;
  /**
   * Session origin. When set and different from the first stop, a compact
   * “Quantum to …” row is shown above the checklist.
   */
  startLocationSlug?: string | null;
  /**
   * Controlled: synthetic start → first-stop quantum marked done.
   * When omitted, the table keeps local state (Storybook).
   */
  quantumOriginDeparted?: boolean;
  onQuantumOriginDepartedChange?: (departed: boolean) => void;
  /** Persist a manual quantum travel leg after a row (or session start). */
  onInsertQuantumTravel?: (input: {
    afterRowId: string;
    fromSlug: string;
    toSlug: string;
    reasonShopSlug?: string | null;
  }) => void | Promise<void>;
  /**
   * Double-click edit on a quantum travel row (or the synthetic origin row).
   * Pass `QUANTUM_ORIGIN_ROW_ID` for the start → first-stop travel row.
   */
  onUpdateQuantumTravel?: (input: {
    rowId: string;
    fromSlug?: string;
    toSlug?: string;
  }) => void | Promise<void>;
  /** Keyboard shortcuts: B cargo bays, S stops, C contracts. */
  onOpenCargoBays?: () => void;
  onOpenStops?: () => void;
  /** Open contracts table; pass a mission id to highlight that row. */
  onOpenContracts?: (missionId?: string) => void;
  /** Persist crate mix for a session mission (Pickup / Drop off double-click). */
  onSelectBoxBreakdown?: (
    missionId: string,
    commoditySlug: string,
    breakdown: ScuBoxSplits,
    options?: {
      applyPreferredMaxToRemaining?: boolean;
      onlyUncorrected?: boolean;
    },
  ) => void | Promise<void>;
  /** True while any session save is awaiting the backend echo. */
  isSaving?: boolean;
};

function sameLocationSlug(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** True when we should show the travel-from-start quantum row. */
export function needsQuantumOriginRow(
  rows: HaulingChecklistRow[],
  startLocationSlug?: string | null,
): boolean {
  const startSlug = startLocationSlug?.trim() || null;
  const firstSlug = rows[0]?.locationSlug ?? null;
  return Boolean(
    startSlug && firstSlug && !sameLocationSlug(startSlug, firstSlug),
  );
}

/**
 * Default focus: quantum origin (when start ≠ first and no stop done yet),
 * else first incomplete stop. When every stop is done, no active focus
 * (completed rows keep the green rail, not the blue active rail).
 */
export function defaultFocusedStopId(
  rows: HaulingChecklistRow[],
  startLocationSlug?: string | null,
): string | null {
  if (
    needsQuantumOriginRow(rows, startLocationSlug) &&
    !rows.some((row) => row.isCompleted)
  ) {
    return QUANTUM_ORIGIN_ROW_ID;
  }
  return rows.find((row) => !row.isCompleted)?.id ?? null;
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

/** Side-view freighter / spaceship for Next stop hops. */
function SpaceshipIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 12"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Hull */}
      <path
        d="M2.5 6.5 L5 3.75 H12.5 L17.5 6 L12.5 8.25 H5 L2.5 5.5 Z"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.12"
      />
      {/* Cockpit */}
      <path
        d="M12.2 4.6 H14.6 L16.2 6 L14.6 7.4 H12.2 Z"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      {/* Engine glow */}
      <path
        d="M2.5 5.2 L0.75 6 L2.5 6.8"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Wing fins */}
      <path
        d="M7 3.9 L6.2 1.6 H8.4 L9.1 3.9"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <path
        d="M7 8.1 L6.2 10.4 H8.4 L9.1 8.1"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Triple chevron pointing right — QT / Next stop travel indicator. */
function TravelChevronsIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 16"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M2.5 3.5 L6.5 8 L2.5 12.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7.5 3.5 L11.5 8 L7.5 12.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.5 3.5 L16.5 8 L12.5 12.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function routeActionBadges(routeAction: RouteAction): { label: string; variant: BadgeVariant }[] {
  if (routeAction === "quantum") {
    return [{ label: "Quantum", variant: "neutral" }];
  }
  if (routeAction === "pickup") {
    return [{ label: "Pickup", variant: "accent" }];
  }
  if (routeAction === "delivery") {
    return [{ label: "Delivery", variant: "success" }];
  }
  return [
    { label: "Pickup", variant: "accent" },
    { label: "Delivery", variant: "success" },
  ];
}

/**
 * Trailing meta for condensed Done rows.
 * CSS grid locks tag / SCU / distance columns so badge right edges line up
 * (Quantum, Pickup, and Pickup+Delivery).
 */
function CondensedRowTrailing({
  routeAction,
  scuTotal = null,
  hopLabel = null,
}: {
  routeAction: RouteAction;
  scuTotal?: number | null;
  hopLabel?: string | null;
}) {
  return (
    <div className="grid w-[17.5rem] shrink-0 grid-cols-[minmax(0,1fr)_2.5rem_4.75rem] items-center gap-x-2.5">
      <div className="flex min-w-0 items-center justify-end gap-1">
        {routeActionBadges(routeAction).map((badge) => (
          <Badge key={badge.label} variant={badge.variant} size="sm">
            {badge.label}
          </Badge>
        ))}
      </div>
      <div
        className="text-right font-mono text-[0.65rem] tabular-nums tracking-wide text-rsi-text-muted"
        title={scuTotal != null ? SCU_TITLE : undefined}
      >
        {scuTotal != null ? scuTotal : null}
      </div>
      <div
        className="text-right font-mono text-[0.65rem] tabular-nums tracking-wide text-rsi-text-muted"
        title={
          hopLabel
            ? routeAction === "quantum"
              ? `Quantum hop ${hopLabel}`
              : `Distance ${hopLabel}`
            : undefined
        }
      >
        {hopLabel ?? null}
      </div>
    </div>
  );
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
  isPending = false,
  compact = false,
  onToggle,
}: {
  location: string;
  step: number | string;
  isCompleted: boolean;
  isActive?: boolean;
  isPending?: boolean;
  /** Smaller circle + mark for condensed Done strips. */
  compact?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={isCompleted}
      aria-busy={isPending}
      disabled={isPending}
      aria-label={
        isPending
          ? `Stop ${step}, updating: ${location}`
          : `Stop ${step}, mark done: ${location}`
      }
      title={isPending ? "Updating stop…" : undefined}
      onClick={(event) => {
        event.stopPropagation();
        if (isPending) return;
        onToggle();
      }}
      className={[
        "group inline-flex shrink-0 items-center justify-center rounded-full border transition-colors",
        compact ? "size-5" : "size-8",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-rsi-bg",
        isPending
          ? "cursor-wait border-rsi-accent/50 bg-rsi-bg-deep/40 text-rsi-accent"
          : isCompleted
            ? "border-rsi-success/50 bg-rsi-success-muted text-rsi-success"
            : isActive
              ? "border-rsi-text-secondary/70 bg-rsi-bg-deep/40 text-rsi-text-secondary hover:border-rsi-text hover:text-rsi-accent"
              : "border-rsi-border bg-rsi-bg-deep/40 text-rsi-text-muted/50 hover:border-rsi-border-strong hover:text-rsi-accent",
      ].join(" ")}
    >
      {isPending ? (
        <Spinner className={compact ? "size-2.5" : "size-4"} />
      ) : isCompleted ? (
        <span
          aria-hidden
          className={[
            "leading-none",
            compact ? "text-[0.65rem]" : "text-base",
          ].join(" ")}
        >
          ✓
        </span>
      ) : (
        <>
          <span
            aria-hidden
            className={[
              "font-mono tabular-nums leading-none tracking-wide group-hover:hidden",
              compact ? "text-[0.55rem]" : "text-[0.7rem]",
              isActive ? "text-rsi-text-secondary" : "",
            ].join(" ")}
          >
            {step}
          </span>
          <span
            aria-hidden
            className={[
              "hidden leading-none group-hover:inline",
              compact ? "text-[0.65rem]" : "text-base",
            ].join(" ")}
          >
            ✓
          </span>
        </>
      )}
    </button>
  );
}

/** Touch-friendly stop complete control for narrow layouts. */
function DoneStopButton({
  location,
  step,
  isCompleted,
  isPending = false,
  onToggle,
}: {
  location: string;
  step: number | string;
  isCompleted: boolean;
  isPending?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={isCompleted}
      aria-busy={isPending}
      disabled={isPending}
      aria-label={
        isPending
          ? `Stop ${step}, updating: ${location}`
          : isCompleted
            ? `Stop ${step}, mark incomplete: ${location}`
            : `Stop ${step}, mark complete: ${location}`
      }
      title={isPending ? "Updating stop…" : undefined}
      onClick={(event) => {
        event.stopPropagation();
        if (isPending) return;
        onToggle();
      }}
      className={[
        "inline-flex min-h-10 w-auto min-w-[8.5rem] items-center justify-center gap-2 rounded-rsi border px-3 font-mono text-[0.65rem] uppercase tracking-[0.14em] transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-rsi-bg",
        isPending
          ? "cursor-wait border-rsi-accent/50 bg-rsi-bg-deep/70 text-rsi-accent"
          : isCompleted
            ? "border-rsi-success/50 bg-rsi-success-muted text-rsi-success"
            : "border-rsi-border bg-rsi-bg-deep/70 text-rsi-text-secondary active:border-rsi-accent/50 active:text-rsi-accent",
      ].join(" ")}
    >
      {isPending ? (
        <>
          <Spinner className="size-3.5" />
          Updating…
        </>
      ) : isCompleted ? (
        "Complete"
      ) : (
        "Mark complete"
      )}
    </button>
  );
}

function CargoTileHandledMark({
  isPickup,
}: {
  isPickup: boolean;
}) {
  const stroke = isPickup ? "var(--rsi-accent)" : "var(--rsi-gold)";
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
    >
      <svg viewBox="0 0 20 20" className="size-5 drop-shadow-sm">
        <circle
          cx="10"
          cy="10"
          r="8.25"
          fill="var(--rsi-bg-deep)"
          stroke={stroke}
          strokeWidth="1.5"
        />
        <path
          d="M6.2 10.1 L8.7 12.5 L13.8 7.4"
          fill="none"
          stroke={stroke}
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function cargoPendingKey(rowId: string, cargoIndex: number): string {
  return `${rowId}:${cargoIndex}`;
}

function partitionCargoByMission(
  items: CargoLine[],
  row: HaulingChecklistRow,
  missions: SessionMission[],
  groupRole: "pickup" | "delivery" | null,
): Array<{
  missionId: string | null;
  items: CargoLine[];
}> {
  const buckets = new Map<string | null, CargoLine[]>();
  const order: Array<string | null> = [];
  for (const line of items) {
    const key = line.commoditySlug
      ? (inferCargoMissionId({
          missionId: line.missionId,
          commoditySlug: line.commoditySlug,
          role: line.role ?? groupRole,
          row,
          missions,
          groupRole,
        }) ?? null)
      : null;
    if (!buckets.has(key)) {
      buckets.set(key, []);
      order.push(key);
    }
    buckets.get(key)!.push(line);
  }
  return order.map((missionId) => ({
    missionId,
    items: buckets.get(missionId)!,
  }));
}

function CargoCommodityTiles({
  row,
  items,
  role,
  pendingCargoKeys,
  onToggleCargoHandled,
}: {
  row: HaulingChecklistRow;
  items: CargoLine[];
  role: "pickup" | "delivery" | null;
  pendingCargoKeys?: ReadonlySet<string>;
  onToggleCargoHandled?: (
    rowId: string,
    cargoIndex: number,
  ) => void | Promise<void>;
}) {
  const doneClass = row.isCompleted ? "opacity-70" : "";
  const isPickup = role === "pickup";
  const handledVerb = isPickup ? "picked up" : "delivered";

  return (
    <div className="grid w-full grid-cols-3 gap-1.5">
      {items.map((line, index) => {
        const tileId = `${row.id}-${role ?? "none"}-${line.commoditySlug}-${line.scu}-${line.sourceIndex ?? index}`;
        const cleared = line.isHandled;
        const isCargoPending =
          line.sourceIndex != null &&
          Boolean(
            pendingCargoKeys?.has(cargoPendingKey(row.id, line.sourceIndex)),
          );
        const canToggle =
          Boolean(onToggleCargoHandled) &&
          line.sourceIndex != null &&
          !isCargoPending;
        const cargoHex = resolveCommodityColorHex(
          line.color,
          line.color2,
          line.commoditySlug,
        );
        const iconSrc = getCommodityIconSrc(line.commoditySlug);
        const abbrev = abbreviateCommodityName(
          line.commodityName ?? line.commoditySlug ?? "?",
        );
        const fullLabel = `${line.scu} ${line.commodityName}`;
        const tileBg = cargoHex
          ? commodityBadgeBackground(cargoHex)
          : "var(--rsi-bg-deep)";
        const tileBorder = cargoHex
          ? commodityBadgeBorder(cargoHex)
          : "var(--rsi-border)";
        const tileFg = cargoHex
          ? commodityBadgeForeground(cargoHex)
          : "var(--rsi-text-secondary)";
        return (
          <button
            key={tileId}
            type="button"
            title={
              isCargoPending
                ? `${fullLabel} · updating…`
                : cleared
                  ? `${fullLabel} · marked ${handledVerb}`
                  : `${fullLabel} · click to mark ${handledVerb}`
            }
            aria-label={fullLabel}
            aria-pressed={cleared}
            aria-busy={isCargoPending}
            disabled={!canToggle && !isCargoPending}
            onClick={(event) => {
              event.stopPropagation();
              if (line.sourceIndex == null || isCargoPending) return;
              void onToggleCargoHandled?.(row.id, line.sourceIndex);
            }}
            className={[
              "relative inline-flex aspect-square w-full flex-col items-center justify-center gap-0.5 rounded-rsi border px-1 font-mono font-medium tabular-nums",
              "transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
              isCargoPending
                ? "cursor-wait"
                : canToggle
                  ? "cursor-pointer"
                  : "cursor-default",
              doneClass,
              cleared && !isCargoPending ? "opacity-40" : "",
            ].join(" ")}
            style={{
              backgroundColor: tileBg,
              borderColor: tileBorder,
              color: tileFg,
            }}
          >
            <span
              aria-hidden
              className="inline-block size-3.5 shrink-0 bg-current"
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
            <span className="text-[0.7rem] font-semibold leading-none">
              {line.scu}
            </span>
            <span
              className="text-[0.5rem] uppercase leading-none tracking-[0.12em] opacity-90"
              title={line.commodityName ?? line.commoditySlug ?? undefined}
            >
              {abbrev}
            </span>
            {isCargoPending ? (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-rsi bg-rsi-bg-deep/55"
              >
                <Spinner className="size-3.5 text-rsi-accent" />
              </span>
            ) : cleared ? (
              <CargoTileHandledMark isPickup={isPickup} />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function CargoGroups({
  row,
  cargoLines,
  missions,
  location,
  shipName,
  transferLedger,
  pendingCargoKeys,
  onToggleCargoHandled,
  bayAside,
}: {
  row: HaulingChecklistRow;
  cargoLines: CargoLine[];
  missions: SessionMission[];
  location: string;
  shipName: string;
  transferLedger?: StopTransferLedger | null;
  pendingCargoKeys?: ReadonlySet<string>;
  onToggleCargoHandled?: (
    rowId: string,
    cargoIndex: number,
  ) => void | Promise<void>;
  /** Pad graph beside Pickup / Drop off — tops align with each section. */
  bayAside?: (role: "pickup" | "delivery") => ReactNode;
}) {
  const groups = groupCargoLines(cargoLines);
  const missionById = new Map(missions.map((mission) => [mission.id, mission]));
  const pickupTransfer =
    transferLedger != null && transferLedger.pickup !== false
      ? transferLedger.pickup
      : false;
  const deliveryTransfer =
    transferLedger != null && transferLedger.delivery !== false
      ? transferLedger.delivery
      : false;
  const hasPickupGroup = groups.some((group) => group.role === "pickup");
  const hasDeliveryGroup = groups.some((group) => group.role === "delivery");

  return (
    <div className="flex flex-col gap-5 text-sm md:gap-2">
      {groups.map((group, groupIndex) => {
        const roleClass =
          group.role === "pickup"
            ? "text-rsi-accent"
            : group.role === "delivery"
              ? "text-rsi-gold"
              : "text-rsi-text-muted";
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
              className={[
                "text-rsi-text-secondary",
                row.isCompleted ? "opacity-70" : "",
              ].join(" ")}
            >
              —
            </span>
          );
        }

        const missionBuckets = partitionCargoByMission(
          group.items,
          row,
          missions,
          group.role,
        );
        const sectionTransfer =
          group.role === "pickup" && pickupTransfer
            ? (
                <PickupTransferBlock
                  location={location}
                  shipName={shipName}
                  transfer={pickupTransfer}
                  isDone={row.isCompleted}
                />
              )
            : group.role === "delivery" && deliveryTransfer
              ? (
                  <DeliveryTransferBlock
                    location={location}
                    shipName={shipName}
                    transfer={deliveryTransfer}
                    isDone={row.isCompleted}
                  />
                )
              : null;

        const sectionBody = (
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {group.role ? (
              <span
                className={[
                  "mb-1 w-fit border-b pb-0.5 font-mono text-[0.65rem] uppercase tracking-[0.16em]",
                  roleClass,
                  group.role === "pickup"
                    ? "border-rsi-accent/45"
                    : "border-rsi-gold/45",
                ].join(" ")}
              >
                {group.role === "pickup" ? "Pickup" : "Drop off"}
              </span>
            ) : null}
            <div className="grid grid-cols-1 gap-2 min-[28rem]:grid-cols-2">
              {missionBuckets.map((bucket) => {
                const mission =
                  bucket.missionId != null
                    ? (missionById.get(bucket.missionId) ?? null)
                    : null;
                const tiles = (
                  <CargoCommodityTiles
                    row={row}
                    items={bucket.items}
                    role={group.role}
                    pendingCargoKeys={pendingCargoKeys}
                    onToggleCargoHandled={onToggleCargoHandled}
                  />
                );

                if (!mission) {
                  return (
                    <div
                      key={`${row.id}-${group.role ?? "none"}-untagged`}
                      className="min-w-0"
                    >
                      {tiles}
                    </div>
                  );
                }

                const rank = resolveMissionRank(mission);
                const title = resolveMissionTitle(mission) || mission.title;
                const reward = missionRewardLabel(mission);
                const exp = estimateMissionHaulingRepXp(mission);
                const headerAccent =
                  group.role === "pickup"
                    ? "border-rsi-accent/40"
                    : group.role === "delivery"
                      ? "border-rsi-gold/40"
                      : "border-rsi-border";

                return (
                  <div
                    key={`${row.id}-${group.role ?? "none"}-${mission.id}`}
                    className={[
                      "flex min-w-0 flex-col overflow-hidden rounded-rsi border border-rsi-border bg-rsi-surface/90",
                      mission.isCompleted || row.isCompleted
                        ? "opacity-70"
                        : "",
                    ].join(" ")}
                  >
                    <div
                      className={[
                        "min-w-0 border-b px-2.5 py-2",
                        headerAccent,
                      ].join(" ")}
                    >
                      <p
                        className={[
                          "font-mono text-[0.5rem] tracking-[0.12em]",
                          mission.isCompleted
                            ? "text-rsi-text-muted"
                            : "text-rsi-accent",
                        ].join(" ")}
                      >
                        {rank ?? "—"}
                      </p>
                      <p
                        className={[
                          "mt-0.5 min-w-0 truncate text-[0.65rem] font-semibold tracking-wide",
                          mission.isCompleted
                            ? "text-rsi-text-muted"
                            : "text-rsi-text",
                        ].join(" ")}
                      >
                        {title || mission.title}
                      </p>
                      {reward !== "—" || exp != null ? (
                        <p className="mt-1 flex min-w-0 items-baseline justify-between gap-2 font-mono text-[0.55rem] tabular-nums tracking-wide text-rsi-text-secondary">
                          <span className="min-w-0 truncate">
                            {reward !== "—" ? reward : null}
                          </span>
                          {exp != null ? (
                            <span
                              className="shrink-0"
                              title={`Approximate Covalex hauling reputation XP: ${exp.toLocaleString("en-US")}`}
                            >
                              {formatHaulingRepXp(exp)} XP
                            </span>
                          ) : null}
                        </p>
                      ) : null}
                    </div>
                    <div className="mt-auto bg-rsi-bg-deep/35 p-2.5">
                      {tiles}
                    </div>
                  </div>
                );
              })}
            </div>
            {sectionTransfer}
          </div>
        );

        const sectionAside =
          group.role === "pickup" || group.role === "delivery"
            ? bayAside?.(group.role)
            : null;

        return (
          <div
            key={`${row.id}-cargo-${group.role ?? "none"}`}
            className={[
              "flex flex-col gap-3 md:flex-row md:items-start md:gap-4",
              showRoleDivider
                ? "border-t border-rsi-divider pt-2 md:pt-1.5"
                : "",
            ].join(" ")}
          >
            {sectionBody}
            {sectionAside ? (
              <div className="w-full min-w-0 md:w-1/2 md:shrink-0">
                {sectionAside}
              </div>
            ) : null}
          </div>
        );
      })}
      {!hasPickupGroup && pickupTransfer ? (
        <PickupTransferBlock
          location={location}
          shipName={shipName}
          transfer={pickupTransfer}
          isDone={row.isCompleted}
        />
      ) : null}
      {!hasDeliveryGroup && deliveryTransfer ? (
        <DeliveryTransferBlock
          location={location}
          shipName={shipName}
          transfer={deliveryTransfer}
          isDone={row.isCompleted}
        />
      ) : null}
    </div>
  );
}


function LocationHeader({
  row,
  location,
  hasOutdoorFreightElevator,
  isCopied,
  onCopy,
  align = "start",
  compact = false,
  showTravelChevron = false,
  travelChevronClassName = "",
  nameTrailing = null,
}: {
  row: HaulingChecklistRow;
  location: string;
  hasOutdoorFreightElevator: boolean;
  isCopied: boolean;
  onCopy: () => void;
  align?: "start" | "end";
  /** Skip pickup/delivery badges; still shows location amenity tags. */
  compact?: boolean;
  /** Triple chevron after the location name (composer / next-stop). */
  showTravelChevron?: boolean;
  /** Extra classes on the travel chevron wrapper (e.g. hide on mobile). */
  travelChevronClassName?: string;
  /** Sits immediately after the location name (e.g. QT ship badge). */
  nameTrailing?: ReactNode;
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const imageSrc = getLocationImageSrc(row.locationSlug);
  const shortName = getLocationShortName(row.locationSlug);

  const showRouteAction = !compact;
  const showLocationTags = hasOutdoorFreightElevator;

  return (
    <div
      className={[
        "flex gap-3 items-start",
        align === "end" ? "w-full flex-row-reverse" : "",
      ].join(" ")}
    >
      <div
        className={[
          "flex w-24 shrink-0 flex-col gap-1",
          align === "end" ? "items-end" : "items-stretch",
          row.isCompleted ? "opacity-70" : "",
        ].join(" ")}
      >
        {imageSrc ? (
          <button
            type="button"
            aria-label={`View full image: ${location}`}
            title="View full image"
            onClick={(event) => {
              event.stopPropagation();
              setLightboxOpen(true);
            }}
            className={[
              "relative h-14 w-24 overflow-hidden rounded-lg border border-rsi-border/80 bg-rsi-bg-deep/60",
              "cursor-zoom-in transition-opacity hover:opacity-90",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-rsi-bg",
            ].join(" ")}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- fixture static assets */}
            <img
              src={imageSrc}
              alt=""
              className="size-full object-cover"
              loading="lazy"
              decoding="async"
            />
          </button>
        ) : (
          <div
            className="flex h-14 w-24 items-center justify-center rounded-lg border border-dashed border-rsi-border/70 bg-rsi-bg-deep/40"
            aria-hidden
          />
        )}
        {lightboxOpen && imageSrc ? (
          <ImageLightbox
            src={imageSrc}
            alt={location}
            title={location}
            caption={shortName}
            onClose={() => setLightboxOpen(false)}
          />
        ) : null}
        <div className="flex w-full items-center justify-center gap-0.5">
          <p
            className={[
              "min-w-0 text-center font-mono text-[0.55rem] uppercase leading-tight tracking-[0.14em]",
              row.isCompleted
                ? "text-rsi-text-muted"
                : "text-rsi-text-secondary",
            ].join(" ")}
            title={location}
          >
            {shortName}
          </p>
          <button
            type="button"
            aria-label={
              isCopied ? `Copied ${shortName}` : `Copy short name: ${shortName}`
            }
            title={isCopied ? "Copied" : "Copy short name"}
            onClick={(event) => {
              event.stopPropagation();
              onCopy();
            }}
            className={[
              "inline-flex size-4 shrink-0 items-center justify-center rounded-rsi border transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-rsi-bg",
              isCopied
                ? "border-rsi-success/50 bg-rsi-success-muted text-rsi-success"
                : "border-transparent text-rsi-text-muted hover:border-rsi-border hover:bg-rsi-bg-deep/40 hover:text-rsi-accent",
            ].join(" ")}
          >
            <CopyIcon className="size-2.5" />
          </button>
        </div>
      </div>
      <div
        className={[
          "flex min-w-0 flex-1 flex-col gap-1",
          align === "end" ? "items-stretch" : "",
        ].join(" ")}
      >
        <div
          className={[
            "flex min-h-14 min-w-0 items-center gap-x-2 gap-y-1",
            showTravelChevron ? "justify-between" : "sm:h-14",
          ].join(" ")}
        >
          <span
            className={[
              "inline-flex min-w-0 max-w-full items-center gap-2 text-left text-base font-semibold tracking-wide sm:text-xl",
              showTravelChevron || nameTrailing
                ? "flex-1"
                : "flex-1 sm:truncate",
              row.isCompleted
                ? "text-rsi-text-muted"
                : "text-rsi-text",
            ].join(" ")}
            title={location}
          >
            <span
              className={
                nameTrailing
                  ? "min-w-0 break-words [overflow-wrap:anywhere] sm:truncate sm:whitespace-nowrap"
                  : "min-w-0 break-words [overflow-wrap:anywhere]"
              }
            >
              {location}
            </span>
            {nameTrailing ? (
              <span className="inline-flex shrink-0 items-center self-center">
                {nameTrailing}
              </span>
            ) : null}
          </span>
          {showTravelChevron ? (
            <span
              aria-hidden
              className={[
                "inline-flex shrink-0 items-center self-center text-rsi-text-muted",
                travelChevronClassName,
              ]
                .filter(Boolean)
                .join(" ")}
              title="Travel"
            >
              <TravelChevronsIcon className="h-5 w-6" />
            </span>
          ) : null}
        </div>
        {showRouteAction || showLocationTags ? (
          <div
            className={[
              "flex flex-wrap items-center gap-2",
              align === "end" ? "justify-end" : "",
            ].join(" ")}
          >
            {showRouteAction
              ? routeActionBadges(row.routeAction).map((badge) => (
                  <Badge key={badge.label} variant={badge.variant} size="sm">
                    {badge.label}
                  </Badge>
                ))
              : null}
            {hasOutdoorFreightElevator ? (
              <OutdoorFreightBadge locationSlug={row.locationSlug} />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M8 3.25v9.5M3.25 8h9.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function AddStopAfterButton({
  onClick,
  disabled = false,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex justify-center py-1">
      <button
        type="button"
        disabled={disabled}
        aria-label="Add stop after this location"
        title="Add stop"
        onClick={(event) => {
          event.stopPropagation();
          onClick();
        }}
        className={[
          "inline-flex size-4 items-center justify-center rounded-full border transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-rsi-bg",
          "disabled:cursor-not-allowed disabled:opacity-40",
          "border-rsi-border/70 bg-rsi-bg-deep/40 text-rsi-text-muted opacity-60 hover:border-rsi-accent/40 hover:text-rsi-accent hover:opacity-100",
        ].join(" ")}
      >
        <PlusIcon className="size-2.5" />
      </button>
    </div>
  );
}

/** Compact travel row: current location → Quantum to destination. */
function QuantumShipBadge({
  shipSlug,
  className = "h-8 w-12",
}: {
  shipSlug?: string | null;
  className?: string;
}) {
  const shipIconSrc = getShipIconSrc(shipSlug);
  return (
    <span
      className={[
        "inline-flex shrink-0 items-center justify-center overflow-hidden",
        className,
      ].join(" ")}
      title="Ship"
    >
      {shipIconSrc ? (
        // eslint-disable-next-line @next/next/no-img-element -- static ship badge
        <img
          src={shipIconSrc}
          alt=""
          className="block size-full object-contain"
        />
      ) : (
        <SpaceshipIcon className="h-3 w-5" />
      )}
    </span>
  );
}

function QuantumTravelRow({
  rowId,
  fromSlug,
  destinationSlug,
  destinationName,
  reasonShopSlug = null,
  distanceToNext = null,
  shipSlug = null,
  isCompleted,
  isFocused,
  isPending = false,
  isSavingSection = false,
  isCopied,
  onCopy,
  onFocus,
  onToggle,
  onChangeFrom,
  onChangeTo,
  footer = null,
  isHistoryExpanded = false,
  onHistoryExpand,
  onHistoryCollapse,
}: {
  rowId: string;
  fromSlug: string;
  destinationSlug: string | null;
  destinationName: string;
  reasonShopSlug?: string | null;
  distanceToNext?: HaulingChecklistRow["distanceToNext"];
  shipSlug?: string | null;
  isCompleted: boolean;
  isFocused: boolean;
  isPending?: boolean;
  /** Endpoint retarget / insert save in flight for this QT row. */
  isSavingSection?: boolean;
  isCopied: boolean;
  onCopy: () => void;
  onFocus: () => void;
  onToggle: () => void;
  onChangeFrom?: (slug: string) => void;
  onChangeTo?: (slug: string) => void;
  footer?: ReactNode;
  /** Completed QT: show full card instead of Done strip. */
  isHistoryExpanded?: boolean;
  onHistoryExpand?: () => void;
  onHistoryCollapse?: () => void;
}) {
  const sectionBusy = isPending || isSavingSection;
  const [editing, setEditing] = useState<"from" | "to" | null>(null);
  const reasonLabel = reasonShopSlug
    ? (getLocationShopBySlug(reasonShopSlug)?.name ?? reasonShopSlug)
    : null;
  const locationFixture = getLocationBySlug(fromSlug);
  const location = locationFixture?.name ?? fromSlug;
  const hopDistance =
    (destinationSlug
      ? distanceBetweenLocationSlugs(fromSlug, destinationSlug)
      : null) ?? distanceToNext;
  const hopLabel = formatDistanceToNext(hopDistance);
  const fromShort = getLocationShortName(fromSlug);
  const toShort =
    destinationSlug != null
      ? getLocationShortName(destinationSlug)
      : destinationName;
  const stubRow: HaulingChecklistRow = {
    id: rowId,
    routeAction: "quantum",
    locationSlug: fromSlug,
    quantumToLocationSlug: destinationSlug,
    cargoDeliveries: [],
    shipStorageLocation: "front",
    distanceToNext: hopDistance,
    isCompleted,
  };

  const stopEditBubble = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
  };

  if (isCompleted && !isHistoryExpanded) {
    return (
      <li
        aria-checked
        aria-busy={sectionBusy}
        aria-current={isFocused ? "step" : undefined}
        className={[
          "scroll-mt-16 border-b border-rsi-divider/80 sm:scroll-mt-24",
          isSavingSection ? "opacity-90" : "",
        ].join(" ")}
        onClick={onFocus}
      >
        <CompletedQuantumHistoryRow
          fromLabel={fromShort}
          toLabel={toShort}
          hopLabel={hopDistance ? hopLabel : null}
          isFocused={isFocused}
          isPending={isPending || isSavingSection}
          onToggle={onToggle}
          onOpen={onHistoryExpand}
        />
      </li>
    );
  }

  const fromBlock =
    editing === "from" && onChangeFrom ? (
      <div
        className="flex min-w-0 flex-col gap-2"
        onClick={stopEditBubble}
        onDoubleClick={stopEditBubble}
      >
        <LocationFuzzySearch
          label="Current location"
          placeholder="Search current location…"
          valueSlug={fromSlug}
          onChange={(slug) => {
            if (!slug || sameLocationSlug(slug, fromSlug)) {
              setEditing(null);
              return;
            }
            onChangeFrom(slug);
            setEditing(null);
          }}
        />
        <button
          type="button"
          onClick={() => setEditing(null)}
          className="self-start font-mono text-[0.65rem] uppercase tracking-[0.16em] text-rsi-text-muted hover:text-rsi-text"
        >
          Cancel
        </button>
      </div>
    ) : (
      <div
        title={
          onChangeFrom
            ? "Double-click to change current location"
            : undefined
        }
        onDoubleClick={(event) => {
          event.stopPropagation();
          if (onChangeFrom) setEditing("from");
        }}
      >
        <LocationHeader
          row={stubRow}
          location={location}
          hasOutdoorFreightElevator={Boolean(
            locationFixture?.hasOutdoorFreightElevator,
          )}
          isCopied={isCopied}
          onCopy={onCopy}
          compact
          nameTrailing={
            <QuantumShipBadge
              shipSlug={shipSlug}
              className="ml-1.5 h-6 w-9 sm:ml-16 sm:h-8 sm:w-12"
            />
          }
        />
      </div>
    );

  /** >>> desktop / rotated down on stacked mobile. */
  const travelBlock = (
    <div
      aria-hidden
      className="flex h-7 items-center justify-start text-rsi-text-muted md:h-14 md:justify-center"
      title="Travel"
    >
      <TravelChevronsIcon className="h-4 w-5 rotate-90 md:h-5 md:w-6 md:rotate-0" />
    </div>
  );

  const toBlock =
    editing === "to" && onChangeTo ? (
      <div
        className="flex min-w-0 flex-col gap-2 py-2"
        onClick={stopEditBubble}
        onDoubleClick={stopEditBubble}
      >
        <LocationFuzzySearch
          label="Destination"
          placeholder="Search destination…"
          valueSlug={destinationSlug}
          onChange={(slug) => {
            if (
              !slug ||
              (destinationSlug && sameLocationSlug(slug, destinationSlug))
            ) {
              setEditing(null);
              return;
            }
            onChangeTo(slug);
            setEditing(null);
          }}
        />
        <button
          type="button"
          onClick={() => setEditing(null)}
          className="self-start font-mono text-[0.65rem] uppercase tracking-[0.16em] text-rsi-text-muted hover:text-rsi-text"
        >
          Cancel
        </button>
      </div>
    ) : (
        <p
        className={[
          "flex min-h-8 min-w-0 items-center text-sm tracking-wide sm:text-lg md:h-14 md:text-base",
          isCompleted ? "text-rsi-text-muted" : "text-rsi-text",
          onChangeTo ? "cursor-pointer" : "cursor-default",
        ].join(" ")}
        title={
          onChangeTo ? "Double-click to change destination" : undefined
        }
        onDoubleClick={(event) => {
          event.stopPropagation();
          if (onChangeTo) setEditing("to");
        }}
      >
        <span
          className={[
            "min-w-0 break-words [overflow-wrap:anywhere]",
            isCompleted ? "" : "text-rsi-text-secondary",
          ].join(" ")}
        >
          {destinationName}
        </span>
      </p>
    );

  return (
    <li
      aria-checked={isCompleted}
      aria-busy={sectionBusy}
      aria-current={isFocused ? "step" : undefined}
      className={[
        "scroll-mt-16 border-b border-rsi-divider/80 px-3 pt-3 pb-1 sm:scroll-mt-24",
        checklistRowToneClass(isCompleted, isFocused),
        isSavingSection ? "opacity-90" : "",
      ].join(" ")}
      onClick={onFocus}
    >
      {isCompleted && onHistoryCollapse ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onHistoryCollapse();
          }}
          className="mb-2 ml-auto block font-mono text-[0.6rem] uppercase tracking-[0.14em] text-rsi-text-muted hover:text-rsi-accent"
        >
          Collapse
        </button>
      ) : null}
      <div className="flex gap-3">
        <div className="hidden h-14 shrink-0 items-center self-start md:flex">
          <DoneCheckbox
            location={location}
            step="QT"
            isCompleted={isCompleted}
            isActive={isFocused}
            isPending={isPending || isSavingSection}
            onToggle={onToggle}
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 md:flex-row md:items-start md:gap-3">
          <div className="min-w-0 flex-1 md:min-w-[52%] md:flex-[1.7]">
            {isSavingSection ? (
              <p className="mb-2 inline-flex items-center gap-1.5 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-rsi-accent">
                <Spinner className="size-3" />
                Saving…
              </p>
            ) : null}
            {fromBlock}
          </div>
          <div className="flex shrink-0 justify-start pl-[6.75rem] md:justify-center md:px-1 md:pl-0">
            {travelBlock}
          </div>
          <div className="flex w-full min-w-0 flex-col gap-1 pl-[6.75rem] md:max-w-[38%] md:flex-1 md:pl-0">
            {toBlock}
            {hopDistance ? (
              <p
                className={[
                  "font-mono text-[0.65rem] tabular-nums tracking-wide",
                  isCompleted
                    ? "text-rsi-text-muted"
                    : "text-rsi-text-secondary",
                ].join(" ")}
                title={`Quantum hop ${hopLabel}`}
              >
                Distance · {hopLabel}
              </p>
            ) : null}
            {reasonLabel ? (
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-rsi-text-muted">
                Reason · {reasonLabel}
              </p>
            ) : null}
            <div className="mt-2 md:hidden">
              <DoneStopButton
                location={location}
                step="QT"
                isCompleted={isCompleted}
                isPending={isPending}
                onToggle={onToggle}
              />
            </div>
          </div>
        </div>
      </div>
      {footer}
    </li>
  );
}

/** Draft quantum stop: current location locked, pick desired + shop reason. */
function QuantumTravelComposer({
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
    <li className="scroll-mt-16 border-b border-rsi-divider/80 bg-rsi-accent-muted/20 px-3 py-3 sm:scroll-mt-24">
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

/** Station is always left, Ship always right — flip chevrons for direction. */
function TransferArrow({
  direction,
}: {
  /** `toShip` = Station → Ship (pickup); `toStation` = Ship → Station (delivery). */
  direction: "toShip" | "toStation";
}) {
  return (
    <span
      aria-hidden
      className="flex shrink-0 self-center px-3 text-rsi-text-muted sm:px-7"
    >
      <svg
        viewBox="0 0 30 20"
        className={[
          "h-4 w-[1.35rem]",
          direction === "toStation" ? "-scale-x-100" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M4 3 L12 10 L4 17"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M15.5 3 L23.5 10 L15.5 17"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function transferToneClasses(isDone: boolean): {
  strike: string;
  mute: string;
} {
  return {
    strike: "",
    mute: isDone ? "text-rsi-text-muted" : "",
  };
}

function TransferColumnLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 w-fit border-b border-rsi-text-muted/45 pb-0.5 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-rsi-text-muted">
      {children}
    </p>
  );
}

function TransferBlockFrame({
  title,
  isDone,
  tone,
  children,
}: {
  title: string;
  isDone: boolean;
  /** Pickup = station→ship (accent); delivery = ship→station (gold). */
  tone: "pickup" | "delivery";
  children: ReactNode;
}) {
  const surface =
    tone === "pickup"
      ? "border-rsi-accent/20 bg-rsi-accent-muted/20"
      : "border-rsi-gold/20 bg-rsi-gold-muted/20";

  return (
    <div
      className={[
        // Equal endpoint columns — Station always left, Ship always right.
        // Arrow direction flips for pickup vs delivery. Text wraps; never truncates.
        "grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-x-2 rounded-rsi border px-3 py-4 sm:gap-x-4 sm:px-4",
        surface,
        isDone ? "opacity-70 text-rsi-text-muted" : "",
      ].join(" ")}
      title={title}
    >
      {children}
    </div>
  );
}

function TransferScuLine({
  amount,
  suffix,
  tone,
  strike,
  mute,
  isDone,
}: {
  amount: string;
  suffix: string;
  tone: string;
  strike: string;
  mute: string;
  isDone: boolean;
}) {
  return (
    <p
      className={[
        "font-mono text-sm leading-5 tabular-nums tracking-wide",
        isDone ? mute : tone,
        strike,
      ].join(" ")}
    >
      {amount}
      <span
        className={[
          "ml-1 text-[0.65rem] font-normal tracking-wide no-underline",
          isDone ? "" : "text-rsi-text-muted",
        ].join(" ")}
      >
        {suffix.startsWith("SCU") ? (
          <>
            <span title={SCU_TITLE}>SCU</span>
            {suffix.slice(3)}
          </>
        ) : (
          suffix
        )}
      </span>
    </p>
  );
}

function PickupTransferBlock({
  location,
  shipName,
  transfer,
  isDone,
}: {
  location: string;
  shipName: string;
  transfer: ScuTransfer;
  isDone: boolean;
}) {
  const { strike, mute } = transferToneClasses(isDone);

  return (
    <TransferBlockFrame
      title={`Load ${transfer.amount} SCU from ${location}`}
      isDone={isDone}
      tone="pickup"
    >
      <TransferColumnLabel>Station</TransferColumnLabel>
      <span aria-hidden className="col-start-2" />
      <TransferColumnLabel>Ship</TransferColumnLabel>

      <p
        className={[
          "mb-2.5 min-w-0 self-center break-words text-sm font-medium leading-5",
          isDone ? mute : "text-rsi-text-muted",
          strike,
        ].join(" ")}
        title={location}
      >
        {location}
      </p>
      <div className="mb-2.5 flex items-center justify-center self-center">
        <TransferArrow direction="toShip" />
      </div>
      <p
        className={[
          "mb-2.5 min-w-0 self-center break-words text-sm font-medium leading-5",
          isDone ? mute : "text-rsi-text-muted",
          strike,
        ].join(" ")}
        title={shipName}
      >
        {shipName}
      </p>

      <span aria-hidden className="col-start-1" />
      <div className="col-start-3 min-w-0">
        <TransferScuLine
          amount={String(transfer.before)}
          suffix="aboard"
          tone="text-rsi-text-muted"
          strike={strike}
          mute={mute}
          isDone={isDone}
        />
      </div>

      <div className="col-start-1 min-w-0">
        <TransferScuLine
          amount={`−${transfer.amount}`}
          suffix="loading"
          tone="text-rsi-danger"
          strike={strike}
          mute={mute}
          isDone={isDone}
        />
      </div>
      <div className="col-start-3 min-w-0">
        <TransferScuLine
          amount={`+${transfer.amount}`}
          suffix="receiving"
          tone="text-rsi-success"
          strike={strike}
          mute={mute}
          isDone={isDone}
        />
      </div>

      <span aria-hidden className="col-start-1" />
      <div className="col-start-3 min-w-0 w-fit">
        <div
          aria-hidden
          className={[
            "mb-1 border-t",
            isDone ? "border-rsi-divider" : "border-rsi-border-strong",
          ].join(" ")}
        />
        <TransferScuLine
          amount={String(transfer.after)}
          suffix="SCU aboard"
          tone="text-rsi-text"
          strike={strike}
          mute={mute}
          isDone={isDone}
        />
      </div>
    </TransferBlockFrame>
  );
}

function DeliveryTransferBlock({
  location,
  shipName,
  transfer,
  isDone,
}: {
  location: string;
  shipName: string;
  transfer: ScuTransfer;
  isDone: boolean;
}) {
  const { strike, mute } = transferToneClasses(isDone);

  return (
    <TransferBlockFrame
      title={`Transfer ${transfer.amount} SCU to ${location}`}
      isDone={isDone}
      tone="delivery"
    >
      <TransferColumnLabel>Station</TransferColumnLabel>
      <span aria-hidden className="col-start-2" />
      <TransferColumnLabel>Ship</TransferColumnLabel>

      <p
        className={[
          "mb-2.5 min-w-0 self-center break-words text-sm font-medium leading-5",
          isDone ? mute : "text-rsi-text-muted",
          strike,
        ].join(" ")}
        title={location}
      >
        {location}
      </p>
      <div className="mb-2.5 flex items-center justify-center self-center">
        <TransferArrow direction="toStation" />
      </div>
      <p
        className={[
          "mb-2.5 min-w-0 self-center break-words text-sm font-medium leading-5",
          isDone ? mute : "text-rsi-text-muted",
          strike,
        ].join(" ")}
        title={shipName}
      >
        {shipName}
      </p>

      <span aria-hidden className="col-start-1" />
      <div className="col-start-3 min-w-0">
        <TransferScuLine
          amount={String(transfer.before)}
          suffix="aboard"
          tone="text-rsi-text-muted"
          strike={strike}
          mute={mute}
          isDone={isDone}
        />
      </div>

      <div className="col-start-1 min-w-0">
        <TransferScuLine
          amount={`+${transfer.amount}`}
          suffix="receiving"
          tone="text-rsi-success"
          strike={strike}
          mute={mute}
          isDone={isDone}
        />
      </div>
      <div className="col-start-3 min-w-0">
        <TransferScuLine
          amount={`−${transfer.amount}`}
          suffix="delivering"
          tone="text-rsi-danger"
          strike={strike}
          mute={mute}
          isDone={isDone}
        />
      </div>

      <span aria-hidden className="col-start-1" />
      <div className="col-start-3 min-w-0 w-fit">
        <div
          aria-hidden
          className={[
            "mb-1 border-t",
            isDone ? "border-rsi-divider" : "border-rsi-border-strong",
          ].join(" ")}
        />
        <TransferScuLine
          amount={String(transfer.after)}
          suffix="SCU remaining"
          tone="text-rsi-text"
          strike={strike}
          mute={mute}
          isDone={isDone}
        />
      </div>
    </TransferBlockFrame>
  );
}

function PayoutExpMeta({
  row,
  completionAuec,
  approxXp,
  completingMissionCount,
}: {
  row: HaulingChecklistRow;
  completionAuec: number;
  approxXp: number;
  completingMissionCount: number;
}) {
  if (completingMissionCount <= 0) return null;

  const contractLabel =
    completingMissionCount === 1
      ? "1 contract"
      : `${completingMissionCount} contracts`;

  return (
    <div
      className={[
        "grid w-full grid-cols-2 gap-x-6 rounded-rsi border border-rsi-success/35 bg-rsi-success-muted/40 px-3 py-4 text-sm sm:gap-x-8 sm:px-4",
        row.isCompleted ? "opacity-70" : "",
      ].join(" ")}
    >
      <div
        className="min-w-0"
        title={
          completionAuec > 0
            ? `Payout ${formatAuecAmount(completionAuec)}`
            : `${AUEC_TITLE} not available`
        }
      >
        <p className="mb-2 w-fit border-b border-rsi-text-muted/45 pb-0.5 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-rsi-text-muted">
          Payout
        </p>
        <p className="text-sm font-medium leading-snug text-rsi-text-muted">
          {completingMissionCount === 1
            ? "Contract reward"
            : `${completingMissionCount} contract rewards`}
        </p>
        {completionAuec > 0 ? (
          <p
            className={[
              "mt-1 font-mono text-sm tabular-nums tracking-wide",
              row.isCompleted ? "text-rsi-text-muted" : "text-rsi-success",
            ].join(" ")}
          >
            +{Math.floor(completionAuec).toLocaleString("en-US")}{" "}
            <span title={AUEC_TITLE}>aUEC</span>
            <span className="ml-1 text-[0.65rem] font-normal tracking-wide text-rsi-text-muted no-underline">
              paid
            </span>
          </p>
        ) : (
          <p
            className={[
              "mt-1 font-mono text-sm tabular-nums tracking-wide",
              row.isCompleted ? "text-rsi-text-muted" : "text-rsi-warn",
            ].join(" ")}
          >
            <span title={AUEC_TITLE}>aUEC</span> not available
          </p>
        )}
      </div>
      <div
        className="min-w-0"
        title="Approximate Covalex hauling reputation for standard ranked cargo hauls (community estimates; recover / special jobs may differ)"
      >
        <p className="mb-2 w-fit border-b border-rsi-text-muted/45 pb-0.5 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-rsi-text-muted">
          Exp
        </p>
        <p className="text-sm font-medium leading-snug text-rsi-text-muted">
          {contractLabel}
        </p>
        {approxXp > 0 ? (
          <p
            className={[
              "mt-1 font-mono text-sm tabular-nums tracking-wide",
              row.isCompleted ? "text-rsi-text-muted" : "text-rsi-accent",
            ].join(" ")}
          >
            ~{approxXp.toLocaleString("en-US")}{" "}
            <span title="Hauling reputation / experience points">XP</span>
          </p>
        ) : (
          <p
            className={[
              "mt-1 font-mono text-sm tabular-nums tracking-wide",
              row.isCompleted ? "text-rsi-text-muted" : "text-rsi-warn",
            ].join(" ")}
          >
            XP unknown
          </p>
        )}
      </div>
    </div>
  );
}

/** Same 3px inset as checklist cards — neutral so Next stop isn’t green/accent. */
const CHECKLIST_RAIL_NEUTRAL =
  "shadow-[inset_3px_0_0_0_var(--rsi-border-strong)]";

function NextStopBridgeBand({
  row,
  nextLocationName,
  nextLocationSlug,
  shipSlug = null,
  isPending = false,
  onToggle,
  bridgeRef,
}: {
  row: HaulingChecklistRow;
  nextLocationName: string | null;
  nextLocationSlug: string | null;
  shipSlug?: string | null;
  isPending?: boolean;
  /** Completes the stop this hop belongs to (current incomplete stop). */
  onToggle?: () => void;
  /** Scroll target for advancing into the destination stop. */
  bridgeRef?: (node: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={bridgeRef}
      className={[
        "border-t border-rsi-divider/60 bg-rsi-bg-deep/60",
        CHECKLIST_RAIL_NEUTRAL,
      ].join(" ")}
    >
      {/* Same px-3 as Done strip so ship badge lines up with the checkbox. */}
      <div className="px-3">
        <NextDistanceMeta
          row={row}
          nextLocationName={nextLocationName}
          nextLocationSlug={nextLocationSlug}
          shipSlug={shipSlug}
          variant="bridge"
          isPending={isPending}
          onToggle={onToggle}
        />
      </div>
    </div>
  );
}

/** Compact history row for a completed stop (show-history mode). */
function CompletedStopHistoryRow({
  location,
  step,
  routeAction,
  scuTotal,
  hopLabel = null,
  isFocused,
  isPending,
  onToggle,
  onOpen,
}: {
  location: string;
  step: number | string;
  routeAction: RouteAction;
  scuTotal: number;
  /** Formatted distance for the hop leaving this stop. */
  hopLabel?: string | null;
  isFocused: boolean;
  isPending: boolean;
  onToggle: () => void;
  /** Expand condensed history to the full stop card. */
  onOpen?: () => void;
}) {
  return (
    <div
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={
        onOpen
          ? (event) => {
              event.stopPropagation();
              onOpen();
            }
          : undefined
      }
      onKeyDown={
        onOpen
          ? (event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              event.stopPropagation();
              onOpen();
            }
          : undefined
      }
      className={[
        "flex items-center gap-2.5 px-3 py-2 sm:gap-3",
        onOpen ? "cursor-pointer" : "",
        checklistRowToneClass(true, isFocused),
      ].join(" ")}
    >
      <DoneCheckbox
        location={location}
        step={step}
        isCompleted
        isActive={isFocused}
        isPending={isPending}
        compact
        onToggle={onToggle}
      />
      <span
        className="min-w-0 flex-1 truncate text-sm font-medium tracking-wide text-rsi-text-secondary"
        title={location}
      >
        {location}
      </span>
      <CondensedRowTrailing
        routeAction={routeAction}
        scuTotal={scuTotal}
        hopLabel={hopLabel}
      />
    </div>
  );
}

/** Compact history strip for a completed quantum hop. */
function CompletedQuantumHistoryRow({
  fromLabel,
  toLabel,
  hopLabel,
  isFocused,
  isPending,
  onToggle,
  onOpen,
}: {
  fromLabel: string;
  toLabel: string;
  hopLabel: string | null;
  isFocused: boolean;
  isPending: boolean;
  onToggle: () => void;
  /** Expand condensed history to the full quantum card. */
  onOpen?: () => void;
}) {
  const hopTitle = `${fromLabel} → ${toLabel}`;
  return (
    <div
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={
        onOpen
          ? (event) => {
              event.stopPropagation();
              onOpen();
            }
          : undefined
      }
      onKeyDown={
        onOpen
          ? (event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              event.stopPropagation();
              onOpen();
            }
          : undefined
      }
      className={[
        "flex items-center gap-2.5 px-3 py-2 sm:gap-3",
        onOpen ? "cursor-pointer" : "",
        checklistRowToneClass(true, isFocused),
      ].join(" ")}
    >
      <DoneCheckbox
        location={hopTitle}
        step="QT"
        isCompleted
        isActive={isFocused}
        isPending={isPending}
        compact
        onToggle={onToggle}
      />
      <span
        className="flex min-w-0 flex-1 items-center truncate text-sm font-medium tracking-wide text-rsi-text-secondary"
        title={hopTitle}
      >
        <span className="truncate">{fromLabel}</span>
        <TravelChevronsIcon className="mx-2.5 h-3.5 w-4 shrink-0 text-rsi-text-muted sm:mx-3" />
        <span className="truncate">{toLabel}</span>
      </span>
      <CondensedRowTrailing
        routeAction="quantum"
        hopLabel={hopLabel}
      />
    </div>
  );
}

function NextDistanceMeta({
  row,
  nextLocationName,
  nextLocationSlug,
  shipSlug = null,
  variant = "inline",
  isPending = false,
  onToggle,
}: {
  row: HaulingChecklistRow;
  nextLocationName: string | null;
  nextLocationSlug: string | null;
  shipSlug?: string | null;
  /** `bridge` sits outside the completed (green) panel — keep it readable. */
  variant?: "inline" | "bridge";
  isPending?: boolean;
  /** Whole row marks the owning stop done (same as the Done checkbox). */
  onToggle?: () => void;
}) {
  const isBridge = variant === "bridge";
  const shipIconSrc = getShipIconSrc(shipSlug);
  const isLastStop = nextLocationSlug == null && nextLocationName == null;
  if (isLastStop) {
    return (
      <div className={isBridge ? "py-3 text-sm" : "pt-5 text-sm"}>
        <p
          className={[
            "font-mono text-[0.65rem] uppercase tracking-[0.16em]",
            isBridge || !row.isCompleted
              ? "text-rsi-success"
              : "text-rsi-text-muted",
          ].join(" ")}
        >
          Trip complete
        </p>
      </div>
    );
  }

  const starmapDistance = distanceBetweenLocationSlugs(
    row.locationSlug,
    nextLocationSlug!,
  );
  const distance = formatDistanceToNext(
    starmapDistance ?? row.distanceToNext,
  );

  // Same columns as stop header (checkbox → thumb → name); keep ship/text sizes.
  const shellClass = [
    "flex min-w-0 items-center gap-3 text-sm",
    isBridge ? "py-3" : "pt-5",
    onToggle
      ? [
          "w-full text-left",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-rsi-bg",
          isPending ? "cursor-wait" : "cursor-pointer",
        ].join(" ")
      : "",
  ].join(" ");

  const body = (
    <>
      {/* Checkbox column spacer — matches DoneCheckbox width on desktop. */}
      <span
        aria-hidden
        className="hidden w-8 shrink-0 md:inline-flex"
      />
      {/* Location-thumb column (w-24); ship centered, >> after ship on active row. */}
      <span
        className={[
          "inline-flex h-14 w-24 shrink-0 items-center justify-start gap-1.5",
          isBridge ? "text-rsi-accent" : "text-rsi-text-secondary",
        ].join(" ")}
        title="Next stop"
      >
        <span className="inline-flex h-10 w-14 items-center justify-center overflow-hidden">
          {shipIconSrc ? (
            // eslint-disable-next-line @next/next/no-img-element -- static ship badge
            <img
              src={shipIconSrc}
              alt=""
              className="block size-full object-contain"
            />
          ) : (
            <SpaceshipIcon className="h-3 w-5" />
          )}
        </span>
        <span
          aria-hidden
          className="ml-1.5 inline-flex shrink-0 text-rsi-text-muted sm:ml-2"
          title="Travel"
        >
          <TravelChevronsIcon className="h-4 w-5" />
        </span>
      </span>
      {/* Same start edge as LocationHeader name text. */}
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-rsi-text-muted">
          Next stop
        </p>
        <p
          className={[
            "mt-0.5 text-sm leading-snug break-words [overflow-wrap:anywhere]",
            isBridge
              ? "text-rsi-text"
              : row.isCompleted
                ? "text-rsi-text-muted"
                : "text-rsi-text-secondary",
          ].join(" ")}
        >
          <span className="font-medium tracking-wide">{nextLocationName}</span>
          <span className="text-rsi-text-muted"> – </span>
          <span className="font-mono tabular-nums text-rsi-text-secondary">
            {distance}
          </span>
        </p>
      </div>
    </>
  );

  if (!onToggle) {
    return <div className={shellClass}>{body}</div>;
  }

  return (
    <button
      type="button"
      className={shellClass}
      disabled={isPending}
      aria-busy={isPending}
      aria-label={
        isPending
          ? `Updating stop, next: ${nextLocationName}`
          : `Mark stop done, next: ${nextLocationName}`
      }
      title={isPending ? "Updating stop…" : "Mark this stop done"}
      onClick={(event) => {
        event.stopPropagation();
        if (isPending) return;
        onToggle();
      }}
    >
      {body}
    </button>
  );
}

/** Memoized so parent modal open/close does not rebuild every stop card. */
export const HaulingChecklistTable = memo(function HaulingChecklistTable({
  rows,
  onToggle,
  focusedStopId = null,
  onFocusStop,
  toolbarStart = null,
  toolbarEnd = null,
  shipName = null,
  shipSlug = null,
  missions = [],
  sessionId = null,
  onToggleCargoHandled,
  startLocationSlug = null,
  quantumOriginDeparted: quantumOriginDepartedProp,
  onQuantumOriginDepartedChange,
  onInsertQuantumTravel,
  onUpdateQuantumTravel,
  onOpenCargoBays,
  onOpenStops,
  onOpenContracts,
  onSelectBoxBreakdown,
  isSaving = false,
}: HaulingChecklistTableProps) {
  const transferShipName = shipName?.trim() || "Ship";
  const [copiedRowId, setCopiedRowId] = useState<string | null>(null);
  const [pendingCompleteRowIds, setPendingCompleteRowIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const [pendingCargoKeys, setPendingCargoKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [pendingQuantumRowIds, setPendingQuantumRowIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const [hideCompleted, setHideCompleted] = useState(false);
  /** Uncontrolled fallback when parent does not lift QT-origin departed. */
  const [quantumDepartedLocal, setQuantumDepartedLocal] = useState(false);
  const isQuantumOriginControlled = onQuantumOriginDepartedChange != null;
  const quantumDeparted = isQuantumOriginControlled
    ? Boolean(quantumOriginDepartedProp)
    : quantumDepartedLocal;
  const setQuantumDeparted = (departed: boolean) => {
    if (isQuantumOriginControlled) onQuantumOriginDepartedChange(departed);
    else setQuantumDepartedLocal(departed);
  };
  /** Which row’s + control opened the quantum destination composer. */
  const [draftingAfterRowId, setDraftingAfterRowId] = useState<string | null>(
    null,
  );
  /** Double-click Pickup / Drop off crate → box mix modal. */
  const [boxEditMissionId, setBoxEditMissionId] = useState<string | null>(null);
  /** Completed Done-strip row expanded to full card (history shown). */
  const [expandedCompletedRowId, setExpandedCompletedRowId] = useState<
    string | null
  >(null);
  const boxEditMission =
    boxEditMissionId == null
      ? null
      : (missions.find((mission) => mission.id === boxEditMissionId) ?? null);
  const rowElsRef = useRef(new Map<string, HTMLLIElement>());
  /** Next stop transition band — keyed by destination stop id. */
  const bridgeElsRef = useRef(new Map<string, HTMLElement>());
  const stickyToolbarRef = useRef<HTMLDivElement | null>(null);
  const pendingScrollToIdRef = useRef<string | null>(null);
  const displayRows = rows;
  const tripStarted = rows.some((row) => row.isCompleted);
  const showQuantumOrigin = needsQuantumOriginRow(
    displayRows,
    startLocationSlug,
  );
  const quantumCompleted =
    quantumDeparted || rows.some((row) => row.isCompleted);
  const completedCount =
    rows.filter((row) => row.isCompleted).length +
    (showQuantumOrigin && quantumCompleted ? 1 : 0);
  const visibleRows = hideCompleted
    ? displayRows.filter((row) => !row.isCompleted)
    : displayRows;
  const showQuantumInList =
    showQuantumOrigin && !(hideCompleted && quantumCompleted);
  const canAddStops = Boolean(onInsertQuantumTravel);

  useEffect(() => {
    if (isQuantumOriginControlled) return;
    setQuantumDepartedLocal(false);
  }, [
    isQuantumOriginControlled,
    startLocationSlug,
    rows[0]?.id,
    rows[0]?.locationSlug,
  ]);

  // Reset trip clears stop completion; also drop local QT-origin "departed".
  useEffect(() => {
    if (isQuantumOriginControlled) return;
    if (!tripStarted) setQuantumDepartedLocal(false);
  }, [isQuantumOriginControlled, tripStarted]);

  useEffect(() => {
    if (hideCompleted) setExpandedCompletedRowId(null);
  }, [hideCompleted]);

  useEffect(() => {
    if (!draftingAfterRowId) return;
    if (draftingAfterRowId === QUANTUM_ORIGIN_ROW_ID) return;
    if (!rows.some((row) => row.id === draftingAfterRowId)) {
      setDraftingAfterRowId(null);
    }
  }, [rows, draftingAfterRowId]);

  useEffect(() => {
    const targetId = pendingScrollToIdRef.current;
    if (!targetId) return;
    pendingScrollToIdRef.current = null;
    // Land the Next stop block (bridge, else stop card) flush under the sticky
    // toolbar — use measured sticky height, not a guessed scroll-margin.
    const el =
      bridgeElsRef.current.get(targetId) ?? rowElsRef.current.get(targetId);
    const sticky = stickyToolbarRef.current;
    if (!el) return;
    const stickyBottom = sticky?.getBoundingClientRect().bottom ?? 0;
    const delta = el.getBoundingClientRect().top - stickyBottom;
    if (Math.abs(delta) < 1) return;
    window.scrollBy({ top: delta, behavior: "smooth" });
  }, [rows, visibleRows]);

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

  const markPendingId = (
    setter: Dispatch<SetStateAction<ReadonlySet<string>>>,
    id: string,
    pending: boolean,
  ) => {
    setter((prev) => {
      const next = new Set(prev);
      if (pending) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const runRowPending = (
    rowId: string,
    action: () => void | Promise<void>,
  ) => {
    markPendingId(setPendingCompleteRowIds, rowId, true);
    return Promise.resolve(action()).finally(() => {
      markPendingId(setPendingCompleteRowIds, rowId, false);
    });
  };

  const runCargoPending = (
    rowId: string,
    cargoIndex: number,
    action: () => void | Promise<void>,
  ) => {
    const key = cargoPendingKey(rowId, cargoIndex);
    markPendingId(setPendingCargoKeys, key, true);
    return Promise.resolve(action()).finally(() => {
      markPendingId(setPendingCargoKeys, key, false);
    });
  };

  const runQuantumPending = (
    rowId: string,
    action: () => void | Promise<void>,
  ) => {
    markPendingId(setPendingQuantumRowIds, rowId, true);
    return Promise.resolve(action()).finally(() => {
      markPendingId(setPendingQuantumRowIds, rowId, false);
    });
  };

  const toolbar = (
    <div
      ref={stickyToolbarRef}
      className="sticky top-0 z-20 flex w-full min-w-0 max-w-full items-center gap-1.5 border-b border-rsi-divider bg-rsi-bg-deep/95 px-2 py-1 sm:gap-2 sm:px-3 sm:py-2"
    >
      <div className="min-w-0 flex-1">{toolbarStart}</div>
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {isSaving ? (
          <span
            className="inline-flex items-center gap-1 font-mono text-[0.55rem] uppercase tracking-[0.12em] text-rsi-accent sm:gap-1.5 sm:text-[0.6rem] sm:tracking-[0.14em]"
            role="status"
            aria-live="polite"
          >
            <Spinner className="size-3 sm:size-3.5" label="Saving trip" />
            <span className="hidden sm:inline">Saving…</span>
          </span>
        ) : null}
        <RouteChecklistMenu
          hideCompleted={hideCompleted}
          completedCount={completedCount}
          onToggleHistory={() => setHideCompleted((value) => !value)}
          elapsed={toolbarEnd}
        />
      </div>
    </div>
  );

  const emptyMessage =
    rows.length === 0
      ? missions.some((mission) => !mission.isHidden)
        ? "All contracts complete — reopen one from Contracts to rebuild the route"
        : "No contracts yet"
      : "All contracts complete — show history to review";

  const stepById = new Map(
    displayRows.map((row, index) => [row.id, index + 1]),
  );
  const transferLedgerByStop =
    cargoInventory.transferLedgerByStop(displayRows);
  const focusTargetsQuantum =
    focusedStopId === QUANTUM_ORIGIN_ROW_ID && showQuantumOrigin;
  const hasIncompleteStop = displayRows.some((row) => !row.isCompleted);
  const focusedRow =
    focusedStopId && focusedStopId !== QUANTUM_ORIGIN_ROW_ID
      ? (displayRows.find((row) => row.id === focusedStopId) ?? null)
      : null;
  // Trip finished: drop active focus so the last Done row shows green, not blue.
  const activeRowId =
    focusTargetsQuantum && (hasIncompleteStop || !quantumCompleted)
      ? focusedStopId
      : focusedRow && !(focusedRow.isCompleted && !hasIncompleteStop)
        ? focusedStopId
        : defaultFocusedStopId(displayRows, startLocationSlug);
  const firstStop = displayRows[0] ?? null;
  const quantumDestinationName = firstStop
    ? (getLocationBySlug(firstStop.locationSlug)?.name ??
      firstStop.locationSlug)
    : null;
  const startSlugTrimmed = startLocationSlug?.trim() || null;

  const completeQuantumOrigin = () => {
    const nextIncomplete =
      rows.find((entry) => !entry.isCompleted) ?? firstStop;
    setQuantumDeparted(true);
    if (nextIncomplete) {
      startTransition(() => {
        pendingScrollToIdRef.current = nextIncomplete.id;
        onFocusStop?.(nextIncomplete.id);
      });
    }
  };

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      if (target.isContentEditable) return true;
      return Boolean(
        target.closest(
          "input, textarea, select, [contenteditable='true'], [role='textbox']",
        ),
      );
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.repeat) return;
      if (isTypingTarget(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === "b") {
        event.preventDefault();
        onOpenCargoBays?.();
        return;
      }
      if (key === "s") {
        event.preventDefault();
        onOpenStops?.();
        return;
      }
      if (key === "c") {
        event.preventDefault();
        onOpenContracts?.();
        return;
      }
      if (key === "h") {
        if (completedCount === 0) return;
        event.preventDefault();
        setHideCompleted((value) => !value);
        return;
      }
      if (key === "d") {
        if (!activeRowId) return;
        event.preventDefault();
        if (activeRowId === QUANTUM_ORIGIN_ROW_ID && showQuantumInList) {
          if (quantumCompleted) {
            setQuantumDeparted(false);
            onFocusStop?.(QUANTUM_ORIGIN_ROW_ID);
          } else {
            completeQuantumOrigin();
          }
          return;
        }
        const row = rows.find((entry) => entry.id === activeRowId);
        if (!row) return;
        if (pendingCompleteRowIds.has(row.id)) return;
        const completing = !row.isCompleted;
        void runRowPending(row.id, () => onToggle(row.id));
        if (completing) {
          const routeIndex = rows.findIndex((entry) => entry.id === row.id);
          const nextIncomplete = rows
            .slice(routeIndex + 1)
            .find((entry) => !entry.isCompleted);
          startTransition(() => {
            if (nextIncomplete) {
              pendingScrollToIdRef.current = nextIncomplete.id;
              onFocusStop?.(nextIncomplete.id);
            } else {
              onFocusStop?.(null);
            }
          });
        }
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    activeRowId,
    completedCount,
    onFocusStop,
    onOpenCargoBays,
    onOpenContracts,
    onOpenStops,
    onToggle,
    pendingCompleteRowIds,
    quantumCompleted,
    rows,
    showQuantumInList,
  ]);

  const confirmQuantumDraft = (input: {
    toSlug: string;
    reasonShopSlug: string;
  }) => {
    if (!onInsertQuantumTravel || !draftingAfterRowId) return;
    const afterRowId = draftingAfterRowId;
    const fromSlug = quantumFromSlugAfter({
      rows,
      afterRowId,
      startLocationSlug,
    });
    if (!fromSlug) return;
    setDraftingAfterRowId(null);
    void runQuantumPending(afterRowId, () =>
      onInsertQuantumTravel({
        afterRowId,
        fromSlug,
        toSlug: input.toSlug,
        reasonShopSlug: input.reasonShopSlug,
      }),
    );
  };

  const handleCargoToggle = (rowId: string, cargoIndex: number) => {
    if (!onToggleCargoHandled) return;
    if (pendingCargoKeys.has(cargoPendingKey(rowId, cargoIndex))) return;
    void runCargoPending(rowId, cargoIndex, () =>
      onToggleCargoHandled(rowId, cargoIndex),
    );
  };

  const handleQuantumEndpointChange = (
    rowId: string,
    patch: { fromSlug?: string; toSlug?: string },
  ) => {
    if (!onUpdateQuantumTravel) return;
    if (pendingQuantumRowIds.has(rowId)) return;
    void runQuantumPending(rowId, () =>
      onUpdateQuantumTravel({ rowId, ...patch }),
    );
  };

  const addStopFooter = (afterRowId: string) =>
    canAddStops ? (
      <AddStopAfterButton
        onClick={() => setDraftingAfterRowId(afterRowId)}
        disabled={draftingAfterRowId === afterRowId}
      />
    ) : null;

  const draftComposer =
    draftingAfterRowId && canAddStops
      ? (() => {
          const fromSlug = quantumFromSlugAfter({
            rows,
            afterRowId: draftingAfterRowId,
            startLocationSlug,
          });
          if (!fromSlug) return null;
          return (
            <QuantumTravelComposer
              fromSlug={fromSlug}
              onCancel={() => setDraftingAfterRowId(null)}
              onConfirm={confirmQuantumDraft}
            />
          );
        })()
      : null;

  return (
    <div className="min-w-0 max-w-full overflow-x-clip rounded-rsi border border-rsi-border bg-rsi-surface/90 shadow-rsi-panel">
      {toolbar}

      <ul className="flex flex-col">
        {visibleRows.length === 0 && !showQuantumInList ? (
          <li className="px-4 py-8 text-center text-sm text-rsi-text-muted">
            {emptyMessage}
          </li>
        ) : null}
        {showQuantumInList && startSlugTrimmed && quantumDestinationName ? (
          <>
            <QuantumTravelRow
              rowId={QUANTUM_ORIGIN_ROW_ID}
              fromSlug={startSlugTrimmed}
              destinationSlug={firstStop?.locationSlug ?? null}
              destinationName={quantumDestinationName}
              shipSlug={shipSlug}
              distanceToNext={
                firstStop
                  ? distanceBetweenLocationSlugs(
                      startSlugTrimmed,
                      firstStop.locationSlug,
                    )
                  : null
              }
              isCompleted={quantumCompleted}
              isFocused={activeRowId === QUANTUM_ORIGIN_ROW_ID}
              isCopied={copiedRowId === QUANTUM_ORIGIN_ROW_ID}
              onCopy={() => {
                void copyStarmapName(
                  QUANTUM_ORIGIN_ROW_ID,
                  getLocationShortName(startSlugTrimmed),
                );
              }}
              onFocus={() => onFocusStop?.(QUANTUM_ORIGIN_ROW_ID)}
              onToggle={() => {
                if (quantumCompleted) {
                  setQuantumDeparted(false);
                  onFocusStop?.(QUANTUM_ORIGIN_ROW_ID);
                  return;
                }
                completeQuantumOrigin();
              }}
              isSavingSection={pendingQuantumRowIds.has(QUANTUM_ORIGIN_ROW_ID)}
              onChangeFrom={
                onUpdateQuantumTravel
                  ? (slug) =>
                      handleQuantumEndpointChange(QUANTUM_ORIGIN_ROW_ID, {
                        fromSlug: slug,
                      })
                  : undefined
              }
              onChangeTo={
                onUpdateQuantumTravel
                  ? (slug) =>
                      handleQuantumEndpointChange(QUANTUM_ORIGIN_ROW_ID, {
                        toSlug: slug,
                      })
                  : undefined
              }
              footer={addStopFooter(QUANTUM_ORIGIN_ROW_ID)}
              isHistoryExpanded={
                expandedCompletedRowId === QUANTUM_ORIGIN_ROW_ID
              }
              onHistoryExpand={() => {
                setExpandedCompletedRowId(QUANTUM_ORIGIN_ROW_ID);
                onFocusStop?.(QUANTUM_ORIGIN_ROW_ID);
              }}
              onHistoryCollapse={() => setExpandedCompletedRowId(null)}
            />
            {draftingAfterRowId === QUANTUM_ORIGIN_ROW_ID ? draftComposer : null}
          </>
        ) : null}
        {visibleRows.map((row) => {
          const locationFixture = getLocationBySlug(row.locationSlug);
          const location = locationFixture?.name ?? row.locationSlug;
          const routeIndex = displayRows.findIndex(
            (entry) => entry.id === row.id,
          );
          const nextRow =
            routeIndex >= 0 ? (displayRows[routeIndex + 1] ?? null) : null;
          const nextLocationSlug = nextRow?.locationSlug ?? null;
          const nextLocationName = nextLocationSlug
            ? (getLocationBySlug(nextLocationSlug)?.name ?? nextLocationSlug)
            : null;
          const isCopied = copiedRowId === row.id;
          const step = stepById.get(row.id) ?? 0;
          const isFocused = row.id === activeRowId;
          const isPendingComplete = pendingCompleteRowIds.has(row.id);
          const isQuantumSaving = pendingQuantumRowIds.has(row.id);
          const isRowCargoPending = [...pendingCargoKeys].some((key) =>
            key.startsWith(`${row.id}:`),
          );
          const isRowSectionBusy =
            isPendingComplete || isQuantumSaving || isRowCargoPending;
          const toggleStopDoneById = (
            stopId: string,
            stopRouteIndex: number,
            isCompleted: boolean,
          ) => {
            if (pendingCompleteRowIds.has(stopId)) return;
            const completing = !isCompleted;
            void runRowPending(stopId, () => onToggle(stopId));
            // Defer focus/scroll/bay replan so the checkbox paints first.
            // Always advance when completing — especially with history hidden,
            // the finished stop leaves the list and the next one should be active.
            if (completing) {
              const nextIncomplete = displayRows
                .slice(stopRouteIndex + 1)
                .find((entry) => !entry.isCompleted);
              startTransition(() => {
                if (nextIncomplete) {
                  pendingScrollToIdRef.current = nextIncomplete.id;
                  onFocusStop?.(nextIncomplete.id);
                } else {
                  onFocusStop?.(null);
                }
              });
            }
          };
          const toggleStopDone = () => {
            toggleStopDoneById(row.id, routeIndex, row.isCompleted);
          };

          if (isQuantumTravelRow(row)) {
            const destinationSlug = row.quantumToLocationSlug?.trim() || "";
            const destinationName = destinationSlug
              ? (getLocationBySlug(destinationSlug)?.name ?? destinationSlug)
              : "…";
            return (
              <Fragment key={row.id}>
                <QuantumTravelRow
                  rowId={row.id}
                  fromSlug={row.locationSlug}
                  destinationSlug={destinationSlug || null}
                  destinationName={destinationName}
                  reasonShopSlug={row.reasonShopSlug ?? null}
                  distanceToNext={row.distanceToNext}
                  shipSlug={shipSlug}
                  isCompleted={row.isCompleted}
                  isFocused={isFocused}
                  isCopied={isCopied}
                  onCopy={() => {
                    void copyStarmapName(
                      row.id,
                      getLocationShortName(row.locationSlug),
                    );
                  }}
                  onFocus={() => onFocusStop?.(row.id)}
                  isPending={isPendingComplete}
                  isSavingSection={isQuantumSaving}
                  onToggle={toggleStopDone}
                  onChangeFrom={
                    onUpdateQuantumTravel
                      ? (slug) =>
                          handleQuantumEndpointChange(row.id, {
                            fromSlug: slug,
                          })
                      : undefined
                  }
                  onChangeTo={
                    onUpdateQuantumTravel
                      ? (slug) =>
                          handleQuantumEndpointChange(row.id, {
                            toSlug: slug,
                          })
                      : undefined
                  }
                  footer={addStopFooter(row.id)}
                  isHistoryExpanded={expandedCompletedRowId === row.id}
                  onHistoryExpand={() => {
                    setExpandedCompletedRowId(row.id);
                    onFocusStop?.(row.id);
                  }}
                  onHistoryCollapse={() => setExpandedCompletedRowId(null)}
                />
                {draftingAfterRowId === row.id ? draftComposer : null}
              </Fragment>
            );
          }

          const cargoFallbackRole =
            row.routeAction === "pickup" || row.routeAction === "delivery"
              ? row.routeAction
              : null;
          const cargoLines = describeCargoDeliveries(
            row.cargoDeliveries,
            cargoFallbackRole,
          );
          const expectedCompletions = missionsExpectedToCompleteAtStop(
            missions,
            displayRows,
            row.id,
          );
          const completionAuec = expectedCompletions.reduce(
            (sum, mission) => sum + missionAuecAmount(mission),
            0,
          );
          const completionXp =
            estimateMissionsHaulingRepXp(expectedCompletions);

          const prevRow =
            routeIndex > 0 ? (displayRows[routeIndex - 1] ?? null) : null;
          // Bridge only while the *next* stop is still open — drops once that
          // stop is completed. With history hidden, render it above the next
          // incomplete card so the hop stays visible.
          const bridgeNextDistance =
            row.isCompleted &&
            nextRow != null &&
            !nextRow.isCompleted;
          const historyHiddenBridge =
            hideCompleted &&
            !row.isCompleted &&
            prevRow != null &&
            prevRow.isCompleted &&
            !isQuantumTravelRow(prevRow);
          const historyHiddenBridgeNextName = historyHiddenBridge
            ? (getLocationBySlug(row.locationSlug)?.name ?? row.locationSlug)
            : null;

          // Show-history: collapse completed stops to a strip unless expanded.
          if (
            row.isCompleted &&
            !hideCompleted &&
            expandedCompletedRowId !== row.id
          ) {
            return (
              <Fragment key={row.id}>
                <li
                  ref={(node) => {
                    if (node) rowElsRef.current.set(row.id, node);
                    else rowElsRef.current.delete(row.id);
                  }}
                  aria-checked
                  aria-busy={isRowSectionBusy}
                  aria-current={isFocused ? "step" : undefined}
                  className="scroll-mt-16 border-b border-rsi-divider/80 sm:scroll-mt-24"
                  onClick={() => onFocusStop?.(row.id)}
                >
                  <CompletedStopHistoryRow
                    location={location}
                    step={step}
                    routeAction={row.routeAction}
                    scuTotal={sumCargoScu(row.cargoDeliveries)}
                    hopLabel={(() => {
                      const hop =
                        (nextLocationSlug
                          ? distanceBetweenLocationSlugs(
                              row.locationSlug,
                              nextLocationSlug,
                            )
                          : null) ?? row.distanceToNext;
                      return hop ? formatDistanceToNext(hop) : null;
                    })()}
                    isFocused={isFocused}
                    isPending={isPendingComplete}
                    onToggle={toggleStopDone}
                    onOpen={() => {
                      setExpandedCompletedRowId(row.id);
                      onFocusStop?.(row.id);
                    }}
                  />
                  {bridgeNextDistance && nextRow ? (
                    <NextStopBridgeBand
                      row={row}
                      nextLocationName={nextLocationName}
                      nextLocationSlug={nextLocationSlug}
                      shipSlug={shipSlug}
                      bridgeRef={(node) => {
                        if (node) bridgeElsRef.current.set(nextRow.id, node);
                        else bridgeElsRef.current.delete(nextRow.id);
                      }}
                    />
                  ) : null}
                </li>
                {draftingAfterRowId === row.id ? draftComposer : null}
              </Fragment>
            );
          }

          return (
            <Fragment key={row.id}>
            <li
              ref={(node) => {
                if (node) rowElsRef.current.set(row.id, node);
                else rowElsRef.current.delete(row.id);
              }}
              aria-checked={row.isCompleted}
              aria-busy={isRowSectionBusy}
              aria-current={isFocused ? "step" : undefined}
              className="flex scroll-mt-16 flex-col border-b border-rsi-divider/80 pb-1 sm:scroll-mt-24"
              onClick={() => onFocusStop?.(row.id)}
            >
              {historyHiddenBridge && prevRow ? (
                <NextStopBridgeBand
                  row={prevRow}
                  nextLocationName={historyHiddenBridgeNextName}
                  nextLocationSlug={row.locationSlug}
                  shipSlug={shipSlug}
                  bridgeRef={(node) => {
                    if (node) bridgeElsRef.current.set(row.id, node);
                    else bridgeElsRef.current.delete(row.id);
                  }}
                />
              ) : null}
              <div
                className={[
                  "flex min-h-0 flex-1 flex-col px-3 pt-4.5 pb-1",
                  checklistRowToneClass(row.isCompleted, isFocused),
                ].join(" ")}
              >
                {row.isCompleted &&
                !hideCompleted &&
                expandedCompletedRowId === row.id ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setExpandedCompletedRowId(null);
                    }}
                    className="mb-2 ml-auto block font-mono text-[0.6rem] uppercase tracking-[0.14em] text-rsi-text-muted hover:text-rsi-accent"
                  >
                    Collapse
                  </button>
                ) : null}
                <div className="flex min-h-0 flex-1 gap-3">
                  {/* Desktop: side column aligned to the thumbnail, gutter below. */}
                  <div className="hidden h-14 shrink-0 items-center self-start md:flex">
                    <DoneCheckbox
                      location={location}
                      step={step}
                      isCompleted={row.isCompleted}
                      isActive={isFocused}
                      isPending={isPendingComplete}
                      onToggle={toggleStopDone}
                    />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <LocationHeader
                      row={row}
                      location={location}
                      hasOutdoorFreightElevator={Boolean(
                        locationFixture?.hasOutdoorFreightElevator,
                      )}
                      isCopied={isCopied}
                      onCopy={() => {
                        void copyStarmapName(
                          row.id,
                          getLocationShortName(row.locationSlug),
                        );
                      }}
                    />
                    <div className="mt-5 pb-5">
                      {isRowSectionBusy ? (
                        <p className="mb-2 inline-flex items-center gap-1.5 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-rsi-accent">
                          <Spinner className="size-3" />
                          Saving…
                        </p>
                      ) : null}
                      <CargoGroups
                        row={row}
                        cargoLines={cargoLines}
                        missions={missions}
                        location={location}
                        shipName={transferShipName}
                        transferLedger={
                          transferLedgerByStop.get(row.id) ?? null
                        }
                        pendingCargoKeys={pendingCargoKeys}
                        onToggleCargoHandled={
                          onToggleCargoHandled
                            ? handleCargoToggle
                            : undefined
                        }
                        bayAside={(role) => (
                          <StopDeliveryBayPreview
                            row={row}
                            rows={rows}
                            role={role}
                            onEditMissionBoxes={
                              onSelectBoxBreakdown
                                ? (missionId) => {
                                    const mission = missions.find(
                                      (entry) => entry.id === missionId,
                                    );
                                    if (!mission || mission.isCompleted)
                                      return;
                                    setBoxEditMissionId(missionId);
                                  }
                                : undefined
                            }
                          />
                        )}
                      />
                    </div>
                    <div className="mt-2 w-full md:w-1/2 md:pr-2">
                      <PayoutExpMeta
                        row={row}
                        completionAuec={completionAuec}
                        approxXp={completionXp}
                        completingMissionCount={expectedCompletions.length}
                      />
                    </div>
                    <div className="flex justify-start py-3 md:hidden">
                      <DoneStopButton
                        location={location}
                        step={step}
                        isCompleted={row.isCompleted}
                        isPending={isPendingComplete}
                        onToggle={toggleStopDone}
                      />
                    </div>
                    {sessionId ? (
                      <div
                        className="mt-3 flex justify-start pt-1"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <StopMissionScreenshots
                          refs={screenshotRefsForRow(
                            missions,
                            row,
                            sessionId,
                          )}
                          variant="inline"
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
                {/* Full-width under the checkbox column so it lines up with bridge Next stop. */}
                <div className="mt-auto">
                  <NextDistanceMeta
                    row={row}
                    nextLocationName={nextLocationName}
                    nextLocationSlug={nextLocationSlug}
                    shipSlug={shipSlug}
                    isPending={isPendingComplete}
                    onToggle={
                      row.isCompleted ? undefined : toggleStopDone
                    }
                  />
                </div>
                {addStopFooter(row.id)}
              </div>
            </li>
            {draftingAfterRowId === row.id ? draftComposer : null}
            </Fragment>
          );
        })}
      </ul>
      {boxEditMission && onSelectBoxBreakdown ? (
        <StopMissionBoxConfigModal
          mission={boxEditMission}
          onClose={() => setBoxEditMissionId(null)}
          onSelectBoxBreakdown={(commoditySlug, breakdown, options) => {
            onSelectBoxBreakdown(
              boxEditMission.id,
              commoditySlug,
              breakdown,
              options,
            );
            const lines =
              boxEditMission.cargo?.filter((line) => (line.scu ?? 0) > 0) ??
              [];
            if (lines.length <= 1) {
              setBoxEditMissionId(null);
            }
          }}
        />
      ) : null}
    </div>
  );
});
