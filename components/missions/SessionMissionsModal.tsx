"use client";

import {
  memo,
  startTransition,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { CatalogMission } from "@/db/schema";
import { CargoBoxCountIcons } from "@/components/ships/CargoBoxSizeIcon";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { fetchCatalogMissionsByIds } from "@/lib/api/catalogMissionsApi";
import { resolveCommodityColorHex } from "@/lib/fixtures/commodityColors";
import {
  boxCountsFromBreakdown,
} from "@/lib/missions/boxBreakdownOptions";
import {
  scuBoxSplitsForScu,
  type ScuBoxSplits,
} from "@/lib/missions/catalogMission";
import { enrichSessionMissionFromCatalog } from "@/lib/missions/enrichSessionMissionFromCatalog";
import {
  stripRankFromTitle,
  type MissionRank,
} from "@/lib/missions/missionRank";
import { cargoBoxSplits } from "@/lib/missions/cargoBoxSplits";
import {
  estimateMissionHaulingRepXp,
  formatHaulingRepXp,
} from "@/lib/missions/haulingRepXp";
import {
  isMissionLocationCompleted,
  missionAuecAmount,
  missionCollectObjectives,
  missionDeliverObjectives,
  missionTotalScu,
} from "@/lib/missions/sessionMissionObjectives";
import type { HaulingChecklistRow } from "@/lib/missions/mockSession";
import type { SessionMission } from "@/lib/missions/sessionMissions";
import { StopMissionBoxConfigModal } from "./StopMissionBoxConfigModal";

export type SessionMissionsModalProps = {
  open: boolean;
  missions: SessionMission[];
  /** Route rows — used to resolve per-stop SCU splits for Collect/Deliver. */
  rows?: HaulingChecklistRow[];
  /** When set, scroll to and highlight this contract row. */
  focusMissionId?: string | null;
  onClose: () => void;
  onToggleHidden: (missionId: string, isHidden: boolean) => void;
  onToggleCompleted: (missionId: string, isCompleted: boolean) => void;
  onRemoveMission: (missionId: string) => void;
  onSelectBoxBreakdown: (
    missionId: string,
    commoditySlug: string,
    breakdown: ScuBoxSplits,
    options?: {
      applyPreferredMaxToRemaining?: boolean;
      onlyUncorrected?: boolean;
    },
  ) => void;
};

function EllipsisIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-3 w-3"
      fill="currentColor"
    >
      <circle cx="5" cy="12" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="19" cy="12" r="1.75" />
    </svg>
  );
}

function VisibilityIcon({ isHidden }: { isHidden: boolean }) {
  if (isHidden) {
    return (
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
        <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    );
  }
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function CompleteIcon({ isCompleted }: { isCompleted: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {isCompleted ? (
        <>
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </>
      ) : (
        <circle cx="12" cy="12" r="9" />
      )}
    </svg>
  );
}

function LocationList({
  items,
}: {
  items: Array<{ label: string; isCompleted: boolean }>;
}) {
  if (items.length === 0) return <span>—</span>;
  if (items.length === 1) {
    const item = items[0]!;
    return (
      <span
        className={[
          "break-words",
          item.isCompleted
            ? "text-rsi-text-muted line-through decoration-rsi-success/50"
            : "",
        ].join(" ")}
      >
        {item.label}
      </span>
    );
  }
  return (
    <ul className="list-disc space-y-0.5 pl-3 text-[0.7rem] leading-snug">
      {items.map((item, index) => (
        <li
          key={`${item.label}-${index}`}
          className={[
            "break-words",
            item.isCompleted
              ? "text-rsi-text-muted line-through decoration-rsi-success/50"
              : "",
          ].join(" ")}
        >
          {item.label}
        </li>
      ))}
    </ul>
  );
}

function formatRewardCell(mission: SessionMission): string {
  const amount = missionAuecAmount(mission);
  if (amount <= 0) return "—";
  return Math.floor(amount).toLocaleString("en-US");
}

const thClass =
  "px-2.5 py-2 text-left font-mono text-[0.55rem] font-medium uppercase tracking-[0.16em] text-rsi-text-muted sm:px-3";

const tdClass =
  "px-2.5 py-2 align-top text-xs leading-snug text-rsi-text-secondary sm:px-3";

function MissionActionsMenu({
  mission,
  onToggleCompleted,
  onToggleHidden,
  onRemoveMission,
}: {
  mission: SessionMission;
  onToggleCompleted: (isCompleted: boolean) => void;
  onToggleHidden: (isHidden: boolean) => void;
  onRemoveMission: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const isHidden = Boolean(mission.isHidden);
  const isCompleted = Boolean(mission.isCompleted);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const itemClass = [
    "flex w-full items-center gap-2 px-3 py-2 text-left text-xs tracking-wide",
    "transition-colors hover:bg-rsi-bg-deep/70",
    "focus-visible:outline-none focus-visible:bg-rsi-bg-deep/70",
  ].join(" ");

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Actions for ${mission.title}`}
        title="Contract actions"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        className={[
          "flex size-8 items-center justify-center rounded-rsi border border-rsi-border bg-rsi-surface md:size-5",
          "text-rsi-text-secondary transition-colors",
          "hover:border-rsi-border-strong hover:text-rsi-text",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
          open ? "border-rsi-accent/50 text-rsi-accent" : "",
        ].join(" ")}
      >
        <EllipsisIcon />
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 min-w-[11.5rem] overflow-hidden rounded-rsi border border-rsi-border bg-rsi-surface shadow-rsi-panel"
        >
          <button
            type="button"
            role="menuitem"
            className={[
              itemClass,
              isCompleted ? "text-rsi-success" : "text-rsi-text-secondary",
            ].join(" ")}
            onClick={() => {
              onToggleCompleted(!isCompleted);
              setOpen(false);
            }}
          >
            <CompleteIcon isCompleted={isCompleted} />
            {isCompleted ? "Reopen contract" : "Complete contract"}
          </button>
          <button
            type="button"
            role="menuitem"
            className={[
              itemClass,
              isHidden ? "text-rsi-accent" : "text-rsi-text-secondary",
            ].join(" ")}
            onClick={() => {
              onToggleHidden(!isHidden);
              setOpen(false);
            }}
          >
            <VisibilityIcon isHidden={isHidden} />
            {isHidden ? "Show in route" : "Hide from route"}
          </button>
          <button
            type="button"
            role="menuitem"
            className={`${itemClass} text-rsi-danger`}
            onClick={() => {
              onRemoveMission();
              setOpen(false);
            }}
          >
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
            Delete from session
          </button>
        </div>
      ) : null}
    </div>
  );
}

function resolvedBoxSplits(mission: SessionMission): ScuBoxSplits {
  const ready = cargoBoxSplits.withDefaults(mission);
  return (
    ready.scuBoxSplits ??
    cargoBoxSplits.aggregate(
      cargoBoxSplits.autoSelectedForMission(mission),
    ) ??
    scuBoxSplitsForScu(missionTotalScu(mission), mission.maxContainerScu)
  );
}

function missionBoxCount(mission: SessionMission): number {
  const ready = cargoBoxSplits.withDefaults(mission);
  const lines = cargoBoxSplits.commodityLines(ready);
  if (lines.length === 0) {
    return boxCountsFromBreakdown(resolvedBoxSplits(mission)).reduce(
      (sum, entry) => sum + entry.count,
      0,
    );
  }
  return lines.reduce((sum, line) => {
    const splits =
      ready.scuCargoBoxSplits?.[line.commoditySlug] ??
      resolvedBoxSplits(mission);
    return (
      sum +
      boxCountsFromBreakdown(splits).reduce(
        (lineSum, entry) => lineSum + entry.count,
        0,
      )
    );
  }, 0);
}

type MissionContractViewModel = {
  isHidden: boolean;
  isCompleted: boolean;
  rank: MissionRank | null;
  title: string;
  totalScu: number;
  reward: string;
  exp: number | null;
  cargoBoxLines: Array<{
    commoditySlug: string;
    commodity: string;
    scu: number;
  }>;
  readyBoxes: ReturnType<typeof cargoBoxSplits.withDefaults>;
  fromLocations: Array<{ label: string; isCompleted: boolean }>;
  toLocations: Array<{ label: string; isCompleted: boolean }>;
  statusBadge: ReactNode;
};

type MissionContractHandlers = {
  onToggleSelect: (missionId: string) => void;
  onToggleHidden: (missionId: string, isHidden: boolean) => void;
  onToggleCompleted: (missionId: string, isCompleted: boolean) => void;
  onRemoveMission: (missionId: string) => void;
  onEditBoxTypes: (missionId: string) => void;
};

function missionContractView(
  mission: SessionMission,
  rows: HaulingChecklistRow[],
): MissionContractViewModel {
  const isHidden = Boolean(mission.isHidden);
  const isCompleted = Boolean(mission.isCompleted);
  const { rank, title } = stripRankFromTitle(mission.title);
  const totalScu = missionTotalScu(mission);
  const readyBoxes = cargoBoxSplits.withDefaults(mission);
  const cargoBoxLines = cargoBoxSplits.commodityLines(readyBoxes);
  const collect = missionCollectObjectives(mission, rows);
  const deliver = missionDeliverObjectives(mission, rows);

  let statusBadge: ReactNode = null;
  if (isCompleted) {
    statusBadge = (
      <span className="font-mono text-[0.5rem] uppercase tracking-[0.14em] text-rsi-success">
        complete
      </span>
    );
  } else if (isHidden) {
    statusBadge = (
      <span className="font-mono text-[0.5rem] uppercase tracking-[0.14em] text-rsi-text-muted">
        hidden
      </span>
    );
  }

  return {
    isHidden,
    isCompleted,
    rank,
    title: title || mission.title,
    totalScu,
    reward: formatRewardCell(mission),
    exp: estimateMissionHaulingRepXp(mission),
    cargoBoxLines,
    readyBoxes,
    fromLocations: collect.map((line) => ({
      label: line.locationLabel,
      isCompleted: isMissionLocationCompleted(
        mission,
        rows,
        line.locationLabel,
        "pickup",
      ),
    })),
    toLocations: deliver.map((line) => ({
      label: line.locationLabel,
      isCompleted: isMissionLocationCompleted(
        mission,
        rows,
        line.locationLabel,
        "delivery",
      ),
    })),
    statusBadge,
  };
}

function cargoLinesOrFallback(
  view: MissionContractViewModel,
): MissionContractViewModel["cargoBoxLines"] {
  if (view.cargoBoxLines.length > 0) return view.cargoBoxLines;
  return [
    {
      commoditySlug: "_",
      commodity: "Cargo",
      scu: view.totalScu,
    },
  ];
}

function MissionBoxesButton({
  mission,
  view,
  onEditBoxTypes,
  className = "",
}: {
  mission: SessionMission;
  view: MissionContractViewModel;
  onEditBoxTypes: (missionId: string) => void;
  className?: string;
}) {
  const { isCompleted, readyBoxes } = view;
  return (
    <button
      type="button"
      disabled={isCompleted}
      title={
        isCompleted
          ? "Box types locked on completed contracts"
          : "Edit box types"
      }
      aria-label={`Edit box types for ${mission.title}`}
      onClick={(event) => {
        event.stopPropagation();
        onEditBoxTypes(mission.id);
      }}
      className={[
        "inline-flex shrink-0 items-center gap-1.5 rounded-rsi border px-2 py-1.5",
        "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
        isCompleted
          ? "cursor-not-allowed border-rsi-border/50 opacity-60"
          : "border-rsi-border bg-rsi-surface/80 hover:border-rsi-accent/50 hover:bg-rsi-accent-muted/25",
        className,
      ].join(" ")}
    >
      <span className="flex flex-col items-start gap-1">
        {cargoLinesOrFallback(view).map((line) => {
          const splits =
            readyBoxes.scuCargoBoxSplits?.[line.commoditySlug] ??
            resolvedBoxSplits(mission);
          const cargoColor =
            resolveCommodityColorHex(null, null, line.commoditySlug) ??
            "var(--rsi-accent)";
          return (
            <span
              key={line.commoditySlug}
              className="flex flex-col items-start gap-0.5"
            >
              <span
                className="font-mono text-[0.45rem] uppercase tracking-[0.1em]"
                style={{
                  color: isCompleted ? "var(--rsi-text-muted)" : cargoColor,
                }}
              >
                {line.commodity}
              </span>
              <CargoBoxCountIcons
                boxCounts={boxCountsFromBreakdown(splits)}
                color={isCompleted ? "var(--rsi-text-muted)" : cargoColor}
                className="gap-x-1.5 [&_svg]:size-4 [&_span]:text-[0.6rem]"
              />
            </span>
          );
        })}
      </span>
    </button>
  );
}

const MissionContractCard = memo(function MissionContractCard({
  mission,
  rows,
  isFocused = false,
  onToggleSelect,
  onToggleHidden,
  onToggleCompleted,
  onRemoveMission,
  onEditBoxTypes,
}: {
  mission: SessionMission;
  rows: HaulingChecklistRow[];
  isFocused?: boolean;
} & MissionContractHandlers) {
  const view = missionContractView(mission, rows);
  const {
    isHidden,
    isCompleted,
    rank,
    title,
    totalScu,
    reward,
    exp,
    fromLocations,
    toLocations,
    statusBadge,
  } = view;

  return (
    <article
      data-mission-id={mission.id}
      aria-selected={isFocused}
      onClick={(event) => {
        const target = event.target as HTMLElement | null;
        if (target?.closest("button, a, [role='menu']")) return;
        onToggleSelect(mission.id);
      }}
      className={[
        "[content-visibility:auto] [contain-intrinsic-size:auto_9rem]",
        "cursor-pointer rounded-rsi border border-rsi-border/70 p-3",
        isHidden ? "opacity-55" : "",
        isFocused
          ? "bg-rsi-accent-muted/35 ring-1 ring-rsi-accent/70"
          : isCompleted
            ? "bg-rsi-success/5"
            : "bg-rsi-bg-deep/25",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span
              className={[
                "font-mono text-[0.55rem] tracking-[0.08em]",
                isCompleted ? "text-rsi-text-muted" : "text-rsi-accent",
              ].join(" ")}
            >
              {rank ?? "—"}
            </span>
            {statusBadge}
          </div>
          <p
            className={[
              "mt-0.5 text-sm font-semibold tracking-wide break-words hyphens-auto",
              isCompleted
                ? "text-rsi-text-muted line-through decoration-rsi-success/40"
                : "text-rsi-text",
            ].join(" ")}
          >
            {title}
          </p>
          <ul
            className={[
              "mt-1 list-disc space-y-0.5 pl-3 text-[0.7rem] leading-snug text-rsi-text-muted",
              isCompleted ? "line-through opacity-80" : "",
            ].join(" ")}
          >
            {cargoLinesOrFallback(view).map((line) => (
              <li key={line.commoditySlug} className="break-words">
                {line.scu} SCU {line.commodity}
              </li>
            ))}
          </ul>
        </div>
        <MissionActionsMenu
          mission={mission}
          onToggleCompleted={(isCompletedNext) =>
            onToggleCompleted(mission.id, isCompletedNext)
          }
          onToggleHidden={(isHiddenNext) =>
            onToggleHidden(mission.id, isHiddenNext)
          }
          onRemoveMission={() => onRemoveMission(mission.id)}
        />
      </div>

      <dl className="mt-2.5 grid grid-cols-3 gap-2 border-t border-rsi-border/50 pt-2.5 font-mono text-[0.65rem] tabular-nums">
        <div>
          <dt className="text-[0.5rem] uppercase tracking-[0.14em] text-rsi-text-muted">
            Reward
          </dt>
          <dd className="mt-0.5 text-rsi-accent">{reward}</dd>
        </div>
        <div>
          <dt className="text-[0.5rem] uppercase tracking-[0.14em] text-rsi-text-muted">
            SCU
          </dt>
          <dd className="mt-0.5 text-rsi-text">{totalScu}</dd>
        </div>
        <div>
          <dt className="text-[0.5rem] uppercase tracking-[0.14em] text-rsi-text-muted">
            EXP
          </dt>
          <dd
            className="mt-0.5 text-rsi-text"
            title={
              exp != null
                ? `Approximate Covalex hauling reputation XP: ${exp.toLocaleString("en-US")}`
                : "Approximate Covalex hauling reputation XP"
            }
          >
            {exp != null ? formatHaulingRepXp(exp) : "—"}
          </dd>
        </div>
      </dl>

      <div className="mt-2.5 grid grid-cols-2 gap-3 text-[0.7rem] leading-snug text-rsi-text-secondary">
        <div className="min-w-0">
          <p className="font-mono text-[0.5rem] uppercase tracking-[0.14em] text-rsi-text-muted">
            From
          </p>
          <div className="mt-0.5">
            <LocationList items={fromLocations} />
          </div>
        </div>
        <div className="min-w-0">
          <p className="font-mono text-[0.5rem] uppercase tracking-[0.14em] text-rsi-text-muted">
            To
          </p>
          <div className="mt-0.5">
            <LocationList items={toLocations} />
          </div>
        </div>
      </div>

      <div className="mt-2.5">
        <MissionBoxesButton
          mission={mission}
          view={view}
          onEditBoxTypes={onEditBoxTypes}
          className="w-full justify-start sm:w-auto"
        />
      </div>
    </article>
  );
});

const MissionContractRow = memo(function MissionContractRow({
  mission,
  rows,
  isFocused = false,
  onToggleSelect,
  onToggleHidden,
  onToggleCompleted,
  onRemoveMission,
  onEditBoxTypes,
}: {
  mission: SessionMission;
  rows: HaulingChecklistRow[];
  isFocused?: boolean;
} & MissionContractHandlers) {
  const view = missionContractView(mission, rows);
  const {
    isHidden,
    isCompleted,
    rank,
    title,
    totalScu,
    reward,
    exp,
    fromLocations,
    toLocations,
    statusBadge,
  } = view;

  return (
    <tr
      data-mission-id={mission.id}
      aria-selected={isFocused}
      onClick={(event) => {
        const target = event.target as HTMLElement | null;
        if (target?.closest("button, a, [role='menu']")) return;
        onToggleSelect(mission.id);
      }}
      className={[
        // Skip off-screen row paint work while scrolling the contracts list.
        "[content-visibility:auto] [contain-intrinsic-size:auto_4.5rem]",
        "cursor-pointer border-b border-rsi-border/50 last:border-b-0",
        isHidden ? "opacity-55" : "",
        isFocused
          ? "bg-rsi-accent-muted/35 ring-1 ring-inset ring-rsi-accent/70"
          : isCompleted
            ? "bg-rsi-success/5"
            : "hover:bg-rsi-bg-deep/35",
      ].join(" ")}
    >
      <td className={tdClass}>
        <span
          className={[
            "font-mono text-[0.5rem] tracking-[0.08em]",
            isCompleted ? "text-rsi-text-muted" : "text-rsi-accent",
          ].join(" ")}
        >
          {rank ?? "—"}
        </span>
      </td>
      <td className={`${tdClass} w-[14rem] max-w-[14rem]`}>
        <p
          className={[
            "text-[0.7rem] font-semibold tracking-wide break-words hyphens-auto",
            isCompleted
              ? "text-rsi-text-muted line-through decoration-rsi-success/40"
              : "text-rsi-text",
          ].join(" ")}
        >
          {title}
        </p>
        <ul
          className={[
            "mt-0.5 list-disc space-y-0.5 pl-3 text-[0.65rem] leading-snug text-rsi-text-muted",
            isCompleted ? "line-through opacity-80" : "",
          ].join(" ")}
        >
          {cargoLinesOrFallback(view).map((line) => (
            <li key={line.commoditySlug} className="break-words">
              {line.scu} SCU {line.commodity}
            </li>
          ))}
        </ul>
        {statusBadge ? <div className="mt-0.5">{statusBadge}</div> : null}
      </td>
      <td
        className={`${tdClass} text-right font-mono text-[0.7rem] tabular-nums text-rsi-accent`}
      >
        {reward}
      </td>
      <td
        className={`${tdClass} text-right font-mono text-[0.7rem] tabular-nums text-rsi-text`}
      >
        {totalScu}
      </td>
      <td
        className={`${tdClass} text-right font-mono text-[0.7rem] tabular-nums text-rsi-text`}
        title={
          exp != null
            ? `Approximate Covalex hauling reputation XP: ${exp.toLocaleString("en-US")}`
            : "Approximate Covalex hauling reputation XP"
        }
      >
        {exp != null ? formatHaulingRepXp(exp) : "—"}
      </td>
      <td className={tdClass}>
        <LocationList items={fromLocations} />
      </td>
      <td className={tdClass}>
        <LocationList items={toLocations} />
      </td>
      <td className={tdClass}>
        <MissionBoxesButton
          mission={mission}
          view={view}
          onEditBoxTypes={onEditBoxTypes}
        />
      </td>
      <td className={`${tdClass} w-10`}>
        <MissionActionsMenu
          mission={mission}
          onToggleCompleted={(isCompletedNext) =>
            onToggleCompleted(mission.id, isCompletedNext)
          }
          onToggleHidden={(isHiddenNext) =>
            onToggleHidden(mission.id, isHiddenNext)
          }
          onRemoveMission={() => onRemoveMission(mission.id)}
        />
      </td>
    </tr>
  );
});

export function SessionMissionsModal({
  open,
  missions,
  rows = [],
  focusMissionId = null,
  onClose,
  onToggleHidden,
  onToggleCompleted,
  onRemoveMission,
  onSelectBoxBreakdown,
}: SessionMissionsModalProps) {
  const [enriched, setEnriched] = useState<SessionMission[]>(missions);
  const [boxEditMissionId, setBoxEditMissionId] = useState<string | null>(null);
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(
    null,
  );
  /** Keep DOM warm after first open so close/reopen is CSS-only. */
  const [retain, setRetain] = useState(false);
  /** Defer heavy row paint one frame so the dialog chrome can appear first. */
  const [paintRows, setPaintRows] = useState(false);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const catalogByIdRef = useRef<Map<string, CatalogMission>>(new Map());
  const catalogIdsKeyRef = useRef<string>("");

  const catalogIdsKey = useMemo(
    () =>
      missions
        .map((mission) => mission.catalogMissionId)
        .filter((id): id is string => Boolean(id))
        .sort()
        .join(","),
    [missions],
  );

  const applyCatalogOverlay = useCallback(
    (nextMissions: SessionMission[]) =>
      nextMissions.map((mission) =>
        enrichSessionMissionFromCatalog(
          mission,
          mission.catalogMissionId
            ? catalogByIdRef.current.get(mission.catalogMissionId)
            : null,
        ),
      ),
    [],
  );

  useEffect(() => {
    if (!open) return;
    setRetain(true);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && boxEditMissionId == null) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, boxEditMissionId]);

  useEffect(() => {
    if (!open) {
      setSelectedMissionId(null);
      setBoxEditMissionId(null);
      return;
    }
    setSelectedMissionId(focusMissionId ?? null);
  }, [open, focusMissionId]);

  useEffect(() => {
    if (!open) return;
    if (paintRows) return;
    const frame = window.requestAnimationFrame(() => {
      startTransition(() => setPaintRows(true));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, paintRows]);

  // Prefetch / refresh catalog overlay even while closed so open is not network-bound.
  useEffect(() => {
    setEnriched(applyCatalogOverlay(missions));

    if (!catalogIdsKey) {
      catalogByIdRef.current = new Map();
      catalogIdsKeyRef.current = "";
      return;
    }

    if (catalogIdsKey === catalogIdsKeyRef.current) return;

    let cancelled = false;
    const ids = catalogIdsKey.split(",");
    void fetchCatalogMissionsByIds(ids)
      .then((catalogRows) => {
        if (cancelled) return;
        catalogByIdRef.current = new Map(
          catalogRows.map((row) => [row.id, row]),
        );
        catalogIdsKeyRef.current = catalogIdsKey;
        setEnriched(applyCatalogOverlay(missions));
      })
      .catch(() => {
        if (!cancelled) setEnriched(missions);
      });

    return () => {
      cancelled = true;
    };
  }, [missions, catalogIdsKey, applyCatalogOverlay]);

  const boxEditMission =
    boxEditMissionId == null
      ? null
      : (enriched.find((mission) => mission.id === boxEditMissionId) ?? null);

  const columnTotals = useMemo(() => {
    let rewardAuec = 0;
    let rewardEarned = 0;
    let scu = 0;
    let scuEarned = 0;
    let exp = 0;
    let expEarned = 0;
    let boxes = 0;
    for (const mission of enriched) {
      const missionScu = missionTotalScu(mission);
      const missionReward = missionAuecAmount(mission);
      const missionExp = estimateMissionHaulingRepXp(mission) ?? 0;
      rewardAuec += missionReward;
      scu += missionScu;
      exp += missionExp;
      boxes += missionBoxCount(mission);
      if (mission.isCompleted) {
        rewardEarned += missionReward;
        scuEarned += missionScu;
        expEarned += missionExp;
      }
    }
    return { rewardAuec, rewardEarned, scu, scuEarned, exp, expEarned, boxes };
  }, [enriched]);

  const onToggleSelect = useCallback((missionId: string) => {
    setSelectedMissionId((current) =>
      current === missionId ? null : missionId,
    );
  }, []);

  const handleToggleHidden = useCallback(
    (missionId: string, isHidden: boolean) => {
      onToggleHidden(missionId, isHidden);
    },
    [onToggleHidden],
  );

  const handleToggleCompleted = useCallback(
    (missionId: string, isCompleted: boolean) => {
      onToggleCompleted(missionId, isCompleted);
    },
    [onToggleCompleted],
  );

  const handleRemoveMission = useCallback(
    (missionId: string) => {
      onRemoveMission(missionId);
    },
    [onRemoveMission],
  );

  const handleEditBoxTypes = useCallback((missionId: string) => {
    setBoxEditMissionId(missionId);
  }, []);

  useEffect(() => {
    if (!open || !selectedMissionId) return;
    // Only auto-scroll for the initial focus from a stop tile.
    if (selectedMissionId !== focusMissionId) return;
    const id = window.requestAnimationFrame(() => {
      const row = tableScrollRef.current?.querySelector(
        `[data-mission-id="${CSS.escape(selectedMissionId)}"]`,
      );
      if (!(row instanceof HTMLElement)) return;
      row.scrollIntoView({ block: "center", behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(id);
  }, [open, focusMissionId, selectedMissionId, enriched]);

  if (!open && !retain) return null;

  return (
    <div
      className={[
        "fixed inset-0 z-50 flex items-stretch justify-center bg-rsi-bg-deep/85 p-0 sm:items-center sm:p-4",
        open ? "" : "hidden",
      ].join(" ")}
      role="dialog"
      aria-modal={open}
      aria-label="Contracts"
      aria-hidden={!open}
      inert={!open ? true : undefined}
      onClick={(event) => {
        if (!open) return;
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex h-[100dvh] w-full max-w-6xl flex-col overflow-hidden border-rsi-border bg-rsi-surface shadow-rsi-panel sm:h-auto sm:max-h-[90vh] sm:rounded-rsi sm:border">
        <header className="relative border-b border-rsi-divider px-4 py-3 pr-12 sm:px-5 sm:py-4 sm:pr-14">
          <ModalCloseButton onClick={onClose} />
          <h2 className="min-w-0 truncate text-base font-semibold tracking-wide text-rsi-text sm:text-lg">
            Contracts
          </h2>
        </header>

        <div
          ref={tableScrollRef}
          className="min-h-0 flex-1 overflow-auto overscroll-contain"
        >
          {enriched.length === 0 ? (
            <p className="px-4 py-4 text-sm text-rsi-text-muted sm:px-5 sm:py-5">
              No contracts in this session.
            </p>
          ) : !paintRows ? (
            <p className="px-4 py-4 text-sm text-rsi-text-muted sm:px-5 sm:py-5">
              Loading contracts…
            </p>
          ) : (
            <>
              {/* Mobile: stacked cards — no horizontal scroll */}
              <div className="space-y-2.5 p-3 pb-4 md:hidden">
                {enriched.map((mission) => (
                  <MissionContractCard
                    key={mission.id}
                    mission={mission}
                    rows={rows}
                    isFocused={mission.id === selectedMissionId}
                    onToggleSelect={onToggleSelect}
                    onToggleHidden={handleToggleHidden}
                    onToggleCompleted={handleToggleCompleted}
                    onRemoveMission={handleRemoveMission}
                    onEditBoxTypes={handleEditBoxTypes}
                  />
                ))}
              </div>

              {/* Desktop: full contracts table */}
              <table className="hidden w-full min-w-[58rem] border-collapse text-left md:table">
                <thead className="sticky top-0 z-10 border-b border-rsi-border bg-rsi-surface">
                  <tr>
                    <th className={`${thClass} w-[5.25rem]`}>Rank</th>
                    <th className={`${thClass} w-[14rem]`}>Title</th>
                    <th className={`${thClass} w-[9.5rem] text-right`}>
                      Reward
                    </th>
                    <th className={`${thClass} w-[7.5rem] text-right`}>SCU</th>
                    <th
                      className={`${thClass} w-[7.5rem] text-right`}
                      title="Approximate Covalex hauling reputation XP"
                    >
                      EXP
                    </th>
                    <th className={`${thClass} w-[12%] min-w-0`}>From</th>
                    <th className={`${thClass} w-[12%] min-w-0`}>To</th>
                    <th className={`${thClass} min-w-[8rem] w-[14%]`}>Boxes</th>
                    <th className={`${thClass} w-10`}>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {enriched.map((mission) => (
                    <MissionContractRow
                      key={mission.id}
                      mission={mission}
                      rows={rows}
                      isFocused={mission.id === selectedMissionId}
                      onToggleSelect={onToggleSelect}
                      onToggleHidden={handleToggleHidden}
                      onToggleCompleted={handleToggleCompleted}
                      onRemoveMission={handleRemoveMission}
                      onEditBoxTypes={handleEditBoxTypes}
                    />
                  ))}
                </tbody>
                <tfoot className="sticky bottom-0 border-t border-rsi-border bg-rsi-surface">
                  <tr className="whitespace-nowrap">
                    <td className={`${tdClass} py-2.5`}>
                      <span className="font-mono text-[0.55rem] uppercase tracking-[0.16em] text-rsi-text-muted">
                        Total
                      </span>
                    </td>
                    <td
                      className={`${tdClass} py-2.5 text-right font-mono text-[0.65rem] tabular-nums text-rsi-text`}
                      colSpan={2}
                      title="Earned / session total aUEC"
                    >
                      {columnTotals.rewardAuec > 0 ? (
                        <>
                          <span
                            className={
                              columnTotals.rewardEarned > 0
                                ? "text-rsi-success"
                                : undefined
                            }
                          >
                            {Math.floor(
                              columnTotals.rewardEarned,
                            ).toLocaleString("en-US")}
                          </span>
                          {" / "}
                          {Math.floor(columnTotals.rewardAuec).toLocaleString(
                            "en-US",
                          )}{" "}
                          aUEC
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td
                      className={`${tdClass} py-2.5 text-right font-mono text-[0.65rem] tabular-nums text-rsi-text`}
                      title="Completed contract SCU / session total SCU"
                    >
                      <span
                        className={
                          columnTotals.scuEarned > 0
                            ? "text-rsi-success"
                            : undefined
                        }
                      >
                        {columnTotals.scuEarned}
                      </span>
                      {" / "}
                      {columnTotals.scu} SCU
                    </td>
                    <td
                      className={`${tdClass} py-2.5 text-right font-mono text-[0.65rem] tabular-nums text-rsi-text`}
                      title={`Earned / session total approximate hauling EXP: ${columnTotals.expEarned.toLocaleString("en-US")} / ${columnTotals.exp.toLocaleString("en-US")}`}
                    >
                      {columnTotals.exp > 0 ? (
                        <>
                          <span
                            className={
                              columnTotals.expEarned > 0
                                ? "text-rsi-success"
                                : undefined
                            }
                          >
                            {formatHaulingRepXp(columnTotals.expEarned)}
                          </span>
                          {" / "}
                          {formatHaulingRepXp(columnTotals.exp)} EXP
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={`${tdClass} py-2.5`} />
                    <td className={`${tdClass} py-2.5`} />
                    <td
                      className={`${tdClass} py-2.5 font-mono text-[0.65rem] tabular-nums text-rsi-text`}
                    >
                      {columnTotals.boxes} boxes
                    </td>
                    <td className={`${tdClass} py-2.5`} />
                  </tr>
                </tfoot>
              </table>
            </>
          )}
        </div>

        {paintRows && enriched.length > 0 ? (
          <footer className="shrink-0 border-t border-rsi-border bg-rsi-surface px-3 py-2.5 md:hidden">
            <p className="font-mono text-[0.5rem] uppercase tracking-[0.16em] text-rsi-text-muted">
              Total
            </p>
            <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1.5 font-mono text-[0.65rem] tabular-nums text-rsi-text">
              <div title="Earned / session total aUEC">
                <dt className="text-[0.45rem] uppercase tracking-[0.12em] text-rsi-text-muted">
                  aUEC
                </dt>
                <dd className="mt-0.5">
                  {columnTotals.rewardAuec > 0 ? (
                    <>
                      <span
                        className={
                          columnTotals.rewardEarned > 0
                            ? "text-rsi-success"
                            : undefined
                        }
                      >
                        {Math.floor(columnTotals.rewardEarned).toLocaleString(
                          "en-US",
                        )}
                      </span>
                      {" / "}
                      {Math.floor(columnTotals.rewardAuec).toLocaleString(
                        "en-US",
                      )}
                    </>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div title="Completed contract SCU / session total SCU">
                <dt className="text-[0.45rem] uppercase tracking-[0.12em] text-rsi-text-muted">
                  SCU
                </dt>
                <dd className="mt-0.5">
                  <span
                    className={
                      columnTotals.scuEarned > 0
                        ? "text-rsi-success"
                        : undefined
                    }
                  >
                    {columnTotals.scuEarned}
                  </span>
                  {" / "}
                  {columnTotals.scu}
                </dd>
              </div>
              <div
                title={`Earned / session total approximate hauling EXP: ${columnTotals.expEarned.toLocaleString("en-US")} / ${columnTotals.exp.toLocaleString("en-US")}`}
              >
                <dt className="text-[0.45rem] uppercase tracking-[0.12em] text-rsi-text-muted">
                  EXP
                </dt>
                <dd className="mt-0.5">
                  {columnTotals.exp > 0 ? (
                    <>
                      <span
                        className={
                          columnTotals.expEarned > 0
                            ? "text-rsi-success"
                            : undefined
                        }
                      >
                        {formatHaulingRepXp(columnTotals.expEarned)}
                      </span>
                      {" / "}
                      {formatHaulingRepXp(columnTotals.exp)}
                    </>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-[0.45rem] uppercase tracking-[0.12em] text-rsi-text-muted">
                  Boxes
                </dt>
                <dd className="mt-0.5">{columnTotals.boxes}</dd>
              </div>
            </dl>
          </footer>
        ) : null}
      </div>

      {open && boxEditMission ? (
        <StopMissionBoxConfigModal
          mission={boxEditMission}
          onClose={() => setBoxEditMissionId(null)}
          onSelectBoxBreakdown={(commoditySlug, breakdown, options) => {
            onSelectBoxBreakdown(
              boxEditMission.id,
              commoditySlug,
              breakdown,
              options,
            );
            const lines = cargoBoxSplits.commodityLines(boxEditMission);
            if (lines.length <= 1) setBoxEditMissionId(null);
          }}
        />
      ) : null}
    </div>
  );
}
