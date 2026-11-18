import {
  auecFromRewards,
  formatAuecAmount,
  formatRewardsLabel,
  normalizeCatalogRewards,
  rewardsFromAuec,
  type CatalogMissionReward,
  type ScuBoxSplits,
  type ScuSplit,
} from "@/lib/missions/catalogMission";
import type { ScuCargoBoxSplits } from "@/lib/missions/cargoBoxSplits";
import {
  normalizeScuCertainty,
  rollupScuBoxSplitsCertainty,
  type ScuCertainty,
} from "@/lib/missions/scuCertainty";
import type {
  HaulingIntakeCargoLine,
  HaulingIntakeContract,
} from "@/lib/missions/haulingIntake";
import type { MobiglasContractPanel } from "@/lib/missions/mobiglasTranscript";
import {
  normalizeMissionRank,
  resolveMissionRank,
  stripRankFromTitle,
  type MissionRank,
} from "@/lib/missions/missionRank";
import { normalizeSessionMissionScuSplits } from "@/lib/missions/missionScuSplits";
import { resolveCommoditySlug } from "@/lib/sessions/resolveRefs";

function commoditySlugFromIntake(nameOrSlug: string): string {
  return (
    resolveCommoditySlug(nameOrSlug) ?? nameOrSlug.trim().toLowerCase()
  );
}

/** Normalize intake certainty map keys to commodity slugs. */
function normalizeIntakeCargoCertaintyMap(
  map: Record<string, ScuCertainty | null> | null | undefined,
): Record<string, ScuCertainty | null> | undefined {
  if (map == null) return undefined;
  return Object.fromEntries(
    Object.entries(map).map(([key, value]) => [
      commoditySlugFromIntake(key),
      normalizeScuCertainty(value),
    ]),
  );
}

/** Mission card stored on the active checklist session for UI / MCP. */
export type SessionMission = {
  id: string;
  /**
   * Optional link to `catalog_missions.id` for durable mission details.
   * When set, the missions modal prefers catalog payload fields.
   */
  catalogMissionId?: string | null;
  title: string;
  /**
   * Hauling career rank (Trainee…Master), without the word “Rank”.
   * Prefer this over parsing `title` (legacy rows may still embed “X Rank - …”).
   */
  rank?: MissionRank | null;
  contractor: string;
  /**
   * Payout lines — same shape as catalog `rewards` (aUEC + blueprint).
   * Source of truth; `rewardAuec` / `rewardDisplay` stay in sync via normalize.
   */
  rewards?: CatalogMissionReward[];
  /** Sum of aUEC reward lines — derived from `rewards` on normalize. */
  rewardAuec: number;
  /** Display string synced from `rewards` on normalize. */
  rewardDisplay?: string;
  from: string[];
  to: string[];
  cargo: HaulingIntakeCargoLine[];
  pickupSplits?: Record<string, HaulingIntakeCargoLine[]>;
  /**
   * Per-leg SCU amounts (canonical; same shape as catalog `scuSplits`).
   * Drives Collect / Deliver objectives and Mission SCU edits.
   */
  scuSplits?: ScuSplit[];
  /** Max crate size from contract Details (1/2/4/8/16/32). */
  scuMaxContainerSize?: number;
  /**
   * Selected crate mix per commodity slug (source of truth for restamp).
   * Aggregate `scuBoxSplits` is the sum of these maps.
   */
  scuCargoBoxSplits?: ScuCargoBoxSplits;
  /**
   * Auto / greedy default mix per commodity (before user correction).
   */
  scuCargoBoxSplitsAutoSelected?: ScuCargoBoxSplits;
  /**
   * @deprecated Derived — use `cargoBoxSplits.selectedAggregate(mission)`.
   * Still accepted on load for legacy single-cargo hydrate into `scuCargoBoxSplits`.
   */
  scuBoxSplits?: ScuBoxSplits;
  /**
   * @deprecated Derived — use `cargoBoxSplits.autoSelectedAggregate(mission)`.
   */
  scuBoxSplitsAutoSelected?: ScuBoxSplits;
  /**
   * Certainty that mission cargo SCU totals match the real contract.
   * See `ScuCertainty` — omitted/null when never asserted.
   */
  scuTotalCertainty?: ScuCertainty | null;
  /**
   * Certainty that crate mix (`scuBoxSplits` / `scuCargoBoxSplits`) is real.
   * Prefer per-commodity `scuCargoBoxSplitsCertainty` when set; this is the rollup.
   */
  scuBoxSplitsCertainty?: ScuCertainty | null;
  /**
   * Crate-mix certainty per commodity slug (`known` | `estimated` | `unknown`).
   */
  scuCargoBoxSplitsCertainty?: Record<string, ScuCertainty | null>;
  /** Short cargo summary for tiles (e.g. "96 SCU Stims"). Optional on older session JSON. */
  cargoSummary?: string;
  isCompleted: boolean;
  /** When true, mission stays in the list but is excluded from the route table. */
  isHidden?: boolean;
  screenshots: string[];
  transcript?: string;
  mobiglas: MobiglasContractPanel;
};

function cargoSummary(contract: HaulingIntakeContract): string {
  return contract.cargo
    .map((line) => `${line.scu} SCU ${line.commodity}`)
    .join(" · ");
}

function synthesizeMobiglas(
  contract: HaulingIntakeContract,
): MobiglasContractPanel {
  const from = contract.from.join(", ");
  const to = contract.to.join(", ");
  const cargo = cargoSummary(contract);
  return {
    tab: "Accepted",
    category: "Hauling - Planetary",
    title: contract.title,
    contractor: contract.contractor ?? "Unknown contractor",
    rewardAuec: auecFromRewards(contract.rewards),
    rewardDisplay:
      contract.rewards && contract.rewards.length > 0
        ? formatRewardsLabel(contract.rewards)
        : undefined,
    timeRemaining: null,
    deadline: null,
    details: `Haul ${cargo} from ${from} to ${to}.${
      contract.scuMaxContainerSize
        ? ` Containers at most ${contract.scuMaxContainerSize} SCU.`
        : ""
    }`,
    objectives: [
      {
        label: `Deliver ${cargo} to ${to}`,
        progressCurrent: 0,
        progressTotal: contract.cargo.reduce((sum, line) => sum + line.scu, 0),
        children: contract.from.map((site) => `Collect from ${site}`),
      },
    ],
  };
}

/** Extract `rank` and strip “X Rank” from title (idempotent). */
export function normalizeSessionMissionRankFields(
  mission: SessionMission,
): SessionMission {
  const stripped = stripRankFromTitle(mission.title);
  const rank =
    normalizeMissionRank(mission.rank) ??
    stripped.rank ??
    resolveMissionRank(mission);
  const title = stripped.title || mission.title;
  const nextMobiglasTitle = mission.mobiglas?.title
    ? stripRankFromTitle(mission.mobiglas.title).title || title
    : title;
  if (
    rank === (mission.rank ?? null) &&
    title === mission.title &&
    nextMobiglasTitle === (mission.mobiglas?.title ?? title)
  ) {
    return mission;
  }
  return {
    ...mission,
    rank,
    title,
    mobiglas: mission.mobiglas
      ? { ...mission.mobiglas, title: nextMobiglasTitle }
      : mission.mobiglas,
  };
}

/**
 * Canonical `rewards[]`; load-migrate bare `rewardAuec` into rewards once;
 * keep derived aUEC / display fields aligned.
 */
export function normalizeSessionMissionRewards(
  mission: SessionMission,
): SessionMission {
  const rewards =
    mission.rewards && mission.rewards.length > 0
      ? mission.rewards
      : rewardsFromAuec(mission.rewardAuec);
  const rewardAuec = auecFromRewards(rewards);
  const rewardDisplay =
    rewards.length > 0
      ? formatRewardsLabel(rewards)
      : mission.rewardDisplay?.trim() ||
        (rewardAuec > 0 ? formatAuecAmount(rewardAuec) : undefined);
  const sameRewards =
    JSON.stringify(mission.rewards ?? []) === JSON.stringify(rewards);
  if (
    sameRewards &&
    rewardAuec === mission.rewardAuec &&
    rewardDisplay === mission.rewardDisplay
  ) {
    return mission;
  }
  return {
    ...mission,
    rewards,
    rewardAuec,
    rewardDisplay: rewardDisplay === "—" ? undefined : rewardDisplay,
  };
}

/** Rank + rewards + legacy `deliverySplits` → `scuSplits` (checklist load). */
export function normalizeSessionMission(
  mission: SessionMission,
): SessionMission {
  return normalizeSessionMissionScuSplits(
    normalizeSessionMissionRewards(
      normalizeSessionMissionRankFields(mission),
    ),
  );
}

export function sessionMissionFromIntakeContract(
  contract: HaulingIntakeContract,
  index: number,
  mobiglas?: MobiglasContractPanel,
): SessionMission {
  const id = contract.id?.trim() || `contract-${index + 1}`;
  const stripped = stripRankFromTitle(contract.title);
  const rank =
    normalizeMissionRank(contract.rank) ?? stripped.rank;
  const title = stripped.title || contract.title;
  const rewards = normalizeCatalogRewards(contract.rewards);
  const rewardAuec = auecFromRewards(rewards);
  const cargoSlugs = contract.cargo.map((line) =>
    commoditySlugFromIntake(line.commodity),
  );
  const scuCargoBoxSplitsCertainty = normalizeIntakeCargoCertaintyMap(
    contract.scuCargoBoxSplitsCertainty,
  );
  const scuBoxSplitsCertainty =
    contract.scuBoxSplitsCertainty !== undefined
      ? normalizeScuCertainty(contract.scuBoxSplitsCertainty)
      : scuCargoBoxSplitsCertainty
        ? rollupScuBoxSplitsCertainty(scuCargoBoxSplitsCertainty, cargoSlugs)
        : undefined;
  const scuTotalCertainty =
    contract.scuTotalCertainty !== undefined
      ? normalizeScuCertainty(contract.scuTotalCertainty)
      : undefined;
  const base: SessionMission = {
    id,
    title,
    rank,
    contractor: contract.contractor ?? "Unknown contractor",
    rewards,
    rewardAuec,
    rewardDisplay:
      rewards.length > 0 ? formatRewardsLabel(rewards) : undefined,
    from: [...contract.from],
    to: [...contract.to],
    cargo: contract.cargo.map((line) => ({ ...line })),
    pickupSplits: contract.pickupSplits
      ? Object.fromEntries(
          Object.entries(contract.pickupSplits).map(([key, lines]) => [
            key,
            lines.map((line) => ({ ...line })),
          ]),
        )
      : undefined,
    scuMaxContainerSize: contract.scuMaxContainerSize,
    ...(scuTotalCertainty !== undefined ? { scuTotalCertainty } : {}),
    ...(scuBoxSplitsCertainty !== undefined ? { scuBoxSplitsCertainty } : {}),
    ...(scuCargoBoxSplitsCertainty !== undefined
      ? { scuCargoBoxSplitsCertainty }
      : {}),
    cargoSummary: cargoSummary(contract),
    isCompleted: false,
    isHidden: false,
    screenshots: contract.screenshots ? [...contract.screenshots] : [],
    transcript: contract.transcript,
    mobiglas: mobiglas ?? synthesizeMobiglas({ ...contract, title }),
  };
  if (mobiglas) {
    return normalizeSessionMission({
      ...base,
      mobiglas: {
        ...mobiglas,
        title: stripRankFromTitle(mobiglas.title).title || title,
      },
    });
  }
  return normalizeSessionMission(base);
}

export function intakeContractFromSessionMission(
  mission: SessionMission,
): HaulingIntakeContract {
  const normalized = normalizeSessionMission(mission);
  return {
    id: normalized.id,
    title: normalized.title,
    rank: normalized.rank ?? undefined,
    contractor: normalized.contractor,
    rewards: normalized.rewards?.length
      ? [...normalized.rewards]
      : rewardsFromAuec(normalized.rewardAuec),
    from: [...normalized.from],
    to: [...normalized.to],
    cargo: normalized.cargo.map((line) => ({ ...line })),
    pickupSplits: normalized.pickupSplits
      ? Object.fromEntries(
          Object.entries(normalized.pickupSplits).map(([key, lines]) => [
            key,
            lines.map((line) => ({ ...line })),
          ]),
        )
      : undefined,
    scuMaxContainerSize: normalized.scuMaxContainerSize,
    scuTotalCertainty: normalized.scuTotalCertainty ?? undefined,
    scuBoxSplitsCertainty: normalized.scuBoxSplitsCertainty ?? undefined,
    scuCargoBoxSplitsCertainty: normalized.scuCargoBoxSplitsCertainty
      ? { ...normalized.scuCargoBoxSplitsCertainty }
      : undefined,
    screenshots: [...normalized.screenshots],
    transcript: normalized.transcript,
  };
}
