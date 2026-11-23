"use client";

import { useCallback, useEffect, useState } from "react";
import {
  readCargoBayLayoutFullscreen,
  writeCargoBayLayoutFullscreen,
} from "@/lib/sessions/cargoBayLayoutClientPrefs";

/**
 * Per-session cargo-bays modal fullscreen, persisted in `localStorage`.
 */
export function useSessionCargoBayLayoutFullscreen(
  sessionId: string | null | undefined,
): {
  isFullscreen: boolean;
  setIsFullscreen: (next: boolean) => void;
  toggleFullscreen: () => void;
} {
  const [isFullscreen, setFullscreenState] = useState(false);

  useEffect(() => {
    setFullscreenState(readCargoBayLayoutFullscreen(sessionId));
  }, [sessionId]);

  const setIsFullscreen = useCallback(
    (next: boolean) => {
      setFullscreenState(next);
      writeCargoBayLayoutFullscreen(sessionId, next);
    },
    [sessionId],
  );

  const toggleFullscreen = useCallback(() => {
    setFullscreenState((prev) => {
      const next = !prev;
      writeCargoBayLayoutFullscreen(sessionId, next);
      return next;
    });
  }, [sessionId]);

  return { isFullscreen, setIsFullscreen, toggleFullscreen };
}
