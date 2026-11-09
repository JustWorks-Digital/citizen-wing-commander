"use client";

import { useId, useState } from "react";
import type { ScuBoxSplits } from "@/lib/missions/catalogMission";
import type { SessionMission } from "@/lib/missions/sessionMissions";
import { missionsRelevantToRow } from "@/lib/missions/rowMissionScreenshots";
import type { HaulingChecklistRow } from "@/lib/missions/mockSession";
import { StopMissionBoxConfigModal } from "./StopMissionBoxConfigModal";

export type StopRelatedMissionsProps = {
  row: HaulingChecklistRow;
  missions: SessionMission[];
  onSelectBoxBreakdown?: (
    missionId: string,
    breakdown: ScuBoxSplits,
  ) => void;
  className?: string;
};

function missionMetaLine(mission: SessionMission): string {
  const reward =
    mission.rewardDisplay ??
    (mission.rewardAuec > 0
      ? `${mission.rewardAuec.toLocaleString()} aUEC`
      : null);
  return [mission.contractor || null, reward].filter(Boolean).join(" · ") || "—";
}

function ExpandChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className={[
        "size-3.5 transition-transform",
        open ? "rotate-180" : "",
      ].join(" ")}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

/**
 * Missions that collect or deliver at this checklist stop.
 * Full-width collapsible section; tile click opens box-type correction modal.
 */
export function StopRelatedMissions({
  row,
  missions,
  onSelectBoxBreakdown,
  className,
}: StopRelatedMissionsProps) {
  const panelId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [activeMissionId, setActiveMissionId] = useState<string | null>(null);
  const related = missionsRelevantToRow(missions, row);
  const activeMission =
    activeMissionId == null
      ? null
      : (missions.find((mission) => mission.id === activeMissionId) ?? null);

  if (related.length === 0) return null;

  return (
    <div
      className={["mt-3 border-t border-rsi-divider/80 pt-3", className]
        .filter(Boolean)
        .join(" ")}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((value) => !value)}
        className={[
          "mx-auto flex items-center justify-center gap-1.5 rounded-rsi px-2 py-1",
          "font-mono text-[0.65rem] uppercase tracking-[0.16em] text-rsi-text-muted",
          "transition-colors hover:text-rsi-text",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-rsi-bg",
        ].join(" ")}
      >
        <span>Missions</span>
        <span className="tabular-nums text-rsi-text-secondary">
          ({related.length})
        </span>
        <ExpandChevronIcon open={isOpen} />
      </button>

      {isOpen ? (
        <ul
          id={panelId}
          className="mt-2.5 grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4"
        >
          {related.map((mission) => (
            <li key={mission.id} className="min-w-0">
              <button
                type="button"
                title={`Edit box types for ${mission.title}`}
                onClick={() => setActiveMissionId(mission.id)}
                className={[
                  "flex w-full min-w-0 items-start rounded-rsi border border-rsi-border/80 bg-rsi-bg-deep/40 py-1.5 pl-2.5 pr-2.5 text-left transition-colors",
                  "hover:border-rsi-border-strong hover:bg-rsi-bg-deep/60",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-rsi-bg",
                  mission.isCompleted ? "opacity-70" : "",
                ].join(" ")}
              >
                <div className="min-w-0 w-full">
                  <p
                    className={[
                      "truncate text-xs font-semibold tracking-wide",
                      mission.isCompleted
                        ? "text-rsi-text-muted line-through decoration-rsi-success/40"
                        : "text-rsi-text",
                    ].join(" ")}
                  >
                    {mission.title}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-[0.55rem] uppercase tracking-[0.12em] text-rsi-text-muted">
                    {missionMetaLine(mission)}
                  </p>
                  {mission.cargoSummary ? (
                    <p
                      className={[
                        "mt-0.5 truncate text-[0.65rem] leading-snug text-rsi-text-secondary",
                        mission.isCompleted ? "line-through opacity-80" : "",
                      ].join(" ")}
                    >
                      {mission.cargoSummary}
                    </p>
                  ) : null}
                </div>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {activeMission ? (
        <StopMissionBoxConfigModal
          mission={activeMission}
          onClose={() => setActiveMissionId(null)}
          onSelectBoxBreakdown={(breakdown) => {
            onSelectBoxBreakdown?.(activeMission.id, breakdown);
          }}
        />
      ) : null}
    </div>
  );
}
