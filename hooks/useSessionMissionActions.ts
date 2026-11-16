"use client";

import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { SessionChecklist } from "@/lib/missions/sessionChecklist";
import {
  removeMissionAndRebuildRoute,
  setMissionCompletedAndRebuildRoute,
  setMissionHiddenAndRebuildRoute,
} from "@/lib/missions/rebuildSessionRoute";

type PersistSession = (next: SessionChecklist) => Promise<void>;

/**
 * Mission list mutations (hide / complete / remove) that rebuild the route.
 */
export function useSessionMissionActions(input: {
  sessionRef: { current: SessionChecklist };
  persistSession: PersistSession;
  setLoadError: Dispatch<SetStateAction<string | null>>;
}) {
  const { sessionRef, persistSession, setLoadError } = input;

  const handleMissionToggleHidden = useCallback(
    (missionId: string, isHidden: boolean) => {
      const result = setMissionHiddenAndRebuildRoute(
        sessionRef.current,
        missionId,
        isHidden,
      );
      if (!result.ok) {
        setLoadError(result.error);
        return;
      }
      void persistSession(result.session);
    },
    [persistSession, sessionRef, setLoadError],
  );

  const handleMissionToggleCompleted = useCallback(
    (missionId: string, isCompleted: boolean) => {
      const result = setMissionCompletedAndRebuildRoute(
        sessionRef.current,
        missionId,
        isCompleted,
      );
      if (!result.ok) {
        setLoadError(result.error);
        return;
      }
      void persistSession(result.session);
    },
    [persistSession, sessionRef, setLoadError],
  );

  const handleMissionRemove = useCallback(
    (missionId: string) => {
      const result = removeMissionAndRebuildRoute(
        sessionRef.current,
        missionId,
      );
      if (!result.ok) {
        setLoadError(result.error);
        return;
      }
      void persistSession(result.session);
    },
    [persistSession, sessionRef, setLoadError],
  );

  return {
    handleMissionToggleHidden,
    handleMissionToggleCompleted,
    handleMissionRemove,
  };
}
