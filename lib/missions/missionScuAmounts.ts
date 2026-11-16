import { getLocationBySlug } from "@/lib/fixtures";
import { scuBoxSplitsForScu } from "@/lib/missions/catalogMission";
import { cargoBoxSplits } from "@/lib/missions/cargoBoxSplits";
import {
  applySessionCompletionTiming,
  type HaulingChecklistRow,
  type SessionChecklistModel,
} from "@/lib/missions/mockSession";
import { stampMissionBoxSizesOntoRows } from "@/lib/missions/rebuildSessionRoute";
import type { SessionMission } from "@/lib/missions/sessionMissions";
import {
  resolveCommoditySlug,
  resolveLocationSlug,
} from "@/lib/sessions/resolveRefs";

export type MissionStationScuLine = {
  role: "pickup" | "delivery";
  /** Location name/slug as stored on the mission / split. */
  locationKey: string;
  locationSlug: string;
  locationLabel: string;
  commodity: string;
  commoditySlug: string;
  scu: number;
};

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
};

export type MissionScuDraft = {
  commodities: MissionScuDraftCommodity[];
  deliveries: MissionScuDraftDelivery[];
};

function commoditySlugOf(nameOrSlug: string): string {
  return (
    resolveCommoditySlug(nameOrSlug) ?? nameOrSlug.trim().toLowerCase()
  );
}

function locationSlugOf(nameOrSlug: string): string {
  return resolveLocationSlug(nameOrSlug) ?? nameOrSlug.trim().toLowerCase();
}

function locationLabelOf(nameOrSlug: string): string {
  const slug = locationSlugOf(nameOrSlug);
  return getLocationBySlug(slug)?.name ?? nameOrSlug;
}

function locationMatches(a: string, b: string): boolean {
  const aSlug = locationSlugOf(a);
  const bSlug = locationSlugOf(b);
  if (aSlug && bSlug && aSlug === bSlug) return true;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function cargoSummaryFor(mission: SessionMission): string {
  return mission.cargo
    .filter((line) => (Number(line.scu) || 0) > 0)
    .map((line) => `${line.scu} SCU ${line.commodity}`)
    .join(" · ");
}

function refreshBoxSplitsForScu(
  mission: SessionMission,
  commoditySlug: string,
  scu: number,
): SessionMission {
  const auto = scuBoxSplitsForScu(scu, mission.maxContainerScu ?? null);
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

function scalePositiveParts(parts: number[], newTotal: number): number[] {
  const safeTotal = Math.max(0, Math.floor(newTotal));
  const positive = parts.map((part) => Math.max(0, Math.floor(part)));
  const sum = positive.reduce((acc, part) => acc + part, 0);
  if (positive.length === 0) return parts;
  if (sum <= 0) {
    const out = positive.map(() => 0);
    out[0] = safeTotal;
    return out;
  }
  if (positive.length === 1) return [safeTotal];

  const scaled = positive.map((part) =>
    Math.floor((part / sum) * safeTotal),
  );
  let remainder = safeTotal - scaled.reduce((acc, part) => acc + part, 0);
  let index = 0;
  while (remainder > 0 && scaled.length > 0) {
    scaled[index % scaled.length]! += 1;
    remainder -= 1;
    index += 1;
  }
  return scaled;
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

function setRouteStationCommodityScu(
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
  deliverySplits: NonNullable<SessionMission["deliverySplits"]>,
): SessionMission["cargo"] {
  const byCommodity = new Map<string, { commodity: string; scu: number }>();
  for (const split of deliverySplits) {
    const slug = commoditySlugOf(split.commodity);
    const prev = byCommodity.get(slug);
    const scu = Math.max(0, Math.floor(Number(split.scu) || 0));
    if (prev) prev.scu += scu;
    else byCommodity.set(slug, { commodity: split.commodity, scu });
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
  session: SessionChecklistModel,
  missionId: string,
  mission: SessionMission,
  rows: HaulingChecklistRow[],
): SessionChecklistModel {
  const stamped = stampMissionBoxSizesOntoRows(rows, mission);
  return applySessionCompletionTiming({
    ...session,
    missions: (session.missions ?? []).map((entry) =>
      entry.id === missionId ? mission : entry,
    ),
    rows: stamped,
  });
}

/** Station SCU lines from the live route for one mission (no invented stops). */
function stationLinesFromRows(
  mission: SessionMission,
  rows: HaulingChecklistRow[],
): MissionStationScuLine[] {
  const commodityBySlug = new Map(
    mission.cargo.map((line) => [
      commoditySlugOf(line.commodity),
      line.commodity,
    ]),
  );
  const byKey = new Map<string, MissionStationScuLine>();

  for (const row of rows) {
    if (row.routeAction === "quantum") continue;
    for (const cargo of row.cargoDeliveries) {
      if (cargo.missionId && cargo.missionId !== mission.id) continue;
      const commodity = commodityBySlug.get(cargo.commoditySlug);
      if (!commodity) continue;
      const role =
        cargo.role ??
        (row.routeAction === "pickup" || row.routeAction === "delivery"
          ? row.routeAction
          : null);
      if (role !== "pickup" && role !== "delivery") continue;

      const locationKey = row.locationSlug;
      const key = `${role}::${locationSlugOf(locationKey)}::${cargo.commoditySlug}`;
      const existing = byKey.get(key);
      if (existing) {
        existing.scu += Math.max(0, Math.floor(cargo.scu));
      } else {
        byKey.set(key, {
          role,
          locationKey,
          locationSlug: locationSlugOf(locationKey),
          locationLabel: locationLabelOf(locationKey),
          commodity,
          commoditySlug: cargo.commoditySlug,
          scu: Math.max(0, Math.floor(cargo.scu)),
        });
      }
    }
  }

  return [...byKey.values()];
}

/**
 * Editable SCU lines for the box-types modal: mission cargo totals and
 * per-station collect/deliver amounts.
 */
export const missionScuAmounts = {
  /** Build a draft from the live mission + route (delivery stations only). */
  draftFromMission(
    mission: SessionMission,
    rows?: HaulingChecklistRow[] | null,
  ): MissionScuDraft {
    const lines = cargoBoxSplits.commodityLines(mission);
    const stations = missionScuAmounts
      .stationLines(mission, rows)
      .filter((line) => line.role === "delivery");
    return {
      commodities: lines.map((line) => ({
        commoditySlug: line.commoditySlug,
        commodity: line.commodity,
        scu: line.scu,
      })),
      deliveries: stations.map((line) => ({
        locationKey: line.locationKey,
        locationSlug: line.locationSlug,
        locationLabel: line.locationLabel,
        commoditySlug: line.commoditySlug,
        commodity: line.commodity,
        scu: line.scu,
      })),
    };
  },

  /**
   * Delivery station sums must equal each commodity’s mission total when that
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
          error: `${commodity.commodity}: delivery stops total ${sum} SCU but mission total is ${total} SCU.`,
        };
      }
    }
    return { ok: true };
  },

  /**
   * Persist a validated draft: commodity totals + delivery station amounts,
   * then scale pickups / restamp crates. Fails closed when delivery sums
   * do not match each commodity total.
   */
  applyDraft(
    session: SessionChecklistModel,
    missionId: string,
    draft: MissionScuDraft,
  ): { ok: true; session: SessionChecklistModel } | { ok: false; error: string } {
    const check = missionScuAmounts.validateDraft(draft);
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

    let deliverySplits = [...(existing.deliverySplits ?? [])];
    if (deliverySplits.length === 0 && draft.deliveries.length > 0) {
      const fromDefault = existing.from[0] ?? draft.deliveries[0]!.locationKey;
      for (const delivery of draft.deliveries) {
        deliverySplits.push({
          from: fromDefault,
          to: delivery.locationKey,
          commodity: delivery.commodity,
          scu: Math.max(0, Math.floor(delivery.scu)),
        });
      }
    } else if (deliverySplits.length > 0) {
      // Pin delivery (`to`) amounts from the draft; leave unmatched splits.
      for (const delivery of draft.deliveries) {
        const amount = Math.max(0, Math.floor(delivery.scu));
        const matchingIndexes: number[] = [];
        for (const [index, split] of deliverySplits.entries()) {
          if (commoditySlugOf(split.commodity) !== delivery.commoditySlug) {
            continue;
          }
          if (!locationMatches(split.to, delivery.locationKey)) continue;
          matchingIndexes.push(index);
        }
        if (matchingIndexes.length === 0) {
          deliverySplits.push({
            from: existing.from[0] ?? delivery.locationKey,
            to: delivery.locationKey,
            commodity: delivery.commodity,
            scu: amount,
          });
          continue;
        }
        if (matchingIndexes.length === 1) {
          const index = matchingIndexes[0]!;
          deliverySplits[index] = {
            ...deliverySplits[index]!,
            scu: amount,
          };
        } else {
          const parts = matchingIndexes.map(
            (index) => deliverySplits[index]!.scu,
          );
          const scaled = scalePositiveParts(parts, amount);
          matchingIndexes.forEach((index, i) => {
            deliverySplits[index] = {
              ...deliverySplits[index]!,
              scu: scaled[i]!,
            };
          });
        }
      }
    }

    let mission: SessionMission = {
      ...existing,
      cargo,
      deliverySplits: deliverySplits.length > 0 ? deliverySplits : existing.deliverySplits,
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
      rows = setRouteStationCommodityScu(
        rows,
        missionId,
        "delivery",
        delivery.locationKey,
        delivery.commoditySlug,
        Math.max(0, Math.floor(delivery.scu)),
      );
    }
    // Pickups follow each commodity total after deliveries are pinned.
    for (const commodity of draft.commodities) {
      const amount = Math.max(0, Math.floor(commodity.scu));
      rows = applyScaledHits(
        rows,
        roleHits(rows, missionId, commodity.commoditySlug, "pickup"),
        amount,
      );
    }

    return {
      ok: true,
      session: finishMissionUpdate(session, missionId, mission, rows),
    };
  },

  stationLines(
    mission: SessionMission,
    rows?: HaulingChecklistRow[] | null,
  ): MissionStationScuLine[] {
    // Live route is authoritative: never invent even-split phantoms for
    // destinations that do not actually move this commodity.
    if (rows?.length) {
      return stationLinesFromRows(mission, rows);
    }

    const out: MissionStationScuLine[] = [];
    const splits = mission.deliverySplits ?? [];

    if (splits.length > 0) {
      const pickupKey = new Map<string, MissionStationScuLine>();
      const deliveryKey = new Map<string, MissionStationScuLine>();
      for (const split of splits) {
        const commoditySlug = commoditySlugOf(split.commodity);
        const fromKey = split.from.trim();
        const toKey = split.to.trim();
        if (fromKey) {
          const key = `${locationSlugOf(fromKey)}::${commoditySlug}`;
          const existing = pickupKey.get(key);
          if (existing) {
            existing.scu += Math.max(0, Math.floor(split.scu));
          } else {
            pickupKey.set(key, {
              role: "pickup",
              locationKey: fromKey,
              locationSlug: locationSlugOf(fromKey),
              locationLabel: locationLabelOf(fromKey),
              commodity: split.commodity,
              commoditySlug,
              scu: Math.max(0, Math.floor(split.scu)),
            });
          }
        }
        if (toKey) {
          const key = `${locationSlugOf(toKey)}::${commoditySlug}`;
          const existing = deliveryKey.get(key);
          if (existing) {
            existing.scu += Math.max(0, Math.floor(split.scu));
          } else {
            deliveryKey.set(key, {
              role: "delivery",
              locationKey: toKey,
              locationSlug: locationSlugOf(toKey),
              locationLabel: locationLabelOf(toKey),
              commodity: split.commodity,
              commoditySlug,
              scu: Math.max(0, Math.floor(split.scu)),
            });
          }
        }
      }
      out.push(...pickupKey.values(), ...deliveryKey.values());
    } else {
      for (const line of mission.cargo) {
        const scu = Math.max(0, Math.floor(Number(line.scu) || 0));
        if (scu <= 0) continue;
        const commoditySlug = commoditySlugOf(line.commodity);
        for (const from of mission.from) {
          out.push({
            role: "pickup",
            locationKey: from,
            locationSlug: locationSlugOf(from),
            locationLabel: locationLabelOf(from),
            commodity: line.commodity,
            commoditySlug,
            scu:
              mission.from.length === 1
                ? scu
                : Math.floor(scu / mission.from.length),
          });
        }
        for (const to of mission.to) {
          out.push({
            role: "delivery",
            locationKey: to,
            locationSlug: locationSlugOf(to),
            locationLabel: locationLabelOf(to),
            commodity: line.commodity,
            commoditySlug,
            scu:
              mission.to.length === 1
                ? scu
                : Math.floor(scu / mission.to.length),
          });
        }
      }
    }

    return out;
  },

  /**
   * Set one commodity’s mission-total SCU; scale station splits + route cargo.
   */
  setCommodityTotal(
    session: SessionChecklistModel,
    missionId: string,
    commoditySlug: string,
    scu: number,
  ): { ok: true; session: SessionChecklistModel } | { ok: false; error: string } {
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

    let deliverySplits = existing.deliverySplits;
    if (deliverySplits && deliverySplits.length > 0) {
      const matching = deliverySplits
        .map((split, index) => ({
          index,
          scu: Math.max(0, Math.floor(split.scu)),
          match: commoditySlugOf(split.commodity) === slug,
        }))
        .filter((entry) => entry.match);
      const scaled = scalePositiveParts(
        matching.map((entry) => entry.scu),
        amount,
      );
      deliverySplits = deliverySplits.map((split) => ({ ...split }));
      matching.forEach((entry, index) => {
        deliverySplits![entry.index] = {
          ...deliverySplits![entry.index]!,
          scu: scaled[index]!,
        };
      });
    } else if (existing.from.length >= 1 && existing.to.length >= 1) {
      const commodity =
        cargo.find((line) => commoditySlugOf(line.commodity) === slug)
          ?.commodity ?? commoditySlug;
      deliverySplits = [
        {
          from: existing.from[0]!,
          to: existing.to[0]!,
          commodity,
          scu: amount,
        },
      ];
    }

    let mission: SessionMission = {
      ...existing,
      cargo,
      deliverySplits,
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
   * Set SCU for one commodity at one collect/deliver station.
   * Mission commodity total becomes the sum of that role’s station amounts;
   * the opposite role is scaled to match.
   */
  setStationAmount(
    session: SessionChecklistModel,
    missionId: string,
    input: {
      role: "pickup" | "delivery";
      locationKey: string;
      commoditySlug: string;
      scu: number;
    },
  ): { ok: true; session: SessionChecklistModel } | { ok: false; error: string } {
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

    let deliverySplits = [...(existing.deliverySplits ?? [])];
    if (deliverySplits.length === 0) {
      const current =
        existing.cargo.find((line) => commoditySlugOf(line.commodity) === slug)
          ?.scu ?? amount;
      for (const from of existing.from.length ? existing.from : [input.locationKey]) {
        for (const to of existing.to.length ? existing.to : [input.locationKey]) {
          deliverySplits.push({
            from,
            to,
            commodity,
            scu: current,
          });
        }
      }
    }

    const field = input.role === "pickup" ? "from" : "to";
    let touched = false;
    deliverySplits = deliverySplits.map((split) => {
      if (commoditySlugOf(split.commodity) !== slug) return split;
      if (!locationMatches(split[field], input.locationKey)) return split;
      touched = true;
      return { ...split, scu: amount };
    });
    if (!touched) {
      if (input.role === "pickup") {
        deliverySplits.push({
          from: input.locationKey,
          to: existing.to[0] ?? deliverySplits[0]?.to ?? input.locationKey,
          commodity,
          scu: amount,
        });
      } else {
        deliverySplits.push({
          from: existing.from[0] ?? deliverySplits[0]?.from ?? input.locationKey,
          to: input.locationKey,
          commodity,
          scu: amount,
        });
      }
    }

    // Mission total from the edited role’s station sums.
    const stationLines = missionScuAmounts.stationLines(
      { ...existing, deliverySplits },
      null,
    );
    const roleTotal = stationLines
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

    // Keep deliverySplits delivering-side sums aligned when editing pickups:
    // scale opposite-field splits to roleTotal.
    if (input.role === "pickup") {
      const deliveryMatches = deliverySplits
        .map((split, index) => ({
          index,
          scu: Math.max(0, Math.floor(split.scu)),
          match: commoditySlugOf(split.commodity) === slug,
        }))
        .filter((entry) => entry.match);
      // Re-sum pickup-side: we already set matching froms; scale `to` rows by
      // redistributing the same splits’ amounts so deliver sum == roleTotal.
      const scaled = scalePositiveParts(
        deliveryMatches.map((entry) => entry.scu),
        roleTotal,
      );
      deliveryMatches.forEach((entry, index) => {
        // Preserve the edited from-station amount(s): only rescale splits that
        // do not match the edited location on from.
        const split = deliverySplits[entry.index]!;
        if (locationMatches(split.from, input.locationKey)) {
          deliverySplits[entry.index] = { ...split, scu: amount };
        } else {
          deliverySplits[entry.index] = { ...split, scu: scaled[index]! };
        }
      });
      // Fix remainder so sum of this commodity’s splits == roleTotal.
      const commoditySplits = deliverySplits
        .map((split, index) => ({ split, index }))
        .filter(
          ({ split }) => commoditySlugOf(split.commodity) === slug,
        );
      const sumNow = commoditySplits.reduce(
        (acc, { split }) => acc + Math.max(0, Math.floor(split.scu)),
        0,
      );
      let delta = roleTotal - sumNow;
      if (delta !== 0 && commoditySplits.length > 0) {
        const adjustable =
          commoditySplits.find(
            ({ split }) => !locationMatches(split.from, input.locationKey),
          ) ?? commoditySplits[0]!;
        deliverySplits[adjustable.index] = {
          ...deliverySplits[adjustable.index]!,
          scu: Math.max(
            0,
            Math.floor(deliverySplits[adjustable.index]!.scu) + delta,
          ),
        };
      }
    } else {
      // delivery edit: cargo already from delivery sums
      void cargoFromDeliverySplitSums;
    }

    const cargoFinal =
      input.role === "delivery"
        ? cargoFromDeliverySplitSums(existing, deliverySplits)
        : cargo;

    let mission: SessionMission = {
      ...existing,
      cargo: cargoFinal,
      deliverySplits,
      cargoSummary: cargoSummaryFor({ ...existing, cargo: cargoFinal }),
      scuTotalCertainty: "known",
    };
    const commodityTotal =
      mission.cargo.find((line) => commoditySlugOf(line.commodity) === slug)
        ?.scu ?? roleTotal;
    mission = refreshBoxSplitsForScu(mission, slug, commodityTotal);

    let rows = setRouteStationCommodityScu(
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
    // Re-pin edited station after opposite scale (no-op for opposite role).
    rows = setRouteStationCommodityScu(
      rows,
      missionId,
      input.role,
      input.locationKey,
      slug,
      amount,
    );
    // Scale other same-role stations so role sum == commodityTotal.
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
