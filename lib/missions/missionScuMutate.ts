import { getCommodityBySlug } from "@/lib/fixtures";
import {
  scuBoxSplitsForScu,
  type ScuSplit,
} from "@/lib/missions/catalogMission";
import { cargoBoxSplits } from "@/lib/missions/cargoBoxSplits";
import { missionLocationScu } from "@/lib/missions/missionLocationScu";
import {
  type MissionScuDraft,
  type MissionScuDraftStop,
  missionScuDraft,
} from "@/lib/missions/missionScuDraft";
import {
  cargoSummaryFor,
  commoditySlugOf,
  locationLabelOf,
  locationMatches,
  locationSlugOf,
  scalePositiveParts,
} from "@/lib/missions/missionScuShared";
import { stampMissionBoxSizesOntoRows } from "@/lib/missions/rebuildSessionRoute";
import {
  applySessionCompletionTiming,
  type HaulingChecklistRow,
  type SessionChecklist,
} from "@/lib/missions/sessionChecklist";
import type { SessionMission } from "@/lib/missions/sessionMissions";
import { resolveCommoditySlug } from "@/lib/sessions/resolveRefs";

function refreshBoxSplitsForScu(
  mission: SessionMission,
  commoditySlug: string,
  scu: number,
): SessionMission {
  const auto = scuBoxSplitsForScu(scu, mission.scuMaxContainerSize ?? null);
  const preferredMax = cargoBoxSplits.preferredMaxFromSplits(
    mission.scuCargoBoxSplits?.[commoditySlug] ??
      mission.scuCargoBoxSplitsAutoSelected?.[commoditySlug] ??
      null,
  );
  const selected =
    preferredMax != null
      ? scuBoxSplitsForScu(
          scu,
          cargoBoxSplits.effectivePreferredMax(mission, preferredMax),
        )
      : auto;
  return cargoBoxSplits.withDefaults(
    cargoBoxSplits.setCommodity(
      {
        ...mission,
        scuCargoBoxSplitsAutoSelected: {
          ...(mission.scuCargoBoxSplitsAutoSelected ?? {}),
          [commoditySlug]: auto,
        },
      },
      commoditySlug,
      selected,
    ),
  );
}

function makeDeliverSplit(input: {
  from: string;
  to: string;
  commodity: string;
  scu: number;
  isUserCorrected?: boolean;
  previousScu?: number;
}): ScuSplit {
  const commoditySlug = commoditySlugOf(input.commodity);
  const line: ScuSplit = {
    kind: "deliver",
    fromLocationSlug: locationSlugOf(input.from),
    toLocationSlug: locationSlugOf(input.to),
    commoditySlug,
    commodityName:
      getCommodityBySlug(commoditySlug)?.name ?? input.commodity,
    scu: Math.max(0, Math.floor(Number(input.scu) || 0)),
  };
  if (input.isUserCorrected) {
    line.isUserCorrected = true;
    const auto =
      input.previousScu != null
        ? Math.max(0, Math.floor(Number(input.previousScu) || 0))
        : undefined;
    if (auto != null) line.scuAutoSelected = auto;
  }
  return line;
}

type CargoHit = { rowIndex: number; cargoIndex: number; scu: number };

function roleHits(
  rows: HaulingChecklistRow[],
  missionId: string,
  commoditySlug: string,
  role: "pickup" | "delivery",
): CargoHit[] {
  const hits: CargoHit[] = [];
  for (const [rowIndex, row] of rows.entries()) {
    if (row.routeAction === "quantum") continue;
    for (const [cargoIndex, cargo] of row.cargoDeliveries.entries()) {
      if (cargo.missionId !== missionId) continue;
      if (cargo.commoditySlug !== commoditySlug) continue;
      const cargoRole =
        cargo.role ??
        (row.routeAction === "pickup" || row.routeAction === "delivery"
          ? row.routeAction
          : null);
      if (cargoRole !== role) continue;
      hits.push({ rowIndex, cargoIndex, scu: cargo.scu });
    }
  }
  return hits;
}

function applyScaledHits(
  rows: HaulingChecklistRow[],
  hits: CargoHit[],
  newTotal: number,
): HaulingChecklistRow[] {
  if (hits.length === 0) return rows;
  const next = rows.map((row) => ({
    ...row,
    cargoDeliveries: row.cargoDeliveries.map((cargo) => ({ ...cargo })),
  }));
  const scaled = scalePositiveParts(
    hits.map((hit) => hit.scu),
    newTotal,
  );
  for (const [index, hit] of hits.entries()) {
    next[hit.rowIndex]!.cargoDeliveries[hit.cargoIndex] = {
      ...next[hit.rowIndex]!.cargoDeliveries[hit.cargoIndex]!,
      scu: scaled[index]!,
    };
  }
  return next;
}

function scaleRouteCommodityScu(
  rows: HaulingChecklistRow[],
  missionId: string,
  commoditySlug: string,
  newTotal: number,
): HaulingChecklistRow[] {
  let next = rows;
  next = applyScaledHits(
    next,
    roleHits(next, missionId, commoditySlug, "pickup"),
    newTotal,
  );
  next = applyScaledHits(
    next,
    roleHits(next, missionId, commoditySlug, "delivery"),
    newTotal,
  );
  return next;
}

function setRouteLocationCommodityScu(
  rows: HaulingChecklistRow[],
  missionId: string,
  role: "pickup" | "delivery",
  locationSlug: string,
  commoditySlug: string,
  scu: number,
): HaulingChecklistRow[] {
  const amount = Math.max(0, Math.floor(scu));
  return rows.map((row) => {
    if (row.routeAction === "quantum") return row;
    if (!locationMatches(row.locationSlug, locationSlug)) return row;
    let changed = false;
    const cargoDeliveries = row.cargoDeliveries.map((cargo) => {
      if (cargo.missionId !== missionId) return cargo;
      if (cargo.commoditySlug !== commoditySlug) return cargo;
      const cargoRole =
        cargo.role ??
        (row.routeAction === "pickup" || row.routeAction === "delivery"
          ? row.routeAction
          : null);
      if (cargoRole !== role) return cargo;
      changed = true;
      return { ...cargo, scu: amount };
    });
    return changed ? { ...row, cargoDeliveries } : row;
  });
}

function cargoFromDeliverySplitSums(
  mission: SessionMission,
  scuSplits: NonNullable<SessionMission["scuSplits"]>,
): SessionMission["cargo"] {
  const byCommodity = new Map<string, { commodity: string; scu: number }>();
  for (const split of scuSplits) {
    const slug = split.commoditySlug || commoditySlugOf(split.commodityName);
    const prev = byCommodity.get(slug);
    const scu = Math.max(0, Math.floor(Number(split.scu) || 0));
    if (prev) prev.scu += scu;
    else byCommodity.set(slug, { commodity: split.commodityName, scu });
  }

  const next: SessionMission["cargo"] = [];
  const seen = new Set<string>();
  for (const line of mission.cargo) {
    const slug = commoditySlugOf(line.commodity);
    const updated = byCommodity.get(slug);
    next.push(updated ? { commodity: line.commodity, scu: updated.scu } : line);
    seen.add(slug);
  }
  for (const [slug, entry] of byCommodity) {
    if (seen.has(slug)) continue;
    next.push({ commodity: entry.commodity, scu: entry.scu });
  }
  return next;
}

function finishMissionUpdate(
  session: SessionChecklist,
  missionId: string,
  mission: SessionMission,
  rows: HaulingChecklistRow[],
): SessionChecklist {
  const stamped = stampMissionBoxSizesOntoRows(rows, mission);
  return applySessionCompletionTiming({
    ...session,
    missions: (session.missions ?? []).map((entry) =>
      entry.id === missionId ? mission : entry,
    ),
    rows: stamped,
  });
}

function pinSplitsByLocationField(
  scuSplits: NonNullable<SessionMission["scuSplits"]>,
  stops: MissionScuDraftStop[],
  field: "fromLocationSlug" | "toLocationSlug",
  existing: SessionMission,
): NonNullable<SessionMission["scuSplits"]> {
  let next = [...scuSplits];
  for (const stop of stops) {
    const amount = Math.max(0, Math.floor(stop.scu));
    const matchingIndexes: number[] = [];
    for (const [index, split] of next.entries()) {
      if (
        split.commoditySlug !== stop.commoditySlug &&
        commoditySlugOf(split.commodityName) !== stop.commoditySlug
      ) {
        continue;
      }
      if (!locationMatches(split[field], stop.locationKey)) continue;
      matchingIndexes.push(index);
    }
    const corrected = Boolean(stop.isUserCorrected) || undefined;
    if (matchingIndexes.length === 0) {
      next.push(
        makeDeliverSplit({
          from:
            field === "fromLocationSlug"
              ? stop.locationKey
              : (existing.from[0] ?? stop.locationKey),
          to:
            field === "toLocationSlug"
              ? stop.locationKey
              : (existing.to[0] ?? stop.locationKey),
          commodity: stop.commodity,
          scu: amount,
          isUserCorrected: corrected,
        }),
      );
      continue;
    }
    if (matchingIndexes.length === 1) {
      const index = matchingIndexes[0]!;
      const prev = next[index]!;
      next[index] = {
        ...prev,
        scu: amount,
        isUserCorrected: corrected,
        scuAutoSelected:
          corrected && prev.scuAutoSelected == null
            ? prev.scu
            : prev.scuAutoSelected,
      };
      continue;
    }
    const parts = matchingIndexes.map((index) => next[index]!.scu);
    const scaled = scalePositiveParts(parts, amount);
    matchingIndexes.forEach((index, i) => {
      const prev = next[index]!;
      next[index] = {
        ...prev,
        scu: scaled[i]!,
        isUserCorrected: corrected,
        scuAutoSelected:
          corrected && prev.scuAutoSelected == null
            ? prev.scu
            : prev.scuAutoSelected,
      };
    });
  }
  return next;
}

/**
 * Prefer edge rebuild when Collect×Deliver is 1:N or N:1; otherwise pin
 * delivery then collect amounts on existing splits.
 */
function rebuildScuSplitsFromDraft(
  existing: SessionMission,
  draft: MissionScuDraft,
): NonNullable<SessionMission["scuSplits"]> {
  let scuSplits = [...(existing.scuSplits ?? [])];
  const commoditySlugs = new Set(
    draft.commodities.map((line) => line.commoditySlug),
  );

  for (const commoditySlug of commoditySlugs) {
    const pickups = draft.pickups.filter(
      (line) => line.commoditySlug === commoditySlug,
    );
    const deliveries = draft.deliveries.filter(
      (line) => line.commoditySlug === commoditySlug,
    );
    if (pickups.length === 0 && deliveries.length === 0) continue;

    const others = scuSplits.filter(
      (split) =>
        split.commoditySlug !== commoditySlug &&
        commoditySlugOf(split.commodityName) !== commoditySlug,
    );

    if (deliveries.length === 1 && pickups.length > 0) {
      const delivery = deliveries[0]!;
      scuSplits = [
        ...others,
        ...pickups.map((pickup) =>
          makeDeliverSplit({
            from: pickup.locationKey,
            to: delivery.locationKey,
            commodity: pickup.commodity,
            scu: pickup.scu,
            isUserCorrected:
              Boolean(pickup.isUserCorrected) ||
              Boolean(delivery.isUserCorrected) ||
              undefined,
          }),
        ),
      ];
      continue;
    }

    if (pickups.length === 1 && deliveries.length > 0) {
      const pickup = pickups[0]!;
      scuSplits = [
        ...others,
        ...deliveries.map((delivery) =>
          makeDeliverSplit({
            from: pickup.locationKey,
            to: delivery.locationKey,
            commodity: delivery.commodity,
            scu: delivery.scu,
            isUserCorrected:
              Boolean(delivery.isUserCorrected) ||
              Boolean(pickup.isUserCorrected) ||
              undefined,
          }),
        ),
      ];
      continue;
    }

    if (scuSplits.length === 0 && deliveries.length > 0) {
      const fromDefault =
        pickups[0]?.locationKey ??
        existing.from[0] ??
        deliveries[0]!.locationKey;
      for (const delivery of deliveries) {
        scuSplits.push(
          makeDeliverSplit({
            from: fromDefault,
            to: delivery.locationKey,
            commodity: delivery.commodity,
            scu: delivery.scu,
            isUserCorrected: Boolean(delivery.isUserCorrected) || undefined,
          }),
        );
      }
      continue;
    }

    if (deliveries.length > 0) {
      scuSplits = pinSplitsByLocationField(
        scuSplits,
        deliveries,
        "toLocationSlug",
        existing,
      );
    }
    if (pickups.length > 0) {
      scuSplits = pinSplitsByLocationField(
        scuSplits,
        pickups,
        "fromLocationSlug",
        existing,
      );
    }
  }

  return scuSplits;
}

/** Commit SCU edits onto the live session mission + route. */
export const missionScuMutate = {
  /**
   * Skip pick-up of one commodity at one stop: zero that stop and rebalance
   * remaining pick-ups, then persist via {@link applyDraft}.
   */
  skipPickupAtStop(
    session: SessionChecklist,
    input: {
      missionId: string;
      commoditySlug: string;
      locationSlug: string;
    },
  ): { ok: true; session: SessionChecklist } | { ok: false; error: string } {
    const mission = (session.missions ?? []).find(
      (entry) => entry.id === input.missionId,
    );
    if (!mission) {
      return { ok: false, error: `Unknown mission: ${input.missionId}` };
    }
    if (mission.isCompleted) {
      return { ok: false, error: "Completed contracts cannot change pick-ups." };
    }
    const draft = missionScuDraft.skipPickupInDraft(
      missionScuDraft.draftFromMission(mission, session.rows),
      input.commoditySlug,
      input.locationSlug,
    );
    return missionScuMutate.applyDraft(session, input.missionId, draft);
  },

  /**
   * Set pick-up SCU for a mission commodity at one stop (add or restore after
   * skip). Rebalances other pick-up stops so the mission total stays fixed.
   */
  setPickupScuAtStop(
    session: SessionChecklist,
    input: {
      missionId: string;
      commoditySlug: string;
      locationSlug: string;
      scu: number;
    },
  ): { ok: true; session: SessionChecklist } | { ok: false; error: string } {
    const amount = Math.max(0, Math.floor(Number(input.scu) || 0));
    if (amount <= 0) {
      return { ok: false, error: "Pick-up SCU must be greater than 0." };
    }
    const mission = (session.missions ?? []).find(
      (entry) => entry.id === input.missionId,
    );
    if (!mission) {
      return { ok: false, error: `Unknown mission: ${input.missionId}` };
    }
    if (mission.isCompleted) {
      return { ok: false, error: "Completed contracts cannot change pick-ups." };
    }
    const slug =
      resolveCommoditySlug(input.commoditySlug) ??
      input.commoditySlug.trim().toLowerCase();
    const cargoLine = mission.cargo.find(
      (line) => commoditySlugOf(line.commodity) === slug,
    );
    if (!cargoLine) {
      return {
        ok: false,
        error: `Commodity ${input.commoditySlug} is not on this mission.`,
      };
    }
    const locationLabel = locationLabelOf(input.locationSlug);
    let draft = missionScuDraft.ensurePickupStopInDraft(
      missionScuDraft.draftFromMission(mission, session.rows),
      {
        commoditySlug: slug,
        commodity: cargoLine.commodity,
        locationKey: input.locationSlug,
        locationSlug: locationSlugOf(input.locationSlug),
        locationLabel,
      },
    );
    draft = missionScuDraft.setPickupScuInDraft(
      draft,
      slug,
      locationSlugOf(input.locationSlug),
      amount,
    );
    return missionScuMutate.applyDraft(session, input.missionId, draft);
  },

  /**
   * Persist a validated draft: commodity totals + Collect/Deliver stop amounts.
   * Fails closed when Collect or Deliver sums do not match each commodity total.
   */
  applyDraft(
    session: SessionChecklist,
    missionId: string,
    draft: MissionScuDraft,
  ): { ok: true; session: SessionChecklist } | { ok: false; error: string } {
    const check = missionScuDraft.validateDraft(draft);
    if (!check.ok) return check;

    const existing = (session.missions ?? []).find(
      (mission) => mission.id === missionId,
    );
    if (!existing) {
      return { ok: false, error: `Unknown mission: ${missionId}` };
    }

    const commodityBySlug = new Map(
      draft.commodities.map((line) => [line.commoditySlug, line]),
    );

    const cargo = existing.cargo.map((line) => {
      const slug = commoditySlugOf(line.commodity);
      const next = commodityBySlug.get(slug);
      return next ? { ...line, scu: Math.max(0, Math.floor(next.scu)) } : line;
    });

    let scuSplits = rebuildScuSplitsFromDraft(existing, draft);

    let mission: SessionMission = {
      ...existing,
      cargo,
      scuSplits: scuSplits.length > 0 ? scuSplits : existing.scuSplits,
      cargoSummary: cargoSummaryFor({ ...existing, cargo }),
      scuTotalCertainty: "known",
    };

    for (const commodity of draft.commodities) {
      mission = refreshBoxSplitsForScu(
        mission,
        commodity.commoditySlug,
        Math.max(0, Math.floor(commodity.scu)),
      );
    }

    let rows = session.rows;
    for (const commodity of draft.commodities) {
      const amount = Math.max(0, Math.floor(commodity.scu));
      rows = scaleRouteCommodityScu(
        rows,
        missionId,
        commodity.commoditySlug,
        amount,
      );
    }
    for (const delivery of draft.deliveries) {
      rows = setRouteLocationCommodityScu(
        rows,
        missionId,
        "delivery",
        delivery.locationKey,
        delivery.commoditySlug,
        Math.max(0, Math.floor(delivery.scu)),
      );
    }
    if (draft.pickups.length > 0) {
      for (const pickup of draft.pickups) {
        rows = setRouteLocationCommodityScu(
          rows,
          missionId,
          "pickup",
          pickup.locationKey,
          pickup.commoditySlug,
          Math.max(0, Math.floor(pickup.scu)),
        );
      }
    } else {
      // No collect rows in the draft — keep legacy proportional pickup scale.
      for (const commodity of draft.commodities) {
        const amount = Math.max(0, Math.floor(commodity.scu));
        rows = applyScaledHits(
          rows,
          roleHits(rows, missionId, commodity.commoditySlug, "pickup"),
          amount,
        );
      }
    }

    return {
      ok: true,
      session: finishMissionUpdate(session, missionId, mission, rows),
    };
  },

  /**
   * Set one commodity’s mission-total SCU; scale location splits + route cargo.
   */
  setCommodityTotal(
    session: SessionChecklist,
    missionId: string,
    commoditySlug: string,
    scu: number,
  ): { ok: true; session: SessionChecklist } | { ok: false; error: string } {
    const slug =
      resolveCommoditySlug(commoditySlug) ?? commoditySlug.trim().toLowerCase();
    const amount = Math.max(0, Math.floor(Number(scu) || 0));
    const existing = (session.missions ?? []).find(
      (mission) => mission.id === missionId,
    );
    if (!existing) {
      return { ok: false, error: `Unknown mission: ${missionId}` };
    }

    const cargo = existing.cargo.map((line) => {
      if (commoditySlugOf(line.commodity) !== slug) return line;
      return { ...line, scu: amount };
    });
    if (!cargo.some((line) => commoditySlugOf(line.commodity) === slug)) {
      return {
        ok: false,
        error: `Unknown commodity for mission ${missionId}: ${commoditySlug}`,
      };
    }

    let scuSplits = existing.scuSplits;
    if (scuSplits && scuSplits.length > 0) {
      const matching = scuSplits
        .map((split, index) => ({
          index,
          scu: Math.max(0, Math.floor(split.scu)),
          match:
            split.commoditySlug === slug ||
            commoditySlugOf(split.commodityName) === slug,
        }))
        .filter((entry) => entry.match);
      const scaled = scalePositiveParts(
        matching.map((entry) => entry.scu),
        amount,
      );
      scuSplits = scuSplits.map((split) => ({ ...split }));
      matching.forEach((entry, index) => {
        scuSplits![entry.index] = {
          ...scuSplits![entry.index]!,
          scu: scaled[index]!,
        };
      });
    } else if (existing.from.length >= 1 && existing.to.length >= 1) {
      const commodity =
        cargo.find((line) => commoditySlugOf(line.commodity) === slug)
          ?.commodity ?? commoditySlug;
      scuSplits = [
        makeDeliverSplit({
          from: existing.from[0]!,
          to: existing.to[0]!,
          commodity,
          scu: amount,
        }),
      ];
    }

    let mission: SessionMission = {
      ...existing,
      cargo,
      scuSplits,
      cargoSummary: cargoSummaryFor({ ...existing, cargo }),
      scuTotalCertainty: "known",
    };
    mission = refreshBoxSplitsForScu(mission, slug, amount);

    const rows = scaleRouteCommodityScu(
      session.rows,
      missionId,
      slug,
      amount,
    );
    return {
      ok: true,
      session: finishMissionUpdate(session, missionId, mission, rows),
    };
  },

  /**
   * Set SCU for one commodity at one collect/deliver location.
   * Mission commodity total becomes the sum of that role’s location amounts;
   * the opposite role is scaled to match.
   */
  setLocationAmount(
    session: SessionChecklist,
    missionId: string,
    input: {
      role: "pickup" | "delivery";
      locationKey: string;
      commoditySlug: string;
      scu: number;
    },
  ): { ok: true; session: SessionChecklist } | { ok: false; error: string } {
    const slug =
      resolveCommoditySlug(input.commoditySlug) ??
      input.commoditySlug.trim().toLowerCase();
    const amount = Math.max(0, Math.floor(Number(input.scu) || 0));
    const existing = (session.missions ?? []).find(
      (mission) => mission.id === missionId,
    );
    if (!existing) {
      return { ok: false, error: `Unknown mission: ${missionId}` };
    }

    const commodity =
      existing.cargo.find((line) => commoditySlugOf(line.commodity) === slug)
        ?.commodity ?? input.commoditySlug;

    let scuSplits = [...(existing.scuSplits ?? [])];
    if (scuSplits.length === 0) {
      const current =
        existing.cargo.find((line) => commoditySlugOf(line.commodity) === slug)
          ?.scu ?? amount;
      for (const from of existing.from.length ? existing.from : [input.locationKey]) {
        for (const to of existing.to.length ? existing.to : [input.locationKey]) {
          scuSplits.push(
            makeDeliverSplit({ from, to, commodity, scu: current }),
          );
        }
      }
    }

    const locField =
      input.role === "pickup" ? "fromLocationSlug" : "toLocationSlug";
    let touched = false;
    scuSplits = scuSplits.map((split) => {
      if (
        split.commoditySlug !== slug &&
        commoditySlugOf(split.commodityName) !== slug
      ) {
        return split;
      }
      if (!locationMatches(split[locField], input.locationKey)) return split;
      touched = true;
      return { ...split, scu: amount };
    });
    if (!touched) {
      if (input.role === "pickup") {
        scuSplits.push(
          makeDeliverSplit({
            from: input.locationKey,
            to:
              existing.to[0] ??
              scuSplits[0]?.toLocationSlug ??
              input.locationKey,
            commodity,
            scu: amount,
          }),
        );
      } else {
        scuSplits.push(
          makeDeliverSplit({
            from:
              existing.from[0] ??
              scuSplits[0]?.fromLocationSlug ??
              input.locationKey,
            to: input.locationKey,
            commodity,
            scu: amount,
          }),
        );
      }
    }

    // Mission total from the edited role’s location sums.
    const locationLines = missionLocationScu.locationLines(
      { ...existing, scuSplits },
      null,
    );
    const roleTotal = locationLines
      .filter(
        (line) =>
          line.role === input.role && line.commoditySlug === slug,
      )
      .reduce((sum, line) => sum + line.scu, 0);

    const cargo = existing.cargo.map((line) =>
      commoditySlugOf(line.commodity) === slug
        ? { ...line, scu: roleTotal }
        : line,
    );

    // Keep scuSplits delivering-side sums aligned when editing pickups:
    // scale opposite-field splits to roleTotal.
    if (input.role === "pickup") {
      const deliveryMatches = scuSplits
        .map((split, index) => ({
          index,
          scu: Math.max(0, Math.floor(split.scu)),
          match:
            split.commoditySlug === slug ||
            commoditySlugOf(split.commodityName) === slug,
        }))
        .filter((entry) => entry.match);
      const scaled = scalePositiveParts(
        deliveryMatches.map((entry) => entry.scu),
        roleTotal,
      );
      deliveryMatches.forEach((entry, index) => {
        // Preserve the edited from-location amount(s): only rescale splits that
        // do not match the edited location on from.
        const split = scuSplits[entry.index]!;
        if (locationMatches(split.fromLocationSlug, input.locationKey)) {
          scuSplits[entry.index] = { ...split, scu: amount };
        } else {
          scuSplits[entry.index] = { ...split, scu: scaled[index]! };
        }
      });
      // Fix remainder so sum of this commodity’s splits == roleTotal.
      const commoditySplits = scuSplits
        .map((split, index) => ({ split, index }))
        .filter(
          ({ split }) =>
            split.commoditySlug === slug ||
            commoditySlugOf(split.commodityName) === slug,
        );
      const sumNow = commoditySplits.reduce(
        (acc, { split }) => acc + Math.max(0, Math.floor(split.scu)),
        0,
      );
      const delta = roleTotal - sumNow;
      if (delta !== 0 && commoditySplits.length > 0) {
        const adjustable =
          commoditySplits.find(
            ({ split }) =>
              !locationMatches(split.fromLocationSlug, input.locationKey),
          ) ?? commoditySplits[0]!;
        scuSplits[adjustable.index] = {
          ...scuSplits[adjustable.index]!,
          scu: Math.max(
            0,
            Math.floor(scuSplits[adjustable.index]!.scu) + delta,
          ),
        };
      }
    } else {
      void cargoFromDeliverySplitSums;
    }

    const cargoFinal =
      input.role === "delivery"
        ? cargoFromDeliverySplitSums(existing, scuSplits)
        : cargo;

    let mission: SessionMission = {
      ...existing,
      cargo: cargoFinal,
      scuSplits,
      cargoSummary: cargoSummaryFor({ ...existing, cargo: cargoFinal }),
      scuTotalCertainty: "known",
    };
    const commodityTotal =
      mission.cargo.find((line) => commoditySlugOf(line.commodity) === slug)
        ?.scu ?? roleTotal;
    mission = refreshBoxSplitsForScu(mission, slug, commodityTotal);

    let rows = setRouteLocationCommodityScu(
      session.rows,
      missionId,
      input.role,
      input.locationKey,
      slug,
      amount,
    );
    const opposite = input.role === "pickup" ? "delivery" : "pickup";
    rows = applyScaledHits(
      rows,
      roleHits(rows, missionId, slug, opposite),
      commodityTotal,
    );
    // Re-pin edited location after opposite scale (no-op for opposite role).
    rows = setRouteLocationCommodityScu(
      rows,
      missionId,
      input.role,
      input.locationKey,
      slug,
      amount,
    );
    // Scale other same-role locations so role sum == commodityTotal.
    const sameRole = roleHits(rows, missionId, slug, input.role).filter(
      (hit) => {
        const row = rows[hit.rowIndex]!;
        return !locationMatches(row.locationSlug, input.locationKey);
      },
    );
    if (sameRole.length > 0) {
      const pinnedSum = amount;
      const remaining = Math.max(0, commodityTotal - pinnedSum);
      rows = applyScaledHits(rows, sameRole, remaining);
    }

    return {
      ok: true,
      session: finishMissionUpdate(session, missionId, mission, rows),
    };
  },
};
