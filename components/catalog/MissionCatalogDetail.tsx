"use client";

import type { CatalogMission } from "@/db/schema";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import {
  catalogCargoSummary,
  catalogPayload,
  catalogRewardLabel,
  catalogRouteSummary,
  contractorDisplayName,
  locationDisplayName,
} from "@/lib/missions/catalogMissionDisplay";
import { screenshotUrlFromLogicalPath } from "@/lib/missions/catalogScreenshotUrl";
import { haulingCategoryShortLabel } from "@/lib/missions/haulingCategory";
import { SCU_TITLE } from "@/lib/ui/abbrevTitles";

export type MissionCatalogDetailProps = {
  mission: CatalogMission;
  onClose: () => void;
  onViewSource?: (mission: CatalogMission) => void;
};

function MetaRow({
  label,
  value,
  labelTitle,
}: {
  label: string;
  value: string;
  labelTitle?: string;
}) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-2 text-sm">
      <dt
        className="font-mono text-[0.55rem] uppercase tracking-[0.16em] text-rsi-text-muted"
        title={labelTitle}
      >
        {label}
      </dt>
      <dd className="text-rsi-text-secondary">{value}</dd>
    </div>
  );
}

export function MissionCatalogDetail({
  mission,
  onClose,
  onViewSource,
}: MissionCatalogDetailProps) {
  const payload = catalogPayload(mission);
  const route = catalogRouteSummary(mission);
  const sourceUrl = screenshotUrlFromLogicalPath(mission.latestScreenshotPath);
  const box = mission.scuBoxSplits;

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-rsi-bg-deep/80 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Contract details"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex h-[100dvh] w-full max-w-lg flex-col overflow-hidden border-rsi-border bg-rsi-surface shadow-rsi-panel sm:h-auto sm:max-h-[90vh] sm:rounded-rsi sm:border">
        <header className="relative border-b border-rsi-divider px-4 py-3 pr-12 sm:px-5 sm:py-4 sm:pr-14">
          <ModalCloseButton onClick={onClose} />
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-rsi-accent">
            Catalog · {mission.type}
          </p>
          <h2 className="mt-1 text-base font-semibold tracking-wide text-rsi-text sm:text-lg">
            {mission.title}
          </h2>
          {mission.contractorSlug ? (
            <p className="mt-1 text-sm text-rsi-text-muted">
              {contractorDisplayName(mission.contractorSlug)}
            </p>
          ) : null}
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
          <dl className="space-y-2">
            <MetaRow label="Reward" value={catalogRewardLabel(mission)} />
            <MetaRow
              label="Category"
              value={
                haulingCategoryShortLabel(catalogPayload(mission)?.category) ??
                "—"
              }
            />
            <MetaRow
              label="Offer at"
              value={locationDisplayName(mission.offerLocationSlug)}
            />
            <MetaRow
              label="From"
              value={route.from.join(" · ") || "—"}
            />
            <MetaRow label="To" value={route.to.join(" · ") || "—"} />
            <MetaRow label="Cargo" value={catalogCargoSummary(mission)} />
            <MetaRow
              label="SCU total"
              labelTitle={SCU_TITLE}
              value={`${mission.scuTotal}`}
            />
            {mission.scuMaxContainerSize ? (
              <MetaRow
                label="SCU max container"
                labelTitle={SCU_TITLE}
                value={`${mission.scuMaxContainerSize}`}
              />
            ) : null}
            <MetaRow
              label="Crates"
              value={[
                box.scuThirtyTwo ? `${box.scuThirtyTwo}×32` : null,
                box.scuSixteen ? `${box.scuSixteen}×16` : null,
                box.scuEight ? `${box.scuEight}×8` : null,
                box.scuFour ? `${box.scuFour}×4` : null,
                box.scuTwo ? `${box.scuTwo}×2` : null,
                box.scuOne ? `${box.scuOne}×1` : null,
              ]
                .filter(Boolean)
                .join(" · ") || "—"}
            />
            <MetaRow
              label="Runs"
              value={
                mission.missionRunCount > 0
                  ? `${mission.missionRunCount}${
                      mission.missionAvgDurationMs
                        ? ` · avg ${Math.round(mission.missionAvgDurationMs / 60000)}m`
                        : ""
                    }`
                  : "None recorded"
              }
            />
          </dl>

          {payload?.cargo && payload.cargo.length > 0 ? (
            <div>
              <p className="font-mono text-[0.55rem] uppercase tracking-[0.16em] text-rsi-text-muted">
                Cargo lines
              </p>
              <ul className="mt-2 space-y-1 border-l border-rsi-border/70 pl-3">
                {payload.cargo.map((line) => (
                  <li
                    key={`${line.commoditySlug}-${line.scu}`}
                    className="font-mono text-sm tabular-nums text-rsi-text-secondary"
                  >
                    {line.scu} {line.commodityName}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <footer className="border-t border-rsi-divider px-4 py-3 sm:px-5">
          <button
            type="button"
            disabled={!sourceUrl}
            onClick={() => onViewSource?.(mission)}
            className={[
              "rounded-rsi border px-3 py-2 font-mono text-[0.65rem] uppercase tracking-[0.16em] transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
              sourceUrl
                ? "border-rsi-border text-rsi-text-secondary hover:border-rsi-accent/50 hover:text-rsi-accent"
                : "cursor-not-allowed border-rsi-border/50 text-rsi-text-muted opacity-50",
            ].join(" ")}
          >
            View source
          </button>
        </footer>
      </div>
    </div>
  );
}
