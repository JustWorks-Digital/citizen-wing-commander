/**
 * Hauling career reputation ranks (Covalex / org hauling track).
 * Source: Star Citizen Wiki — Hauling progression table.
 * Stored as the level name only (no “Rank” suffix).
 */
export const MISSION_RANKS = [
  "Trainee",
  "Rookie",
  "Junior",
  "Member",
  "Experienced",
  "Senior",
  "Master",
] as const;

export type MissionRank = (typeof MISSION_RANKS)[number];

const MISSION_RANK_SET = new Set<string>(MISSION_RANKS);

const MISSION_RANK_BY_NORM = new Map(
  MISSION_RANKS.map((rank) => [rank.toLowerCase(), rank] as const),
);

/** Ordered low → high for sorting. */
export const MISSION_RANK_ORDER: Record<MissionRank, number> = {
  Trainee: 1,
  Rookie: 2,
  Junior: 3,
  Member: 4,
  Experienced: 5,
  Senior: 6,
  Master: 7,
};

export function isMissionRank(value: unknown): value is MissionRank {
  return typeof value === "string" && MISSION_RANK_SET.has(value);
}

export function normalizeMissionRank(
  value: string | null | undefined,
): MissionRank | null {
  if (!value?.trim()) return null;
  return MISSION_RANK_BY_NORM.get(value.trim().toLowerCase()) ?? null;
}

const RANK_PREFIX =
  /^(Trainee|Rookie|Junior|Member|Experienced|Senior|Master)\s+Rank\s*[-–—:|]?\s*/i;

const EMBEDDED_RANK =
  /\b(Trainee|Rookie|Junior|Member|Experienced|Senior|Master)\b/i;

/** Read rank from a contract title ("Junior Rank - …", "Ling Family Rookie …"). */
export function parseRankFromTitle(title: string): MissionRank | null {
  const trimmed = title.trim();
  if (!trimmed) return null;
  const prefix = RANK_PREFIX.exec(trimmed);
  if (prefix?.[1]) return normalizeMissionRank(prefix[1]);
  const embedded = EMBEDDED_RANK.exec(trimmed);
  if (embedded?.[1]) return normalizeMissionRank(embedded[1]);
  return null;
}

/**
 * Canonical catalog title casing: Title Case words, collapsed whitespace.
 * Turns "SMALL CARGO HAUL" / "direct medium cargo haul" into the same form.
 */
export function normalizeCatalogMissionTitle(title: string): string {
  const trimmed = title.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  return trimmed
    .toLowerCase()
    .replace(
      /(^|[\s\-–—|/])(\p{L})/gu,
      (_, boundary: string, letter: string) =>
        `${boundary}${letter.toUpperCase()}`,
    );
}

/** Prefer stored `rank`, else parse from title (legacy session JSON). */
export function resolveMissionRank(mission: {
  title?: string | null;
  rank?: MissionRank | string | null;
}): MissionRank | null {
  return (
    normalizeMissionRank(mission.rank) ??
    (mission.title ? parseRankFromTitle(mission.title) : null)
  );
}

/**
 * Display title without the "X Rank" prefix.
 * Uses stored rank only for resolution elsewhere — always strips the title.
 */
export function resolveMissionTitle(mission: {
  title?: string | null;
}): string {
  if (!mission.title?.trim()) return "";
  return stripRankFromTitle(mission.title).title;
}

/**
 * Pull rank out of a title and return a cleaned title without "X Rank".
 * For "Ling Family Rookie Cargo Haul", removes only the rank token.
 * Returned title is Title Case via `normalizeCatalogMissionTitle`.
 */
export function stripRankFromTitle(title: string): {
  title: string;
  rank: MissionRank | null;
} {
  const trimmed = title.trim();
  if (!trimmed) return { title: "", rank: null };

  const prefix = RANK_PREFIX.exec(trimmed);
  if (prefix) {
    const rank = normalizeMissionRank(prefix[1]!);
    const rest = trimmed.slice(prefix[0].length).trim();
    return {
      title: normalizeCatalogMissionTitle(rest || trimmed),
      rank,
    };
  }

  const embedded = EMBEDDED_RANK.exec(trimmed);
  if (embedded?.[1] && embedded.index != null) {
    const rank = normalizeMissionRank(embedded[1]);
    const before = trimmed.slice(0, embedded.index).trim();
    const after = trimmed.slice(embedded.index + embedded[0].length).trim();
    const cleaned = [before, after]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ");
    return {
      title: normalizeCatalogMissionTitle(cleaned || trimmed),
      rank,
    };
  }

  return { title: normalizeCatalogMissionTitle(trimmed), rank: null };
}
