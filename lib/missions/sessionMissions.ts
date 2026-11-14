import {
  formatAuecAmount,
  type ScuBoxSplits,
} from "@/lib/missions/catalogMission";
import type { ScuCargoBoxSplits } from "@/lib/missions/cargoBoxSplits";
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
  rewardAuec: number;
  rewardDisplay?: string;
  from: string[];
  to: string[];
  cargo: HaulingIntakeCargoLine[];
  pickupSplits?: Record<string, HaulingIntakeCargoLine[]>;
  /**
   * Per-leg collect→deliver splits (from catalog / OCR extras).
   * When present, drives Collect / Deliver objective lines in the modal.
   */
  deliverySplits?: Array<{
    from: string;
    to: string;
    commodity: string;
    scu: number;
  }>;
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
   * Aggregate crate mix (sum of `scuCargoBoxSplits`). Kept for catalog column,
   * compact icons, and legacy single-mix callers.
   */
  scuBoxSplits?: ScuBoxSplits;
  /**
   * Aggregate auto mix (sum of `scuCargoBoxSplitsAutoSelected`).
   */
  scuBoxSplitsAutoSelected?: ScuBoxSplits;
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
  const base = {
    id,
    title,
    rank,
    contractor: contract.contractor ?? "Unknown contractor",
    rewardAuec: contract.rewardAuec ?? 0,
    rewardDisplay:
      contract.rewardAuec != null
        ? formatAuecAmount(contract.rewardAuec)
        : undefined,
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
    return normalizeSessionMissionRankFields({
      ...base,
      mobiglas: {
        ...mobiglas,
        title: stripRankFromTitle(mobiglas.title).title || title,
      },
    });
  }
  return base;
}

export function intakeContractFromSessionMission(
  mission: SessionMission,
): HaulingIntakeContract {
  const normalized = normalizeSessionMissionRankFields(mission);
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
