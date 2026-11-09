import {
  auecFromRewards,
  type CatalogMissionCargoLine,
  type CatalogMissionReward,
  type CatalogMissionScuSplit,
  type HaulingCatalogMissionPayload,
} from "@/lib/missions/catalogMission";

export type CatalogScreenshotNameInput = {
  title: string;
  scuTotal: number;
  cargo: CatalogMissionCargoLine[];
  fromLocationSlugs: string[];
  toLocationSlugs: string[];
  scuSplits?: CatalogMissionScuSplit[];
  rewardAuec?: number | null;
  /** When set, preferred over rewardAuec for the aUEC filename token. */
  rewards?: CatalogMissionReward[];
  /** Short uniqueness suffix (first 8 of mission UUID recommended). */
  missionId?: string | null;
  /** Including dot, e.g. `.png`. Defaults to `.png`. */
  extension?: string;
};

const MAX_FILENAME_LEN = 180;

/** Filename-safe slug (lowercase, hyphenated). */
export function toScreenshotSlug(value: string, max = 64): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max);
}

function shortLocation(slug: string): string {
  return toScreenshotSlug(slug, 28);
}

function shortCommodity(slug: string): string {
  return toScreenshotSlug(slug, 24);
}

function rewardToken(
  rewardAuec?: number | null,
  rewards?: Array<{ kind: string; amount?: number }>,
): string | null {
  const fromRewards = (rewards ?? [])
    .filter((r) => r.kind === "auec")
    .reduce((sum, r) => sum + Math.max(0, r.amount ?? 0), 0);
  const amount = fromRewards > 0 ? fromRewards : (rewardAuec ?? 0);
  if (amount <= 0) return null;
  // Exact aUEC — avoids 131500 → "132k" rounding ambiguity in filenames.
  return `${Math.floor(amount)}auec`;
}

/**
 * Compact cargo / split segment for filenames.
 * Prefers scuSplits when present (includes destinations).
 */
export function catalogScreenshotCargoToken(
  input: Pick<CatalogScreenshotNameInput, "cargo" | "scuSplits">,
): string {
  if (input.scuSplits && input.scuSplits.length > 0) {
    return input.scuSplits
      .map(
        (split) =>
          `${shortCommodity(split.commoditySlug)}-${split.scu}-${shortLocation(split.toLocationSlug)}`,
      )
      .join("+");
  }
  return (input.cargo ?? [])
    .map((line) => `${shortCommodity(line.commoditySlug)}-${line.scu}`)
    .join("+");
}

export function catalogScreenshotRouteToken(
  input: Pick<
    CatalogScreenshotNameInput,
    "fromLocationSlugs" | "toLocationSlugs"
  >,
): string {
  const from = (input.fromLocationSlugs ?? []).map(shortLocation).join("+");
  const to = (input.toLocationSlugs ?? []).map(shortLocation).join("+");
  if (!from && !to) return "route-unknown";
  if (!from) return `to-${to}`;
  if (!to) return `from-${from}`;
  return `${from}_to_${to}`;
}

/**
 * Build a descriptive screenshot filename from catalog contract fields.
 *
 * Example:
 * `member-rank-small-cargo-haul_20scu_pressurized-ice-7-orinth+…_lorville_to_orinth+hadley_131kauec_9234afbe.png`
 *
 * Safe for `.data/mcp-screenshots` storage; includes enough cargo/route/reward
 * detail for AI to identify the contract without opening the image.
 */
export function buildCatalogScreenshotFilename(
  input: CatalogScreenshotNameInput,
): string {
  const extRaw = input.extension?.trim() || ".png";
  const ext = extRaw.startsWith(".")
    ? extRaw.toLowerCase()
    : `.${extRaw.toLowerCase()}`;

  // Identity tokens first so truncation clips cargo detail, not uniqueness.
  const head = [
    toScreenshotSlug(input.title, 40) || "hauling-contract",
    `${Math.max(0, Math.floor(input.scuTotal))}scu`,
    rewardToken(input.rewardAuec, input.rewards),
    input.missionId?.trim()
      ? toScreenshotSlug(input.missionId.replace(/-/g, "").slice(0, 8), 8)
      : null,
    catalogScreenshotRouteToken(input),
  ].filter(Boolean) as string[];

  const cargo = catalogScreenshotCargoToken(input) || "cargo-unknown";
  const maxBase = MAX_FILENAME_LEN - ext.length;
  const headJoined = head.join("_");
  const sep = "_";
  const cargoBudget = maxBase - headJoined.length - sep.length;
  const cargoPart =
    cargoBudget >= 8
      ? cargo.slice(0, cargoBudget).replace(/[:+_-]+$/g, "")
      : "";

  const base = cargoPart ? `${headJoined}${sep}${cargoPart}` : headJoined;
  return `${base}${ext}`;
}

/** Convenience: filename from a hauling catalog payload (+ optional mission id / ext). */
export function buildCatalogScreenshotFilenameFromPayload(
  payload: HaulingCatalogMissionPayload,
  options?: { missionId?: string | null; extension?: string },
): string {
  return buildCatalogScreenshotFilename({
    title: payload.title,
    scuTotal: payload.scuTotal,
    cargo: payload.cargo,
    fromLocationSlugs: payload.fromLocationSlugs,
    toLocationSlugs: payload.toLocationSlugs,
    scuSplits: payload.scuSplits,
    rewards: payload.rewards,
    rewardAuec: auecFromRewards(payload.rewards),
    missionId: options?.missionId,
    extension: options?.extension,
  });
}
