"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_CARGO_BAY_CHROME_PREFS,
  readCargoBayChromePrefs,
  writeCargoBayChromePrefs,
  type CargoBayChromePrefs,
} from "@/lib/sessions/cargoBayLayoutClientPrefs";

/**
 * Per-session Legend / Sorting panel visibility in `localStorage`.
 * New sessions default to both hidden until the user opens them.
 */
export function useSessionCargoBayChrome(
  sessionId: string | null | undefined,
): {
  legendHidden: boolean;
  sortingHidden: boolean;
  setLegendHidden: (hidden: boolean) => void;
  setSortingHidden: (hidden: boolean) => void;
} {
  const [prefs, setPrefs] = useState<CargoBayChromePrefs>(
    DEFAULT_CARGO_BAY_CHROME_PREFS,
  );

  useEffect(() => {
    setPrefs(readCargoBayChromePrefs(sessionId));
  }, [sessionId]);

  const setLegendHidden = useCallback(
    (hidden: boolean) => {
      setPrefs((prev) => {
        const next = { ...prev, legendHidden: hidden };
        writeCargoBayChromePrefs(sessionId, next);
        return next;
      });
    },
    [sessionId],
  );

  const setSortingHidden = useCallback(
    (hidden: boolean) => {
      setPrefs((prev) => {
        const next = { ...prev, sortingHidden: hidden };
        writeCargoBayChromePrefs(sessionId, next);
        return next;
      });
    },
    [sessionId],
  );

  return {
    legendHidden: prefs.legendHidden,
    sortingHidden: prefs.sortingHidden,
    setLegendHidden,
    setSortingHidden,
  };
}
