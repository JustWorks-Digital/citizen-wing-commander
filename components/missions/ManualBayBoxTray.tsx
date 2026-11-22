"use client";

import { useRef, useState } from "react";
import { CommodityIcon } from "@/components/missions/CommodityIcon";
import { resolveCommodityColorHex } from "@/lib/fixtures/commodityColors";
import { SCU_TITLE } from "@/lib/ui/abbrevTitles";
import {
  cargoBoxOrientations,
  type CargoBoxScu,
} from "@/lib/ships/cargoBoxSizes";
import type { PlacedCargoBox } from "@/lib/ships/cargoGridPlacement";
import {
  commodityGroupsFromMission,
  type ManualBayInventoryCommodityGroup,
  type ManualBayInventoryMissionGroup,
} from "@/lib/ships/manualBayInventory";
import type {
  ManualBayAddBoxSpec,
  ManualBayBulkFillSpec,
} from "@/lib/ships/manualBayMove";

export type ManualBayBoxTrayProps = {
  groups: ManualBayInventoryMissionGroup[];
  onClearBay?: () => void;
  /** Pull one cargo type off the bay back into Cargo (Reset Fill). */
  onResetCommodity?: (
    missionId: string | null,
    commoditySlug: string,
  ) => void;
  /** Line currently pointer-dragged (source chip dims; ghost follows cursor). */
  draggingLineKey?: string | null;
  /** Orientation index for the dragging crate (R cycles). */
  orientationIndex?: number;
  /**
   * Pointer drag past threshold starts drag-and-drop.
   * `onTrayDragMove` / `onTrayDragEnd` follow until pointer up.
   */
  onTrayDragStart?: (spec: ManualBayAddBoxSpec, lineKey: string) => void;
  onTrayDragMove?: (clientX: number, clientY: number) => void;
  onTrayDragEnd?: (clientX: number, clientY: number) => void;
  /** Bulk: drag full remaining cargo type onto a bay section. */
  onTrayBulkDragStart?: (
    fill: ManualBayBulkFillSpec,
    lineKey: string,
  ) => void;
  /** Cancel an in-progress drag (e.g. Esc). */
  onTrayDragCancel?: () => void;
  className?: string;
};

/** Base pixels per 1 SCU cell (bay top-down aspect). */
const TRAY_CELL_PX = 10;
/** Short side must fit icon + size + count without clipping. */
const TRAY_MIN_SHORT_SIDE_PX = 32;
/** Pointer travel before a press becomes drag-and-drop. */
const TRAY_DRAG_THRESHOLD_PX = 10;

export function trayFootprintStyle(
  size: CargoBoxScu,
  orientationIndex = 0,
): {
  width: number;
  height: number;
  dx: number;
  dy: number;
} {
  const orientations = cargoBoxOrientations(size);
  const footprint =
    orientations[
      ((orientationIndex % orientations.length) + orientations.length) %
        orientations.length
    ] ?? orientations[0]!;
  const shortSide = Math.min(footprint.dx, footprint.dy);
  const cellPx = Math.max(
    TRAY_CELL_PX,
    Math.ceil(TRAY_MIN_SHORT_SIDE_PX / shortSide),
  );
  return {
    width: footprint.dx * cellPx,
    height: footprint.dy * cellPx,
    dx: footprint.dx,
    dy: footprint.dy,
  };
}

/** Short mission id for tray headers (same-name contracts stay distinct). */
function shortMissionId(missionId: string | null): string | null {
  if (!missionId) return null;
  return missionId.replace(/-/g, "").slice(0, 8);
}

function specFromLine(line: {
  missionId: string | null;
  commoditySlug: string;
  commodityName: string;
  size: number;
  color: string | null;
  color2: string | null;
}): ManualBayAddBoxSpec {
  return {
    size: line.size as ManualBayAddBoxSpec["size"],
    commoditySlug: line.commoditySlug,
    commodityName: line.commodityName,
    color: line.color,
    color2: line.color2,
    missionId: line.missionId,
    action: "pickup",
  };
}

function bulkSpecFromCommodity(
  commodity: ManualBayInventoryCommodityGroup,
): ManualBayBulkFillSpec {
  return {
    missionId: commodity.missionId,
    commoditySlug: commodity.commoditySlug,
    commodityName: commodity.commodityName,
    color: commodity.color,
    color2: commodity.color2,
    crates: commodity.lines.map((line) => ({
      size: line.size,
      count: line.remaining,
    })),
  };
}

type PendingPointer =
  | {
      kind: "single";
      pointerId: number;
      startX: number;
      startY: number;
      lineKey: string;
      spec: ManualBayAddBoxSpec;
      dragging: boolean;
    }
  | {
      kind: "bulk";
      pointerId: number;
      startX: number;
      startY: number;
      lineKey: string;
      fill: ManualBayBulkFillSpec;
      dragging: boolean;
    };

export type ManualBayTrayDragGhostProps = {
  spec: ManualBayAddBoxSpec;
  orientationIndex?: number;
  clientX: number;
  clientY: number;
};

/**
 * Floating crate under the pointer while tray drag-and-drop is active.
 */
export function ManualBayTrayDragGhost({
  spec,
  orientationIndex = 0,
  clientX,
  clientY,
}: ManualBayTrayDragGhostProps) {
  const footprint = trayFootprintStyle(spec.size, orientationIndex);
  return (
    <div
      role="presentation"
      aria-hidden
      className="pointer-events-none fixed z-[200] box-border flex -translate-x-1/2 -translate-y-[110%] flex-col items-center justify-center gap-0.5 rounded-[2px] border-2 border-rsi-accent bg-rsi-accent-muted/90 px-0.5 py-0.5 font-mono text-[0.5rem] leading-none text-rsi-accent shadow-rsi-panel tabular-nums"
      style={{
        left: clientX,
        top: clientY,
        width: footprint.width,
        height: footprint.height,
      }}
    >
      <span className="flex max-w-full items-center justify-center gap-0.5">
        <CommodityIcon
          commoditySlug={spec.commoditySlug}
          label={spec.commodityName}
          color={spec.color}
          color2={spec.color2}
          size="sm"
          showTooltip={false}
        />
        <span className="shrink-0">{spec.size}</span>
      </span>
      <span className="shrink-0 uppercase tracking-[0.08em] text-rsi-text">
        Drop
      </span>
    </div>
  );
}

export type ManualBayTrayBulkDragGhostProps = {
  fill: ManualBayBulkFillSpec;
  remainingScu: number;
  clientX: number;
  clientY: number;
};

/** Ghost while dragging a full cargo type onto a bay section. */
export function ManualBayTrayBulkDragGhost({
  fill,
  remainingScu,
  clientX,
  clientY,
}: ManualBayTrayBulkDragGhostProps) {
  const hex =
    resolveCommodityColorHex(fill.color, fill.color2, fill.commoditySlug) ??
    "var(--rsi-accent)";
  return (
    <div
      role="presentation"
      aria-hidden
      className="pointer-events-none fixed z-[200] box-border flex min-w-[5.5rem] -translate-x-1/2 -translate-y-[110%] flex-col items-center justify-center gap-0.5 rounded-[2px] border-2 border-rsi-accent px-1.5 py-1 font-mono text-[0.5rem] leading-none text-rsi-bg-deep shadow-rsi-panel tabular-nums"
      style={{
        left: clientX,
        top: clientY,
        backgroundColor: hex,
        opacity: 0.95,
      }}
    >
      <span className="flex max-w-full items-center justify-center gap-0.5">
        <CommodityIcon
          commoditySlug={fill.commoditySlug}
          label={fill.commodityName}
          color={fill.color}
          color2={fill.color2}
          size="xs"
          showTooltip={false}
        />
        <span className="max-w-[6rem] truncate font-semibold">
          {fill.commodityName}
        </span>
      </span>
      <span className="uppercase tracking-[0.08em]">
        Fill · {remainingScu}
        <span className="normal-case tracking-normal" title={SCU_TITLE}>
          scu
        </span>
      </span>
    </div>
  );
}

export type ManualBayPlacedBoxDragGhostProps = {
  box: PlacedCargoBox;
  clientX: number;
  clientY: number;
};

/** Pixels per cell for the placed-crate cursor ghost (screen overlay). */
const PLACED_DRAG_GHOST_CELL_PX = 14;

/**
 * Floating placed crate that follows the cursor through gaps / invalid cells.
 * Drop commits only when the pointer is over a legal cargo cell.
 */
export function ManualBayPlacedBoxDragGhost({
  box,
  clientX,
  clientY,
}: ManualBayPlacedBoxDragGhostProps) {
  const hex =
    resolveCommodityColorHex(box.color, box.color2, box.commoditySlug) ??
    "var(--rsi-accent)";
  const width = Math.max(1, box.footprint.dx) * PLACED_DRAG_GHOST_CELL_PX;
  const height = Math.max(1, box.footprint.dy) * PLACED_DRAG_GHOST_CELL_PX;
  return (
    <div
      role="presentation"
      aria-hidden
      className="pointer-events-none fixed z-[200] box-border flex -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-[2px] border-2 border-rsi-text/80 px-0.5 font-mono text-[0.55rem] leading-none text-rsi-bg-deep shadow-rsi-panel tabular-nums"
      style={{
        left: clientX,
        top: clientY,
        width,
        height,
        backgroundColor: hex,
        opacity: 0.92,
      }}
    >
      <span className="flex max-w-full items-center justify-center gap-0.5">
        <CommodityIcon
          commoditySlug={box.commoditySlug}
          label={box.commodityName}
          color={box.color}
          color2={box.color2}
          size="sm"
          showTooltip={false}
        />
        <span className="shrink-0 font-semibold">{box.size}</span>
      </span>
    </div>
  );
}

/**
 * Manual Cargo panel: remaining crates by mission × commodity × SCU size.
 * Drag Fill onto a section to pack all remaining of that type (largest first).
 * Size chips under each Fill are collapsed by default — expand for one-at-a-time.
 * R rotates single-crate drag; Esc cancels.
 */
export function ManualBayBoxTray({
  groups,
  onClearBay,
  onResetCommodity,
  draggingLineKey = null,
  orientationIndex = 0,
  onTrayDragStart,
  onTrayDragMove,
  onTrayDragEnd,
  onTrayBulkDragStart,
  onTrayDragCancel,
  className,
}: ManualBayBoxTrayProps) {
  const pendingRef = useRef<PendingPointer | null>(null);
  /** Commodity keys with size chips expanded (Fill-only by default). */
  const [expandedSizeKeys, setExpandedSizeKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const toggleSizesExpanded = (commodityKey: string) => {
    setExpandedSizeKeys((prev) => {
      const next = new Set(prev);
      if (next.has(commodityKey)) next.delete(commodityKey);
      else next.add(commodityKey);
      return next;
    });
  };

  const totalRemainingScu = groups.reduce(
    (sum, group) =>
      sum +
      group.lines.reduce(
        (lineSum, line) => lineSum + line.remaining * line.size,
        0,
      ),
    0,
  );
  const totalDemandedScu = groups.reduce(
    (sum, group) =>
      sum +
      group.lines.reduce(
        (lineSum, line) => lineSum + line.demanded * line.size,
        0,
      ),
    0,
  );

  if (groups.length === 0) {
    return null;
  }

  return (
    <div
      className={[
        "flex min-h-0 flex-col rounded-rsi border border-rsi-border/80 bg-rsi-bg-deep/50 px-1.5 py-1.5",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="mb-1 flex min-w-0 items-center gap-1">
        <p
          className="shrink-0 pr-0.5 font-mono text-[0.5rem] uppercase tracking-[0.14em] text-rsi-accent"
          title="Drag Fill onto a bay section to pack that cargo type. Expand Sizes for one-crate chips. R rotates. Esc cancels."
        >
          Cargo:
        </p>
        <p className="min-w-0 flex-1 truncate font-mono text-[0.5rem] tabular-nums tracking-wide text-rsi-text-muted">
          {totalRemainingScu}/{totalDemandedScu}
          <span title={SCU_TITLE}>scu</span>
        </p>
        {onClearBay ? (
          <button
            type="button"
            title="Remove all crates from the bay so you can place from Cargo"
            aria-label="Clear bay"
            onClick={onClearBay}
            className="shrink-0 rounded border border-rsi-border/70 px-1 py-px font-mono text-[0.45rem] uppercase tracking-[0.1em] text-rsi-text-muted transition-colors hover:border-rsi-border-strong hover:text-rsi-text-secondary"
          >
            Clear
          </button>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 basis-0 space-y-2 overflow-y-auto [scrollbar-width:thin]">
        {groups.map((group) => {
          const idShort = shortMissionId(group.missionId);
          const commodities = commodityGroupsFromMission(group);
          return (
            <div
              key={group.missionId ?? "_"}
              className="rounded-[2px] border border-rsi-border/60 bg-rsi-bg-deep/40 px-1 py-1"
            >
              <p
                className="mb-0.5 flex min-w-0 items-baseline gap-1 font-mono text-[0.45rem] uppercase tracking-[0.1em] text-rsi-text-muted"
                title={
                  idShort
                    ? `${group.missionTitle} · ${group.missionId}`
                    : group.missionTitle
                }
              >
                <span className="min-w-0 truncate">{group.missionTitle}</span>
                {idShort ? (
                  <span className="shrink-0 normal-case tracking-normal text-rsi-text-muted/80">
                    · {idShort}
                  </span>
                ) : null}
              </p>
              <div className="space-y-0.5">
                {commodities.map((commodity) => {
                  const bulkDragging = draggingLineKey === commodity.key;
                  const sizesExpanded = expandedSizeKeys.has(commodity.key);
                  const sizeChipCount = commodity.lines.length;
                  const sizesId = `tray-sizes-${commodity.key.replace(/:/g, "-")}`;
                  const canFill = commodity.remainingScu > 0;
                  const canReset =
                    Boolean(onResetCommodity) && commodity.placedScu > 0;
                  return (
                    <div key={commodity.key} className="space-y-0.5">
                      <div
                        className={[
                          "flex min-w-0 overflow-hidden rounded-[2px] border font-mono text-[0.5rem] leading-none tabular-nums",
                          bulkDragging
                            ? "border-dashed border-rsi-accent/60 bg-rsi-bg-deep/30 opacity-40"
                            : canFill
                              ? "border-rsi-accent/40 bg-rsi-accent-muted/15"
                              : "border-rsi-border/60 bg-rsi-bg-deep/40",
                        ].join(" ")}
                      >
                      <button
                        type="button"
                        disabled={!canFill}
                        title={
                          canFill
                            ? `Fill · drag onto a bay section to pack all remaining ${commodity.commodityName} (largest first)`
                            : `${commodity.commodityName} is on the bay — Reset to pull it back`
                        }
                        aria-label={`Fill ${commodity.commodityName}, ${commodity.remainingScu}scu`}
                        onPointerDown={(event) => {
                          if (!canFill || event.button !== 0) return;
                          pendingRef.current = {
                            kind: "bulk",
                            pointerId: event.pointerId,
                            startX: event.clientX,
                            startY: event.clientY,
                            lineKey: commodity.key,
                            fill: bulkSpecFromCommodity(commodity),
                            dragging: false,
                          };
                          try {
                            event.currentTarget.setPointerCapture(
                              event.pointerId,
                            );
                          } catch {
                            // Synthetic / already-captured pointers still drag.
                          }
                        }}
                        onPointerMove={(event) => {
                          const pending = pendingRef.current;
                          if (
                            !pending ||
                            pending.kind !== "bulk" ||
                            pending.pointerId !== event.pointerId
                          ) {
                            return;
                          }
                          const dx = event.clientX - pending.startX;
                          const dy = event.clientY - pending.startY;
                          if (
                            !pending.dragging &&
                            Math.hypot(dx, dy) >= TRAY_DRAG_THRESHOLD_PX
                          ) {
                            pending.dragging = true;
                            onTrayBulkDragStart?.(
                              pending.fill,
                              pending.lineKey,
                            );
                          }
                          if (pending.dragging) {
                            onTrayDragMove?.(event.clientX, event.clientY);
                          }
                        }}
                        onPointerUp={(event) => {
                          const pending = pendingRef.current;
                          if (
                            !pending ||
                            pending.kind !== "bulk" ||
                            pending.pointerId !== event.pointerId
                          ) {
                            return;
                          }
                          try {
                            event.currentTarget.releasePointerCapture(
                              event.pointerId,
                            );
                          } catch {
                            // already released
                          }
                          if (pending.dragging) {
                            onTrayDragEnd?.(event.clientX, event.clientY);
                          }
                          pendingRef.current = null;
                        }}
                        onPointerCancel={(event) => {
                          const pending = pendingRef.current;
                          if (
                            !pending ||
                            pending.kind !== "bulk" ||
                            pending.pointerId !== event.pointerId
                          ) {
                            return;
                          }
                          if (pending.dragging) {
                            onTrayDragCancel?.();
                          }
                          pendingRef.current = null;
                        }}
                        className={[
                          "flex min-w-0 flex-1 touch-none items-center gap-0.5 px-1 py-1 text-left transition-colors",
                          !canFill
                            ? "cursor-default text-rsi-text-muted"
                            : bulkDragging
                              ? "cursor-grabbing text-rsi-text-muted"
                              : "cursor-grab text-rsi-text hover:bg-rsi-accent-muted/25",
                        ].join(" ")}
                      >
                        <CommodityIcon
                          commoditySlug={commodity.commoditySlug}
                          label={commodity.commodityName}
                          color={commodity.color}
                          color2={commodity.color2}
                          size="xs"
                          showTooltip={false}
                        />
                        <span className="min-w-0 flex-1 truncate text-rsi-text-secondary">
                          {commodity.commodityName}
                        </span>
                        <span className="shrink-0 text-rsi-text-muted">
                          {commodity.remainingScu}
                          <span title={SCU_TITLE}>scu</span>
                        </span>
                      </button>
                      {canReset ? (
                        <button
                          type="button"
                          title={`Reset · pull ${commodity.commodityName} off the bay into Cargo`}
                          aria-label={`Reset ${commodity.commodityName}`}
                          onClick={() =>
                            onResetCommodity?.(
                              commodity.missionId,
                              commodity.commoditySlug,
                            )
                          }
                          className="inline-flex w-5 shrink-0 items-center justify-center border-l border-rsi-accent/30 text-rsi-text-muted transition-colors hover:bg-rsi-accent-muted/30 hover:text-rsi-text-secondary"
                        >
                          <svg
                            aria-hidden
                            viewBox="0 0 12 12"
                            className="size-2.5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M3.5 4.5H8a2 2 0 0 1 0 4H5.5" />
                            <path d="M5 2.5 3 4.5 5 6.5" />
                          </svg>
                        </button>
                      ) : null}
                      {sizeChipCount > 0 ? (
                      <button
                        type="button"
                        aria-expanded={sizesExpanded}
                        aria-controls={sizesId}
                        aria-label={
                          sizesExpanded
                            ? `Hide ${commodity.commodityName} size chips`
                            : `Show ${sizeChipCount} ${commodity.commodityName} size chips`
                        }
                        title={
                          sizesExpanded
                            ? "Hide size chips"
                            : `Sizes (${sizeChipCount}) — one-at-a-time place`
                        }
                        onClick={() => toggleSizesExpanded(commodity.key)}
                        className={[
                          "inline-flex w-5 shrink-0 items-center justify-center border-l border-rsi-accent/30 text-rsi-text-muted transition-colors hover:bg-rsi-accent-muted/30 hover:text-rsi-text-secondary",
                          sizesExpanded ? "bg-rsi-accent-muted/20 text-rsi-accent" : "",
                        ].join(" ")}
                      >
                        <svg
                          aria-hidden
                          viewBox="0 0 12 12"
                          className={[
                            "size-2.5 transition-transform",
                            sizesExpanded ? "rotate-180" : "",
                          ].join(" ")}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="2 4 6 8 10 4" />
                        </svg>
                      </button>
                      ) : null}
                      </div>
                      {sizesExpanded ? (
                      <ul
                        id={sizesId}
                        className="flex flex-wrap items-end gap-1 pl-0.5"
                      >
                        {commodity.lines.map((line) => {
                          const canPlace = line.remaining > 0;
                          const dragging = draggingLineKey === line.key;
                          const footprint = trayFootprintStyle(
                            line.size,
                            dragging ? orientationIndex : 0,
                          );
                          return (
                            <li key={line.key}>
                              <button
                                type="button"
                                disabled={!canPlace}
                                title={
                                  canPlace
                                    ? `Drag onto the 2D grid · ${line.size} ${SCU_TITLE} ${line.commodityName} · R rotates`
                                    : `All ${line.size} ${SCU_TITLE} ${line.commodityName} placed`
                                }
                                onPointerDown={(event) => {
                                  if (!canPlace || event.button !== 0) return;
                                  const spec = specFromLine(line);
                                  pendingRef.current = {
                                    kind: "single",
                                    pointerId: event.pointerId,
                                    startX: event.clientX,
                                    startY: event.clientY,
                                    lineKey: line.key,
                                    spec,
                                    dragging: false,
                                  };
                                  try {
                                    event.currentTarget.setPointerCapture(
                                      event.pointerId,
                                    );
                                  } catch {
                                    // Synthetic / already-captured pointers still drag.
                                  }
                                }}
                                onPointerMove={(event) => {
                                  const pending = pendingRef.current;
                                  if (
                                    !pending ||
                                    pending.kind !== "single" ||
                                    pending.pointerId !== event.pointerId
                                  ) {
                                    return;
                                  }
                                  const dx = event.clientX - pending.startX;
                                  const dy = event.clientY - pending.startY;
                                  if (
                                    !pending.dragging &&
                                    Math.hypot(dx, dy) >=
                                      TRAY_DRAG_THRESHOLD_PX
                                  ) {
                                    pending.dragging = true;
                                    onTrayDragStart?.(
                                      pending.spec,
                                      pending.lineKey,
                                    );
                                  }
                                  if (pending.dragging) {
                                    onTrayDragMove?.(
                                      event.clientX,
                                      event.clientY,
                                    );
                                  }
                                }}
                                onPointerUp={(event) => {
                                  const pending = pendingRef.current;
                                  if (
                                    !pending ||
                                    pending.kind !== "single" ||
                                    pending.pointerId !== event.pointerId
                                  ) {
                                    return;
                                  }
                                  try {
                                    event.currentTarget.releasePointerCapture(
                                      event.pointerId,
                                    );
                                  } catch {
                                    // already released
                                  }
                                  if (pending.dragging) {
                                    onTrayDragEnd?.(
                                      event.clientX,
                                      event.clientY,
                                    );
                                  }
                                  pendingRef.current = null;
                                }}
                                onPointerCancel={(event) => {
                                  const pending = pendingRef.current;
                                  if (
                                    !pending ||
                                    pending.kind !== "single" ||
                                    pending.pointerId !== event.pointerId
                                  ) {
                                    return;
                                  }
                                  if (pending.dragging) {
                                    onTrayDragCancel?.();
                                  }
                                  pendingRef.current = null;
                                }}
                                style={{
                                  width: footprint.width,
                                  height: footprint.height,
                                }}
                                className={[
                                  "box-border flex touch-none flex-col items-center justify-center gap-0.5 rounded-[2px] border px-0.5 py-0.5 font-mono text-[0.5rem] leading-none tabular-nums transition-colors",
                                  !canPlace
                                    ? "cursor-default border-rsi-border/50 bg-rsi-bg-deep/40 text-rsi-text-muted opacity-60"
                                    : dragging
                                      ? "cursor-grabbing border-dashed border-rsi-accent/60 bg-rsi-bg-deep/30 text-rsi-text-muted opacity-40"
                                      : "cursor-grab border-rsi-border bg-rsi-surface text-rsi-text hover:border-rsi-border-strong",
                                ].join(" ")}
                              >
                                <span className="flex max-w-full items-center justify-center gap-0.5">
                                  <CommodityIcon
                                    commoditySlug={line.commoditySlug}
                                    label={line.commodityName}
                                    color={line.color}
                                    color2={line.color2}
                                    size="sm"
                                    showTooltip={false}
                                  />
                                  <span className="shrink-0 text-rsi-accent">
                                    {line.size}
                                  </span>
                                </span>
                                <span className="shrink-0 text-rsi-text-muted">
                                  {line.remaining}/{line.demanded}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
