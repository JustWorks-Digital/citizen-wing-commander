/** MobiGlas hauling contract categories (Category: Hauling - …). */
export const HAULING_CATEGORIES = [
  "Hauling - Local",
  "Hauling - Planetary",
  "Hauling - Stellar",
  "Hauling - Interstellar",
] as const;

export type HaulingCategory = (typeof HAULING_CATEGORIES)[number];

const SHORT_TO_FULL: Record<string, HaulingCategory> = {
  local: "Hauling - Local",
  planetary: "Hauling - Planetary",
  stellar: "Hauling - Stellar",
  interstellar: "Hauling - Interstellar",
};

/** Normalize OCR / UI / short labels to the canonical MobiGlas category string. */
export function normalizeHaulingCategory(
  raw: string | null | undefined,
): HaulingCategory | null {
  if (!raw?.trim()) return null;
  const trimmed = raw.trim().replace(/\s+/g, " ");
  const lower = trimmed.toLowerCase();
  for (const value of HAULING_CATEGORIES) {
    if (value.toLowerCase() === lower) return value;
  }
  const withoutPrefix = lower.replace(/^hauling\s*[-:]\s*/, "").trim();
  return SHORT_TO_FULL[withoutPrefix] ?? null;
}

/** Short label for UI chips: Planetary, Stellar, … */
export function haulingCategoryShortLabel(
  raw: string | null | undefined,
): string | null {
  const normalized = normalizeHaulingCategory(raw);
  if (normalized) return normalized.replace(/^Hauling\s*-\s*/i, "");
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  return trimmed.replace(/^Hauling\s*[-:]\s*/i, "").trim() || trimmed;
}
