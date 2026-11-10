"use client";

import { useEffect, useMemo, useState } from "react";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { fetchCatalogMissionsByIds } from "@/lib/api/catalogMissionsApi";
import { enrichSessionMissionFromCatalog } from "@/lib/missions/enrichSessionMissionFromCatalog";
import {
  missionCollectObjectives,
  missionDeliverObjectives,
  missionRewardLabel,
  missionTotalScu,
} from "@/lib/missions/sessionMissionObjectives";
import type { ScuBoxSplits } from "@/lib/missions/catalogMission";
import { haulingCategoryShortLabel } from "@/lib/missions/haulingCategory";
import type { SessionMission } from "@/lib/missions/sessionMissions";
import { MissionBoxBreakdownPicker } from "./MissionBoxBreakdownPicker";

export type SessionMissionsModalProps = {
  open: boolean;
  missions: SessionMission[];
  onClose: () => void;
  onToggleHidden: (missionId: string, isHidden: boolean) => void;
  onToggleCompleted: (missionId: string, isCompleted: boolean) => void;
  onRemoveMission: (missionId: string) => void;
  onSelectBoxBreakdown: (
    missionId: string,
    breakdown: ScuBoxSplits,
  ) => void;
};

function VisibilityIcon({ isHidden }: { isHidden: boolean }) {
  if (isHidden) {
    return (
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="h-4 w-4"
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
      className="h-4 w-4"
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
      className="h-4 w-4"
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
  lines: Array<{ locationLabel: string; cargoLabel: string }>;
}) {
  if (lines.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="font-mono text-[0.55rem] uppercase tracking-[0.16em] text-rsi-text-muted">
        {label}
      </p>
      <div className="mt-1.5 space-y-1 border-l border-rsi-border/70 pl-3">
        {lines.map((line) => (
          <p
            key={`${label}-${line.locationLabel}-${line.cargoLabel}`}
            className="text-sm leading-snug text-rsi-text-secondary"
          >
            <span className="text-rsi-text">{line.locationLabel}</span>
            <span className="text-rsi-text-muted"> — </span>
            <span className="font-mono text-[0.8rem] tabular-nums">
              {line.cargoLabel}
            </span>
          </p>
        ))}
      </div>
    </div>
  );
}

function ExpandChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className={[
        "h-4 w-4 transition-transform",
        open ? "rotate-180" : "",
      ].join(" ")}
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

export function SessionMissionsModal({
  open,
  missions,
  onClose,
  onToggleHidden,
  onToggleCompleted,
  onRemoveMission,
  onSelectBoxBreakdown,
}: SessionMissionsModalProps) {
  const [enriched, setEnriched] = useState<SessionMission[]>(missions);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setEnriched(missions);
      setExpandedIds({});
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

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    for (const mission of displayMissions) {
      next[mission.id] = true;
    }
    setExpandedIds(next);
  };

  const collapseAll = () => {
    setExpandedIds({});
  };

  if (!open) return null;

  const bulkToggleClass = [
    "rounded-rsi border border-rsi-border bg-rsi-bg-deep/50 px-2.5 py-1.5",
    "font-mono text-[0.55rem] uppercase tracking-[0.14em] text-rsi-text-secondary",
    "transition-colors hover:border-rsi-accent/50 hover:text-rsi-accent",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
  ].join(" ");

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-rsi-bg-deep/80 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Session missions"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex h-[100dvh] w-full max-w-2xl flex-col overflow-hidden border-rsi-border bg-rsi-surface shadow-rsi-panel sm:h-auto sm:max-h-[90vh] sm:rounded-rsi sm:border">
        <header className="relative border-b border-rsi-divider px-4 py-3 pr-12 sm:px-5 sm:py-4 sm:pr-14">
          <ModalCloseButton onClick={onClose} />
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-rsi-accent">
            Missions
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 gap-y-2">
            <h2 className="min-w-0 flex-1 truncate text-base font-semibold tracking-wide text-rsi-text sm:text-lg">
              Session contracts
            </h2>
            {displayMissions.length > 0 ? (
              <div className="flex shrink-0 gap-1.5">
                <button
                  type="button"
                  className={bulkToggleClass}
                  onClick={expandAll}
                >
                  Expand all
                </button>
                <button
                  type="button"
                  className={bulkToggleClass}
                  onClick={collapseAll}
                >
                  Collapse all
                </button>
              </div>
            ) : null}
          </div>
        </header>

        <div className="overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 sm:py-5">
          {displayMissions.length === 0 ? (
            <p className="text-sm text-rsi-text-muted">
              No missions in this session.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {displayMissions.map((mission) => {
                const isHidden = Boolean(mission.isHidden);
                const isCompleted = Boolean(mission.isCompleted);
                const isExpanded = Boolean(expandedIds[mission.id]);
                const totalScu = missionTotalScu(mission);
                const reward = missionRewardLabel(mission);
                const collect = missionCollectObjectives(mission);
                const deliver = missionDeliverObjectives(mission);
                const detailsId = `mission-details-${mission.id}`;

                return (
                  <article
                    key={mission.id}
                    className={[
                      "relative rounded-rsi border p-4 pr-28",
                      isHidden
                        ? "border-rsi-border/60 bg-rsi-bg-deep/30 opacity-55"
                        : isCompleted
                          ? "border-rsi-success/40 bg-rsi-bg-deep/40"
                          : "border-rsi-border bg-rsi-bg-deep/50",
                    ].join(" ")}
                  >
                    <div className="absolute right-3 top-3 flex gap-1">
                      <button
                        type="button"
                        aria-label={
                          isCompleted
                            ? `Reopen ${mission.title}`
                            : `Complete ${mission.title}`
                        }
                        title={
                          isCompleted
                            ? "Reopen mission (restore cargo to route)"
                            : "Complete mission (drop cargo from route)"
                        }
                        onClick={() =>
                          onToggleCompleted(mission.id, !isCompleted)
                        }
                        className={[
                          "flex h-8 w-8 items-center justify-center rounded-rsi border bg-rsi-surface",
                          isCompleted
                            ? "border-rsi-success/50 text-rsi-success hover:border-rsi-success"
                            : "border-rsi-border text-rsi-text-secondary hover:border-rsi-success/50 hover:text-rsi-success",
                        ].join(" ")}
                      >
                        <CompleteIcon isCompleted={isCompleted} />
                      </button>
                      <button
                        type="button"
                        aria-label={
                          isHidden
                            ? `Show ${mission.title} in route`
                            : `Hide ${mission.title} from route`
                        }
                        title={
                          isHidden
                            ? "Show in route table"
                            : "Hide from route table"
                        }
                        onClick={() => onToggleHidden(mission.id, !isHidden)}
                        className={[
                          "flex h-8 w-8 items-center justify-center rounded-rsi border bg-rsi-surface",
                          isHidden
                            ? "border-rsi-accent/40 text-rsi-accent hover:border-rsi-accent"
                            : "border-rsi-border text-rsi-text-secondary hover:border-rsi-border-strong hover:text-rsi-text",
                        ].join(" ")}
                      >
                        <VisibilityIcon isHidden={isHidden} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove ${mission.title}`}
                        title="Remove from session"
                        onClick={() => onRemoveMission(mission.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-rsi border border-rsi-danger/40 bg-rsi-surface text-rsi-danger hover:bg-rsi-danger-muted"
                      >
                        <svg
                          aria-hidden
                          viewBox="0 0 24 24"
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        >
                          <line x1="6" y1="6" x2="18" y2="18" />
                          <line x1="18" y1="6" x2="6" y2="18" />
                        </svg>
                      </button>
                    </div>

                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        aria-controls={detailsId}
                        aria-label={
                          isExpanded
                            ? `Collapse ${mission.title} details`
                            : `Expand ${mission.title} details`
                        }
                        title={isExpanded ? "Collapse details" : "Expand details"}
                        onClick={() =>
                          setExpandedIds((prev) => ({
                            ...prev,
                            [mission.id]: !prev[mission.id],
                          }))
                        }
                        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-rsi border border-rsi-border bg-rsi-surface text-rsi-text-secondary hover:border-rsi-border-strong hover:text-rsi-text"
                      >
                        <ExpandChevronIcon open={isExpanded} />
                      </button>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-semibold tracking-wide text-rsi-text">
                          {mission.title}
                        </h3>
                        <p className="mt-2 font-mono text-sm tabular-nums tracking-wide text-rsi-text">
                          <span
                            className={
                              isCompleted
                                ? "text-rsi-success"
                                : "text-rsi-accent"
                            }
                          >
                            {totalScu} SCU
                          </span>
                          <span className="mx-2 text-rsi-text-muted">·</span>
                          <span>{reward}</span>
                          {isCompleted ? (
                            <span className="ml-2 text-[0.65rem] uppercase tracking-[0.14em] text-rsi-success">
                              complete
                            </span>
                          ) : null}
                          {isHidden ? (
                            <span className="ml-2 text-[0.65rem] uppercase tracking-[0.14em] text-rsi-text-muted">
                              hidden
                            </span>
                          ) : null}
                        </p>
                        {mission.mobiglas.category || mission.contractor ? (
                          <p className="mt-1 text-xs text-rsi-text-secondary">
                            {[
                              haulingCategoryShortLabel(mission.mobiglas.category),
                              mission.contractor || null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    {isExpanded ? (
                      <div id={detailsId} className="mt-1">
                        <ObjectiveGroup label="Collect" lines={collect} />
                        <ObjectiveGroup label="Deliver" lines={deliver} />
                        <MissionBoxBreakdownPicker
                          totalScu={totalScu}
                          maxContainerScu={mission.maxContainerScu}
                          selected={mission.scuBoxSplits ?? null}
                          autoSelected={
                            mission.scuBoxSplitsAutoSelected ?? null
                          }
                          disabled={isCompleted}
                          onSelect={(breakdown) =>
                            onSelectBoxBreakdown(mission.id, breakdown)
                          }
                        />
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
