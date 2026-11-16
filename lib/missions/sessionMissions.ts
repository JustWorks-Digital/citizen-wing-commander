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
import type { ScuCertainty } from "@/lib/missions/scuCertainty";
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
  /**
   * @deprecated Prefer `rewards` / `auecFromRewards(mission.rewards)`.
   * Sum of aUEC lines — kept for legacy session JSON + dense UI; synced on normalize.
   */
  rewardAuec: number;
  /**
   * @deprecated Prefer `formatRewardsLabel(mission.rewards)` / `missionRewardLabel`.
   * Display string synced from `rewards` on normalize.
   */
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
  /**
   * @deprecated Prefer catalog-aligned `scuMaxContainerSize` naming when
   * rewriting session JSON; still the live session field today.
   */
  maxContainerScu?: number;
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
    rewardAuec: contract.rewardAuec ?? 0,
    rewardDisplay:
      contract.rewardAuec != null
        ? formatAuecAmount(contract.rewardAuec)
        : undefined,
    timeRemaining: null,
    deadline: null,
    details: `Haul ${cargo} from ${from} to ${to}.${
      contract.maxContainerScu
        ? ` Containers at most ${contract.maxContainerScu} SCU.`
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
 * Prefer `rewards[]`; hydrate from `rewardAuec` when missing; keep aUEC
 * display fields aligned.
 */
export function normalizeSessionMissionRewards(
  mission: SessionMission,
): SessionMission {
  const rewards = normalizeCatalogRewards(mission.rewards, mission.rewardAuec);
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
  const rewardAuec = contract.rewardAuec ?? 0;
  const rewards = rewardsFromAuec(rewardAuec);
  const base: SessionMission = {
    id,
    title,
    rank,
    contractor: contract.contractor ?? "Unknown contractor",
    rewards,
    rewardAuec,
    rewardDisplay:
      rewardAuec > 0 ? formatAuecAmount(rewardAuec) : undefined,
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
    maxContainerScu: contract.maxContainerScu,
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
    rewardAuec: normalized.rewardAuec,
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
    maxContainerScu: normalized.maxContainerScu,
    screenshots: [...normalized.screenshots],
    transcript: normalized.transcript,
  };
}
