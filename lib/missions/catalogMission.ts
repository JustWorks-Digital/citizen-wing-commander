import { createHash } from "node:crypto";
import {
  normalizeHaulingCategory,
  type HaulingCategory,
} from "@/lib/missions/haulingCategory";
import {
  normalizeMissionRank,
  stripRankFromTitle,
  type MissionRank,
} from "@/lib/missions/missionRank";
import { normalizeStarSystemSlug } from "@/lib/missions/starSystem";
import {
  CARGO_BOX_SCU,
  type CargoBoxScu,
  decomposeScuIntoBoxes,
} from "@/lib/ships/cargoBoxSizes";

/** Counts of each crate size used for a mission’s cargo total. */
export type ScuBoxSplits = {
  scuOne: number;
  scuTwo: number;
  scuFour: number;
  scuEight: number;
  scuSixteen: number;
  scuThirtyTwo: number;
};

/** @deprecated Prefer `ScuBoxSplits` */
export type CargoBoxBreakdown = ScuBoxSplits;

export type CatalogMissionCargoLine = {
  commoditySlug: string;
  commodityName: string;
  scu: number;
};

/**
 * Structured per-stop cargo amount (how much of which commodity goes where).
 * Sibling of `scuTotal` on the hauling catalog payload.
 */
export type CatalogMissionScuSplit = {
  kind: "deliver" | "collect";
  fromLocationSlug: string;
  toLocationSlug: string;
  commoditySlug: string;
  commodityName: string;
  scu: number;
};

/**
 * Total SCU keyed by location slug for pickups (`from`) and deliveries (`to`).
 * Sibling of `scuSplits` — usually derived by summing split lines.
 */
export type ScuLocationSplits = {
  from: Record<string, number>;
  to: Record<string, number>;
};

/** aUEC payout (hauling today). */
export type CatalogMissionRewardAuec = {
  kind: "auec";
  amount: number;
};

/**
 * Blueprint / item unlock reward (other mission types; rare on hauling).
 * `slug` optional until we have a blueprint fixture catalog.
 */
export type CatalogMissionRewardBlueprint = {
  kind: "blueprint";
  name: string;
  slug?: string | null;
};

export type CatalogMissionReward =
  | CatalogMissionRewardAuec
  | CatalogMissionRewardBlueprint;

/**
 * Durable catalog body for an observed hauling contract.
 * Stored in `catalog_missions.payload`.
 */
export type HaulingCatalogMissionPayload = {
  kind: "hauling";
  version: 1;
  title: string;
  /** Slug from `contractors` / `lib/fixtures/contractors.json`. */
  contractorSlug?: string | null;
  /** Payout lines — aUEC now; blueprint (and later kinds) for other missions. */
  rewards: CatalogMissionReward[];
  /** Where the offer was seen / screenshot taken (availability context). */
  offerLocationSlug?: string | null;
  /**
   * Star system where the offer was seen (fixture slug: stanton / pyro / nyx).
   * No default — set explicitly; existing catalog rows backfilled to stanton.
   */
  offerStarSystemSlug?: string | null;
  fromLocationSlugs: string[];
  toLocationSlugs: string[];
  cargo: CatalogMissionCargoLine[];
  /** Total cargo SCU for the contract (sum of cargo / splits). */
  scuTotal: number;
  /**
   * Per-stop commodity + SCU amounts (same level as `scuTotal`).
   * Source of truth for multi-stop quantities.
   */
  scuSplits?: CatalogMissionScuSplit[];
  /**
   * SCU totals per location: `{ from: { slug: scu }, to: { slug: scu } }`.
   * Also denormalized on `catalog_missions.scu_location_splits`.
   */
  scuLocationSplits?: ScuLocationSplits;
  /**
   * Screenshot-style Primary Objectives bullets (human text).
   * Prefer OCR/transcript wording; can be derived from `scuSplits`.
   */
  objectives?: string[];
  /**
   * Hauling career rank on the contract (Trainee…Master).
   * Extracted from titles like "Junior Rank - …"; value has no “Rank” suffix.
   */
  rank?: MissionRank | null;
  /**
   * MobiGlas Category line: Hauling - Local | Planetary | Stellar | Interstellar.
   */
  category?: HaulingCategory | null;
  /** Largest allowed crate size in SCU (from contract text). */
  scuMaxContainerSize?: number | null;
  /** Crate-size counts for the contract total (1/2/4/8/16/32 SCU). */
  scuBoxSplits: ScuBoxSplits;
  /** Logical screenshot path under `.data/mcp-screenshots`. */
  latestScreenshotPath?: string | null;
  /** Free-form extras from intake / OCR. */
  extras?: Record<string, unknown>;
};

export type CatalogMissionNoteSentiment = "good" | "bad" | "neutral";

export function emptyScuBoxSplits(): ScuBoxSplits {
  return {
    scuOne: 0,
    scuTwo: 0,
    scuFour: 0,
    scuEight: 0,
    scuSixteen: 0,
    scuThirtyTwo: 0,
  };
}

/** @deprecated Prefer `emptyScuBoxSplits` */
export const emptyBoxBreakdown = emptyScuBoxSplits;

/** Accept current keys or legacy `size1`/`size2`/`size4`/`size8`. */
export function normalizeScuBoxSplits(
  raw: Partial<ScuBoxSplits> & {
    size1?: number;
    size2?: number;
    size4?: number;
    size8?: number;
    size16?: number;
    size32?: number;
  } | null | undefined,
): ScuBoxSplits {
  if (!raw) return emptyScuBoxSplits();
  return {
    scuOne: Number(raw.scuOne ?? raw.size1 ?? 0) || 0,
    scuTwo: Number(raw.scuTwo ?? raw.size2 ?? 0) || 0,
    scuFour: Number(raw.scuFour ?? raw.size4 ?? 0) || 0,
    scuEight: Number(raw.scuEight ?? raw.size8 ?? 0) || 0,
    scuSixteen: Number(raw.scuSixteen ?? raw.size16 ?? 0) || 0,
    scuThirtyTwo: Number(raw.scuThirtyTwo ?? raw.size32 ?? 0) || 0,
  };
}

/** @deprecated Prefer `normalizeScuBoxSplits` */
export const normalizeCargoBoxBreakdown = normalizeScuBoxSplits;

export function incrementScuBoxSplit(
  counts: ScuBoxSplits,
  size: CargoBoxScu,
  by = 1,
): void {
  if (size === 1) counts.scuOne += by;
  else if (size === 2) counts.scuTwo += by;
  else if (size === 4) counts.scuFour += by;
  else if (size === 8) counts.scuEight += by;
  else if (size === 16) counts.scuSixteen += by;
  else if (size === 32) counts.scuThirtyTwo += by;
}

/**
 * Greedy largest-first counts (default cap 8). When `scuMaxContainerSize` is
 * set, never emit a box larger than that size (validated against allowed crates).
 */
export function scuBoxSplitsForScu(
  scu: number,
  scuMaxContainerSize?: number | null,
): ScuBoxSplits {
  const maxAllowed =
    typeof scuMaxContainerSize === "number" && scuMaxContainerSize > 0
      ? Math.max(
          ...CARGO_BOX_SCU.filter((size) => size <= scuMaxContainerSize),
          1,
        )
      : null;

  const boxes =
    maxAllowed == null
      ? decomposeScuIntoBoxes(scu)
      : decomposeScuIntoBoxesCapped(scu, maxAllowed as CargoBoxScu);

  const counts = emptyScuBoxSplits();
  for (const size of boxes) {
    incrementScuBoxSplit(counts, size);
  }
  return counts;
}

/** @deprecated Prefer `scuBoxSplitsForScu` */
export const boxBreakdownForScu = scuBoxSplitsForScu;

function decomposeScuIntoBoxesCapped(
  scu: number,
  maxSize: CargoBoxScu,
): CargoBoxScu[] {
  const boxes: CargoBoxScu[] = [];
  let remaining = Math.max(0, Math.floor(scu));
  for (const size of CARGO_BOX_SCU) {
    if (size > maxSize) continue;
    while (remaining >= size) {
      boxes.push(size);
      remaining -= size;
    }
  }
  return boxes;
}

export function sumCatalogCargoScu(cargo: CatalogMissionCargoLine[]): number {
  return cargo.reduce((sum, line) => sum + Math.max(0, line.scu), 0);
}

export function rewardsFromAuec(amount?: number | null): CatalogMissionReward[] {
  if (amount == null || amount <= 0) return [];
  return [{ kind: "auec", amount }];
}

/** Exact aUEC for UI — never abbreviate to “Nk”. */
export function formatAuecAmount(amount: number): string {
  return `${Math.floor(amount).toLocaleString("en-US")} aUEC`;
}

/** Sum of aUEC reward lines (0 when none). */
export function auecFromRewards(
  rewards: CatalogMissionReward[] | null | undefined,
): number {
  if (!rewards?.length) return 0;
  return rewards.reduce((sum, reward) => {
    if (reward.kind !== "auec") return sum;
    return sum + Math.max(0, reward.amount);
  }, 0);
}

export function normalizeCatalogRewards(
  rewards?: CatalogMissionReward[] | null,
  /** @deprecated Prefer `rewards` */
  rewardAuec?: number | null,
): CatalogMissionReward[] {
  if (rewards && rewards.length > 0) return rewards;
  return rewardsFromAuec(rewardAuec);
}

/** Aggregate commodity totals from SCU splits. */
export function cargoFromScuSplits(
  scuSplits: CatalogMissionScuSplit[],
): CatalogMissionCargoLine[] {
  const bySlug = new Map<string, CatalogMissionCargoLine>();
  for (const split of scuSplits) {
    const existing = bySlug.get(split.commoditySlug);
    if (existing) {
      existing.scu += Math.max(0, split.scu);
      continue;
    }
    bySlug.set(split.commoditySlug, {
      commoditySlug: split.commoditySlug,
      commodityName: split.commodityName,
      scu: Math.max(0, split.scu),
    });
  }
  return [...bySlug.values()];
}

export function locationsFromScuSplits(
  scuSplits: CatalogMissionScuSplit[],
): { fromLocationSlugs: string[]; toLocationSlugs: string[] } {
  const fromLocationSlugs: string[] = [];
  const toLocationSlugs: string[] = [];
  for (const split of scuSplits) {
    if (!fromLocationSlugs.includes(split.fromLocationSlug)) {
      fromLocationSlugs.push(split.fromLocationSlug);
    }
    if (!toLocationSlugs.includes(split.toLocationSlug)) {
      toLocationSlugs.push(split.toLocationSlug);
    }
  }
  return { fromLocationSlugs, toLocationSlugs };
}

function addScuToLocationMap(
  map: Record<string, number>,
  slug: string,
  scu: number,
): void {
  const amount = Math.max(0, Math.floor(scu));
  if (!slug || amount <= 0) return;
  map[slug] = (map[slug] ?? 0) + amount;
}

/** Sum SCU per from/to location from structured split lines. */
export function scuLocationSplitsFromScuSplits(
  scuSplits: CatalogMissionScuSplit[],
): ScuLocationSplits {
  const from: Record<string, number> = {};
  const to: Record<string, number> = {};
  for (const split of scuSplits) {
    addScuToLocationMap(from, split.fromLocationSlug, split.scu);
    addScuToLocationMap(to, split.toLocationSlug, split.scu);
  }
  return { from, to };
}

/**
 * Prefer explicit maps; else derive from `scuSplits`; else single from+to + total.
 * Returns undefined when multi-stop amounts cannot be inferred.
 */
export function resolveScuLocationSplits(input: {
  scuLocationSplits?: ScuLocationSplits | null;
  scuSplits?: CatalogMissionScuSplit[] | null;
  fromLocationSlugs?: string[];
  toLocationSlugs?: string[];
  scuTotal?: number;
}): ScuLocationSplits | undefined {
  if (input.scuLocationSplits) {
    return {
      from: { ...input.scuLocationSplits.from },
      to: { ...input.scuLocationSplits.to },
    };
  }
  if (input.scuSplits && input.scuSplits.length > 0) {
    return scuLocationSplitsFromScuSplits(input.scuSplits);
  }
  const fromSlugs = input.fromLocationSlugs ?? [];
  const toSlugs = input.toLocationSlugs ?? [];
  const scuTotal = Math.max(0, Math.floor(input.scuTotal ?? 0));
  if (fromSlugs.length === 1 && toSlugs.length === 1 && scuTotal > 0) {
    return {
      from: { [fromSlugs[0]!]: scuTotal },
      to: { [toSlugs[0]!]: scuTotal },
    };
  }
  return undefined;
}

/**
 * Build screenshot-style objective bullets from structured splits.
 * `locationLabel` should return a display name for a slug.
 */
export function objectivesFromScuSplits(
  scuSplits: CatalogMissionScuSplit[],
  locationLabel: (slug: string) => string,
): string[] {
  return scuSplits.map((split) => {
    const from = locationLabel(split.fromLocationSlug);
    const to = locationLabel(split.toLocationSlug);
    if (split.kind === "collect") {
      return `Collect ${split.scu} SCU of ${split.commodityName} from ${from}`;
    }
    return `Deliver ${split.scu} SCU of ${split.commodityName} to ${to}`;
  });
}

type CatalogMissionIdentityInput = Pick<
  HaulingCatalogMissionPayload,
  | "title"
  | "rank"
  | "contractorSlug"
  | "offerLocationSlug"
  | "fromLocationSlugs"
  | "toLocationSlugs"
  | "cargo"
>;

function catalogMissionRouteIdentityParts(input: CatalogMissionIdentityInput): {
  titleKey: string;
  rankKey: string;
  contractorKey: string;
  offerKey: string;
  fromKey: string;
  toKey: string;
} {
  const stripped = stripRankFromTitle(input.title);
  const rank = normalizeMissionRank(input.rank) ?? stripped.rank ?? "";
  return {
    titleKey: stripped.title.trim().toLowerCase(),
    rankKey: String(rank).toLowerCase(),
    contractorKey: (input.contractorSlug ?? "").trim().toLowerCase(),
    offerKey: (input.offerLocationSlug ?? "").trim().toLowerCase(),
    fromKey: [...input.fromLocationSlugs]
      .map((s) => s.toLowerCase())
      .sort()
      .join("|"),
    toKey: [...input.toLocationSlugs]
      .map((s) => s.toLowerCase())
      .sort()
      .join("|"),
  };
}

/**
 * Stable dedupe key for the same observed contract *including* SCU amounts.
 * Reward aUEC is intentionally omitted — payout-only diffs update the same row.
 */
export function catalogMissionFingerprint(
  input: CatalogMissionIdentityInput,
): string {
  const parts = catalogMissionRouteIdentityParts(input);
  const cargoKey = [...input.cargo]
    .map((line) => `${line.commoditySlug}:${line.scu}`)
    .sort()
    .join(",");
  const raw = [
    parts.titleKey,
    parts.rankKey,
    parts.contractorKey,
    parts.offerKey,
    parts.fromKey,
    parts.toKey,
    cargoKey,
  ].join("::");
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Family key for SCU variants of the same contract (commodities + route, no SCU).
 * Rows that share this key share a `variantGroupId` but keep separate fingerprints.
 */
export function catalogMissionVariantFamilyKey(
  input: CatalogMissionIdentityInput,
): string {
  const parts = catalogMissionRouteIdentityParts(input);
  const commodityKey = [
    ...new Set(input.cargo.map((line) => line.commoditySlug.toLowerCase())),
  ]
    .sort()
    .join(",");
  const raw = [
    parts.titleKey,
    parts.rankKey,
    parts.contractorKey,
    parts.offerKey,
    parts.fromKey,
    parts.toKey,
    commodityKey,
  ].join("::");
  return createHash("sha256").update(raw).digest("hex");
}

export function buildHaulingCatalogMissionPayload(
  partial: Omit<
    HaulingCatalogMissionPayload,
    "kind" | "version" | "scuTotal" | "scuBoxSplits" | "rewards"
  > & {
    rewards?: CatalogMissionReward[] | null;
    scuTotal?: number;
    /** @deprecated Prefer scuTotal */
    totalScu?: number;
    /** @deprecated Prefer scuMaxContainerSize */
    maxContainerScu?: number | null;
    /** @deprecated Prefer rewards: [{ kind: "auec", amount }] */
    rewardAuec?: number | null;
    scuBoxSplits?: ScuBoxSplits;
    /** @deprecated Prefer scuBoxSplits */
    boxBreakdown?: ScuBoxSplits;
  },
): HaulingCatalogMissionPayload {
  const scuTotal =
    partial.scuTotal ??
    partial.totalScu ??
    sumCatalogCargoScu(partial.cargo);
  const scuMaxContainerSize =
    partial.scuMaxContainerSize ?? partial.maxContainerScu ?? null;
  const rawSplits = partial.scuBoxSplits ?? partial.boxBreakdown;
  const scuLocationSplits = resolveScuLocationSplits({
    scuLocationSplits: partial.scuLocationSplits,
    scuSplits: partial.scuSplits,
    fromLocationSlugs: partial.fromLocationSlugs,
    toLocationSlugs: partial.toLocationSlugs,
    scuTotal,
  });
  const fromTitle = stripRankFromTitle(partial.title);
  const rank = normalizeMissionRank(partial.rank) ?? fromTitle.rank ?? null;
  const offerStarSystemSlug =
    normalizeStarSystemSlug(partial.offerStarSystemSlug) ??
    (partial.offerStarSystemSlug?.trim() || null);
  return {
    kind: "hauling",
    version: 1,
    title: fromTitle.title,
    rank,
    category: normalizeHaulingCategory(partial.category),
    contractorSlug: partial.contractorSlug ?? null,
    rewards: normalizeCatalogRewards(partial.rewards, partial.rewardAuec),
    offerLocationSlug: partial.offerLocationSlug ?? null,
    offerStarSystemSlug,
    fromLocationSlugs: partial.fromLocationSlugs,
    toLocationSlugs: partial.toLocationSlugs,
    cargo: partial.cargo,
    scuTotal,
    scuSplits: partial.scuSplits,
    scuLocationSplits,
    objectives: partial.objectives,
    scuMaxContainerSize,
    scuBoxSplits: rawSplits
      ? normalizeScuBoxSplits(rawSplits)
      : scuBoxSplitsForScu(scuTotal, scuMaxContainerSize),
    latestScreenshotPath: partial.latestScreenshotPath ?? null,
    extras: partial.extras,
  };
}
