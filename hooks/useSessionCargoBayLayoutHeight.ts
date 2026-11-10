"use client";

import { useCallback, useEffect, useState } from "react";
import {
  clampCargoBayLayoutHeightPx,
  DEFAULT_CARGO_BAY_LAYOUT_HEIGHT_PX,
  readCargoBayLayoutHeightPx,
  writeCargoBayLayoutHeightPx,
} from "@/lib/sessions/cargoBayLayoutClientPrefs";

/**
 * Per-session ship-layout panel height, persisted in `localStorage`.
 * Falls back to the default when `sessionId` is missing.
 */
export function useSessionCargoBayLayoutHeight(
  sessionId: string | null | undefined,
): {
  heightPx: number;
  setHeightPx: (next: number, options?: { persist?: boolean }) => void;
  resetHeightPx: () => void;
} {
  const [heightPx, setHeightState] = useState(DEFAULT_CARGO_BAY_LAYOUT_HEIGHT_PX);

  useEffect(() => {
    setHeightState(readCargoBayLayoutHeightPx(sessionId));
  }, [sessionId]);

  const setHeightPx = useCallback(
    (next: number, options?: { persist?: boolean }) => {
      const clamped = clampCargoBayLayoutHeightPx(next);
      setHeightState(clamped);
      if (options?.persist !== false) {
        writeCargoBayLayoutHeightPx(sessionId, clamped);
      }
    },
    [sessionId],
  );

  const resetHeightPx = useCallback(() => {
    setHeightPx(DEFAULT_CARGO_BAY_LAYOUT_HEIGHT_PX);
  }, [setHeightPx]);

  return { heightPx, setHeightPx, resetHeightPx };
}
