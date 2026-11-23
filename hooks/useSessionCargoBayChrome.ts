"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_CARGO_BAY_CHROME_PREFS,
  readCargoBayChromePrefs,
  writeCargoBayChromePrefs,
  type CargoBayAutoPackMode,
  type CargoBayChromePrefs,
  type CargoBaySortingMode,
  type CargoBaySplitOrientation,
  type CargoBayViewTab,
} from "@/lib/sessions/cargoBayLayoutClientPrefs";

/**
 * Per-session Legend / Packing visibility, overlay vs push side panels,
 * packing type, 2D/Split/3D view, and grid zooms in `localStorage`.
 * Survives modal close/reopen.
 */
export function useSessionCargoBayChrome(
  sessionId: string | null | undefined,
): {
  legendHidden: boolean;
  sortingHidden: boolean;
  sidePanelsOverlay: boolean;
  viewTab: CargoBayViewTab;
  splitOrientation: CargoBaySplitOrientation;
  syncedZoom: boolean;
  topZoomLocked: boolean;
  isoZoomLocked: boolean;
  sortingMode: CargoBaySortingMode;
  lastAutoPackMode: CargoBayAutoPackMode;
  prioritized: boolean;
  topZoom: number;
  isoZoom: number;
  setLegendHidden: (hidden: boolean) => void;
  setSortingHidden: (hidden: boolean) => void;
  setSidePanelsOverlay: (overlay: boolean) => void;
  setViewTab: (tab: CargoBayViewTab) => void;
  setSplitOrientation: (orientation: CargoBaySplitOrientation) => void;
  setSyncedZoom: (synced: boolean) => void;
  setTopZoomLocked: (locked: boolean) => void;
  setIsoZoomLocked: (locked: boolean) => void;
  setSortingMode: (mode: CargoBaySortingMode) => void;
  setLastAutoPackMode: (mode: CargoBayAutoPackMode) => void;
  setPrioritized: (prioritized: boolean) => void;
  setTopZoom: (zoom: number) => void;
  setIsoZoom: (zoom: number) => void;
} {
  const [prefs, setPrefs] = useState<CargoBayChromePrefs>(
    DEFAULT_CARGO_BAY_CHROME_PREFS,
  );

  useEffect(() => {
    setPrefs(readCargoBayChromePrefs(sessionId));
  }, [sessionId]);

  const patchPrefs = useCallback(
    (patch: Partial<CargoBayChromePrefs>) => {
      setPrefs((prev) => {
        const next = { ...prev, ...patch };
        writeCargoBayChromePrefs(sessionId, next);
        return next;
      });
    },
    [sessionId],
  );

  const setLegendHidden = useCallback(
    (hidden: boolean) => {
      patchPrefs({ legendHidden: hidden });
    },
    [patchPrefs],
  );

  const setSortingHidden = useCallback(
    (hidden: boolean) => {
      patchPrefs({ sortingHidden: hidden });
    },
    [patchPrefs],
  );

  const setSidePanelsOverlay = useCallback(
    (overlay: boolean) => {
      patchPrefs({ sidePanelsOverlay: overlay });
    },
    [patchPrefs],
  );

  const setViewTab = useCallback(
    (tab: CargoBayViewTab) => {
      patchPrefs({ viewTab: tab });
    },
    [patchPrefs],
  );

  const setSplitOrientation = useCallback(
    (orientation: CargoBaySplitOrientation) => {
      patchPrefs({ splitOrientation: orientation });
    },
    [patchPrefs],
  );

  const setSyncedZoom = useCallback(
    (synced: boolean) => {
      setPrefs((prev) => {
        const next: CargoBayChromePrefs = synced
          ? {
              ...prev,
              syncedZoom: true,
              // Snap 3D to 2D when enabling so both start aligned.
              isoZoom: prev.topZoom,
            }
          : { ...prev, syncedZoom: false };
        writeCargoBayChromePrefs(sessionId, next);
        return next;
      });
    },
    [sessionId],
  );

  const setTopZoomLocked = useCallback(
    (locked: boolean) => {
      patchPrefs({ topZoomLocked: locked });
    },
    [patchPrefs],
  );

  const setIsoZoomLocked = useCallback(
    (locked: boolean) => {
      patchPrefs({ isoZoomLocked: locked });
    },
    [patchPrefs],
  );

  const setSortingMode = useCallback(
    (mode: CargoBaySortingMode) => {
      patchPrefs({ sortingMode: mode });
    },
    [patchPrefs],
  );

  const setLastAutoPackMode = useCallback(
    (mode: CargoBayAutoPackMode) => {
      patchPrefs({ lastAutoPackMode: mode });
    },
    [patchPrefs],
  );

  const setPrioritized = useCallback(
    (next: boolean) => {
      patchPrefs({ prioritized: next });
    },
    [patchPrefs],
  );

  const setTopZoom = useCallback(
    (zoom: number) => {
      setPrefs((prev) => {
        // Zoom lock only blocks scroll-to-zoom — +/- / fit still persist.
        const next: CargoBayChromePrefs = {
          ...prev,
          topZoom: zoom,
          ...(prev.syncedZoom ? { isoZoom: zoom } : {}),
        };
        writeCargoBayChromePrefs(sessionId, next);
        return next;
      });
    },
    [sessionId],
  );

  const setIsoZoom = useCallback(
    (zoom: number) => {
      setPrefs((prev) => {
        const next: CargoBayChromePrefs = {
          ...prev,
          isoZoom: zoom,
          ...(prev.syncedZoom ? { topZoom: zoom } : {}),
        };
        writeCargoBayChromePrefs(sessionId, next);
        return next;
      });
    },
    [sessionId],
  );

  return {
    legendHidden: prefs.legendHidden,
    sortingHidden: prefs.sortingHidden,
    sidePanelsOverlay: prefs.sidePanelsOverlay,
    viewTab: prefs.viewTab,
    splitOrientation: prefs.splitOrientation,
    syncedZoom: prefs.syncedZoom,
    topZoomLocked: prefs.topZoomLocked,
    isoZoomLocked: prefs.isoZoomLocked,
    sortingMode: prefs.sortingMode,
    lastAutoPackMode: prefs.lastAutoPackMode,
    prioritized: prefs.prioritized,
    topZoom: prefs.topZoom,
    isoZoom: prefs.isoZoom,
    setLegendHidden,
    setSortingHidden,
    setSidePanelsOverlay,
    setViewTab,
    setSplitOrientation,
    setSyncedZoom,
    setTopZoomLocked,
    setIsoZoomLocked,
    setSortingMode,
    setLastAutoPackMode,
    setPrioritized,
    setTopZoom,
    setIsoZoom,
  };
}
