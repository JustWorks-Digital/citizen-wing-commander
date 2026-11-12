"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
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
import { stripRankFromTitle } from "@/lib/missions/missionRank";
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
          "flex size-5 items-center justify-center rounded-rsi border border-rsi-border bg-rsi-surface",
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

function MissionContractRow({
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
  onToggleSelect: () => void;
  onToggleHidden: (isHidden: boolean) => void;
  onToggleCompleted: (isCompleted: boolean) => void;
  onRemoveMission: () => void;
  onEditBoxTypes: () => void;
}) {
  const isHidden = Boolean(mission.isHidden);
  const isCompleted = Boolean(mission.isCompleted);
  const { rank, title } = stripRankFromTitle(mission.title);
  const totalScu = missionTotalScu(mission);
  const reward = formatRewardCell(mission);
  const exp = estimateMissionHaulingRepXp(mission);
  const collect = missionCollectObjectives(mission, rows);
  const deliver = missionDeliverObjectives(mission, rows);
  const readyBoxes = cargoBoxSplits.withDefaults(mission);
  const cargoBoxLines = cargoBoxSplits.commodityLines(readyBoxes);
  const fromLocations = collect.map((line) => ({
    label: line.locationLabel,
    isCompleted: isMissionLocationCompleted(
      mission,
      rows,
      line.locationLabel,
      "pickup",
    ),
  }));
  const toLocations = deliver.map((line) => ({
    label: line.locationLabel,
    isCompleted: isMissionLocationCompleted(
      mission,
      rows,
      line.locationLabel,
      "delivery",
    ),
  }));

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

  return (
    <tr
      data-mission-id={mission.id}
      aria-selected={isFocused}
      onClick={(event) => {
        const target = event.target as HTMLElement | null;
        if (target?.closest("button, a, [role='menu']")) return;
        onToggleSelect();
      }}
      className={[
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
      <td className={`${tdClass} w-[9.5rem] max-w-[9.5rem]`}>
        <p
          className={[
            "text-[0.7rem] font-semibold tracking-wide break-words hyphens-auto",
            isCompleted
              ? "text-rsi-text-muted line-through decoration-rsi-success/40"
              : "text-rsi-text",
          ].join(" ")}
        >
          {title || mission.title}
        </p>
        <ul
          className={[
            "mt-0.5 list-disc space-y-0.5 pl-3 text-[0.65rem] leading-snug text-rsi-text-muted",
            isCompleted ? "line-through opacity-80" : "",
          ].join(" ")}
        >
          {(cargoBoxLines.length > 0
            ? cargoBoxLines
            : [
                {
                  commoditySlug: "_",
                  commodity: "Cargo",
                  scu: totalScu,
                },
              ]
          ).map((line) => (
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
            onEditBoxTypes();
          }}
          className={[
            "inline-flex shrink-0 items-center gap-1.5 rounded-rsi border px-2 py-1",
            "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
            isCompleted
              ? "cursor-not-allowed border-rsi-border/50 opacity-60"
              : "border-rsi-border bg-rsi-surface/80 hover:border-rsi-accent/50 hover:bg-rsi-accent-muted/25",
          ].join(" ")}
        >
          <span className="flex flex-col items-start gap-1">
            {(cargoBoxLines.length > 0
              ? cargoBoxLines
              : [
                  {
                    commoditySlug: "_",
                    commodity: "Cargo",
                    scu: totalScu,
                  },
                ]
            ).map((line) => {
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
                  {cargoBoxLines.length > 1 ? (
                    <span
                      className="font-mono text-[0.45rem] uppercase tracking-[0.1em]"
                      style={{
                        color: isCompleted
                          ? "var(--rsi-text-muted)"
                          : cargoColor,
                      }}
                    >
                      {line.commodity}
                    </span>
                  ) : null}
                  <CargoBoxCountIcons
                    boxCounts={boxCountsFromBreakdown(splits)}
                    color={
                      isCompleted ? "var(--rsi-text-muted)" : cargoColor
                    }
                    className="gap-x-1.5 [&_svg]:size-4 [&_span]:text-[0.6rem]"
                  />
                </span>
              );
            })}
          </span>
        </button>
      </td>
      <td className={`${tdClass} w-10`}>
        <MissionActionsMenu
          mission={mission}
          onToggleCompleted={onToggleCompleted}
          onToggleHidden={onToggleHidden}
          onRemoveMission={onRemoveMission}
        />
      </td>
    </tr>
  );
}

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
  const tableScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
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
    if (!open) {
      setEnriched(missions);
      return;
    }
    let cancelled = false;
    setEnriched(missions);
    const ids = missions
      .map((mission) => mission.catalogMissionId)
      .filter((id): id is string => Boolean(id));
    if (ids.length === 0) return;

    void fetchCatalogMissionsByIds(ids)
      .then((catalogRows) => {
        if (cancelled) return;
        const byId = new Map(catalogRows.map((row) => [row.id, row]));
        setEnriched(
          missions.map((mission) =>
            enrichSessionMissionFromCatalog(
              mission,
              mission.catalogMissionId
                ? byId.get(mission.catalogMissionId)
                : null,
            ),
          ),
        );
      })
      .catch(() => {
        if (!cancelled) setEnriched(missions);
      });

    return () => {
      cancelled = true;
    };
  }, [open, missions]);

  const displayMissions = useMemo(() => enriched, [enriched]);
  const boxEditMission =
    boxEditMissionId == null
      ? null
      : (displayMissions.find((mission) => mission.id === boxEditMissionId) ??
        null);

  const columnTotals = useMemo(() => {
    let rewardAuec = 0;
    let rewardEarned = 0;
    let scu = 0;
    let scuEarned = 0;
    let exp = 0;
    let expEarned = 0;
    let boxes = 0;
    for (const mission of displayMissions) {
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
  }, [displayMissions]);

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
  }, [open, focusMissionId, selectedMissionId, displayMissions]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-rsi-bg-deep/85 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Contracts"
      onClick={(event) => {
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
          {displayMissions.length === 0 ? (
            <p className="px-4 py-4 text-sm text-rsi-text-muted sm:px-5 sm:py-5">
              No contracts in this session.
            </p>
          ) : (
            <table className="w-full min-w-[58rem] border-collapse text-left">
              <thead className="sticky top-0 z-10 border-b border-rsi-border bg-rsi-surface">
                <tr>
                  <th className={`${thClass} w-[5.25rem]`}>Rank</th>
                  <th className={`${thClass} w-[9.5rem]`}>Title</th>
                  <th className={`${thClass} w-[9.5rem] text-right`}>Reward</th>
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
                {displayMissions.map((mission) => (
                  <MissionContractRow
                    key={mission.id}
                    mission={mission}
                    rows={rows}
                    isFocused={mission.id === selectedMissionId}
                    onToggleSelect={() => {
                      setSelectedMissionId((current) =>
                        current === mission.id ? null : mission.id,
                      );
                    }}
                    onToggleHidden={(isHidden) =>
                      onToggleHidden(mission.id, isHidden)
                    }
                    onToggleCompleted={(isCompleted) =>
                      onToggleCompleted(mission.id, isCompleted)
                    }
                    onRemoveMission={() => onRemoveMission(mission.id)}
                    onEditBoxTypes={() => setBoxEditMissionId(mission.id)}
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
                        <span className="text-rsi-success">
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
                    <span className="text-rsi-success">
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
                        <span className="text-rsi-success">
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
          )}
        </div>
      </div>

      {boxEditMission ? (
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
