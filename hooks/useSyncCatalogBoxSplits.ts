"use client";

import { useCallback, type Dispatch, type SetStateAction } from "react";
import { updateCatalogMissionScuBoxSplits } from "@/lib/api/catalogMissionsApi";
import { cargoBoxSplits } from "@/lib/missions/cargoBoxSplits";
import {
  clearCatalogMissionLink,
  isCatalogMissionNotFoundError,
} from "@/lib/missions/clearCatalogMissionLink";
import type { SessionChecklist } from "@/lib/missions/sessionChecklist";

type PersistSession = (next: SessionChecklist) => Promise<void>;

/** Best-effort push of trip crate mixes onto the linked catalog mission. */
export function useSyncCatalogBoxSplits(input: {
  sessionRef: { current: SessionChecklist };
  persistSession: PersistSession;
  setLoadError: Dispatch<SetStateAction<string | null>>;
}) {
  const { sessionRef, persistSession, setLoadError } = input;

  return useCallback(
    (missionId: string, nextSession: SessionChecklist) => {
      const updatedMission =
        nextSession.missions?.find((mission) => mission.id === missionId) ??
        null;
      const catalogId = updatedMission?.catalogMissionId ?? null;
      if (!catalogId || !updatedMission) return;
      const scuBoxSplits = cargoBoxSplits.selectedAggregate(updatedMission);
      const hasBoxes =
        scuBoxSplits.scuOne +
          scuBoxSplits.scuTwo +
          scuBoxSplits.scuFour +
          scuBoxSplits.scuEight +
          scuBoxSplits.scuSixteen +
          scuBoxSplits.scuThirtyTwo >
        0;
      if (!hasBoxes && !updatedMission.scuCargoBoxSplits) return;
      void updateCatalogMissionScuBoxSplits({
        missionId: catalogId,
        scuBoxSplits,
        scuCargoBoxSplits: updatedMission.scuCargoBoxSplits,
        scuTotalCertainty: updatedMission.scuTotalCertainty,
        scuBoxSplitsCertainty: updatedMission.scuBoxSplitsCertainty,
        scuCargoBoxSplitsCertainty: updatedMission.scuCargoBoxSplitsCertainty,
      }).catch((error: unknown) => {
        if (isCatalogMissionNotFoundError(error)) {
          void persistSession(
            clearCatalogMissionLink(sessionRef.current, missionId),
          );
          return;
        }
        const message =
          error instanceof Error ? error.message : String(error);
        setLoadError(
          `Saved on trip, but failed to update catalog default: ${message}`,
        );
      });
    },
    [persistSession, sessionRef, setLoadError],
  );
}
