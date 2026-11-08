"use client";

import {
  buildCargoBaySections,
  type CargoBayTile,
} from "@/lib/missions/cargoBayLayout";
import {
  shipStorageLocationLabels,
  type HaulingChecklistRow,
  type ShipStorageLocation,
} from "@/lib/missions/mockSession";
import { CommodityIcon } from "./CommodityIcon";

export type CargoBayLayoutProps = {
  rows: HaulingChecklistRow[];
};

function tileClasses(tile: CargoBayTile): string {
  const roleBorder =
    tile.role === "pickup"
      ? "border-rsi-accent/50 bg-rsi-accent-muted/50 text-rsi-accent"
      : "border-rsi-success/50 bg-rsi-success-muted/60 text-rsi-success";
  const done = tile.isCompleted ? "opacity-50 line-through" : "";
  return [
    "flex min-h-16 flex-col justify-center rounded-rsi border px-2 py-2 text-left",
    roleBorder,
    done,
  ].join(" ");
}

function BaySection({
  zone,
  tiles,
}: {
  zone: ShipStorageLocation;
  tiles: CargoBayTile[];
}) {
  return (
    <section className="rounded-rsi border border-rsi-border/80 bg-rsi-bg-deep/40 p-3">
      <header className="mb-2 flex items-center justify-between gap-2">
        <h3 className="font-mono text-[0.65rem] font-medium uppercase tracking-[0.2em] text-rsi-text-muted">
          {shipStorageLocationLabels[zone]}
        </h3>
        <span className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-rsi-text-muted">
          {tiles.length} loc
        </span>
      </header>
      {tiles.length === 0 ? (
        <p className="py-4 text-center text-xs text-rsi-text-muted">Empty</p>
      ) : (
        <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
          {tiles.map((tile) => (
            <div key={tile.key} className={tileClasses(tile)}>
              <span className="font-mono text-[0.55rem] uppercase tracking-[0.16em]">
                {tile.role}
              </span>
              <span className="text-sm font-semibold leading-tight text-rsi-text">
                {tile.locationName}
              </span>
              {tile.commodities.length > 0 ? (
                <>
                  {/* Mobile: named list (tooltips are hard to use on touch). */}
                  <ul className="mt-1.5 flex flex-col gap-1 md:hidden">
                    {tile.commodities.map((item) => {
                      const label = `${item.scu} SCU · ${item.commodityName}`;
                      return (
                        <li
                          key={`${tile.key}-${item.commoditySlug}-list`}
                          className="flex items-center gap-1.5 text-xs leading-snug text-rsi-text"
                        >
                          <CommodityIcon
                            commoditySlug={item.commoditySlug}
                            label={label}
                            color={item.color}
                            color2={item.color2}
                            size="sm"
                            showTooltip={false}
                          />
                          <span className="min-w-0 font-medium">{label}</span>
                        </li>
                      );
                    })}
                  </ul>
                  {/* Desktop: compact icons + hover tooltips. */}
                  <div className="mt-1.5 hidden flex-wrap items-center gap-1.5 md:flex">
                    {tile.commodities.map((item) => (
                      <CommodityIcon
                        key={`${tile.key}-${item.commoditySlug}`}
                        commoditySlug={item.commoditySlug}
                        label={`${item.scu} SCU · ${item.commodityName}`}
                        color={item.color}
                        color2={item.color2}
                        size="sm"
                      />
                    ))}
                  </div>
                </>
              ) : null}
              <span className="mt-1 font-mono text-xs tabular-nums opacity-90">
                {tile.scu} SCU
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** Top-down cargo bay: front → middle → rear, 2 location tiles per row. */
export function CargoBayLayout({ rows }: CargoBayLayoutProps) {
  const sections = buildCargoBaySections(rows);

  return (
    <div className="rounded-rsi border border-rsi-border bg-rsi-surface/90 p-4 shadow-rsi-panel">
      <p className="mb-3 font-mono text-[0.65rem] uppercase tracking-[0.22em] text-rsi-accent">
        Cargo layout
      </p>
      <div className="mx-auto flex w-full max-w-md flex-col gap-3">
        {sections.map((section) => (
          <BaySection
            key={section.zone}
            zone={section.zone}
            tiles={section.tiles}
          />
        ))}
      </div>
    </div>
  );
}
