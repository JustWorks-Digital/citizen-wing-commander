import { cargoBoxSplits } from "@/lib/missions/cargoBoxSplits";
import type { ScuBoxSplits } from "@/lib/missions/catalogMission";
import type { MissionScuDraft } from "@/lib/missions/missionScuAmounts";
import type { HaulingChecklistRow } from "@/lib/missions/sessionChecklist";
import type { SessionMission } from "@/lib/missions/sessionMissions";

export type SelectBoxBreakdownOptions = {
  /** Re-greedy other cargo lines with this mix’s preferred max. */
  applyPreferredMaxToRemaining?: boolean;
  /**
   * When propagating, skip already-corrected lines (default true).
   * Total-style picks pass false so one choice restyles every cargo type.
   */
  onlyUncorrected?: boolean;
};

export type SessionBoxBreakdownHandler = (
  missionId: string,
  commoditySlug: string,
  breakdown: ScuBoxSplits,
  options?: SelectBoxBreakdownOptions,
) => void | Promise<void>;

export type SessionSaveMissionScuDraftHandler = (
  missionId: string,
  draft: MissionScuDraft,
) => void;

/** Props shape shared by `StopMissionBoxConfigModal` and its parent binders. */
export type StopMissionBoxConfigBindProps = {
  mission: SessionMission;
  rows?: HaulingChecklistRow[] | null;
  sessionId?: string | null;
  onClose: () => void;
  onSelectBoxBreakdown: (
    commoditySlug: string,
    breakdown: ScuBoxSplits,
    options?: SelectBoxBreakdownOptions,
  ) => void;
  onSaveScuDraft?: (draft: MissionScuDraft) => void;
};

/**
 * Wire a session-level box-breakdown / SCU-draft handler into modal props.
 * Closes after a single-cargo mix pick (multi-cargo stays open).
 */
export function stopMissionBoxConfigModalProps(input: {
  mission: SessionMission;
  rows?: HaulingChecklistRow[] | null;
  sessionId?: string | null;
  onClose: () => void;
  onSelectBoxBreakdown: SessionBoxBreakdownHandler;
  onSaveMissionScuDraft?: SessionSaveMissionScuDraftHandler;
}): StopMissionBoxConfigBindProps {
  const { mission, onClose, onSelectBoxBreakdown, onSaveMissionScuDraft } =
    input;
  return {
    mission,
    rows: input.rows ?? null,
    sessionId: input.sessionId ?? null,
    onClose,
    onSelectBoxBreakdown: (commoditySlug, breakdown, options) => {
      void onSelectBoxBreakdown(
        mission.id,
        commoditySlug,
        breakdown,
        options,
      );
      if (cargoBoxSplits.commodityLines(mission).length <= 1) {
        onClose();
      }
    },
    onSaveScuDraft: onSaveMissionScuDraft
      ? (draft) => onSaveMissionScuDraft(mission.id, draft)
      : undefined,
  };
}
