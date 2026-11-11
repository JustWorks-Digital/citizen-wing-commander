"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_CARGO_BAY_CHROME_PREFS,
  readCargoBayChromePrefs,
  writeCargoBayChromePrefs,
  type CargoBayChromePrefs,
  type CargoBayViewTab,
} from "@/lib/sessions/cargoBayLayoutClientPrefs";

/**
 * Per-session Legend / Sorting visibility and 2D/Split/3D view in
 * `localStorage`. Defaults: both panels hidden, Split view.
 */
export function useSessionCargoBayChrome(
  sessionId: string | null | undefined,
): {
  legendHidden: boolean;
  sortingHidden: boolean;
  viewTab: CargoBayViewTab;
  setLegendHidden: (hidden: boolean) => void;
  setSortingHidden: (hidden: boolean) => void;
  setViewTab: (tab: CargoBayViewTab) => void;
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

  const setViewTab = useCallback(
    (tab: CargoBayViewTab) => {
      setPrefs((prev) => {
        const next = { ...prev, viewTab: tab };
        writeCargoBayChromePrefs(sessionId, next);
        return next;
      });
    },
    [sessionId],
  );

  return {
    legendHidden: prefs.legendHidden,
    sortingHidden: prefs.sortingHidden,
    viewTab: prefs.viewTab,
    setLegendHidden,
    setSortingHidden,
    setViewTab,
  };
}
