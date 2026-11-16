import { cargoBoxSplits } from "@/lib/missions/cargoBoxSplits";
import { missionLocationScu } from "@/lib/missions/missionLocationScu";
import {
  commoditySlugOf,
  locationMatches,
  scalePositiveParts,
} from "@/lib/missions/missionScuShared";
import type { HaulingChecklistRow } from "@/lib/missions/sessionChecklist";
import type { SessionMission } from "@/lib/missions/sessionMissions";

/** Draft commodity totals for the box-types modal Save flow. */
export type MissionScuDraftCommodity = {
  commoditySlug: string;
  commodity: string;
  scu: number;
};

/** Draft per-delivery-location SCU nested under a cargo type. */
export type MissionScuDraftDelivery = {
  locationKey: string;
  locationSlug: string;
  locationLabel: string;
  commoditySlug: string;
  commodity: string;
  scu: number;
  /** Player overrode this delivery location — rebalance must not change it. */
  isUserCorrected?: boolean;
};

export type MissionScuDraft = {
  commodities: MissionScuDraftCommodity[];
  deliveries: MissionScuDraftDelivery[];
};

/**
 * Keep user-corrected delivery locations fixed; split the leftover SCU across
 * the other locations for this commodity (weighted by their current amounts).
 */
export function rebalanceDraftDeliveries(
  deliveries: MissionScuDraftDelivery[],
  commoditySlug: string,
  commodityTotal: number,
): MissionScuDraftDelivery[] {
  const indexes: number[] = [];
  for (const [index, line] of deliveries.entries()) {
    if (line.commoditySlug === commoditySlug) indexes.push(index);
  }
  if (indexes.length === 0) return deliveries;

  const lockedIndexes = indexes.filter(
    (index) => deliveries[index]!.isUserCorrected,
  );
  const unlockedIndexes = indexes.filter(
    (index) => !deliveries[index]!.isUserCorrected,
  );
  if (unlockedIndexes.length === 0) return deliveries;

  const lockedSum = lockedIndexes.reduce(
    (sum, index) =>
      sum + Math.max(0, Math.floor(Number(deliveries[index]!.scu) || 0)),
    0,
  );
  const remainder = Math.max(0, Math.floor(commodityTotal) - lockedSum);
  const parts = unlockedIndexes.map((index) =>
    Math.max(0, Math.floor(Number(deliveries[index]!.scu) || 0)),
  );
  const scaled = scalePositiveParts(parts, remainder);

  return deliveries.map((line, index) => {
    const unlockAt = unlockedIndexes.indexOf(index);
    if (unlockAt < 0) return line;
    return { ...line, scu: scaled[unlockAt]! };
  });
}

function deliverySplitIsUserCorrected(
  mission: SessionMission,
  locationKey: string,
  commoditySlug: string,
): boolean {
  for (const split of mission.scuSplits ?? []) {
    if (
      split.commoditySlug !== commoditySlug &&
      commoditySlugOf(split.commodityName) !== commoditySlug
    ) {
      continue;
    }
    if (!locationMatches(split.toLocationSlug, locationKey)) continue;
    if (split.isUserCorrected) return true;
  }
  return false;
}

/**
 * Box-types modal draft buffer: commodity totals + delivery location amounts.
 */
export const missionScuDraft = {
  /** Build a draft from the live mission + route (delivery locations only). */
  draftFromMission(
    mission: SessionMission,
    rows?: HaulingChecklistRow[] | null,
  ): MissionScuDraft {
    const lines = cargoBoxSplits.commodityLines(mission);
    const deliveries = missionLocationScu
      .locationLines(mission, rows)
      .filter((line) => line.role === "delivery");
    return {
      commodities: lines.map((line) => ({
        commoditySlug: line.commoditySlug,
        commodity: line.commodity,
        scu: line.scu,
      })),
      deliveries: deliveries.map((line) => ({
        locationKey: line.locationKey,
        locationSlug: line.locationSlug,
        locationLabel: line.locationLabel,
        commoditySlug: line.commoditySlug,
        commodity: line.commodity,
        scu: line.scu,
        isUserCorrected: deliverySplitIsUserCorrected(
          mission,
          line.locationKey,
          line.commoditySlug,
        ),
      })),
    };
  },

  /**
   * Mark a delivery location as player-overwritten and rebalance the other
   * locations for that commodity so they still sum to the mission total.
   */
  setDeliveryScuInDraft(
    draft: MissionScuDraft,
    commoditySlug: string,
    locationSlug: string,
    scu: number,
  ): MissionScuDraft {
    const amount = Math.max(0, Math.floor(scu));
    const deliveries = draft.deliveries.map((line) =>
      line.commoditySlug === commoditySlug &&
      line.locationSlug === locationSlug
        ? { ...line, scu: amount, isUserCorrected: true }
        : line,
    );
    const commodityTotal =
      draft.commodities.find((line) => line.commoditySlug === commoditySlug)
        ?.scu ?? 0;
    return {
      ...draft,
      deliveries: rebalanceDraftDeliveries(
        deliveries,
        commoditySlug,
        commodityTotal,
      ),
    };
  },

  /**
   * Update a commodity total and rebalance only non-overwritten delivery
   * locations.
   */
  setCommodityScuInDraft(
    draft: MissionScuDraft,
    commoditySlug: string,
    scu: number,
  ): MissionScuDraft {
    const amount = Math.max(0, Math.floor(scu));
    const commodities = draft.commodities.map((line) =>
      line.commoditySlug === commoditySlug ? { ...line, scu: amount } : line,
    );
    return {
      ...draft,
      commodities,
      deliveries: rebalanceDraftDeliveries(
        draft.deliveries,
        commoditySlug,
        amount,
      ),
    };
  },

  /**
   * Delivery location sums must equal each commodity’s mission total when that
   * commodity has one or more delivery rows in the draft.
   */
  validateDraft(
    draft: MissionScuDraft,
  ): { ok: true } | { ok: false; error: string } {
    for (const commodity of draft.commodities) {
      const total = Math.max(0, Math.floor(Number(commodity.scu) || 0));
      const deliveries = draft.deliveries.filter(
        (line) => line.commoditySlug === commodity.commoditySlug,
      );
      if (deliveries.length === 0) continue;
      const sum = deliveries.reduce(
        (acc, line) => acc + Math.max(0, Math.floor(Number(line.scu) || 0)),
        0,
      );
      if (sum !== total) {
        return {
          ok: false,
          error: `${commodity.commodity}: delivery locations total ${sum} SCU but mission total is ${total} SCU.`,
        };
      }
    }
    return { ok: true };
  },
};
