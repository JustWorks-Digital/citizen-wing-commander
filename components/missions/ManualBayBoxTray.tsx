"use client";

import { CommodityIcon } from "@/components/missions/CommodityIcon";
import { SCU_TITLE } from "@/lib/ui/abbrevTitles";
import {
  cargoBoxOrientations,
  type CargoBoxScu,
} from "@/lib/ships/cargoBoxSizes";
import type { ManualBayInventoryMissionGroup } from "@/lib/ships/manualBayInventory";
import {
  MANUAL_BAY_TRAY_MIME,
  type ManualBayAddBoxSpec,
} from "@/lib/ships/manualBayMove";

export type ManualBayBoxTrayProps = {
  groups: ManualBayInventoryMissionGroup[];
  onClearBay?: () => void;
  className?: string;
};

/** Base pixels per 1 SCU cell (bay top-down aspect). */
const TRAY_CELL_PX = 10;
/** Short side must fit icon + size + count without clipping. */
const TRAY_MIN_SHORT_SIDE_PX = 32;

function trayFootprintStyle(size: CargoBoxScu): {
  width: number;
  height: number;
  dx: number;
  dy: number;
} {
  const footprint = cargoBoxOrientations(size)[0]!;
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

function trayPayload(line: {
  missionId: string | null;
  commoditySlug: string;
  commodityName: string;
  size: number;
  color: string | null;
  color2: string | null;
}): string {
  const spec: ManualBayAddBoxSpec = {
    size: line.size as ManualBayAddBoxSpec["size"],
    commoditySlug: line.commoditySlug,
    commodityName: line.commodityName,
    color: line.color,
    color2: line.color2,
    missionId: line.missionId,
    action: "pickup",
  };
  return JSON.stringify(spec);
}

/**
 * Manual packing tray: remaining crates by mission × commodity × SCU size.
 * Drag a chip onto the 2D bay grid to place; counts drop as crates land.
 */
export function ManualBayBoxTray({
  groups,
  onClearBay,
  className,
}: ManualBayBoxTrayProps) {
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
        "rounded-rsi border border-rsi-border/80 bg-rsi-bg-deep/50 px-2 py-2",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-[0.55rem] uppercase tracking-[0.14em] text-rsi-accent">
          Place from tray
        </p>
        <p className="font-mono text-[0.55rem] tabular-nums tracking-wide text-rsi-text-muted">
          {totalRemaining} left · {totalDemanded} total
        </p>
      </div>
      {onClearBay ? (
        <button
          type="button"
          title="Remove all crates from the bay so you can place from the tray"
          onClick={onClearBay}
          className="mb-2 w-full rounded-rsi border border-dashed border-rsi-border/80 px-2 py-1 font-mono text-[0.5rem] uppercase tracking-[0.12em] text-rsi-text-muted transition-colors hover:border-rsi-border-strong hover:text-rsi-text-secondary"
        >
          Clear bay to tray
        </button>
      ) : null}
      <div className="max-h-40 space-y-2 overflow-y-auto [scrollbar-width:thin]">
        {groups.map((group) => (
          <div key={group.missionId ?? "_"}>
            <p className="mb-1 truncate font-mono text-[0.5rem] uppercase tracking-[0.12em] text-rsi-text-muted">
              {group.missionTitle}
            </p>
            <ul className="flex flex-wrap items-end gap-1.5">
              {group.lines.map((line) => {
                const canDrag = line.remaining > 0;
                const footprint = trayFootprintStyle(line.size);
                const showName = footprint.width >= 64 && footprint.height >= 52;
                return (
                  <li key={line.key}>
                    <button
                      type="button"
                      draggable={canDrag}
                      disabled={!canDrag}
                      title={
                        canDrag
                          ? `Drag ${line.size} ${SCU_TITLE} ${line.commodityName} onto the 2D grid (${line.remaining} left)`
                          : `All ${line.size} ${SCU_TITLE} ${line.commodityName} placed`
                      }
                      onDragStart={(event) => {
                        if (!canDrag) {
                          event.preventDefault();
                          return;
                        }
                        event.dataTransfer.setData(
                          MANUAL_BAY_TRAY_MIME,
                          trayPayload(line),
                        );
                        event.dataTransfer.effectAllowed = "copy";
                      }}
                      style={{
                        width: footprint.width,
                        height: footprint.height,
                      }}
                      className={[
                        "box-border flex flex-col items-center justify-center gap-0.5 rounded-[2px] border px-0.5 py-0.5 font-mono text-[0.5rem] leading-none tabular-nums transition-colors",
                        canDrag
                          ? "cursor-grab border-rsi-border bg-rsi-surface text-rsi-text active:cursor-grabbing"
                          : "cursor-default border-rsi-border/50 bg-rsi-bg-deep/40 text-rsi-text-muted opacity-60",
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
                      {showName ? (
                        <span className="max-w-full truncate px-0.5 text-center text-rsi-text-secondary">
                          {line.commodityName}
                        </span>
                      ) : null}
                      <span className="shrink-0 text-rsi-text-muted">
                        {line.remaining}/{line.demanded}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[0.6rem] leading-snug text-rsi-text-muted">
        Drag a chip onto a free 2D cell. Double-click a crate to return it to
        the tray.
      </p>
    </div>
  );
}
