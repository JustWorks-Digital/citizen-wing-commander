"use client";

import { useState, type ReactNode } from "react";
import { LocationFuzzySearch } from "@/components/ui/LocationFuzzySearch";
import {
  getLocationBySlug,
  getLocationShortName,
  getShipIconSrc,
} from "@/lib/fixtures";
import { getLocationShopBySlug } from "@/lib/fixtures/locationShops";
import { formatDistanceToNext, type HaulingChecklistRow } from "@/lib/missions/sessionChecklist";
import { distanceBetweenLocationSlugs } from "@/lib/starmap/distance";
import { DoneCheckbox, DoneStopButton } from "./ChecklistDoneControls";
import { SpaceshipIcon, TravelChevronIcon } from "./ChecklistIcons";
import { LocationHeader } from "./ChecklistLocationHeader";
import {
  CondensedQuantumRow,
  CompletedQuantumHistoryRow,
  checklistRowToneClass,
} from "./CompletedHistoryRow";

function sameLocationSlug(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function QuantumShipBadge({
  shipSlug,
  className = "h-14 w-24",
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

export function QuantumTravelRow({
  id,
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
  id?: string;
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
  const hopLabelCompact = formatDistanceToNext(hopDistance, { compact: true });
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

  const condensedHopLabel = hopDistance ? (
    <>
      <span className="md:hidden">{hopLabelCompact}</span>
      <span className="hidden md:inline">{hopLabel}</span>
    </>
  ) : null;

  if (isCompleted && !isHistoryExpanded) {
    return (
      <li
        aria-checked
        aria-busy={sectionBusy}
        aria-current={isFocused ? "step" : undefined}
        className={[
          "scroll-mt-20 border-b border-rsi-divider/80 sm:scroll-mt-24",
          isSavingSection ? "opacity-90" : "",
        ].join(" ")}
        onClick={onFocus}
      >
        <CompletedQuantumHistoryRow
          fromLabel={fromShort}
          toLabel={toShort}
          hopLabel={condensedHopLabel}
          hopTitle={hopDistance ? hopLabel : null}
          isFocused={isFocused}
          isPending={isPending || isSavingSection}
          onToggle={onToggle}
          onOpen={onHistoryExpand}
        />
      </li>
    );
  }

  // Upcoming QT: keep the strip condensed until this hop is the active stop.
  if (!isCompleted && !isFocused) {
    return (
      <li
        aria-checked={false}
        aria-busy={sectionBusy}
        className={[
          "scroll-mt-20 border-b border-rsi-divider/80 sm:scroll-mt-24",
          isSavingSection ? "opacity-90" : "",
        ].join(" ")}
        onClick={onFocus}
      >
        <CondensedQuantumRow
          fromLabel={fromShort}
          toLabel={toShort}
          hopLabel={condensedHopLabel}
          hopTitle={hopDistance ? hopLabel : null}
          isCompleted={false}
          isFocused={false}
          isPending={isPending || isSavingSection}
          onToggle={onToggle}
          onOpen={onFocus}
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
        />
      </div>
    );

  /**
   * Same L→R chevron wave as Next stop (`NextDistanceMeta`): always while
   * pending; hover while this hop is still open; settled complete = static.
   */
  const chevronTone = sectionBusy
    ? "text-rsi-accent"
    : isCompleted
      ? "text-rsi-success"
      : isFocused
        ? "text-rsi-text-secondary"
        : "text-rsi-text-muted";
  const chevronWave = sectionBusy || !isCompleted;
  const chevronWaveAlways = sectionBusy;

  const travelChevrons = (
    <>
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
            chevronWave ? { animationDelay: `${index * 50}ms` } : undefined
          }
        />
      ))}
    </>
  );

  const travelBlock =
    editing === "from" || editing === "to" ? null : (
      <div
        className="flex w-full min-w-0 shrink-0 items-center gap-2.5 px-1 py-1 md:min-w-[12rem] md:flex-1 md:self-center sm:gap-3"
        title="Travel"
      >
        <QuantumShipBadge
          shipSlug={shipSlug}
          className="h-12 w-20 sm:h-14 sm:w-24"
        />
        <span className="group/done flex min-w-0 flex-1 items-center gap-2">
          <DoneCheckbox
            location={location}
            step="QT"
            isCompleted={isCompleted}
            isActive={isFocused}
            isPending={isPending || isSavingSection}
            onToggle={onToggle}
          />
          <button
            type="button"
            disabled={sectionBusy}
            aria-label={
              sectionBusy
                ? `Quantum travel, updating: ${location}`
                : isCompleted
                  ? `Quantum travel, mark not done: ${location}`
                  : `Quantum travel, mark done: ${location}`
            }
            title={sectionBusy ? "Updating…" : "Mark this quantum hop done"}
            onClick={(event) => {
              event.stopPropagation();
              if (sectionBusy) return;
              onToggle();
            }}
            className={[
              "flex min-w-4 flex-1 items-center justify-start gap-1 overflow-hidden",
              "[mask-image:linear-gradient(to_right,black_0%,black_calc(100%-0.75rem),transparent)]",
              "[-webkit-mask-image:linear-gradient(to_right,black_0%,black_calc(100%-0.75rem),transparent)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--rsi-ring)]",
              sectionBusy ? "cursor-wait" : "cursor-pointer",
              chevronTone,
            ].join(" ")}
          >
            {travelChevrons}
          </button>
        </span>
      </div>
    );

  const destinationFixture = destinationSlug
    ? getLocationBySlug(destinationSlug)
    : null;
  const destinationStubRow: HaulingChecklistRow = {
    ...stubRow,
    locationSlug: destinationSlug ?? stubRow.locationSlug,
  };

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
    ) : destinationSlug ? (
      <div
        title={
          onChangeTo ? "Double-click to change destination" : undefined
        }
        onDoubleClick={(event) => {
          event.stopPropagation();
          if (onChangeTo) setEditing("to");
        }}
      >
        <LocationHeader
          row={destinationStubRow}
          location={destinationName}
          hasOutdoorFreightElevator={Boolean(
            destinationFixture?.hasOutdoorFreightElevator,
          )}
          isCopied={false}
          onCopy={() => undefined}
          compact
          titleBelow={
            hopDistance ? (
              <p
                className={[
                  "font-mono text-[0.65rem] tabular-nums tracking-wide",
                  isCompleted
                    ? "text-rsi-text-muted"
                    : "text-rsi-text-secondary",
                ].join(" ")}
                title={`Quantum hop ${hopLabel}`}
              >
                <span className="md:hidden">{hopLabelCompact}</span>
                <span className="hidden md:inline">
                  Distance · {hopLabel}
                </span>
              </p>
            ) : null
          }
        />
      </div>
    ) : (
      <div className="flex min-w-0 flex-col gap-0.5">
        <p
          className={[
            "flex min-h-8 min-w-0 items-center text-sm tracking-wide md:h-14 md:text-sm",
            isCompleted ? "text-rsi-text-muted" : "text-rsi-text",
          ].join(" ")}
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
        {hopDistance ? (
          <p
            className={[
              "font-mono text-[0.65rem] tabular-nums tracking-wide",
              isCompleted ? "text-rsi-text-muted" : "text-rsi-text-secondary",
            ].join(" ")}
            title={`Quantum hop ${hopLabel}`}
          >
            <span className="md:hidden">{hopLabelCompact}</span>
            <span className="hidden md:inline">Distance · {hopLabel}</span>
          </p>
        ) : null}
      </div>
    );

  return (
    <li
      id={id}
      aria-checked={isCompleted}
      aria-busy={sectionBusy}
      aria-current={isFocused ? "step" : undefined}
      className={[
        "scroll-mt-20 border-b border-rsi-divider/80 px-3 pt-3 pb-1 sm:scroll-mt-24",
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
      <div className="flex min-w-0 flex-col gap-1.5">
        {/* Mobile: current → Done/ship line → destination. Desktop: 50/50 with ship on left col. */}
        <div className="grid min-w-0 grid-cols-1 gap-2 md:grid-cols-2 md:items-center md:gap-3">
          <div className="flex min-w-0 flex-col gap-2 md:flex-row md:items-center">
            <div className="min-w-0 flex-1">{fromBlock}</div>
            {travelBlock}
          </div>
          <div className="flex min-w-0 flex-col gap-1 md:pl-6 lg:pl-8">
            {toBlock}
            {reasonLabel ? (
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-rsi-text-muted">
                Reason · {reasonLabel}
              </p>
            ) : null}
          </div>
        </div>
        {/* Mobile: Done lives with the ship above; keep a full-width control when travel is hidden (editing). */}
        {travelBlock == null ? (
          <div className="mt-2 md:hidden">
            <DoneStopButton
              location={location}
              step="QT"
              isCompleted={isCompleted}
              isPending={isPending}
              onToggle={onToggle}
            />
          </div>
        ) : null}
      </div>
      {footer}
    </li>
  );
}
