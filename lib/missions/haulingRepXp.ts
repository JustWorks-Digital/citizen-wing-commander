import {
  normalizeMissionRank,
  parseRankFromTitle,
  type MissionRank,
} from "@/lib/missions/missionRank";
import type { SessionMission } from "@/lib/missions/sessionMissions";

/**
 * Typical Covalex hauling-contract reputation (XP) for standard
 * “{Rank} Rank - … Cargo Haul” jobs. Community-sourced approximator —
 * recover/special contracts can differ.
 *
 * Pattern from Alpha 4.x: Rookie 50, then ~2× each step from Junior
 * (500 → 1k → 2k → 4k → 8k). Trainee intro hauls often award 500.
 */
export const HAULING_CONTRACT_REP_XP_BY_RANK: Record<MissionRank, number> = {
  Trainee: 500,
  Rookie: 50,
  Junior: 500,
  Member: 1_000,
  Experienced: 2_000,
  Senior: 4_000,
  Master: 8_000,
};

export type HaulingRepXpMission = Pick<SessionMission, "title"> & {
  /** Prefer stored catalog/session rank when the title omits “X Rank”. */
  rank?: MissionRank | string | null;
};

/** Approximate hauling XP from stored rank, else title rank. */
export function estimateMissionHaulingRepXp(
  mission: HaulingRepXpMission,
): number | null {
  const rank =
    normalizeMissionRank(mission.rank) ?? parseRankFromTitle(mission.title);
  if (!rank) return null;
  return HAULING_CONTRACT_REP_XP_BY_RANK[rank];
}

/** Compact EXP for table cells — `500`, `1k`, `11k`. */
export function formatHaulingRepXp(amount: number): string {
  const n = Math.floor(Math.max(0, amount));
  if (n < 1000) return String(n);
  if (n % 1000 === 0) return `${n / 1000}k`;
  const tenths = Math.round(n / 100) / 10;
  return `${String(tenths).replace(/\.0$/, "")}k`;
}

/**
 * Sum of approximate hauling XP for missions expected to complete
 * (unknown-rank contracts contribute 0).
 */
export function estimateMissionsHaulingRepXp(
  missions: HaulingRepXpMission[],
): number {
  return missions.reduce((sum, mission) => {
    const xp = estimateMissionHaulingRepXp(mission);
    return sum + (xp ?? 0);
  }, 0);
}
