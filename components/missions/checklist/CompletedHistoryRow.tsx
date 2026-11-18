"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { formatAuecAmount } from "@/lib/missions/catalogMission";
import {
  formatDistanceToNext,
  type DistanceToNext,
  type HaulingChecklistRow,
  type RouteAction,
} from "@/lib/missions/sessionChecklist";
import { distanceBetweenLocationSlugs } from "@/lib/starmap/distance";
import {
  getLocationImageSrc,
  getLocationShortName,
  getShipIconSrc,
} from "@/lib/fixtures";
import { Badge } from "@/components/ui/Badge";
import { AUEC_TITLE } from "@/lib/ui/abbrevTitles";
import { DoneCheckbox } from "./ChecklistDoneControls";
import { SpaceshipIcon, TravelChevronsIcon } from "./ChecklistIcons";
import { CondensedRowTrailing } from "./ChecklistLocationHeader";

export type ChecklistProgressTimelineStop = {
  id: string;
  locationSlug: string;
  step: number | string;
  isCompleted: boolean;
  isCurrent: boolean;
  isViewing: boolean;
};

/**
 * Route progress timeline (done thumbs → current → next).
 * Horizontal for the mobile checklist band; vertical for the desktop left rail.
 */
export function ChecklistProgressTimeline({
  stops,
  onSelectStop,
  orientation = "horizontal",
}: {
  stops: ChecklistProgressTimelineStop[];
  onSelectStop: (stopId: string) => void;
  orientation?: "horizontal" | "vertical";
}) {
  if (stops.length === 0) return null;
  const isVertical = orientation === "vertical";
  const currentIndex = stops.findIndex((stop) => stop.isCurrent);
  const nextIndex =
    currentIndex >= 0
      ? stops.findIndex(
          (stop, index) => index > currentIndex && !stop.isCompleted,
        )
      : stops.findIndex((stop) => !stop.isCompleted);
  return (
    <ol
      className={
        isVertical
          ? "flex min-w-0 flex-col items-stretch gap-0 px-2 py-2"
          : "flex min-w-0 items-stretch gap-0 overflow-x-auto px-3 py-3"
      }
    >
      {stops.map((stop, index) => {
        const shortName = getLocationShortName(stop.locationSlug);
        const imageSrc = getLocationImageSrc(stop.locationSlug);
        const isLast = index === stops.length - 1;
        const statusLabel = stop.isCurrent
          ? "Current"
          : index === nextIndex
            ? "Next"
            : null;
        const connectorDone = stop.isCompleted;
        const title = statusLabel
          ? `${shortName} · ${statusLabel}`
          : shortName;
        return (
          <li
            key={stop.id}
            data-progress-stop-id={stop.id}
            className={
              isVertical
                ? "flex min-w-0 flex-col items-center"
                : "flex min-w-0 items-start"
            }
          >
            <button
              type="button"
              title={title}
              onClick={() => onSelectStop(stop.id)}
              className={[
                "flex shrink-0 flex-col items-center gap-1.5 rounded-rsi px-1 py-1 text-center transition-colors",
                isVertical ? "w-full max-w-[7.5rem]" : "w-[5.75rem]",
                "hover:bg-rsi-surface-raised/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
                stop.isViewing ? "bg-rsi-accent-muted/30" : "",
              ].join(" ")}
            >
              {!isVertical ? (
                <span className="font-mono text-[0.55rem] tabular-nums tracking-wide text-rsi-text-muted">
                  {stop.step}
                </span>
              ) : null}
              {isVertical && statusLabel === "Next" ? (
                <Badge variant="neutral" size="xs" className="max-w-full truncate">
                  Next
                </Badge>
              ) : null}
              <span
                className={[
                  "relative flex size-9 items-center justify-center overflow-hidden rounded-full bg-rsi-bg-deep sm:size-10",
                  stop.isViewing
                    ? "border-4 border-rsi-accent"
                    : stop.isCompleted
                      ? "border-2 border-rsi-success"
                      : "border-2 border-rsi-border",
                ].join(" ")}
              >
                {imageSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element -- fixture static assets
                  <img
                    src={imageSrc}
                    alt=""
                    className={[
                      "size-full object-cover",
                      stop.isCompleted ? "opacity-70" : "",
                    ].join(" ")}
                    loading="lazy"
                    decoding="async"
                  />
                ) : null}
                {stop.isCompleted ? (
                  <span className="absolute inset-0 flex items-center justify-center bg-rsi-success/35 font-mono text-[0.75rem] text-rsi-success">
                    ✓
                  </span>
                ) : null}
              </span>
              <span
                className={[
                  "w-full truncate text-[0.7rem] font-medium leading-tight",
                  stop.isViewing
                    ? "text-rsi-text"
                    : stop.isCompleted
                      ? "text-rsi-text-muted"
                      : "text-rsi-text-secondary",
                ].join(" ")}
              >
                {shortName}
              </span>
              {isLast ? (
                <Badge variant="neutral" size="xs" className="max-w-full truncate">
                  Last stop
                </Badge>
              ) : !isVertical && statusLabel === "Next" ? (
                <Badge variant="neutral" size="xs" className="max-w-full truncate">
                  Next
                </Badge>
              ) : !isVertical && statusLabel ? (
                <span className="w-full truncate font-mono text-[0.55rem] uppercase tracking-[0.1em] text-rsi-accent">
                  {statusLabel}
                </span>
              ) : null}
            </button>
            {!isLast ? (
              isVertical ? (
                <span
                  aria-hidden
                  className={[
                    "my-0.5 h-3 w-0.5 shrink-0",
                    connectorDone ? "bg-rsi-success/70" : "bg-rsi-border",
                  ].join(" ")}
                />
              ) : (
                <div
                  aria-hidden
                  className="flex shrink-0 flex-col gap-1.5 py-1"
                >
                  {/* Match step label height so the line centers on the thumb. */}
                  <span className="font-mono text-[0.55rem] tabular-nums tracking-wide opacity-0">
                    0
                  </span>
                  <span className="flex h-9 items-center sm:h-10">
                    <span
                      className={[
                        "h-0.5 w-3.5 sm:w-5",
                        connectorDone ? "bg-rsi-success/70" : "bg-rsi-border",
                      ].join(" ")}
                    />
                  </span>
                </div>
              )
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function ProgressRailChevron({ direction }: { direction: "up" | "down" }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className="size-3.5"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d={
          direction === "up"
            ? "M5 12.5 L10 7.5 L15 12.5"
            : "M5 7.5 L10 12.5 L15 7.5"
        }
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Desktop Stops rail: sizes to timeline content, capped at the checklist
 * card height. Header opens the stops modal; when capped content overflows,
 * up/down snap to the next off-screen stop.
 */
export function ChecklistProgressRail({
  stops,
  progressDone,
  progressTotal,
  matchHeightEl,
  onSelectStop,
  onOpenStops,
  distanceTraveled = null,
  distanceTotal = null,
}: {
  stops: ChecklistProgressTimelineStop[];
  progressDone: number;
  progressTotal: number;
  matchHeightEl: HTMLElement | null;
  onSelectStop: (stopId: string) => void;
  onOpenStops?: () => void;
  distanceTraveled?: DistanceToNext | null;
  distanceTotal?: DistanceToNext | null;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [maxRailHeight, setMaxRailHeight] = useState<number | null>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  useEffect(() => {
    if (!matchHeightEl) {
      setMaxRailHeight(null);
      return;
    }
    const update = () => {
      setMaxRailHeight(
        Math.max(0, matchHeightEl.getBoundingClientRect().height),
      );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(matchHeightEl);
    return () => observer.disconnect();
  }, [matchHeightEl]);

  const refreshScrollState = useCallback(() => {
    const scroller = scrollRef.current;
    if (!scroller) {
      setCanScrollUp(false);
      setCanScrollDown(false);
      return;
    }
    const maxScroll = scroller.scrollHeight - scroller.clientHeight;
    setCanScrollUp(scroller.scrollTop > 1);
    setCanScrollDown(maxScroll - scroller.scrollTop > 1);
  }, []);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    refreshScrollState();
    scroller.addEventListener("scroll", refreshScrollState, { passive: true });
    const observer = new ResizeObserver(refreshScrollState);
    observer.observe(scroller);
    return () => {
      scroller.removeEventListener("scroll", refreshScrollState);
      observer.disconnect();
    };
  }, [refreshScrollState, stops, maxRailHeight]);

  const scrollToOffscreenStop = (direction: "up" | "down") => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const nodes = [
      ...scroller.querySelectorAll<HTMLElement>("[data-progress-stop-id]"),
    ];
    if (nodes.length === 0) return;
    const viewTop = scroller.scrollTop;
    const viewBottom = viewTop + scroller.clientHeight;
    const epsilon = 2;

    if (direction === "down") {
      const next = nodes.find((node) => {
        const top = node.offsetTop;
        const bottom = top + node.offsetHeight;
        return bottom > viewBottom + epsilon;
      });
      if (!next) return;
      scroller.scrollTo({ top: next.offsetTop, behavior: "smooth" });
      return;
    }

    const prev = [...nodes].reverse().find((node) => {
      const top = node.offsetTop;
      return top < viewTop - epsilon;
    });
    if (!prev) return;
    const top = Math.max(
      0,
      prev.offsetTop + prev.offsetHeight - scroller.clientHeight,
    );
    scroller.scrollTo({ top, behavior: "smooth" });
  };

  const showDistance = Boolean(distanceTotal || distanceTraveled);
  const traveledLabel = formatDistanceToNext(distanceTraveled);
  const totalDistanceLabel = formatDistanceToNext(distanceTotal);
  const distanceToMeters = (distance: DistanceToNext | null): number | null => {
    if (!distance) return null;
    const factor =
      distance.unit === "m"
        ? 1
        : distance.unit === "km"
          ? 1_000
          : distance.unit === "Mm"
            ? 1_000_000
            : distance.unit === "Gm"
              ? 1_000_000_000
              : null;
    return factor == null ? null : distance.value * factor;
  };
  const traveledMeters = distanceToMeters(distanceTraveled);
  const totalMeters = distanceToMeters(distanceTotal);
  const distanceProgress =
    traveledMeters != null && totalMeters != null && totalMeters > 0
      ? Math.min(1, Math.max(0, traveledMeters / totalMeters))
      : traveledMeters != null && traveledMeters > 0
        ? 1
        : 0;
  const distanceScaleLabel = totalDistanceLabel !== "—"
    ? totalDistanceLabel
    : traveledLabel;

  const stopsHeaderTitle = showDistance
    ? `Stops ${progressDone}/${progressTotal}; traveled ${traveledLabel} of ${totalDistanceLabel}`
    : `Stops ${progressDone}/${progressTotal}`;

  const stopsHeader = (
    <div
      className="flex w-full min-w-0 flex-col items-center gap-1 text-center"
      title={stopsHeaderTitle}
    >
      <span className="font-mono text-[0.5rem] leading-none uppercase tracking-[0.16em] text-rsi-text-muted">
        Stops
      </span>
      <span className="font-mono text-[0.7rem] leading-none tabular-nums tracking-wide text-rsi-text">
        {progressDone}
        <span className="mx-0.5 text-rsi-text-muted">/</span>
        {progressTotal}
      </span>
      {showDistance ? (
        <span className="flex w-full min-w-0 flex-col items-center gap-1 pt-2">
          <span className="font-mono text-[0.45rem] leading-none uppercase tracking-[0.14em] text-rsi-text-muted">
            Distance
          </span>
          <span
            className="relative h-1.5 w-full max-w-[6.75rem] overflow-hidden rounded-full bg-rsi-bg-deep ring-1 ring-inset ring-rsi-border"
            role="progressbar"
            aria-label={`Distance traveled ${traveledLabel} of ${totalDistanceLabel}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(distanceProgress * 100)}
          >
            <span
              className={[
                "absolute inset-y-0 left-0 rounded-full",
                distanceProgress >= 1
                  ? "bg-rsi-success/90"
                  : "bg-rsi-accent/90",
              ].join(" ")}
              style={{ width: `${Math.max(distanceProgress * 100, distanceProgress > 0 ? 6 : 0)}%` }}
            />
          </span>
          <span className="flex w-full max-w-[6.75rem] items-center justify-between gap-1 font-mono text-[0.45rem] leading-none tabular-nums tracking-wide text-rsi-text-muted">
            <span className="text-rsi-text-secondary">{traveledLabel}</span>
            <span>{distanceScaleLabel}</span>
          </span>
        </span>
      ) : null}
    </div>
  );

  const stopsHeaderClass = [
    "flex shrink-0 items-center justify-center border-b border-rsi-divider/60 bg-rsi-bg-deep/40 px-2 py-2",
  ].join(" ");

  return (
    <aside
      aria-label="Stops"
      className="sticky top-1.5 hidden w-[8.75rem] shrink-0 flex-col overflow-hidden rounded-rsi border border-rsi-border bg-rsi-surface/90 shadow-[0_12px_40px_rgba(0,0,0,0.35)] lg:flex"
      style={maxRailHeight != null ? { maxHeight: maxRailHeight } : undefined}
    >
      {onOpenStops ? (
        <button
          type="button"
          onClick={onOpenStops}
          title="Open stops"
          className={[
            stopsHeaderClass,
            "transition-colors hover:bg-rsi-surface-raised/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--rsi-ring)]",
          ].join(" ")}
        >
          {stopsHeader}
        </button>
      ) : (
        <div className={stopsHeaderClass}>{stopsHeader}</div>
      )}

      {canScrollUp ? (
        <button
          type="button"
          aria-label="Show previous stops"
          title="Previous stops"
          onClick={() => scrollToOffscreenStop("up")}
          className={[
            "flex shrink-0 items-center justify-center border-b border-rsi-divider/60 py-1 text-rsi-text-muted transition-colors",
            "hover:bg-rsi-surface-raised/40 hover:text-rsi-text",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--rsi-ring)]",
          ].join(" ")}
        >
          <ProgressRailChevron direction="up" />
        </button>
      ) : null}

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        <ChecklistProgressTimeline
          stops={stops}
          orientation="vertical"
          onSelectStop={onSelectStop}
        />
      </div>

      {canScrollDown ? (
        <button
          type="button"
          aria-label="Show next stops"
          title="Next stops"
          onClick={() => scrollToOffscreenStop("down")}
          className={[
            "flex shrink-0 items-center justify-center border-t border-rsi-divider/60 py-1 text-rsi-text-muted transition-colors",
            "hover:bg-rsi-surface-raised/40 hover:text-rsi-text",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--rsi-ring)]",
          ].join(" ")}
        >
          <ProgressRailChevron direction="down" />
        </button>
      ) : null}
    </aside>
  );
}

export function checklistRowToneClass(
  isCompleted: boolean,
  isFocused: boolean,
): string {
  if (isFocused && isCompleted) {
    return "cursor-pointer bg-rsi-success-muted/50 shadow-[inset_3px_0_0_0_var(--rsi-success)]";
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

/** Compact strip for a cargo stop (completed history or upcoming). */
export function CondensedStopRow({
  location,
  step,
  routeAction,
  scuTotal,
  hopLabel = null,
  hopTitle = null,
  isCompleted = true,
  isFocused,
  isPending,
  onToggle,
  onOpen,
  /** `badges` = route tags only (for tight Next-stop / upcoming chips). */
  trailing = "full",
}: {
  location: string;
  step: number | string;
  routeAction: RouteAction;
  scuTotal: number;
  /** Formatted distance for the hop leaving this stop. */
  hopLabel?: ReactNode;
  hopTitle?: string | null;
  isCompleted?: boolean;
  isFocused: boolean;
  isPending: boolean;
  onToggle: () => void;
  /** Expand condensed strip to the full stop card / focus this stop. */
  onOpen?: () => void;
  trailing?: "full" | "badges";
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
        "flex min-w-0 items-center gap-2.5 px-3 py-2 sm:gap-3",
        onOpen && !isPending ? "cursor-pointer" : "",
        checklistRowToneClass(isCompleted, isFocused),
      ].join(" ")}
    >
      <DoneCheckbox
        location={location}
        step={step}
        isCompleted={isCompleted}
        isActive={isFocused}
        isPending={isPending}
        compact
        onToggle={onToggle}
      />
      <span
        className={[
          "min-w-0 flex-1 truncate text-sm font-medium tracking-wide",
          isCompleted ? "text-rsi-text-secondary" : "text-rsi-text",
        ].join(" ")}
        title={location}
      >
        {location}
      </span>
      <CondensedRowTrailing
        routeAction={routeAction}
        scuTotal={trailing === "full" ? scuTotal : null}
        hopLabel={trailing === "full" ? hopLabel : null}
        hopTitle={trailing === "full" ? hopTitle : null}
        badgesOnly={trailing === "badges"}
      />
    </div>
  );
}

/** Completed history strip — same as CondensedStopRow with isCompleted. */
export function CompletedStopHistoryRow(
  props: Omit<Parameters<typeof CondensedStopRow>[0], "isCompleted">,
) {
  return <CondensedStopRow {...props} isCompleted />;
}

/** Compact strip for a quantum hop (completed history or upcoming). */
export function CondensedQuantumRow({
  fromLabel,
  toLabel,
  hopLabel,
  hopTitle = null,
  isCompleted = true,
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
  isCompleted?: boolean;
  isFocused: boolean;
  isPending: boolean;
  onToggle: () => void;
  /** Expand condensed strip to the full quantum card / focus this stop. */
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
        checklistRowToneClass(isCompleted, isFocused),
      ].join(" ")}
    >
      <DoneCheckbox
        location={routeTitle}
        step="QT"
        isCompleted={isCompleted}
        isActive={isFocused}
        isPending={isPending}
        compact
        onToggle={onToggle}
      />
      <span
        className={[
          "flex min-w-0 flex-1 items-center truncate text-sm font-medium tracking-wide",
          isCompleted ? "text-rsi-text-secondary" : "text-rsi-text",
        ].join(" ")}
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

/** @deprecated Prefer CondensedQuantumRow — alias for completed QT history strips. */
export function CompletedQuantumHistoryRow(
  props: Omit<Parameters<typeof CondensedQuantumRow>[0], "isCompleted">,
) {
  return <CondensedQuantumRow {...props} isCompleted />;
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
  /** `bridge` outside the stop panel; `header` beside the stop title (right). */
  variant?: "inline" | "bridge" | "header";
  isPending?: boolean;
  checkboxColumn?: "inline" | "external";
  /** Whole row marks the owning stop done (same as the Done checkbox). */
  onToggle?: () => void;
}) {
  const isBridge = variant === "bridge";
  const isHeader = variant === "header";
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

  const shellClass = [
    "flex min-w-0 items-center gap-2.5 text-sm sm:gap-3",
    isBridge ? "py-3" : isHeader ? "py-0" : "pt-5",
    isHeader ? "justify-between" : "",
    onToggle
      ? [
          "w-full",
          "text-left",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-rsi-bg",
          isPending ? "cursor-wait" : "cursor-pointer",
        ].join(" ")
      : "",
  ].join(" ");

  const body = (
    <>
      {/* Checkbox column spacer — matches DoneCheckbox when it is not sticky-sibling. */}
      {checkboxColumn === "inline" && !isHeader ? (
        <span
          aria-hidden
          className="hidden w-8 shrink-0 md:inline-flex"
        />
      ) : null}
      {/* Ship + travel chevrons — compact beside the stop title when header. */}
      <span
        className={[
          "inline-flex shrink-0 items-center",
          isHeader
            ? "h-14 w-28 justify-between sm:h-16 sm:w-36"
            : "h-16 w-32 justify-start gap-1.5 sm:h-[4.5rem] sm:w-36",
          isBridge || isHeader ? "text-rsi-accent" : "text-rsi-text-secondary",
        ].join(" ")}
        title="Next stop"
      >
        <span
          className={[
            "inline-flex items-center justify-start overflow-hidden",
            isHeader
              ? "h-12 w-20 sm:h-14 sm:w-24"
              : "h-14 w-24 sm:h-16 sm:w-28",
          ].join(" ")}
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
        <span
          aria-hidden
          className={[
            "inline-flex shrink-0 text-rsi-text-muted",
            isHeader ? "ml-3 sm:ml-4" : "ml-1 sm:ml-1.5",
          ].join(" ")}
          title="Travel"
        >
          <TravelChevronsIcon className="h-4 w-5" />
        </span>
      </span>
      <div
        className={[
          "min-w-0 text-left",
          isHeader
            ? "ml-auto max-w-[calc(100%-7.5rem)] pr-3"
            : "flex-1 pl-4 sm:pl-6",
        ].join(" ")}
      >
        <p className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-rsi-text-muted">
          Next stop
        </p>
        <p
          className={[
            "mt-0.5 text-sm font-medium leading-snug tracking-wide break-words [overflow-wrap:anywhere]",
            isBridge || isHeader
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

/** Last-stop header control — mirrors Next stop layout (mark + copy). */
export function FinishRunTile({
  isCompleted,
  isPending = false,
  onFinish,
}: {
  isCompleted: boolean;
  isPending?: boolean;
  onFinish: () => void;
}) {
  return (
    <button
      type="button"
      disabled={isPending}
      aria-busy={isPending}
      aria-label={
        isPending
          ? "Finishing run…"
          : isCompleted
            ? "Open finish report"
            : "Finish run"
      }
      title={
        isPending
          ? "Finishing…"
          : isCompleted
            ? "Open finish report"
            : "Mark last stop done and finish the run"
      }
      onClick={(event) => {
        event.stopPropagation();
        if (isPending) return;
        onFinish();
      }}
      className={[
        "flex min-w-0 items-center justify-end gap-2.5 rounded-rsi py-0.5 pl-1 pr-0.5 text-right sm:gap-3",
        "transition-colors hover:bg-rsi-success-muted/25",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-rsi-bg",
        isPending ? "cursor-wait opacity-70" : "cursor-pointer",
      ].join(" ")}
    >
      <span
        aria-hidden
        className={[
          "relative inline-flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 sm:size-11",
          isCompleted
            ? "border-rsi-success bg-rsi-success-muted/50 text-rsi-success"
            : "border-rsi-success/80 bg-rsi-bg-deep text-rsi-success shadow-[inset_0_0_12px_0_color-mix(in_srgb,var(--rsi-success)_22%,transparent)]",
        ].join(" ")}
      >
        <svg
          viewBox="0 0 20 20"
          className="size-5"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M5 10.5 L8.5 14 L15 6.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="min-w-0 max-w-[9.5rem]">
        <span className="block text-sm font-medium leading-snug tracking-wide text-rsi-text">
          {isCompleted ? "View report" : "Finish trip"}
        </span>
        <span className="mt-0.5 block font-mono text-[0.65rem] uppercase tracking-[0.14em] text-rsi-text-secondary">
          {isCompleted ? "Summary ready" : "Last stop"}
        </span>
      </span>
    </button>
  );
}
