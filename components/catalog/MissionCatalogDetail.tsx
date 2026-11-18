"use client";

import type { CatalogMission } from "@/db/schema";
import {
  CatalogCargoBadges,
  CatalogLocationBadges,
} from "@/components/catalog/CatalogRouteBadges";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import {
  catalogPayload,
  catalogRewardLabel,
  catalogRouteBadgeItems,
  catalogScuSplitsCaption,
  contractorDisplayName,
  locationDisplayName,
} from "@/lib/missions/catalogMissionDisplay";
import { screenshotUrlFromLogicalPath } from "@/lib/missions/catalogScreenshotUrl";
import { haulingCategoryShortLabel } from "@/lib/missions/haulingCategory";
import { SCU_TITLE } from "@/lib/ui/abbrevTitles";
import type { ReactNode } from "react";

export type MissionCatalogDetailProps = {
  mission: CatalogMission;
  onClose: () => void;
  onViewSource?: (mission: CatalogMission) => void;
};

function MetaRow({
  label,
  value,
  labelTitle,
  valueTitle,
}: {
  label: string;
  value: ReactNode;
  labelTitle?: string;
  valueTitle?: string;
}) {
  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)] items-start gap-x-3">
      <dt
        className="flex min-h-5 items-center font-mono text-[0.55rem] leading-none uppercase tracking-[0.16em] text-rsi-text-muted"
        title={labelTitle}
      >
        {label}
      </dt>
      <dd
        className="flex min-h-5 min-w-0 items-center text-sm leading-snug text-rsi-text-secondary"
        title={valueTitle}
      >
        {value}
      </dd>
    </div>
  );
}

export function MissionCatalogDetail({
  mission,
  onClose,
  onViewSource,
}: MissionCatalogDetailProps) {
  const payload = catalogPayload(mission);
  const route = catalogRouteBadgeItems(mission);
  const sourceUrl = screenshotUrlFromLogicalPath(mission.latestScreenshotPath);
  const box = mission.scuBoxSplits;
  const splitLines = catalogScuSplitsCaption(mission)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const objectives = payload?.objectives?.filter((line) => line.trim()) ?? [];
  const boxesLabel = [
    box.scuThirtyTwo ? `${box.scuThirtyTwo}×32` : null,
    box.scuSixteen ? `${box.scuSixteen}×16` : null,
    box.scuEight ? `${box.scuEight}×8` : null,
    box.scuFour ? `${box.scuFour}×4` : null,
    box.scuTwo ? `${box.scuTwo}×2` : null,
    box.scuOne ? `${box.scuOne}×1` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-rsi-bg-deep/80 px-3 pt-14 pb-3 backdrop-blur-sm sm:items-center sm:px-4 sm:pt-14 sm:pb-4"
      role="dialog"
      aria-modal="true"
      aria-label="Contract details"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="relative flex h-[calc(100dvh-4.25rem)] w-full max-w-lg sm:h-auto sm:max-h-[90vh]">
        <ModalCloseButton onClick={onClose} />
        <div className="flex h-full w-full flex-col overflow-hidden border-rsi-border bg-rsi-surface shadow-rsi-panel sm:rounded-rsi sm:border">
        <header className="border-b border-rsi-divider px-4 py-3 sm:px-5 sm:py-4">
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
            <MetaRow
              label="Reward"
              value={
                <span className="font-mono text-[0.7rem] tabular-nums text-rsi-accent">
                  {catalogRewardLabel(mission, {
                    includeAuecUnit: false,
                    compact: true,
                  })}
                </span>
              }
              valueTitle={catalogRewardLabel(mission, {
                includeAuecUnit: true,
              })}
            />
            <MetaRow
              label="Category"
              value={
                haulingCategoryShortLabel(catalogPayload(mission)?.category) ??
                "—"
              }
            />
            <MetaRow label="Rank" value={mission.rank ?? "—"} />
            <MetaRow
              label="Offer at"
              value={locationDisplayName(mission.offerLocationSlug)}
            />
            <MetaRow
              label="From"
              value={<CatalogLocationBadges items={route.from} tone="from" />}
            />
            <MetaRow
              label="To"
              value={<CatalogLocationBadges items={route.to} tone="to" />}
            />
            <MetaRow
              label="Cargo"
              value={<CatalogCargoBadges mission={mission} />}
            />
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
            <MetaRow label="Boxes" value={boxesLabel || "—"} />
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

          {splitLines.length > 0 ? (
            <div>
              <p className="font-mono text-[0.55rem] uppercase tracking-[0.16em] text-rsi-text-muted">
                Stops
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-rsi-text-secondary">
                {splitLines.map((line, index) => (
                  <li key={`${index}-${line}`}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {objectives.length > 0 ? (
            <div>
              <p className="font-mono text-[0.55rem] uppercase tracking-[0.16em] text-rsi-text-muted">
                Objectives
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-rsi-text-secondary">
                {objectives.map((line) => (
                  <li key={line}>{line}</li>
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
    </div>
  );
}
