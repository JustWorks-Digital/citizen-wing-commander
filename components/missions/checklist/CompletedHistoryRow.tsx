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
import { Spinner } from "@/components/ui/Spinner";
import { AUEC_TITLE } from "@/lib/ui/abbrevTitles";
import { DoneCheckbox } from "./ChecklistDoneControls";
import {
  SpaceshipIcon,
  TravelChevronIcon,
  TravelChevronsIcon,
  TravelDoubleChevronsIcon,
} from "./ChecklistIcons";
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
  let lastCompletedIndex = -1;
  for (let i = 0; i < stops.length; i += 1) {
    if (stops[i]!.isCompleted) lastCompletedIndex = i;
  }
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
        // Green between completed stops; muted after the latest completed (and open legs).
        const connectorClass =
          stop.isCompleted && index < lastCompletedIndex
            ? "text-rsi-success/80"
            : "text-rsi-text-muted";
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
                "flex shrink-0 flex-col items-center gap-1.5 rounded-rsi px-1 py-2 text-center transition-colors",
                isVertical ? "w-full max-w-[7.5rem]" : "w-[5.75rem]",
                "hover:bg-rsi-surface-raised/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
                stop.isCurrent
                  ? "bg-rsi-accent-muted/30"
                  : stop.isViewing
                    ? "bg-rsi-surface-raised/50"
                    : "",
              ].join(" ")}
            >
              {!isVertical ? (
                <span className="font-mono text-[0.55rem] tabular-nums tracking-wide text-rsi-text-muted">
                  {stop.step}
                </span>
              ) : null}
              <span
                className={[
                  "relative flex size-9 items-center justify-center overflow-hidden rounded-full bg-rsi-bg-deep sm:size-10",
                  stop.isCurrent
                    ? "border-4 border-rsi-accent"
                    : stop.isViewing
                      ? "border-4 border-rsi-text/70"
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
                      stop.isCompleted ? "opacity-45" : "",
                    ].join(" ")}
                    loading="lazy"
                    decoding="async"
                  />
                ) : null}
                {stop.isCompleted ? (
                  <span
                    aria-hidden
                    className="absolute inset-0 flex items-center justify-center bg-rsi-success/55"
                  >
                    <span className="flex size-5 items-center justify-center rounded-full bg-rsi-success font-mono text-[0.85rem] font-bold leading-none text-rsi-bg-deep shadow-[0_1px_2px_rgba(0,0,0,0.45)] sm:size-6 sm:text-[0.95rem]">
                      ✓
                    </span>
                  </span>
                ) : null}
                {isVertical && statusLabel === "Next" ? (
                  <span
                    aria-hidden
                    className="absolute inset-0 flex items-center justify-center bg-rsi-bg-deep/55"
                  >
                    <Badge
                      variant="neutral"
                      size="xs"
                      className="max-w-[calc(100%-0.25rem)] truncate px-0.5"
                    >
                      Next
                    </Badge>
                  </span>
                ) : null}
              </span>
              <span
                className={[
                  "w-full truncate text-[0.7rem] font-medium leading-tight",
                  stop.isCurrent || stop.isViewing
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
                    "my-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center",
                    connectorClass,
                  ].join(" ")}
                >
                  {/* Right-pointing pair → rotate so they stack pointing down. */}
                  <TravelDoubleChevronsIcon className="h-3.5 w-4 rotate-90" />
                </span>
              ) : (
                <div
                  aria-hidden
                  className="flex shrink-0 flex-col gap-1.5 py-1"
                >
                  {/* Match step label height so chevrons center on the thumb. */}
                  <span className="font-mono text-[0.55rem] tabular-nums tracking-wide opacity-0">
                    0
                  </span>
                  <span
                    className={["flex h-9 items-center sm:h-10", connectorClass].join(
                      " ",
                    )}
                  >
                    <TravelDoubleChevronsIcon className="h-4 w-3.5 sm:h-[1.125rem] sm:w-4" />
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
 * card height. Cap only grows (high-water) so collapsing the open stop
 * accordion does not shrink the rail to the short tab stack. Header opens
 * the stops modal; when capped content overflows, up/down snap to the next
 * off-screen stop.
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
  const heightHighWaterRef = useRef(0);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const stopsSignature = stops.map((stop) => stop.id).join("\0");

  useEffect(() => {
    heightHighWaterRef.current = 0;
    setMaxRailHeight(null);
  }, [stopsSignature]);

  useEffect(() => {
    if (!matchHeightEl) {
      heightHighWaterRef.current = 0;
      setMaxRailHeight(null);
      return;
    }
    const update = () => {
      const next = Math.max(0, matchHeightEl.getBoundingClientRect().height);
      // Never shrink with the checklist — only raise the ceiling.
      if (next <= heightHighWaterRef.current) return;
      heightHighWaterRef.current = next;
      setMaxRailHeight(next);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(matchHeightEl);
    return () => observer.disconnect();
  }, [matchHeightEl, stopsSignature]);

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
        // Match CondensedStopRow chrome; completed QT omits the Done mark.
        "flex min-w-0 items-center gap-2.5 px-3 py-2 sm:gap-3",
        onOpen && !isPending ? "cursor-pointer" : "",
        checklistRowToneClass(isCompleted, isFocused),
      ].join(" ")}
    >
      {!isCompleted ? (
        <DoneCheckbox
          location={routeTitle}
          step="QT"
          isCompleted={false}
          isActive={isFocused}
          isPending={isPending}
          compact
          onToggle={onToggle}
        />
      ) : null}
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
  /** Stop label for the Done control before the ship. */
  locationLabel,
  step,
  isActive = false,
  onToggle,
}: {
  row: HaulingChecklistRow;
  nextLocationName: string | null;
  nextLocationSlug: string | null;
  shipSlug?: string | null;
  /** `header` beside the stop title (right); default `inline`. */
  variant?: "inline" | "header";
  isPending?: boolean;
  locationLabel?: string;
  step?: number | string;
  isActive?: boolean;
  /** Done checkbox before the ship — marks this stop finished. */
  onToggle?: () => void;
}) {
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
  const doneLocation = locationLabel ?? nextLocationName ?? row.locationSlug;
  const doneStep = step ?? "";

  const shellClass = [
    "flex min-w-0 items-center gap-2 text-sm sm:gap-2.5",
    isHeader ? "py-0" : "pt-5",
  ].join(" ");

  const chevronTone = isPending
    ? "text-rsi-accent"
    : row.isCompleted
      ? "text-rsi-success"
      : isActive
        ? "text-rsi-text-secondary"
        : "text-rsi-text-muted/50";
  /**
   * L→R travel wave: hover while open; always while Done is pending/blue
   * (optimistic complete can flip `isCompleted` before pending clears — still
   * wave in accent). Settled complete = static green.
   */
  const chevronWave = isPending || !row.isCompleted;
  const chevronWaveAlways = isPending;
  const nextStopClass = [
    "min-w-0 shrink-0 text-left",
    isHeader
      ? "max-w-[min(100%,14rem)] pr-1 sm:max-w-[16rem]"
      : "max-w-[min(100%,18rem)]",
  ].join(" ");
  const nextStopCopy = (
    <>
      <p className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-rsi-text-muted">
        Next stop
      </p>
            <p
              className={[
                "mt-0.5 text-sm font-medium leading-snug tracking-wide break-words [overflow-wrap:anywhere]",
                isHeader
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
    </>
  );
  const markDone = () => {
    if (isPending || !onToggle) return;
    onToggle();
  };

  return (
    <div className={shellClass}>
      <span
        className={[
          "inline-flex shrink-0 items-center justify-start overflow-hidden",
          isHeader
            ? "h-12 w-20 sm:h-14 sm:w-24"
            : "h-14 w-24 sm:h-16 sm:w-28",
          isHeader ? "text-rsi-accent" : "text-rsi-text-secondary",
        ].join(" ")}
        title="Next stop"
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
      {/* Checkbox + chevrons share hover; chevron click marks the stop done. */}
      <span
        className={[
          "group/done flex min-w-0 flex-1 items-center gap-2",
          isHeader ? "h-14 sm:h-16" : "h-16 sm:h-[4.5rem]",
        ].join(" ")}
      >
        {onToggle ? (
          <DoneCheckbox
            location={doneLocation}
            step={doneStep}
            isCompleted={row.isCompleted}
            isActive={isActive}
            isPending={isPending}
            onToggle={onToggle}
          />
        ) : null}
        {onToggle ? (
          <button
            type="button"
            disabled={isPending}
            aria-label={
              isPending
                ? `Stop ${doneStep}, updating: ${doneLocation}`
                : `Stop ${doneStep}, mark done: ${doneLocation}`
            }
            title={isPending ? "Updating stop…" : "Mark this stop done"}
            onClick={(event) => {
              event.stopPropagation();
              markDone();
            }}
            className={[
              "flex min-w-4 flex-1 items-center justify-start gap-1 overflow-hidden",
              "[mask-image:linear-gradient(to_right,black_0%,black_calc(100%-0.75rem),transparent)]",
              "[-webkit-mask-image:linear-gradient(to_right,black_0%,black_calc(100%-0.75rem),transparent)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--rsi-ring)]",
              isPending ? "cursor-wait" : "cursor-pointer",
              chevronTone,
            ].join(" ")}
          >
            {Array.from({ length: 40 }, (_, index) => (
              <TravelChevronIcon
                key={index}
                className={[
                  "h-3.5 w-2 shrink-0 sm:h-4 sm:w-2.5",
                  chevronWave
                    ? chevronWaveAlways
                      ? "opacity-40 animate-rsi-done-chevron-wave"
                      : "opacity-40 group-hover/done:text-rsi-text group-hover/done:animate-rsi-done-chevron-wave"
                    : "",
                ].join(" ")}
                style={
                  chevronWave
                    ? { animationDelay: `${index * 50}ms` }
                    : undefined
                }
              />
            ))}
          </button>
        ) : (
          <span
            aria-hidden
            title="Travel"
            className={[
              "flex min-w-4 flex-1 items-center justify-start gap-1 overflow-hidden",
              "[mask-image:linear-gradient(to_right,black_0%,black_calc(100%-0.75rem),transparent)]",
              "[-webkit-mask-image:linear-gradient(to_right,black_0%,black_calc(100%-0.75rem),transparent)]",
              chevronTone,
            ].join(" ")}
          >
            {Array.from({ length: 40 }, (_, index) => (
              <TravelChevronIcon
                key={index}
                className={[
                  "h-3.5 w-2 shrink-0 sm:h-4 sm:w-2.5",
                  chevronWave
                    ? chevronWaveAlways
                      ? "opacity-40 animate-rsi-done-chevron-wave"
                      : "opacity-40 group-hover/done:text-rsi-text group-hover/done:animate-rsi-done-chevron-wave"
                    : "",
                ].join(" ")}
                style={
                  chevronWave
                    ? { animationDelay: `${index * 50}ms` }
                    : undefined
                }
              />
            ))}
          </span>
        )}
      </span>
      {onToggle ? (
        <button
          type="button"
          disabled={isPending}
          aria-label={
            isPending
              ? `Stop ${doneStep}, updating: ${doneLocation}`
              : row.isCompleted
                ? `Stop ${doneStep}, mark not done: ${doneLocation}`
                : `Stop ${doneStep}, mark done: ${doneLocation}`
          }
          title={
            isPending
              ? "Updating stop…"
              : row.isCompleted
                ? "Mark this stop not done"
                : "Mark this stop done"
          }
          onClick={(event) => {
            event.stopPropagation();
            markDone();
          }}
          className={[
            nextStopClass,
            "rounded-rsi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--rsi-ring)]",
            isPending
              ? "cursor-wait"
              : "cursor-pointer hover:bg-rsi-surface-raised/35",
          ].join(" ")}
        >
          {nextStopCopy}
        </button>
      ) : (
        <div className={nextStopClass}>{nextStopCopy}</div>
      )}
    </div>
  );
}

/** Last-stop header — Done-sized finish mark left of Finish trip / View report. */
export function FinishRunTile({
  location,
  step,
  isCompleted,
  isActive = false,
  isPending = false,
  onToggle,
  onOpenSummary,
}: {
  location: string;
  step: number | string;
  isCompleted: boolean;
  isActive?: boolean;
  isPending?: boolean;
  /** Mark last stop done / undone (same behavior as DoneCheckbox). */
  onToggle: () => void;
  /** When the last stop is already done — open the finish report. */
  onOpenSummary?: () => void;
}) {
  return (
    <div className="flex min-w-0 items-center justify-end gap-2.5 rounded-rsi py-0.5 pl-1 pr-0.5 sm:gap-3">
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
          // Larger finish mark, DoneCheckbox tones: unchecked until completed.
          "group relative inline-flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 sm:size-11",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-rsi-bg",
          isPending
            ? "cursor-wait border-rsi-accent/50 bg-rsi-bg-deep/40 text-rsi-accent"
            : isCompleted
              ? "border-rsi-success bg-rsi-success-muted/50 text-rsi-success"
              : isActive
                ? "border-rsi-text-secondary/70 bg-rsi-bg-deep/40 text-rsi-text-secondary hover:border-rsi-text hover:text-rsi-text"
                : "border-rsi-border bg-rsi-bg-deep/40 text-rsi-text-muted/50 hover:border-rsi-border-strong hover:text-rsi-text",
        ].join(" ")}
      >
        {isPending ? (
          <Spinner className="size-5" />
        ) : (
          <svg
            aria-hidden
            viewBox="0 0 20 20"
            className={[
              "size-5",
              isCompleted ? "" : "opacity-40 group-hover:opacity-100",
            ].join(" ")}
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
        )}
      </button>
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
          if (isCompleted) {
            onOpenSummary?.();
            return;
          }
          onToggle();
        }}
        className={[
          "min-w-0 max-w-[9.5rem] rounded-rsi text-right transition-colors",
          "hover:bg-rsi-success-muted/25",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-rsi-bg",
          isPending ? "cursor-wait opacity-70" : "cursor-pointer",
        ].join(" ")}
      >
        <span className="block text-sm font-medium leading-snug tracking-wide text-rsi-text">
          {isCompleted ? "View report" : "Finish trip"}
        </span>
        <span className="mt-0.5 block font-mono text-[0.65rem] uppercase tracking-[0.14em] text-rsi-text-secondary">
          {isCompleted ? "Summary ready" : "Last stop"}
        </span>
      </button>
    </div>
  );
}
