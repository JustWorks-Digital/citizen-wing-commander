"use client";

import type { ReactNode } from "react";
import { formatAuecAmount } from "@/lib/missions/catalogMission";
import { formatDistanceToNext, type HaulingChecklistRow, type RouteAction } from "@/lib/missions/sessionChecklist";
import { distanceBetweenLocationSlugs } from "@/lib/starmap/distance";
import { getShipIconSrc } from "@/lib/fixtures";
import { AUEC_TITLE } from "@/lib/ui/abbrevTitles";
import { DoneCheckbox } from "./ChecklistDoneControls";
import { SpaceshipIcon, TravelChevronsIcon } from "./ChecklistIcons";
import { CondensedRowTrailing } from "./ChecklistLocationHeader";

export function checklistRowToneClass(
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

export function PayoutExpMeta({
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
            ? "Reward"
            : `${completingMissionCount} rewards`}
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
            +{approxXp.toLocaleString("en-US")}{" "}
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
export const CHECKLIST_RAIL_NEUTRAL =
  "shadow-[inset_3px_0_0_0_var(--rsi-border-strong)]";

export function NextStopBridgeBand({
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
export function CompletedStopHistoryRow({
  location,
  step,
  routeAction,
  scuTotal,
  hopLabel = null,
  hopTitle = null,
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
  hopLabel?: ReactNode;
  hopTitle?: string | null;
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
              // Ignore while Done save is in flight — same click that completed
              // the stop can retarget onto this strip after it condenses.
              if (isPending) return;
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
              if (isPending) return;
              onOpen();
            }
          : undefined
      }
      className={[
        "flex items-center gap-2.5 px-3 py-2 sm:gap-3",
        onOpen && !isPending ? "cursor-pointer" : "",
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
        hopTitle={hopTitle}
      />
    </div>
  );
}

/** Compact history strip for a completed quantum hop. */
export function CompletedQuantumHistoryRow({
  fromLabel,
  toLabel,
  hopLabel,
  hopTitle = null,
  isFocused,
  isPending,
  onToggle,
  onOpen,
}: {
  fromLabel: string;
  toLabel: string;
  hopLabel?: ReactNode;
  /** Full distance string for tooltip (when hopLabel is responsive). */
  hopTitle?: string | null;
  isFocused: boolean;
  isPending: boolean;
  onToggle: () => void;
  /** Expand condensed history to the full quantum card. */
  onOpen?: () => void;
}) {
  const routeTitle = `${fromLabel} → ${toLabel}`;
  return (
    <div
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={
        onOpen
          ? (event) => {
              event.stopPropagation();
              if (isPending) return;
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
              if (isPending) return;
              onOpen();
            }
          : undefined
      }
      className={[
        "flex items-center gap-2.5 px-3 py-2 sm:gap-3",
        onOpen && !isPending ? "cursor-pointer" : "",
        checklistRowToneClass(true, isFocused),
      ].join(" ")}
    >
      <DoneCheckbox
        location={routeTitle}
        step="QT"
        isCompleted
        isActive={isFocused}
        isPending={isPending}
        compact
        onToggle={onToggle}
      />
      <span
        className="flex min-w-0 flex-1 items-center truncate text-sm font-medium tracking-wide text-rsi-text-secondary"
        title={routeTitle}
      >
        <span className="truncate">{fromLabel}</span>
        <TravelChevronsIcon className="mx-2.5 h-3.5 w-4 shrink-0 text-rsi-text-muted sm:mx-3" />
        <span className="truncate">{toLabel}</span>
      </span>
      <CondensedRowTrailing
        routeAction="quantum"
        hopLabel={hopLabel}
        hopTitle={hopTitle}
      />
    </div>
  );
}

export function NextDistanceMeta({
  row,
  nextLocationName,
  nextLocationSlug,
  shipSlug = null,
  variant = "inline",
  isPending = false,
  /** When sticky Done sits in a sibling column, skip the inline spacer. */
  checkboxColumn = "inline",
  onToggle,
}: {
  row: HaulingChecklistRow;
  nextLocationName: string | null;
  nextLocationSlug: string | null;
  shipSlug?: string | null;
  /** `bridge` sits outside the completed (green) panel — keep it readable. */
  variant?: "inline" | "bridge";
  isPending?: boolean;
  checkboxColumn?: "inline" | "external";
  /** Whole row marks the owning stop done (same as the Done checkbox). */
  onToggle?: () => void;
}) {
  const isBridge = variant === "bridge";
  const shipIconSrc = getShipIconSrc(shipSlug);
  const isLastStop = nextLocationSlug == null && nextLocationName == null;
  if (isLastStop) return null;

  const starmapDistance = distanceBetweenLocationSlugs(
    row.locationSlug,
    nextLocationSlug!,
  );
  const distanceRaw = starmapDistance ?? row.distanceToNext;
  const distance = formatDistanceToNext(distanceRaw);
  const distanceCompact = formatDistanceToNext(distanceRaw, { compact: true });

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
      {/* Checkbox column spacer — matches DoneCheckbox when it is not sticky-sibling. */}
      {checkboxColumn === "inline" ? (
        <span
          aria-hidden
          className="hidden w-8 shrink-0 md:inline-flex"
        />
      ) : null}
      {/* Location-thumb column; ship + travel chevrons on active row. */}
      <span
        className={[
          "inline-flex h-16 w-32 shrink-0 items-center justify-start gap-1.5 sm:h-[4.5rem] sm:w-36",
          isBridge ? "text-rsi-accent" : "text-rsi-text-secondary",
        ].join(" ")}
        title="Next stop"
      >
        <span className="inline-flex h-14 w-24 items-center justify-center overflow-hidden sm:h-16 sm:w-28">
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
      {/* Extra left pad after ship + >>> before the Next stop copy. */}
      <div className="min-w-0 flex-1 pl-4 sm:pl-6">
        <p className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-rsi-text-muted">
          Next stop
        </p>
        <p
          className={[
            "mt-0.5 text-sm font-medium leading-snug tracking-wide break-words [overflow-wrap:anywhere]",
            isBridge
              ? "text-rsi-text"
              : row.isCompleted
                ? "text-rsi-text-muted"
                : "text-rsi-text-secondary",
          ].join(" ")}
        >
          {nextLocationName}
        </p>
        {distance ? (
          <p
            className="mt-0.5 font-mono text-[0.65rem] tabular-nums tracking-wide text-rsi-text-secondary"
            title={distance}
          >
            <span className="md:hidden">{distanceCompact}</span>
            <span className="hidden md:inline">{distance}</span>
          </p>
        ) : null}
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
