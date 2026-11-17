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

/** Draft per-stop Pick up/Deliver SCU nested under a cargo type. */
export type MissionScuDraftStop = {
  locationKey: string;
  locationSlug: string;
  locationLabel: string;
  commoditySlug: string;
  commodity: string;
  scu: number;
  /** Player overrode this stop — rebalance must not change it. */
  isUserCorrected?: boolean;
};

/** @deprecated Prefer MissionScuDraftStop — same shape. */
export type MissionScuDraftDelivery = MissionScuDraftStop;

export type MissionScuDraft = {
  commodities: MissionScuDraftCommodity[];
  pickups: MissionScuDraftStop[];
  deliveries: MissionScuDraftStop[];
};

/**
 * Keep user-corrected stops fixed; split leftover SCU across the other stops
 * for this commodity (weighted by their current amounts).
 */
export function rebalanceDraftStops(
  stops: MissionScuDraftStop[],
  commoditySlug: string,
  commodityTotal: number,
): MissionScuDraftStop[] {
  const indexes: number[] = [];
  for (const [index, line] of stops.entries()) {
    if (line.commoditySlug === commoditySlug) indexes.push(index);
  }
  if (indexes.length === 0) return stops;

  const lockedIndexes = indexes.filter(
    (index) => stops[index]!.isUserCorrected,
  );
  const unlockedIndexes = indexes.filter(
    (index) => !stops[index]!.isUserCorrected,
  );
  if (unlockedIndexes.length === 0) return stops;

  const lockedSum = lockedIndexes.reduce(
    (sum, index) =>
      sum + Math.max(0, Math.floor(Number(stops[index]!.scu) || 0)),
    0,
  );
  const remainder = Math.max(0, Math.floor(commodityTotal) - lockedSum);
  const parts = unlockedIndexes.map((index) =>
    Math.max(0, Math.floor(Number(stops[index]!.scu) || 0)),
  );
  const scaled = scalePositiveParts(parts, remainder);

  return stops.map((line, index) => {
    const unlockAt = unlockedIndexes.indexOf(index);
    if (unlockAt < 0) return line;
    return { ...line, scu: scaled[unlockAt]! };
  });
}

/** @deprecated Prefer rebalanceDraftStops. */
export function rebalanceDraftDeliveries(
  deliveries: MissionScuDraftStop[],
  commoditySlug: string,
  commodityTotal: number,
): MissionScuDraftStop[] {
  return rebalanceDraftStops(deliveries, commoditySlug, commodityTotal);
}

function splitIsUserCorrected(
  mission: SessionMission,
  locationKey: string,
  commoditySlug: string,
  side: "from" | "to",
): boolean {
  for (const split of mission.scuSplits ?? []) {
    if (
      split.commoditySlug !== commoditySlug &&
      commoditySlugOf(split.commodityName) !== commoditySlug
    ) {
      continue;
    }
    const field =
      side === "from" ? split.fromLocationSlug : split.toLocationSlug;
    if (!locationMatches(field, locationKey)) continue;
    if (split.isUserCorrected) return true;
  }
  return false;
}

function mapLocationLines(
  mission: SessionMission,
  rows: HaulingChecklistRow[] | null | undefined,
  role: "pickup" | "delivery",
): MissionScuDraftStop[] {
  return missionLocationScu
    .locationLines(mission, rows)
    .filter((line) => line.role === role)
    .map((line) => ({
      locationKey: line.locationKey,
      locationSlug: line.locationSlug,
      locationLabel: line.locationLabel,
      commoditySlug: line.commoditySlug,
      commodity: line.commodity,
      scu: line.scu,
      isUserCorrected: splitIsUserCorrected(
        mission,
        line.locationKey,
        line.commoditySlug,
        role === "pickup" ? "from" : "to",
      ),
    }));
}

function setStopScuInList(
  stops: MissionScuDraftStop[],
  commoditySlug: string,
  locationSlug: string,
  scu: number,
  commodityTotal: number,
): MissionScuDraftStop[] {
  const amount = Math.max(0, Math.floor(scu));
  const next = stops.map((line) =>
    line.commoditySlug === commoditySlug && line.locationSlug === locationSlug
      ? { ...line, scu: amount, isUserCorrected: true }
      : line,
  );
  return rebalanceDraftStops(next, commoditySlug, commodityTotal);
}

/**
 * Box-types modal draft buffer: commodity totals + Pick up/Deliver stop amounts.
 */
export const missionScuDraft = {
  /** Build a draft from the live mission + route. */
  draftFromMission(
    mission: SessionMission,
    rows?: HaulingChecklistRow[] | null,
  ): MissionScuDraft {
    const lines = cargoBoxSplits.commodityLines(mission);
    return {
      commodities: lines.map((line) => ({
        commoditySlug: line.commoditySlug,
        commodity: line.commodity,
        scu: line.scu,
      })),
      pickups: mapLocationLines(mission, rows, "pickup"),
      deliveries: mapLocationLines(mission, rows, "delivery"),
    };
  },

  /**
   * Mark a delivery stop as player-overwritten and rebalance the other
   * delivery stops for that commodity.
   */
  setDeliveryScuInDraft(
    draft: MissionScuDraft,
    commoditySlug: string,
    locationSlug: string,
    scu: number,
  ): MissionScuDraft {
    const commodityTotal =
      draft.commodities.find((line) => line.commoditySlug === commoditySlug)
        ?.scu ?? 0;
    return {
      ...draft,
      deliveries: setStopScuInList(
        draft.deliveries,
        commoditySlug,
        locationSlug,
        scu,
        commodityTotal,
      ),
    };
  },

  /**
   * Ensure a pick-up draft row exists for this commodity + location
   * (e.g. before adding cargo back at a skipped stop).
   */
  ensurePickupStopInDraft(
    draft: MissionScuDraft,
    input: {
      commoditySlug: string;
      commodity: string;
      locationKey: string;
      locationSlug: string;
      locationLabel: string;
    },
  ): MissionScuDraft {
    const exists = draft.pickups.some(
      (line) =>
        line.commoditySlug === input.commoditySlug &&
        line.locationSlug === input.locationSlug,
    );
    if (exists) return draft;
    return {
      ...draft,
      pickups: [
        ...draft.pickups,
        {
          locationKey: input.locationKey,
          locationSlug: input.locationSlug,
          locationLabel: input.locationLabel,
          commoditySlug: input.commoditySlug,
          commodity: input.commodity,
          scu: 0,
          isUserCorrected: false,
        },
      ],
    };
  },

  /**
   * Mark a pick-up stop as player-overwritten and rebalance the other
   * pick-up stops for that commodity.
   */
  setPickupScuInDraft(
    draft: MissionScuDraft,
    commoditySlug: string,
    locationSlug: string,
    scu: number,
  ): MissionScuDraft {
    const commodityTotal =
      draft.commodities.find((line) => line.commoditySlug === commoditySlug)
        ?.scu ?? 0;
    return {
      ...draft,
      pickups: setStopScuInList(
        draft.pickups,
        commoditySlug,
        locationSlug,
        scu,
        commodityTotal,
      ),
    };
  },

  /**
   * Quick skip: set this pick-up stop to 0 and rebalance the remaining
   * pick-up stops for that commodity up to the mission total.
   */
  skipPickupInDraft(
    draft: MissionScuDraft,
    commoditySlug: string,
    locationSlug: string,
  ): MissionScuDraft {
    return missionScuDraft.setPickupScuInDraft(
      draft,
      commoditySlug,
      locationSlug,
      0,
    );
  },

  /**
   * True when skipping this pick-up leaves Pick up sums still balanced
   * (other stops can absorb the SCU).
   */
  canSkipPickupInDraft(
    draft: MissionScuDraft,
    commoditySlug: string,
    locationSlug: string,
  ): boolean {
    const target = draft.pickups.find(
      (line) =>
        line.commoditySlug === commoditySlug &&
        line.locationSlug === locationSlug,
    );
    if (!target || Math.max(0, Math.floor(Number(target.scu) || 0)) <= 0) {
      return false;
    }
    const next = missionScuDraft.skipPickupInDraft(
      draft,
      commoditySlug,
      locationSlug,
    );
    return missionScuDraft.validateDraft(next).ok;
  },

  /**
   * Update a commodity total and rebalance only non-overwritten Pick up and
   * Deliver stops.
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
      pickups: rebalanceDraftStops(draft.pickups, commoditySlug, amount),
      deliveries: rebalanceDraftStops(draft.deliveries, commoditySlug, amount),
    };
  },

  /**
   * Pick up and Deliver stop sums must each equal the commodity total when
   * that role has one or more rows in the draft.
   */
  validateDraft(
    draft: MissionScuDraft,
  ): { ok: true } | { ok: false; error: string } {
    for (const commodity of draft.commodities) {
      const total = Math.max(0, Math.floor(Number(commodity.scu) || 0));
      const pickups = draft.pickups.filter(
        (line) => line.commoditySlug === commodity.commoditySlug,
      );
      if (pickups.length > 0) {
        const sum = pickups.reduce(
          (acc, line) => acc + Math.max(0, Math.floor(Number(line.scu) || 0)),
          0,
        );
        if (sum !== total) {
          return {
            ok: false,
            error: `${commodity.commodity}: pick up locations total ${sum} SCU but mission total is ${total} SCU.`,
          };
        }
      }
      const deliveries = draft.deliveries.filter(
        (line) => line.commoditySlug === commodity.commoditySlug,
      );
      if (deliveries.length > 0) {
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
    }
    return { ok: true };
  },
};
