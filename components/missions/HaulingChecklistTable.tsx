"use client";

import {
  memo,
  startTransition,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import {
  describeCargoDeliveries,
  getCommodityIconSrc,
  getLocationBySlug,
  getLocationImageSrc,
} from "@/lib/fixtures";
import {
  commodityBadgeBackground,
  commodityBadgeBorder,
  commodityBadgeForeground,
  resolveCommodityColorHex,
} from "@/lib/fixtures/commodityColors";
import { formatAuecAmount } from "@/lib/missions/catalogMission";
import { missionsExpectedToCompleteAtStop } from "@/lib/missions/expectedCompletions";
import {
  formatDistanceToNext,
  type HaulingChecklistRow,
  type LegKind,
} from "@/lib/missions/mockSession";
import { abbreviateCommodityName } from "@/lib/missions/stopDeliveryBoxes";
import {
  estimateOnboardScuByStop,
  type StopOnboardScuReceipt,
} from "@/lib/missions/cargoInventory";
import { stripRankFromTitle } from "@/lib/missions/missionRank";
import { screenshotRefsForRow } from "@/lib/missions/rowMissionScreenshots";
import type { SessionMission } from "@/lib/missions/sessionMissions";
import { distanceBetweenLocationSlugs } from "@/lib/starmap/distance";
import { OutdoorFreightBadge } from "./OutdoorFreightBadge";
import { SessionMissionDetailModal } from "./SessionMissionDetailModal";
import { StopDeliveryBayPreview } from "./StopDeliveryBayPreview";
import { StopMissionScreenshots } from "./StopMissionScreenshots";

export type HaulingChecklistTableProps = {
  rows: HaulingChecklistRow[];
  onToggle: (rowId: string) => void;
  /** Stop shown in cargo layout — any stop, including completed. */
  focusedStopId?: string | null;
  /** Click a row (not checkbox / copy) to preview that stop. */
  onFocusStop?: (rowId: string) => void;
  /** Left side of the toolbar (e.g. Missions / Stops / Cargo stats). */
  toolbarStart?: ReactNode;
  /** Right side of the toolbar, left of Hide history (e.g. total time). */
  toolbarEnd?: ReactNode;
  /** Session ship display name for pickup transfer labels. */
  shipName?: string | null;
  /** Session missions — used to attach contract screenshot refs per stop. */
  missions?: SessionMission[];
  /** Session id (screenshot batch) for image URLs. */
  sessionId?: string | null;
  /** Toggle shared pickup/delivery brick handled state (persisted). */
  onToggleCargoHandled?: (rowId: string, cargoIndex: number) => void;
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

function CompletedStamp() {
  return (
    <span
      aria-hidden
      className="pointer-events-none inline-flex rotate-[-22deg] select-none"
    >
      <svg
        viewBox="0 0 120 120"
        className="size-[7.5rem] text-rsi-success"
        role="img"
      >
        <circle
          cx="60"
          cy="60"
          r="54"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          opacity="0.75"
        />
        <circle
          cx="60"
          cy="60"
          r="46"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="3 2.5"
          opacity="0.55"
        />
        <path
          d="M36 64 L52 78 L86 44"
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.7"
        />
      </svg>
    </span>
  );
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
        "group inline-flex size-8 shrink-0 items-center justify-center rounded-full border transition-colors",
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

/** Touch-friendly stop complete control for narrow layouts. */
function DoneStopButton({
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
      aria-pressed={isCompleted}
      aria-label={
        isCompleted
          ? `Stop ${step}, mark incomplete: ${location}`
          : `Stop ${step}, mark complete: ${location}`
      }
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      className={[
        "inline-flex min-h-10 w-auto min-w-[8.5rem] items-center justify-center rounded-rsi border px-3 font-mono text-[0.65rem] uppercase tracking-[0.14em] transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-rsi-bg",
        isCompleted
          ? "border-rsi-success/50 bg-rsi-success-muted text-rsi-success"
          : "border-rsi-border bg-rsi-bg-deep/70 text-rsi-text-secondary active:border-rsi-accent/50 active:text-rsi-accent",
      ].join(" ")}
    >
      {isCompleted ? "Complete" : "Mark complete"}
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

function CargoGroups({
  row,
  cargoLines,
  onToggleCargoHandled,
}: {
  row: HaulingChecklistRow;
  cargoLines: CargoLine[];
  onToggleCargoHandled?: (rowId: string, cargoIndex: number) => void;
}) {
  const groups = groupCargoLines(cargoLines);

  return (
    <div className="flex flex-col gap-5 text-sm md:gap-2">
      {groups.map((group, groupIndex) => {
        const roleClass =
          group.role === "pickup"
            ? "text-rsi-accent"
            : group.role === "delivery"
              ? "text-rsi-gold"
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
        const isPickup = group.role === "pickup";
        const handledVerb = isPickup ? "picked up" : "delivered";

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
              "flex flex-col gap-1",
              showRoleDivider
                ? "border-t border-rsi-divider pt-2 md:pt-1.5"
                : "",
            ].join(" ")}
          >
            {group.role ? (
              <span
                className={[
                  "mb-2 w-fit border-b pb-0.5 font-mono text-[0.65rem] uppercase tracking-[0.16em]",
                  roleClass,
                  group.role === "pickup"
                    ? "border-rsi-accent/45"
                    : "border-rsi-gold/45",
                ].join(" ")}
              >
                {group.role === "pickup" ? "Collect" : "Drop off"}
              </span>
            ) : null}
            <div className="grid max-w-[19rem] grid-cols-5 gap-1.5">
              {group.items.map((line, index) => {
                const tileId = `${row.id}-${group.role ?? "none"}-${line.commoditySlug}-${line.scu}-${line.sourceIndex ?? index}`;
                const cleared = line.isHandled;
                const canToggle =
                  Boolean(onToggleCargoHandled) && line.sourceIndex != null;
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
                      cleared
                        ? `${fullLabel} · marked ${handledVerb}`
                        : `${fullLabel} · click to mark ${handledVerb}`
                    }
                    aria-label={fullLabel}
                    aria-pressed={cleared}
                    disabled={!canToggle}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (line.sourceIndex == null) return;
                      onToggleCargoHandled?.(row.id, line.sourceIndex);
                    }}
                    className={[
                      "relative inline-flex aspect-square w-full flex-col items-center justify-center gap-0.5 rounded-rsi border px-1 font-mono font-medium tabular-nums",
                      "transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
                      canToggle ? "cursor-pointer" : "cursor-default",
                      doneClass,
                      cleared ? "opacity-40" : "",
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
                    <span className="text-[0.5rem] uppercase leading-none tracking-[0.12em] opacity-90">
                      {abbrev}
                    </span>
                    {cleared ? (
                      <CargoTileHandledMark isPickup={isPickup} />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const LOCATION_TITLE_MAX_CHARS = 48;

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
  const imageSrc = getLocationImageSrc(row.locationSlug);

  return (
    <div
      className={[
        "flex gap-3",
        align === "end" ? "w-full flex-row-reverse" : "items-start",
      ].join(" ")}
    >
      {imageSrc ? (
        <div
          className={[
            "relative h-14 w-24 shrink-0 overflow-hidden rounded-lg border border-rsi-border/80 bg-rsi-bg-deep/60",
            row.isCompleted ? "opacity-70" : "",
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
        </div>
      ) : null}
      <div
        className={[
          "flex min-w-0 flex-1 flex-col gap-2",
          align === "end" ? "items-stretch" : "",
        ].join(" ")}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <span
            className={[
              "min-w-0 truncate text-left text-lg font-semibold tracking-wide sm:text-xl",
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
              // Slight drop so the icon sits on the title’s optical center
              // without changing title metrics (keeps title ↔ image alignment).
              "inline-flex size-5 shrink-0 translate-y-0.5 items-center justify-center rounded-rsi border transition-colors",
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
    </div>
  );
}

function TransferArrow() {
  return (
    <span
      aria-hidden
      className="flex shrink-0 self-center px-3 text-rsi-text-muted sm:px-7"
    >
      <svg
        viewBox="0 0 30 20"
        className="h-4 w-[1.35rem]"
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
    strike: isDone ? "line-through" : "",
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
  children,
}: {
  title: string;
  isDone: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={[
        "mr-auto grid w-fit grid-cols-[auto_auto_auto] items-start gap-x-2 py-5 sm:gap-x-4",
        isDone ? "text-rsi-text-muted" : "",
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
        {suffix}
      </span>
    </p>
  );
}

function PickupTransferBlock({
  location,
  shipName,
  receipt,
  isDone,
}: {
  location: string;
  shipName: string;
  receipt: StopOnboardScuReceipt;
  isDone: boolean;
}) {
  const { strike, mute } = transferToneClasses(isDone);
  const afterPickup = receipt.beforeDelivery;

  return (
    <TransferBlockFrame
      title={`Load ${receipt.pickup} SCU from ${location}`}
      isDone={isDone}
    >
      <TransferColumnLabel>Station</TransferColumnLabel>
      <span aria-hidden className="col-start-2" />
      <TransferColumnLabel>Ship</TransferColumnLabel>

      <p
        className={[
          "mb-2.5 max-w-[20rem] self-center text-sm font-medium leading-5",
          isDone ? mute : "text-rsi-text-muted",
          strike,
        ].join(" ")}
        title={location}
      >
        {location}
      </p>
      <div className="mb-2.5 flex items-center self-center">
        <TransferArrow />
      </div>
      <p
        className={[
          "mb-2.5 max-w-[20rem] self-center text-sm font-medium leading-5",
          isDone ? mute : "text-rsi-text-muted",
          strike,
        ].join(" ")}
        title={shipName}
      >
        {shipName}
      </p>

      <span aria-hidden className="col-start-1" />
      <div className="col-start-3">
        <TransferScuLine
          amount={String(receipt.beforePickup)}
          suffix="aboard"
          tone="text-rsi-text-muted"
          strike={strike}
          mute={mute}
          isDone={isDone}
        />
      </div>

      <div className="col-start-1">
        <TransferScuLine
          amount={`−${receipt.pickup}`}
          suffix="loading"
          tone="text-rsi-danger"
          strike={strike}
          mute={mute}
          isDone={isDone}
        />
      </div>
      <div className="col-start-3">
        <TransferScuLine
          amount={`+${receipt.pickup}`}
          suffix="receiving"
          tone="text-rsi-success"
          strike={strike}
          mute={mute}
          isDone={isDone}
        />
      </div>

      <span aria-hidden className="col-start-1" />
      <div className="col-start-3 w-fit">
        <div
          aria-hidden
          className={[
            "mb-1 border-t",
            isDone ? "border-rsi-divider" : "border-rsi-border-strong",
          ].join(" ")}
        />
        <TransferScuLine
          amount={String(afterPickup)}
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
  receipt,
  isDone,
}: {
  location: string;
  shipName: string;
  receipt: StopOnboardScuReceipt;
  isDone: boolean;
}) {
  const { strike, mute } = transferToneClasses(isDone);

  return (
    <TransferBlockFrame
      title={`Transfer ${receipt.delivery} SCU to ${location}`}
      isDone={isDone}
    >
      <TransferColumnLabel>Ship</TransferColumnLabel>
      <span aria-hidden className="col-start-2" />
      <TransferColumnLabel>Station</TransferColumnLabel>

      <p
        className={[
          "mb-2.5 max-w-[20rem] self-center text-sm font-medium leading-5",
          isDone ? mute : "text-rsi-text-muted",
          strike,
        ].join(" ")}
        title={shipName}
      >
        {shipName}
      </p>
      <div className="mb-2.5 flex items-center self-center">
        <TransferArrow />
      </div>
      <p
        className={[
          "mb-2.5 max-w-[20rem] self-center text-sm font-medium leading-5",
          isDone ? mute : "text-rsi-text-muted",
          strike,
        ].join(" ")}
        title={location}
      >
        {location}
      </p>

      <div className="col-start-1">
        <TransferScuLine
          amount={String(receipt.beforeDelivery)}
          suffix="aboard"
          tone="text-rsi-text-muted"
          strike={strike}
          mute={mute}
          isDone={isDone}
        />
      </div>
      <span aria-hidden className="col-start-3" />

      <div className="col-start-1">
        <TransferScuLine
          amount={`−${receipt.delivery}`}
          suffix="delivering"
          tone="text-rsi-danger"
          strike={strike}
          mute={mute}
          isDone={isDone}
        />
      </div>
      <div className="col-start-3">
        <TransferScuLine
          amount={`+${receipt.delivery}`}
          suffix="receiving"
          tone="text-rsi-success"
          strike={strike}
          mute={mute}
          isDone={isDone}
        />
      </div>

      <div className="col-start-1 w-fit">
        <div
          aria-hidden
          className={[
            "mb-1 border-t",
            isDone ? "border-rsi-divider" : "border-rsi-border-strong",
          ].join(" ")}
        />
        <TransferScuLine
          amount={String(receipt.after)}
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

function TotalMeta({
  row,
  location,
  shipName,
  onboardReceipt,
}: {
  row: HaulingChecklistRow;
  /** Station for this stop (load source or unload destination). */
  location: string;
  /** Session ship display name for pickup transfers. */
  shipName: string;
  /** Planned bay load before/after this stop. */
  onboardReceipt?: StopOnboardScuReceipt | null;
}) {
  const showPickup = onboardReceipt != null && onboardReceipt.pickup > 0;
  const showDelivering =
    onboardReceipt != null && onboardReceipt.delivery > 0;

  if (!showPickup && !showDelivering) return null;

  return (
    <div className="space-y-0 text-sm">
      {showPickup ? (
        <PickupTransferBlock
          location={location}
          shipName={shipName}
          receipt={onboardReceipt!}
          isDone={row.isCompleted}
        />
      ) : null}
      {showDelivering ? (
        <DeliveryTransferBlock
          location={location}
          shipName={shipName}
          receipt={onboardReceipt!}
          isDone={row.isCompleted}
        />
      ) : null}
    </div>
  );
}

function PayoutMeta({
  row,
  completionAuec,
  completingMissionCount,
}: {
  row: HaulingChecklistRow;
  completionAuec: number;
  completingMissionCount: number;
}) {
  if (completingMissionCount <= 0) return null;

  return (
    <div
      className="py-5 text-sm"
      title={
        completionAuec > 0
          ? `Payout ${formatAuecAmount(completionAuec)}`
          : "aUEC not available"
      }
    >
      <p className="mb-2 w-fit border-b border-rsi-text-muted/45 pb-0.5 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-rsi-text-muted">
        Payout
      </p>
      <p
        className={[
          "text-sm font-medium leading-snug text-rsi-text-muted",
          row.isCompleted ? "line-through" : "",
        ].join(" ")}
      >
        {completingMissionCount === 1
          ? "Contract reward"
          : `${completingMissionCount} contract rewards`}
      </p>
      {completionAuec > 0 ? (
        <p
          className={[
            "mt-1 font-mono text-sm tabular-nums tracking-wide",
            row.isCompleted
              ? "text-rsi-text-muted line-through"
              : "text-rsi-success",
          ].join(" ")}
        >
          +{formatAuecAmount(completionAuec)}
          <span className="ml-1 text-[0.65rem] font-normal tracking-wide text-rsi-text-muted no-underline">
            paid
          </span>
        </p>
      ) : (
        <p
          className={[
            "mt-1 font-mono text-sm tabular-nums tracking-wide",
            row.isCompleted ? "text-rsi-text-muted line-through" : "text-rsi-warn",
          ].join(" ")}
        >
          aUEC not available
        </p>
      )}
    </div>
  );
}

function missionScuItemsLabel(mission: SessionMission): string {
  if (mission.cargoSummary.trim()) return mission.cargoSummary;
  if (mission.cargo.length === 0) return "—";
  return mission.cargo
    .map((line) => `${line.scu} SCU ${line.commodity}`)
    .join(" · ");
}

function ExpectedCompletionsMeta({
  missions,
}: {
  missions: SessionMission[];
}) {
  const [detailMissionId, setDetailMissionId] = useState<string | null>(null);
  const detailMission =
    detailMissionId == null
      ? null
      : (missions.find((mission) => mission.id === detailMissionId) ?? null);

  // Desktop: keep an invisible footprint so Next stop does not jump.
  // Mobile: collapse — vertical space matters more than column alignment.
  if (missions.length === 0) {
    return (
      <div
        className="invisible hidden py-5 pr-4 text-sm md:block md:pr-8"
        aria-hidden
      >
        <p className="mb-2 w-fit border-b border-transparent pb-0.5 font-mono text-[0.65rem] uppercase tracking-[0.16em]">
          Contracts
        </p>
        <p>None</p>
      </div>
    );
  }

  return (
    <div className="py-5 pr-4 text-sm md:pr-8">
      <p className="mb-2 w-fit border-b border-rsi-text-muted/45 pb-0.5 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-rsi-text-muted">
        Contracts
      </p>
      <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 md:grid-cols-3">
        {missions.map((mission) => {
          const { rank, title } = stripRankFromTitle(mission.title);
          const scuItems = missionScuItemsLabel(mission);
          return (
            <li key={mission.id} className="min-w-0">
              <button
                type="button"
                title={`View details for ${mission.title}`}
                onClick={(event) => {
                  event.stopPropagation();
                  setDetailMissionId(mission.id);
                }}
                className={[
                  "flex w-full min-w-0 flex-col items-stretch gap-0.5 rounded-rsi border border-rsi-border/80 bg-rsi-bg-deep/40 px-2 py-1.5 text-left transition-colors",
                  "hover:border-rsi-border-strong hover:bg-rsi-bg-deep/60",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-rsi-bg",
                  mission.isCompleted ? "opacity-70" : "",
                ].join(" ")}
              >
                <p
                  className={[
                    "truncate font-mono text-[0.5rem] uppercase tracking-[0.14em]",
                    mission.isCompleted
                      ? "text-rsi-text-muted line-through"
                      : "text-rsi-accent",
                  ].join(" ")}
                >
                  {rank ?? "—"}
                </p>
                <p
                  className={[
                    "truncate text-[0.6rem] font-semibold tracking-wide",
                    mission.isCompleted
                      ? "text-rsi-text-muted line-through decoration-rsi-success/40"
                      : "text-rsi-text",
                  ].join(" ")}
                >
                  {title || mission.title}
                </p>
                <p
                  className={[
                    "truncate text-[0.5rem] leading-snug text-rsi-text-secondary",
                    mission.isCompleted ? "line-through opacity-80" : "",
                  ].join(" ")}
                >
                  {scuItems}
                </p>
              </button>
            </li>
          );
        })}
      </ul>
      {detailMission ? (
        <SessionMissionDetailModal
          mission={detailMission}
          onClose={() => setDetailMissionId(null)}
        />
      ) : null}
    </div>
  );
}

function NextDistanceMeta({
  row,
  nextLocationName,
  nextLocationSlug,
}: {
  row: HaulingChecklistRow;
  nextLocationName: string | null;
  nextLocationSlug: string | null;
}) {
  const isLastStop = nextLocationSlug == null && nextLocationName == null;
  if (isLastStop) {
    return (
      <div className="py-5 text-sm">
        <p
          className={[
            "font-mono text-[0.65rem] uppercase tracking-[0.16em]",
            row.isCompleted ? "text-rsi-text-muted line-through" : "text-rsi-success",
          ].join(" ")}
        >
          Session complete
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

  return (
    <div className="py-5 text-sm">
      <p className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-rsi-text-muted">
        Next stop / Distance
      </p>
      <p
        className={[
          "mt-0.5 text-sm",
          row.isCompleted
            ? "text-rsi-text-muted line-through"
            : "text-rsi-text-secondary",
        ].join(" ")}
      >
        <span className="font-medium tracking-wide">{nextLocationName}</span>
        <span className="text-rsi-text-muted"> / </span>
        <span className="font-mono tabular-nums">{distance}</span>
      </p>
    </div>
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
  missions = [],
  sessionId = null,
  onToggleCargoHandled,
}: HaulingChecklistTableProps) {
  const transferShipName = shipName?.trim() || "Ship";
  const [copiedRowId, setCopiedRowId] = useState<string | null>(null);
  const [hideCompleted, setHideCompleted] = useState(false);
  const rowElsRef = useRef(new Map<string, HTMLLIElement>());
  const pendingScrollToIdRef = useRef<string | null>(null);
  const completedCount = rows.filter((row) => row.isCompleted).length;
  const visibleRows = hideCompleted
    ? rows.filter((row) => !row.isCompleted)
    : rows;

  useEffect(() => {
    const targetId = pendingScrollToIdRef.current;
    if (!targetId) return;
    pendingScrollToIdRef.current = null;
    const el = rowElsRef.current.get(targetId);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
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

  const toolbar = (
    <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-rsi-divider bg-rsi-bg-deep/95 px-3 py-2">
      {toolbarStart}
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {toolbarEnd}
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
          {hideCompleted ? "Show history" : "Hide history"}
        </button>
      </div>
    </div>
  );

  const emptyMessage =
    rows.length === 0
      ? "No contracts yet"
      : "All contracts complete — show history to review";

  const stepById = new Map(rows.map((row, index) => [row.id, index + 1]));
  const onboardByStop = estimateOnboardScuByStop(rows);
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
          const routeIndex = rows.findIndex((entry) => entry.id === row.id);
          const nextRow =
            routeIndex >= 0 ? (rows[routeIndex + 1] ?? null) : null;
          const nextLocationSlug = nextRow?.locationSlug ?? null;
          const nextLocationName = nextLocationSlug
            ? (getLocationBySlug(nextLocationSlug)?.name ?? nextLocationSlug)
            : null;
          const cargoFallbackRole =
            row.legKind === "both" ? null : row.legKind;
          const cargoLines = describeCargoDeliveries(
            row.cargoDeliveries,
            cargoFallbackRole,
          );
          const isCopied = copiedRowId === row.id;
          const step = stepById.get(row.id) ?? 0;
          const isFocused = row.id === activeRowId;
          const expectedCompletions = missionsExpectedToCompleteAtStop(
            missions,
            rows,
            row.id,
          );
          const completionAuec = expectedCompletions.reduce((sum, mission) => {
            if (mission.rewardAuec > 0) return sum + mission.rewardAuec;
            const fromDisplay = mission.rewardDisplay?.match(
              /([\d,]+)\s*aUEC/i,
            );
            if (fromDisplay?.[1]) {
              const parsed = Number(fromDisplay[1].replace(/,/g, ""));
              if (Number.isFinite(parsed) && parsed > 0) return sum + parsed;
            }
            return sum;
          }, 0);

          const toggleStopDone = () => {
            const completing = !row.isCompleted;
            onToggle(row.id);
            // Defer focus/scroll/bay replan so the checkbox paints first.
            if (completing && !hideCompleted) {
              const nextIncomplete = rows
                .slice(routeIndex + 1)
                .find((entry) => !entry.isCompleted);
              if (nextIncomplete) {
                startTransition(() => {
                  pendingScrollToIdRef.current = nextIncomplete.id;
                  onFocusStop?.(nextIncomplete.id);
                });
              }
            }
          };

          return (
            <li
              key={row.id}
              ref={(node) => {
                if (node) rowElsRef.current.set(row.id, node);
                else rowElsRef.current.delete(row.id);
              }}
              aria-checked={row.isCompleted}
              aria-current={isFocused ? "step" : undefined}
              className={[
                "scroll-mt-14 border-b border-rsi-divider/80 px-3 pt-4.5 pb-3 last:border-b-0",
                checklistRowToneClass(row.isCompleted, isFocused),
              ].join(" ")}
              onClick={() => onFocusStop?.(row.id)}
            >
              <div className="flex gap-3">
                {/* Desktop: side column aligned to the thumbnail, gutter below. */}
                <div className="hidden h-14 shrink-0 items-center self-start md:flex">
                  <DoneCheckbox
                    location={location}
                    step={step}
                    isCompleted={row.isCompleted}
                    isActive={isFocused}
                    onToggle={toggleStopDone}
                  />
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex flex-col gap-3 md:flex-row md:items-stretch md:gap-4">
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
                      <div className="mt-5 pb-5">
                        <CargoGroups
                          row={row}
                          cargoLines={cargoLines}
                          onToggleCargoHandled={onToggleCargoHandled}
                        />
                      </div>
                    </div>
                    <div className="w-full min-w-0 md:w-1/2 md:shrink-0 md:self-start">
                      <StopDeliveryBayPreview row={row} rows={rows} />
                    </div>
                  </div>
                  <div className="md:hidden">
                    <TotalMeta
                      row={row}
                      location={location}
                      shipName={transferShipName}
                      onboardReceipt={onboardByStop.get(row.id) ?? null}
                    />
                  </div>
                  <div className="flex flex-col md:flex-row md:items-start md:gap-4">
                    <div className="min-w-0 flex-1">
                      <ExpectedCompletionsMeta missions={expectedCompletions} />
                      <PayoutMeta
                        row={row}
                        completionAuec={completionAuec}
                        completingMissionCount={expectedCompletions.length}
                      />
                      <div className="flex justify-start py-3 md:hidden">
                        <DoneStopButton
                          location={location}
                          step={step}
                          isCompleted={row.isCompleted}
                          onToggle={toggleStopDone}
                        />
                      </div>
                      <NextDistanceMeta
                        row={row}
                        nextLocationName={nextLocationName}
                        nextLocationSlug={nextLocationSlug}
                      />
                    </div>
                    <div className="hidden w-full md:flex md:w-1/2 md:shrink-0 md:flex-col">
                      <TotalMeta
                        row={row}
                        location={location}
                        shipName={transferShipName}
                        onboardReceipt={onboardByStop.get(row.id) ?? null}
                      />
                      {row.isCompleted ? (
                        <div className="flex flex-1 items-center justify-center">
                          <CompletedStamp />
                        </div>
                      ) : null}
                    </div>
                  </div>
                  {sessionId ? (
                    <div
                      className="mt-3 flex justify-start pt-1"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <StopMissionScreenshots
                        refs={screenshotRefsForRow(missions, row, sessionId)}
                        variant="inline"
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
});
