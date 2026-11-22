"use client";

import { useRef } from "react";
import { CommodityIcon } from "@/components/missions/CommodityIcon";
import { SCU_TITLE } from "@/lib/ui/abbrevTitles";
import {
  cargoBoxOrientations,
  type CargoBoxScu,
} from "@/lib/ships/cargoBoxSizes";
import type { ManualBayInventoryMissionGroup } from "@/lib/ships/manualBayInventory";
import type { ManualBayAddBoxSpec } from "@/lib/ships/manualBayMove";

export type ManualBayBoxTrayProps = {
  groups: ManualBayInventoryMissionGroup[];
  onClearBay?: () => void;
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

type PendingPointer = {
  pointerId: number;
  startX: number;
  startY: number;
  lineKey: string;
  spec: ManualBayAddBoxSpec;
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

/**
 * Manual packing tray: remaining crates by mission × commodity × SCU size.
 * Drag a chip onto the 2D grid to place. R rotates while dragging; Esc cancels.
 */
export function ManualBayBoxTray({
  groups,
  onClearBay,
  draggingLineKey = null,
  orientationIndex = 0,
  onTrayDragStart,
  onTrayDragMove,
  onTrayDragEnd,
  onTrayDragCancel,
  className,
}: ManualBayBoxTrayProps) {
  const pendingRef = useRef<PendingPointer | null>(null);

  const totalRemaining = groups.reduce(
    (sum, group) =>
      sum + group.lines.reduce((lineSum, line) => lineSum + line.remaining, 0),
    0,
  );
  const totalDemanded = groups.reduce(
    (sum, group) =>
      sum + group.lines.reduce((lineSum, line) => lineSum + line.demanded, 0),
    0,
  );

  if (groups.length === 0) {
    return null;
  }

  return (
    <div
      className={[
        "flex min-h-0 flex-col rounded-rsi border border-rsi-border/80 bg-rsi-bg-deep/50 px-2 py-2",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <p
          className="font-mono text-[0.55rem] uppercase tracking-[0.14em] text-rsi-accent"
          title="Drag a chip onto the 2D grid to place. R rotates. Esc cancels."
        >
          Tray
        </p>
        <p className="font-mono text-[0.55rem] tabular-nums tracking-wide text-rsi-text-muted">
          {totalRemaining}/{totalDemanded}
        </p>
      </div>
      {onClearBay ? (
        <button
          type="button"
          title="Remove all crates from the bay so you can place from the tray"
          onClick={onClearBay}
          className="mb-2 w-full rounded-rsi border border-dashed border-rsi-border/80 px-2 py-1 font-mono text-[0.5rem] uppercase tracking-[0.12em] text-rsi-text-muted transition-colors hover:border-rsi-border-strong hover:text-rsi-text-secondary"
        >
          Clear bay
        </button>
      ) : null}
      <div className="min-h-[12rem] flex-1 basis-0 space-y-2 overflow-y-auto [scrollbar-width:thin]">
        {groups.map((group) => {
          const idShort = shortMissionId(group.missionId);
          return (
            <div key={group.missionId ?? "_"}>
              <p
                className="mb-1 flex min-w-0 items-baseline gap-1 font-mono text-[0.5rem] uppercase tracking-[0.12em] text-rsi-text-muted"
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
              <ul className="flex flex-wrap items-end gap-1.5">
                {group.lines.map((line) => {
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
                            // Synthetic / already-captured pointers still drag via chip events.
                          }
                        }}
                        onPointerMove={(event) => {
                          const pending = pendingRef.current;
                          if (
                            !pending ||
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
                            onTrayDragStart?.(pending.spec, pending.lineKey);
                          }
                          if (pending.dragging) {
                            onTrayDragMove?.(event.clientX, event.clientY);
                          }
                        }}
                        onPointerUp={(event) => {
                          const pending = pendingRef.current;
                          if (
                            !pending ||
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
