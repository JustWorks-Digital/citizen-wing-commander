import { createHash } from "node:crypto";
import {
  normalizeMissionRank,
  stripRankFromTitle,
  type MissionRank,
} from "@/lib/missions/missionRank";
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
  /** Largest allowed crate size in SCU (from contract text). */
  scuMaxContainerSize?: number | null;
  /** Crate-size counts for the contract total (1/2/4/8 SCU). */
  scuBoxSplits: ScuBoxSplits;
  /** Logical screenshot path under `.data/mcp-screenshots`. */
  latestScreenshotPath?: string | null;
  /** Free-form extras from intake / OCR. */
  extras?: Record<string, unknown>;
};

export type CatalogMissionNoteSentiment = "good" | "bad" | "neutral";

export function emptyScuBoxSplits(): ScuBoxSplits {
  return { scuOne: 0, scuTwo: 0, scuFour: 0, scuEight: 0 };
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
  } | null | undefined,
): ScuBoxSplits {
  if (!raw) return emptyScuBoxSplits();
  return {
    scuOne: Number(raw.scuOne ?? raw.size1 ?? 0) || 0,
    scuTwo: Number(raw.scuTwo ?? raw.size2 ?? 0) || 0,
    scuFour: Number(raw.scuFour ?? raw.size4 ?? 0) || 0,
    scuEight: Number(raw.scuEight ?? raw.size8 ?? 0) || 0,
  };
}

/** @deprecated Prefer `normalizeScuBoxSplits` */
export const normalizeCargoBoxBreakdown = normalizeScuBoxSplits;

/**
 * Greedy 8→4→2→1 counts. When `scuMaxContainerSize` is set, never emit a box
 * larger than that size (validated against allowed crate sizes).
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
    if (size === 1) counts.scuOne += 1;
    else if (size === 2) counts.scuTwo += 1;
    else if (size === 4) counts.scuFour += 1;
    else if (size === 8) counts.scuEight += 1;
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

/** Stable dedupe key for upserting the same observed contract. */
export function catalogMissionFingerprint(
  input: Pick<
    HaulingCatalogMissionPayload,
    | "title"
    | "rank"
    | "contractorSlug"
    | "offerLocationSlug"
    | "fromLocationSlugs"
    | "toLocationSlugs"
    | "cargo"
  >,
): string {
  const stripped = stripRankFromTitle(input.title);
  const rank = normalizeMissionRank(input.rank) ?? stripped.rank ?? "";
  const titleKey = stripped.title.trim().toLowerCase();
  const cargoKey = [...input.cargo]
    .map((line) => `${line.commoditySlug}:${line.scu}`)
    .sort()
    .join(",");
  const raw = [
    titleKey,
    String(rank).toLowerCase(),
    (input.contractorSlug ?? "").trim().toLowerCase(),
    (input.offerLocationSlug ?? "").trim().toLowerCase(),
    [...input.fromLocationSlugs].map((s) => s.toLowerCase()).sort().join("|"),
    [...input.toLocationSlugs].map((s) => s.toLowerCase()).sort().join("|"),
    cargoKey,
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
  return {
    kind: "hauling",
    version: 1,
    title: fromTitle.title,
    rank,
    contractorSlug: partial.contractorSlug ?? null,
    rewards: normalizeCatalogRewards(partial.rewards, partial.rewardAuec),
    offerLocationSlug: partial.offerLocationSlug ?? null,
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
