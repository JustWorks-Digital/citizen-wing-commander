/**
 * How sure we are about an SCU measure (total or crate mix) from OCR / AI
 * vs an in-game hangar / freight-elevator confirmation.
 *
 * - `known` — clearly readable in a screenshot or confirmed in the hangar UI
 * - `estimated` — AI greedy / inferred (e.g. from max container size)
 * - `unknown` — not visible / not asserted
 */
export const scuCertaintyValues = ["known", "estimated", "unknown"] as const;

export type ScuCertainty = (typeof scuCertaintyValues)[number];

export function isScuCertainty(value: unknown): value is ScuCertainty {
  return (
    typeof value === "string" &&
    (scuCertaintyValues as readonly string[]).includes(value)
  );
}

/** Normalize loose MCP / JSON input; invalid → null. */
export function normalizeScuCertainty(
  value: unknown,
): ScuCertainty | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return isScuCertainty(trimmed) ? trimmed : null;
}

/**
 * Crate-mix UI warning: anything other than confirmed `known`
 * (`estimated`, `unknown`, or unset).
 */
export function isScuBoxSplitsUncertain(
  certainty: ScuCertainty | null | undefined,
): boolean {
  return certainty !== "known";
}

/** Per-commodity crate-mix certainty (slug → known | estimated | unknown | null). */
export type ScuCargoBoxSplitsCertainty = Record<string, ScuCertainty | null>;

export type ScuBoxSplitsCertaintySource = {
  scuBoxSplitsCertainty?: ScuCertainty | null;
  scuCargoBoxSplitsCertainty?: ScuCargoBoxSplitsCertainty | null;
};

/**
 * Resolve crate-mix certainty for one commodity.
 * Prefers `scuCargoBoxSplitsCertainty[slug]`; falls back to mission-level.
 */
export function resolveScuBoxSplitsCertainty(
  source: ScuBoxSplitsCertaintySource,
  commoditySlug?: string | null,
): ScuCertainty | null {
  const slug = commoditySlug?.trim() || null;
  if (slug) {
    const map = source.scuCargoBoxSplitsCertainty;
    if (map && Object.prototype.hasOwnProperty.call(map, slug)) {
      return normalizeScuCertainty(map[slug]);
    }
  }
  return source.scuBoxSplitsCertainty ?? null;
}

/**
 * Roll mission-level certainty from per-commodity values.
 * All `known` → known; any `estimated` → estimated; else unknown/null.
 */
export function rollupScuBoxSplitsCertainty(
  map: ScuCargoBoxSplitsCertainty | null | undefined,
  commoditySlugs: readonly string[],
): ScuCertainty | null {
  if (commoditySlugs.length === 0) return null;
  const values = commoditySlugs.map((slug) =>
    map && Object.prototype.hasOwnProperty.call(map, slug)
      ? normalizeScuCertainty(map[slug])
      : null,
  );
  if (values.every((value) => value === "known")) return "known";
  if (values.some((value) => value === "estimated")) return "estimated";
  if (values.some((value) => value === "unknown")) return "unknown";
  if (values.every((value) => value == null)) return null;
  return "unknown";
}

/**
 * Breakdown under-stack label dots (independent — both can show).
 * - `uncertain` — AI / unset certainty (warn)
 * - `overridden` — selected mix differs from auto (accent)
 */
export type ScuBoxSplitsIndicators = {
  uncertain: boolean;
  overridden: boolean;
};
