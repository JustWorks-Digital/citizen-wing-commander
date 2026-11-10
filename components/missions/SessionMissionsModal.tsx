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
import {
  boxCountsFromBreakdown,
} from "@/lib/missions/boxBreakdownOptions";
import {
  scuBoxSplitsForScu,
  type ScuBoxSplits,
} from "@/lib/missions/catalogMission";
import { enrichSessionMissionFromCatalog } from "@/lib/missions/enrichSessionMissionFromCatalog";
import { stripRankFromTitle } from "@/lib/missions/missionRank";
import { autoSelectedMissionScuBoxSplits } from "@/lib/missions/rebuildSessionRoute";
import {
  missionCollectObjectives,
  missionDeliverObjectives,
  missionRewardLabel,
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
  onClose: () => void;
  onToggleHidden: (missionId: string, isHidden: boolean) => void;
  onToggleCompleted: (missionId: string, isCompleted: boolean) => void;
  onRemoveMission: (missionId: string) => void;
  onSelectBoxBreakdown: (
    missionId: string,
    breakdown: ScuBoxSplits,
  ) => void;
};

function ExpandChevronIcon({
  open,
  className,
}: {
  open: boolean;
  className?: string;
}) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className={[
        "h-3 w-3 transition-transform",
        open ? "rotate-180" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

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

function ObjectiveGroup({
  label,
  lines,
}: {
  label: string;
  lines: Array<{ locationLabel: string; cargoItems: string[] }>;
}) {
  if (lines.length === 0) return null;
  return (
    <div>
      <p className="font-mono text-[0.55rem] uppercase tracking-[0.16em] text-rsi-text-muted">
        {label}
      </p>
      <div className="mt-1 space-y-1.5">
        {lines.map((line) => (
          <div key={`${label}-${line.locationLabel}`}>
            <p className="text-[0.65rem] leading-snug text-rsi-text">
              {line.locationLabel}
            </p>
            {line.cargoItems.length > 0 ? (
              <ul className="mt-0.5 list-disc space-y-0.5 pl-4 marker:text-rsi-text-muted">
                {line.cargoItems.map((item) => (
                  <li
                    key={`${line.locationLabel}-${item}`}
                    className="font-mono text-[0.6rem] tabular-nums leading-snug text-rsi-text-secondary"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

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
  const totalScu = missionTotalScu(mission);
  return (
    mission.scuBoxSplits ??
    mission.scuBoxSplitsAutoSelected ??
    autoSelectedMissionScuBoxSplits(mission) ??
    scuBoxSplitsForScu(totalScu, mission.maxContainerScu)
  );
}

function MissionContractTile({
  mission,
  rows,
  isExpanded,
  onToggleExpanded,
  onToggleHidden,
  onToggleCompleted,
  onRemoveMission,
  onEditBoxTypes,
}: {
  mission: SessionMission;
  rows: HaulingChecklistRow[];
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onToggleHidden: (isHidden: boolean) => void;
  onToggleCompleted: (isCompleted: boolean) => void;
  onRemoveMission: () => void;
  onEditBoxTypes: () => void;
}) {
  const isHidden = Boolean(mission.isHidden);
  const isCompleted = Boolean(mission.isCompleted);
  const { rank, title } = stripRankFromTitle(mission.title);
  const totalScu = missionTotalScu(mission);
  const reward = missionRewardLabel(mission);
  const collect = missionCollectObjectives(mission, rows);
  const deliver = missionDeliverObjectives(mission, rows);
  const detailsId = `mission-details-${mission.id}`;
  const boxSplits = resolvedBoxSplits(mission);
  const boxCounts = boxCountsFromBreakdown(boxSplits);

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
    <article
      className={[
        "rounded-rsi border px-3 pb-0.5 pt-3",
        isHidden
          ? "border-rsi-border/60 bg-rsi-bg-deep/30 opacity-55"
          : isCompleted
            ? "border-rsi-success/40 bg-rsi-bg-deep/40"
            : "border-rsi-border/80 bg-rsi-bg-deep/40",
      ].join(" ")}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p
                className={[
                  "truncate font-mono text-[0.5rem] uppercase tracking-[0.14em]",
                  isCompleted ? "text-rsi-text-muted" : "text-rsi-accent",
                ].join(" ")}
              >
                {rank ?? "—"}
              </p>
              <h3
                className={[
                  "mt-0.5 truncate text-sm font-semibold tracking-wide",
                  isCompleted
                    ? "text-rsi-text-muted line-through decoration-rsi-success/40"
                    : "text-rsi-text",
                ].join(" ")}
                title={mission.title}
              >
                {title || mission.title}
              </h3>
            </div>
            <MissionActionsMenu
              mission={mission}
              onToggleCompleted={onToggleCompleted}
              onToggleHidden={onToggleHidden}
              onRemoveMission={onRemoveMission}
            />
          </div>

          <p
            className={[
              "mt-1 truncate text-[0.65rem] leading-snug text-rsi-text-secondary",
              isCompleted ? "line-through opacity-80" : "",
            ].join(" ")}
          >
            {mission.cargoSummary || `${totalScu} SCU`}
          </p>

          <div className="mt-1.5 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p
                className={[
                  "font-mono text-[0.55rem] tabular-nums tracking-wide",
                  isCompleted ? "text-rsi-success" : "text-rsi-accent",
                ].join(" ")}
              >
                {totalScu} SCU
              </p>
              {reward !== "—" ? (
                <p className="mt-0.5 font-mono text-[0.55rem] tabular-nums tracking-wide text-rsi-text">
                  {reward}
                </p>
              ) : null}
              {statusBadge ? <div className="mt-0.5">{statusBadge}</div> : null}
            </div>

            <button
              type="button"
              disabled={isCompleted}
              title={
                isCompleted
                  ? "Box types locked on completed contracts"
                  : "Edit box types"
              }
              aria-label={`Edit box types for ${mission.title}`}
              onClick={onEditBoxTypes}
              className={[
                "inline-flex shrink-0 items-center gap-1.5 rounded-rsi border px-2 py-1",
                "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
                isCompleted
                  ? "cursor-not-allowed border-rsi-border/50 opacity-60"
                  : "border-rsi-border bg-rsi-surface/80 hover:border-rsi-accent/50 hover:bg-rsi-accent-muted/25",
              ].join(" ")}
            >
              <CargoBoxCountIcons
                boxCounts={boxCounts}
                color={
                  isCompleted ? "var(--rsi-text-muted)" : "var(--rsi-accent)"
                }
                className="gap-x-1.5 [&_svg]:size-4 [&_span]:text-[0.6rem]"
              />
            </button>
          </div>
        </div>
      </div>

      {isExpanded ? (
        <div id={detailsId} className="mt-3 space-y-3 border-t border-rsi-border/60 pt-3">
          <ObjectiveGroup label="Collect" lines={collect} />
          <ObjectiveGroup label="Deliver" lines={deliver} />
          {collect.length === 0 && deliver.length === 0 ? (
            <p className="text-sm text-rsi-text-muted">No route details.</p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-2 flex items-center justify-center">
        <button
          type="button"
          aria-expanded={isExpanded}
          aria-controls={detailsId}
          aria-label={
            isExpanded
              ? `Hide details for ${mission.title}`
              : `Show details for ${mission.title}`
          }
          title={isExpanded ? "Hide details" : "Show details"}
          onClick={onToggleExpanded}
          className={[
            "flex items-center justify-center gap-1 rounded-rsi px-1.5 py-0.5",
            "font-mono text-[0.5rem] uppercase tracking-[0.16em] text-rsi-text-muted",
            "transition-colors hover:text-rsi-text",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-rsi-bg",
          ].join(" ")}
        >
          <span>Details</span>
          <ExpandChevronIcon open={isExpanded} />
        </button>
      </div>
    </article>
  );
}

export function SessionMissionsModal({
  open,
  missions,
  rows = [],
  onClose,
  onToggleHidden,
  onToggleCompleted,
  onRemoveMission,
  onSelectBoxBreakdown,
}: SessionMissionsModalProps) {
  const [enriched, setEnriched] = useState<SessionMission[]>(missions);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [boxEditMissionId, setBoxEditMissionId] = useState<string | null>(null);

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
      setEnriched(missions);
      setDetailsExpanded(false);
      setBoxEditMissionId(null);
      return;
    }
    let cancelled = false;
    setEnriched(missions);
    const ids = missions
      .map((mission) => mission.catalogMissionId)
      .filter((id): id is string => Boolean(id));
    if (ids.length === 0) return;

    void fetchCatalogMissionsByIds(ids)
      .then((rows) => {
        if (cancelled) return;
        const byId = new Map(rows.map((row) => [row.id, row]));
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

  const toggleDetailsExpanded = () => {
    setDetailsExpanded((value) => !value);
  };

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

        <div className="overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 sm:py-5">
          {displayMissions.length === 0 ? (
            <p className="text-sm text-rsi-text-muted">
              No contracts in this session.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-4">
              {displayMissions.map((mission) => (
                <MissionContractTile
                  key={mission.id}
                  mission={mission}
                  rows={rows}
                  isExpanded={detailsExpanded}
                  onToggleExpanded={toggleDetailsExpanded}
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
            </div>
          )}
        </div>
      </div>

      {boxEditMission ? (
        <StopMissionBoxConfigModal
          mission={boxEditMission}
          onClose={() => setBoxEditMissionId(null)}
          onSelectBoxBreakdown={(breakdown) => {
            onSelectBoxBreakdown(boxEditMission.id, breakdown);
            setBoxEditMissionId(null);
          }}
        />
      ) : null}
    </div>
  );
}
