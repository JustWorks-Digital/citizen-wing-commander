"use client";

import { useState, type ReactNode } from "react";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { getLocationImageSrc, getLocationShortName } from "@/lib/fixtures";
import type { RouteAction } from "@/lib/missions/sessionChecklist";
import type { HaulingChecklistRow } from "@/lib/missions/sessionChecklist";
import { SCU_TITLE } from "@/lib/ui/abbrevTitles";
import { OutdoorFreightBadge } from "../OutdoorFreightBadge";
import { CopyIcon, PlusIcon, TravelChevronsIcon } from "./ChecklistIcons";

function routeActionBadges(routeAction: RouteAction): { label: string; variant: BadgeVariant }[] {
  if (routeAction === "quantum") {
    return [{ label: "Quantum", variant: "neutral" }];
  }
  if (routeAction === "pickup") {
    return [{ label: "Pick up", variant: "accent" }];
  }
  if (routeAction === "delivery") {
    return [{ label: "Delivery", variant: "success" }];
  }
  return [
    { label: "Delivery", variant: "success" },
    { label: "Pick up", variant: "accent" },
  ];
}

export function CondensedRowTrailing({
  routeAction,
  scuTotal = null,
  hopLabel = null,
  hopTitle = null,
}: {
  routeAction: RouteAction;
  scuTotal?: number | null;
  hopLabel?: ReactNode;
  /** Full distance string for tooltip (when hopLabel is responsive). */
  hopTitle?: string | null;
}) {
  const titleText =
    hopTitle ?? (typeof hopLabel === "string" ? hopLabel : null);
  return (
    <div className="grid w-[13.5rem] shrink-0 grid-cols-[minmax(5.75rem,1fr)_2.5rem_3.25rem] items-center gap-x-1 md:w-[18.75rem] md:grid-cols-[minmax(0,1fr)_3.5rem_4.75rem] md:gap-x-2.5">
      <div className="flex min-w-0 flex-nowrap items-center justify-end gap-1.5 md:gap-2">
        {routeActionBadges(routeAction).map((badge) => (
          <Badge key={badge.label} variant={badge.variant} size="sm">
            {badge.label}
          </Badge>
        ))}
      </div>
      <div
        className="whitespace-nowrap text-right font-mono text-[0.65rem] tabular-nums tracking-wide text-rsi-text-muted"
        title={scuTotal != null ? SCU_TITLE : undefined}
      >
        {scuTotal != null ? (
          <>
            {scuTotal}
            <span className="ml-0.5 text-[0.5rem] uppercase tracking-[0.1em] text-rsi-text-muted/80">
              SCU
            </span>
          </>
        ) : null}
      </div>
      <div
        className="whitespace-nowrap text-right font-mono text-[0.65rem] tabular-nums tracking-wide text-rsi-text-muted"
        title={
          titleText
            ? routeAction === "quantum"
              ? `Quantum hop ${titleText}`
              : `Distance ${titleText}`
            : undefined
        }
      >
        {hopLabel ?? null}
      </div>
    </div>
  );
}

export function LocationHeader({
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
  titleBelow = null,
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
  /** Directly under the full location title (e.g. quantum hop distance). */
  titleBelow?: ReactNode;
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
          "flex min-h-14 min-w-0 flex-1 flex-col justify-center gap-1",
          align === "end" ? "items-stretch" : "",
          showTravelChevron ? "" : "sm:min-h-14",
        ].join(" ")}
      >
        <div
          className={[
            "flex min-w-0 items-center gap-x-2 gap-y-1",
            showTravelChevron ? "justify-between" : "",
          ].join(" ")}
        >
          <span
            className={[
              "inline-flex min-w-0 max-w-full items-center gap-2 text-left text-sm font-semibold tracking-wide sm:text-base",
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
        {titleBelow ? (
          <div className="mt-0.5 min-w-0">{titleBelow}</div>
        ) : null}
        {showRouteAction || showLocationTags ? (
          <div
            className={[
              "flex flex-nowrap items-center gap-2 sm:gap-2.5",
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

export function AddStopAfterButton({
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
