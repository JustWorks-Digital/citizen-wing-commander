import {
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

/** Approximate hauling XP for one session mission from its title rank. */
export function estimateMissionHaulingRepXp(
  mission: Pick<SessionMission, "title">,
): number | null {
  const rank = parseRankFromTitle(mission.title);
  if (!rank) return null;
  return HAULING_CONTRACT_REP_XP_BY_RANK[rank];
}

/**
 * Sum of approximate hauling XP for missions expected to complete
 * (unknown-rank contracts contribute 0).
 */
export function estimateMissionsHaulingRepXp(
  missions: Array<Pick<SessionMission, "title">>,
): number {
  return missions.reduce((sum, mission) => {
    const xp = estimateMissionHaulingRepXp(mission);
    return sum + (xp ?? 0);
  }, 0);
}
