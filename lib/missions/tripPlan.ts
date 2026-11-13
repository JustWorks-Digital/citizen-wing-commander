import type { HaulingChecklistRow } from "@/lib/missions/mockSession";
import {
  shipCargo,
  type ShipCargo,
  type ShipCargoLine,
} from "@/lib/missions/shipCargo";
import {
  distanceBetweenLocationSlugs,
  distanceToNextToKm,
} from "@/lib/starmap/distance";

export type TripStopPlan = {
  stopId: string;
  locationSlug: string;
  pickups: ShipCargoLine[];
  deliveries: ShipCargoLine[];
};

export type TripPlan = {
  startLocationSlug: string | null;
  stops: TripStopPlan[];
};

export type TripCargoIssue = {
  stopId: string;
  locationSlug: string;
  missing: ShipCargoLine;
  shortfallScu: number;
};

export type TripValidation = {
  ok: boolean;
  issues: TripCargoIssue[];
};

export type TripScore = {
  stopCount: number;
  distanceKm: number;
};

/** One pickup→delivery cargo movement used by the sequence search. */
export type TripContractLeg = {
  /** Unique leg id within the candidate search. */
  id: string;
  /** Session mission id when known (stamped onto cargo lines). */
  missionId: string | null;
  fromLocationSlug: string;
  toLocationSlug: string;
  commoditySlug: string;
  scu: number;
};

function cargoRole(
  row: HaulingChecklistRow,
  role: "pickup" | "delivery" | undefined,
): "pickup" | "delivery" | null {
  if (role === "pickup" || role === "delivery") return role;
  if (row.routeAction === "pickup") return "pickup";
  if (row.routeAction === "delivery") return "delivery";
  return null;
}

/** Build a trip plan from checklist rows (quantum rows skipped). */
export function tripPlanFromChecklistRows(
  rows: HaulingChecklistRow[],
  startLocationSlug: string | null = null,
): TripPlan {
  const stops: TripStopPlan[] = [];
  for (const row of rows) {
    if (row.routeAction === "quantum") continue;
    const pickups: ShipCargoLine[] = [];
    const deliveries: ShipCargoLine[] = [];
    for (const cargo of row.cargoDeliveries) {
      const role = cargoRole(row, cargo.role);
      if (role !== "pickup" && role !== "delivery") continue;
      const line: ShipCargoLine = {
        commoditySlug: cargo.commoditySlug,
        scu: cargo.scu,
        missionId: cargo.missionId ?? null,
      };
      if (role === "pickup") pickups.push(line);
      else deliveries.push(line);
    }
    if (pickups.length === 0 && deliveries.length === 0) continue;
    stops.push({
      stopId: row.id,
      locationSlug: row.locationSlug,
      pickups,
      deliveries,
    });
  }
  return { startLocationSlug, stops };
}

/**
 * Hard rule: walk the hold stop-by-stop (pickup then delivery).
 * Reports every delivery that exceeds what’s aboard.
 */
export function validateTripCargo(plan: TripPlan): TripValidation {
  let ship: ShipCargo = shipCargo.empty();
  const issues: TripCargoIssue[] = [];

  for (const stop of plan.stops) {
    ship = shipCargo.add(ship, stop.pickups);
    const unloaded = shipCargo.remove(ship, stop.deliveries);
    ship = unloaded.ship;
    for (const shortfall of unloaded.shortfalls) {
      issues.push({
        stopId: stop.stopId,
        locationSlug: stop.locationSlug,
        missing: shortfall.missing,
        shortfallScu: shortfall.shortfallScu,
      });
    }
  }

  return { ok: issues.length === 0, issues };
}

/** Validate checklist rows as a trip plan. */
export function validateChecklistTripCargo(
  rows: HaulingChecklistRow[],
  startLocationSlug: string | null = null,
): TripValidation {
  return validateTripCargo(tripPlanFromChecklistRows(rows, startLocationSlug));
}

/**
 * Structural legality: each contract has a pickupIndex before a deliveryIndex
 * in the visit sequence.
 */
export function isSequenceLegal(
  sequence: string[],
  contracts: TripContractLeg[],
): boolean {
  for (const contract of contracts) {
    const pickupIndex = sequence.indexOf(contract.fromLocationSlug);
    const deliveryIndex = sequence.findIndex(
      (slug, index) =>
        index > pickupIndex && slug === contract.toLocationSlug,
    );
    if (pickupIndex < 0 || deliveryIndex < 0) return false;
  }
  return true;
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items.slice()];
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += 1) {
    const head = items[index]!;
    const rest = items.filter((_, i) => i !== index);
    for (const tail of permutations(rest)) {
      out.push([head, ...tail]);
    }
  }
  return out;
}

function uniqSequences(sequences: string[][]): string[][] {
  const seen = new Set<string>();
  const out: string[][] = [];
  for (const sequence of sequences) {
    const key = sequence.join(">");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(sequence);
  }
  return out;
}

function requiredLocations(contracts: TripContractLeg[]): string[] {
  return [
    ...new Set(
      contracts.flatMap((contract) => [
        contract.fromLocationSlug,
        contract.toLocationSlug,
      ]),
    ),
  ];
}

/** Materialize cargo onto a legal visit sequence. */
export function sequenceToPlan(
  sequence: string[],
  contracts: TripContractLeg[],
  startLocationSlug: string | null,
): TripPlan {
  const stops: TripStopPlan[] = sequence.map((locationSlug, index) => ({
    stopId: `stop-${index + 1}`,
    locationSlug,
    pickups: [],
    deliveries: [],
  }));

  for (const contract of contracts) {
    const pickupIndex = stops.findIndex(
      (stop) => stop.locationSlug === contract.fromLocationSlug,
    );
    const deliveryIndex = stops.findIndex(
      (stop, index) =>
        index > pickupIndex && stop.locationSlug === contract.toLocationSlug,
    );
    if (pickupIndex < 0 || deliveryIndex < 0) {
      throw new Error(
        `sequenceToPlan called with illegal sequence for contract ${contract.id}`,
      );
    }
    const line: ShipCargoLine = {
      commoditySlug: contract.commoditySlug,
      scu: contract.scu,
      missionId: contract.missionId ?? contract.id,
    };
    const pickupStop = stops[pickupIndex];
    const deliveryStop = stops[deliveryIndex];
    if (!pickupStop || !deliveryStop) {
      throw new Error(`Missing stop for contract ${contract.id}`);
    }
    pickupStop.pickups.push(line);
    deliveryStop.deliveries.push(line);
  }

  return {
    startLocationSlug,
    stops: stops.filter(
      (stop) => stop.pickups.length + stop.deliveries.length > 0,
    ),
  };
}

/**
 * Append pickup then delivery for each contract (re-visit hubs as needed).
 * Always structurally legal; may use more stops than a searched optimum.
 */
export function buildLegalSequenceGreedy(
  contracts: TripContractLeg[],
): string[] {
  const sequence: string[] = [];
  for (const contract of contracts) {
    const pickupIndex = sequence.indexOf(contract.fromLocationSlug);
    if (pickupIndex < 0) {
      sequence.push(contract.fromLocationSlug);
    }
    const fromIndex = sequence.indexOf(contract.fromLocationSlug);
    const deliveryIndex = sequence.findIndex(
      (slug, index) =>
        index > fromIndex && slug === contract.toLocationSlug,
    );
    if (deliveryIndex < 0) {
      sequence.push(contract.toLocationSlug);
    }
  }
  return sequence;
}

/** Full search only for small place counts (n! grows fast). */
const PERMUTE_PLACE_LIMIT = 6;

/**
 * Enumerate visit sequences (single-pass permutations + hub re-visits when
 * small; otherwise one greedy legal sequence), keep only structurally legal
 * ones, then attach cargo.
 */
export function buildCandidatePlans(
  contracts: TripContractLeg[],
  startLocationSlug: string | null = null,
): TripPlan[] {
  if (contracts.length === 0) {
    return [{ startLocationSlug, stops: [] }];
  }

  const places = requiredLocations(contracts);
  let sequences: string[][];

  if (places.length <= PERMUTE_PLACE_LIMIT) {
    const singlePass = permutations(places);
    const hubs = places.filter(
      (slug) =>
        contracts.some((contract) => contract.fromLocationSlug === slug) &&
        contracts.some((contract) => contract.toLocationSlug === slug),
    );
    const splitPass: string[][] = [];
    for (const hub of hubs) {
      const others = places.filter((place) => place !== hub);
      for (const mid of permutations(others)) {
        splitPass.push([hub, ...mid, hub]);
      }
      for (const side of permutations(others)) {
        if (side.length === 1) {
          splitPass.push([side[0]!, hub, side[0]!]);
        }
      }
    }
    sequences = uniqSequences([...singlePass, ...splitPass]);
  } else {
    sequences = [buildLegalSequenceGreedy(contracts)];
  }

  return sequences
    .filter((sequence) => isSequenceLegal(sequence, contracts))
    .map((sequence) =>
      sequenceToPlan(sequence, contracts, startLocationSlug),
    );
}

export function scoreTrip(plan: TripPlan): TripScore {
  const chain: string[] = [];
  if (plan.startLocationSlug) chain.push(plan.startLocationSlug);
  for (const stop of plan.stops) {
    if (chain[chain.length - 1] === stop.locationSlug) continue;
    chain.push(stop.locationSlug);
  }

  let distanceKm = 0;
  for (let index = 0; index < chain.length - 1; index += 1) {
    const leg = distanceBetweenLocationSlugs(chain[index]!, chain[index + 1]!);
    if (leg) distanceKm += distanceToNextToKm(leg);
  }

  return {
    stopCount: plan.stops.length,
    distanceKm,
  };
}

function betterScore(a: TripScore, b: TripScore): boolean {
  if (a.stopCount !== b.stopCount) return a.stopCount < b.stopCount;
  return a.distanceKm < b.distanceKm;
}

export type OptimizeTripResult =
  | { ok: true; plan: TripPlan; score: TripScore }
  | { ok: false; issues: TripCargoIssue[] };

/**
 * Legal sequences → ship-cargo validate → fewest stops, then least distance.
 */
export function optimizeTrip(
  contracts: TripContractLeg[],
  startLocationSlug: string | null = null,
): OptimizeTripResult {
  const candidates = buildCandidatePlans(contracts, startLocationSlug);
  let best: { plan: TripPlan; score: TripScore } | null = null;

  for (const plan of candidates) {
    const check = validateTripCargo(plan);
    if (!check.ok) continue;
    const score = scoreTrip(plan);
    if (!best || betterScore(score, best.score)) {
      best = { plan, score };
    }
  }

  if (!best) {
    const sample = candidates[0];
    return {
      ok: false,
      issues: sample ? validateTripCargo(sample).issues : [],
    };
  }

  return { ok: true, plan: best.plan, score: best.score };
}

/**
 * Ship cargo after completing stops up to (but not including) the first
 * incomplete row — progress manifest for the live session.
 */
export function shipCargoFromCompletedRows(
  rows: HaulingChecklistRow[],
): ShipCargo {
  let ship = shipCargo.empty();
  for (const row of rows) {
    if (!row.isCompleted) break;
    if (row.routeAction === "quantum") continue;
    const pickups: ShipCargoLine[] = [];
    const deliveries: ShipCargoLine[] = [];
    for (const cargo of row.cargoDeliveries) {
      const role = cargoRole(row, cargo.role);
      if (role === "pickup") {
        pickups.push({
          commoditySlug: cargo.commoditySlug,
          scu: cargo.scu,
          missionId: cargo.missionId ?? null,
        });
      } else if (role === "delivery") {
        deliveries.push({
          commoditySlug: cargo.commoditySlug,
          scu: cargo.scu,
          missionId: cargo.missionId ?? null,
        });
      }
    }
    ship = shipCargo.add(ship, pickups);
    ship = shipCargo.remove(ship, deliveries).ship;
  }
  return ship;
}

type LocCommodityScu = {
  locationSlug: string;
  commoditySlug: string;
  scu: number;
};

/**
 * Derive 1:1 contract legs from checklist cargo (by mission + commodity).
 * Each delivery line pairs to the first earlier pickup of the same mission
 * and commodity (or any pickup of that commodity for the mission).
 */
export function contractLegsFromChecklistRows(
  rows: HaulingChecklistRow[],
): TripContractLeg[] {
  const pickupsByMission = new Map<string, LocCommodityScu[]>();
  const deliveriesByMission = new Map<string, LocCommodityScu[]>();

  for (const row of rows) {
    if (row.routeAction === "quantum") continue;
    for (const cargo of row.cargoDeliveries) {
      const role = cargoRole(row, cargo.role);
      if (role !== "pickup" && role !== "delivery") continue;
      const missionId = cargo.missionId?.trim() || "_";
      const entry: LocCommodityScu = {
        locationSlug: row.locationSlug,
        commoditySlug: cargo.commoditySlug,
        scu: cargo.scu,
      };
      const bag =
        role === "pickup" ? pickupsByMission : deliveriesByMission;
      const list = bag.get(missionId) ?? [];
      list.push(entry);
      bag.set(missionId, list);
    }
  }

  const legs: TripContractLeg[] = [];
  let legSerial = 0;
  for (const [missionId, deliveries] of deliveriesByMission) {
    const pickups = [...(pickupsByMission.get(missionId) ?? [])];
    for (const delivery of deliveries) {
      const pickupIndex = pickups.findIndex(
        (pickup) =>
          pickup.commoditySlug === delivery.commoditySlug &&
          pickup.scu > 0,
      );
      if (pickupIndex < 0) continue;
      const pickup = pickups[pickupIndex]!;
      const scu = Math.min(pickup.scu, delivery.scu);
      if (scu <= 0) continue;
      pickup.scu -= scu;
      legSerial += 1;
      legs.push({
        id: `${missionId}#${legSerial}`,
        missionId: missionId === "_" ? null : missionId,
        fromLocationSlug: pickup.locationSlug,
        toLocationSlug: delivery.locationSlug,
        commoditySlug: delivery.commoditySlug,
        scu,
      });
    }
  }
  return legs;
}

/** Checklist rows from an optimized trip plan (default bay front). */
export function checklistRowsFromTripPlan(
  plan: TripPlan,
): HaulingChecklistRow[] {
  const rows: HaulingChecklistRow[] = plan.stops.map((stop, index) => {
    const hasP = stop.pickups.length > 0;
    const hasD = stop.deliveries.length > 0;
    const routeAction =
      hasP && hasD ? "both" : hasP ? "pickup" : "delivery";
    // Pickup before delivery so transfer ledger / UI load first.
    const cargoDeliveries = [
      ...stop.pickups.map((line) => ({
        commoditySlug: line.commoditySlug,
        scu: line.scu,
        role: "pickup" as const,
        missionId: line.missionId ?? undefined,
        shipStorageLocation: "front" as const,
      })),
      ...stop.deliveries.map((line) => ({
        commoditySlug: line.commoditySlug,
        scu: line.scu,
        role: "delivery" as const,
        missionId: line.missionId ?? undefined,
        shipStorageLocation: "front" as const,
      })),
    ];

    return {
      id: stop.stopId || `leg-${index + 1}`,
      routeAction,
      locationSlug: stop.locationSlug,
      cargoDeliveries,
      shipStorageLocation: "front",
      distanceToNext: null,
      isCompleted: false,
    };
  });

  for (let index = 0; index < rows.length - 1; index += 1) {
    const from = rows[index]!;
    const to = rows[index + 1]!;
    from.distanceToNext = distanceBetweenLocationSlugs(
      from.locationSlug,
      to.locationSlug,
    );
  }
  return rows;
}
