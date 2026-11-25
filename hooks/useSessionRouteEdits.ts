"use client";

import { useCallback, type Dispatch, type SetStateAction } from "react";
import { listLocationShops } from "@/lib/fixtures/locationShops";
import type { ScuBoxSplits } from "@/lib/missions/catalogMission";
import {
  missionScuAmounts,
  type MissionScuDraft,
} from "@/lib/missions/missionScuAmounts";
import {
  insertQuantumTravelAfter,
  updateChecklistRowLocation,
  updateQuantumTravelEndpoints,
} from "@/lib/missions/quantumTravel";
import { setMissionScuBoxSplits } from "@/lib/missions/rebuildSessionRoute";
import {
  reorderChecklistStops,
  resetTripProgress,
} from "@/lib/missions/reorderStops";
import {
  applySessionCompletionTiming,
  type SessionChecklist,
} from "@/lib/missions/sessionChecklist";
import { stopCargoRole } from "@/lib/missions/stopDeliveryBoxes";
import { toggleStopCompletion } from "@/lib/missions/toggleStopCompletion";
import { QUANTUM_ORIGIN_ROW_ID } from "@/components/missions/checklist/MissionChecklistTable";

type PersistSession = (next: SessionChecklist) => Promise<void>;

/**
 * Route / trip edits: cargo handled, stop done, quantum, reorder, reset,
 * box mixes and mission SCU drafts.
 */
export function useSessionRouteEdits(input: {
  sessionRef: { current: SessionChecklist };
  persistSession: PersistSession;
  setLoadError: Dispatch<SetStateAction<string | null>>;
  syncCatalogBoxSplits: (
    missionId: string,
    nextSession: SessionChecklist,
  ) => void;
}) {
  const {
    sessionRef,
    persistSession,
    setLoadError,
    syncCatalogBoxSplits,
  } = input;

  const onToggleCargoHandled = useCallback(
    (rowId: string, cargoIndex: number) => {
      const current = sessionRef.current;
      const target = current.rows.find((row) => row.id === rowId);
      if (!target) return Promise.resolve();

      const toggled = target.cargoDeliveries[cargoIndex];
      if (!toggled) return Promise.resolve();

      let nextRow: typeof target = {
        ...target,
        cargoDeliveries: target.cargoDeliveries.map((cargo, index) =>
          index === cargoIndex
            ? { ...cargo, isHandled: !cargo.isHandled }
            : cargo,
        ),
      };

      // Last active cargo type checked → stamp whole role (Loaded / Unloaded).
      const role: "pickup" | "delivery" | null =
        toggled.role === "pickup" || toggled.role === "delivery"
          ? toggled.role
          : target.routeAction === "pickup"
            ? "pickup"
            : target.routeAction === "delivery" ||
                target.routeAction === "pickup_delivery"
              ? "delivery"
              : null;
      if (
        role &&
        nextRow.cargoDeliveries[cargoIndex]?.isHandled === true &&
        stopCargoRole.isHandled(nextRow, role)
      ) {
        nextRow = stopCargoRole.withHandled(nextRow, role, true);
      }

      return persistSession(
        applySessionCompletionTiming({
          ...current,
          shipSlugs: current.shipSlugs ?? [],
          startLocationSlug: current.startLocationSlug ?? null,
          rows: current.rows.map((row) => (row.id === rowId ? nextRow : row)),
        }),
      );
    },
    [persistSession, sessionRef],
  );

  const onSetCargoRoleHandled = useCallback(
    (rowId: string, role: "pickup" | "delivery", handled: boolean) => {
      const current = sessionRef.current;
      const target = current.rows.find((row) => row.id === rowId);
      if (!target) return Promise.resolve();

      const withRole = stopCargoRole.withHandled(target, role, handled);
      return persistSession(
        applySessionCompletionTiming({
          ...current,
          shipSlugs: current.shipSlugs ?? [],
          startLocationSlug: current.startLocationSlug ?? null,
          rows: current.rows.map((row) =>
            row.id === rowId ? withRole : row,
          ),
        }),
      );
    },
    [persistSession, sessionRef],
  );

  const onToggleStop = useCallback(
    (rowId: string) => {
      const next = toggleStopCompletion(sessionRef.current, rowId);
      if (!next) return Promise.resolve();
      return persistSession(next);
    },
    [persistSession, sessionRef],
  );

  const onInsertQuantumTravel = useCallback(
    (travel: {
      afterRowId: string;
      fromSlug: string;
      toSlug: string;
      reasonShopSlug?: string | null;
    }) => {
      const current = sessionRef.current;
      return persistSession(
        applySessionCompletionTiming({
          ...current,
          shipSlugs: current.shipSlugs ?? [],
          startLocationSlug: current.startLocationSlug ?? null,
          rows: insertQuantumTravelAfter(current.rows, travel.afterRowId, {
            fromSlug: travel.fromSlug,
            toSlug: travel.toSlug,
            reasonShopSlug: travel.reasonShopSlug ?? null,
          }),
        }),
      );
    },
    [persistSession, sessionRef],
  );

  const onUpdateQuantumTravel = useCallback(
    (travel: { rowId: string; fromSlug?: string; toSlug?: string }) => {
      const current = sessionRef.current;

      if (travel.rowId === QUANTUM_ORIGIN_ROW_ID) {
        let startLocationSlug = current.startLocationSlug ?? null;
        let rows = current.rows;
        if (travel.fromSlug) {
          startLocationSlug = travel.fromSlug;
        }
        if (travel.toSlug && rows[0]) {
          const updated = updateChecklistRowLocation(
            rows,
            rows[0].id,
            travel.toSlug,
          );
          if (!updated.ok) {
            setLoadError(updated.error);
            return Promise.resolve();
          }
          rows = updated.rows;
        }
        return persistSession(
          applySessionCompletionTiming({
            ...current,
            shipSlugs: current.shipSlugs ?? [],
            startLocationSlug,
            rows,
          }),
        );
      }

      const updated = updateQuantumTravelEndpoints(
        current.rows,
        travel.rowId,
        {
          fromSlug: travel.fromSlug,
          toSlug: travel.toSlug,
        },
        {
          isReasonValidAtDestination: (reasonShopSlug, toSlug) =>
            listLocationShops(toSlug).some(
              (shop) => shop.slug === reasonShopSlug,
            ),
        },
      );
      if (!updated.ok) {
        setLoadError(updated.error);
        return Promise.resolve();
      }
      return persistSession(
        applySessionCompletionTiming({
          ...current,
          shipSlugs: current.shipSlugs ?? [],
          startLocationSlug: current.startLocationSlug ?? null,
          rows: updated.rows,
        }),
      );
    },
    [persistSession, sessionRef, setLoadError],
  );

  const applyBoxBreakdown = useCallback(
    (
      missionId: string,
      commoditySlug: string,
      breakdown: ScuBoxSplits,
      options?: {
        applyPreferredMaxToRemaining?: boolean;
        onlyUncorrected?: boolean;
      },
    ) => {
      const result = setMissionScuBoxSplits(
        sessionRef.current,
        missionId,
        breakdown,
        commoditySlug,
        {
          ...options,
          scuBoxSplitsCertainty: "known",
        },
      );
      if (!result.ok) {
        setLoadError(result.error);
        return;
      }
      void persistSession(result.session);
      syncCatalogBoxSplits(missionId, result.session);
    },
    [persistSession, sessionRef, setLoadError, syncCatalogBoxSplits],
  );

  const applyMissionScuDraft = useCallback(
    (missionId: string, draft: MissionScuDraft) => {
      const result = missionScuAmounts.applyDraft(
        sessionRef.current,
        missionId,
        draft,
      );
      if (!result.ok) {
        setLoadError(result.error);
        return;
      }
      void persistSession(result.session);
      syncCatalogBoxSplits(missionId, result.session);
    },
    [persistSession, sessionRef, setLoadError, syncCatalogBoxSplits],
  );

  const skipPickupAtStop = useCallback(
    (input: {
      missionId: string;
      commoditySlug: string;
      locationSlug: string;
    }) => {
      const result = missionScuAmounts.skipPickupAtStop(
        sessionRef.current,
        input,
      );
      if (!result.ok) {
        setLoadError(result.error);
        return;
      }
      void persistSession(result.session);
      syncCatalogBoxSplits(input.missionId, result.session);
    },
    [persistSession, sessionRef, setLoadError, syncCatalogBoxSplits],
  );

  const setPickupScuAtStop = useCallback(
    (input: {
      missionId: string;
      commoditySlug: string;
      locationSlug: string;
      scu: number;
    }) => {
      const result = missionScuAmounts.setPickupScuAtStop(
        sessionRef.current,
        input,
      );
      if (!result.ok) {
        setLoadError(result.error);
        return;
      }
      void persistSession(result.session);
      syncCatalogBoxSplits(input.missionId, result.session);
    },
    [persistSession, sessionRef, setLoadError, syncCatalogBoxSplits],
  );

  const setDeliveryScuAtStop = useCallback(
    (input: {
      missionId: string;
      commoditySlug: string;
      locationSlug: string;
      scu: number;
    }) => {
      const result = missionScuAmounts.setDeliveryScuAtStop(
        sessionRef.current,
        input,
      );
      if (!result.ok) {
        setLoadError(result.error);
        return;
      }
      void persistSession(result.session);
      syncCatalogBoxSplits(input.missionId, result.session);
    },
    [persistSession, sessionRef, setLoadError, syncCatalogBoxSplits],
  );

  const onReorderStops = useCallback(
    (orderedIds: string[]) => {
      const current = sessionRef.current;
      const result = reorderChecklistStops(current.rows, orderedIds);
      if (!result.ok) {
        setLoadError(result.error);
        return;
      }
      void persistSession(
        applySessionCompletionTiming({
          ...current,
          rows: result.rows,
        }),
      );
    },
    [persistSession, sessionRef, setLoadError],
  );

  const onResetTrip = useCallback(() => {
    void persistSession(resetTripProgress(sessionRef.current));
  }, [persistSession, sessionRef]);

  return {
    onToggleCargoHandled,
    onSetCargoRoleHandled,
    onToggleStop,
    onInsertQuantumTravel,
    onUpdateQuantumTravel,
    applyBoxBreakdown,
    applyMissionScuDraft,
    skipPickupAtStop,
    setPickupScuAtStop,
    setDeliveryScuAtStop,
    onReorderStops,
    onResetTrip,
  };
}
