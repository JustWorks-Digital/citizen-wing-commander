"use client";

import { useCallback, useEffect, useState } from "react";
import {
  clampCargoBayLayoutWidthPx,
  DEFAULT_CARGO_BAY_LAYOUT_WIDTH_PX,
  readCargoBayLayoutWidthPx,
  writeCargoBayLayoutWidthPx,
} from "@/lib/sessions/cargoBayLayoutClientPrefs";

/**
 * Per-session cargo-base modal width, persisted in `localStorage`.
 * Falls back to the default when `sessionId` is missing.
 */
export function useSessionCargoBayLayoutWidth(
  sessionId: string | null | undefined,
): {
  widthPx: number;
  setWidthPx: (next: number, options?: { persist?: boolean }) => void;
  resetWidthPx: () => void;
} {
  const [widthPx, setWidthState] = useState(DEFAULT_CARGO_BAY_LAYOUT_WIDTH_PX);

  useEffect(() => {
    setWidthState(readCargoBayLayoutWidthPx(sessionId));
  }, [sessionId]);

  const setWidthPx = useCallback(
    (next: number, options?: { persist?: boolean }) => {
      const clamped = clampCargoBayLayoutWidthPx(next);
      setWidthState(clamped);
      if (options?.persist !== false) {
        writeCargoBayLayoutWidthPx(sessionId, clamped);
      }
    },
    [sessionId],
  );

  const resetWidthPx = useCallback(() => {
    setWidthPx(DEFAULT_CARGO_BAY_LAYOUT_WIDTH_PX);
  }, [setWidthPx]);

  return { widthPx, setWidthPx, resetWidthPx };
}
