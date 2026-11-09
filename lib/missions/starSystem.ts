import { getStarSystemBySlug, listStarSystems } from "@/lib/fixtures";

export { getStarSystemBySlug, listStarSystems };

const BY_NORM = new Map(
  listStarSystems().flatMap((row) => {
    const keys = [
      row.slug,
      row.name.toLowerCase(),
      row.code.toLowerCase(),
      `${row.name} system`.toLowerCase(),
    ];
    return keys.map((key) => [key, row.slug] as const);
  }),
);

/** Resolve name / code / slug ("Stanton", "ST", "Stanton System") → fixture slug. */
export function normalizeStarSystemSlug(
  value: string | null | undefined,
): string | null {
  if (!value?.trim()) return null;
  const raw = value.trim().toLowerCase().replace(/\s+/g, " ");
  return BY_NORM.get(raw) ?? BY_NORM.get(raw.replace(/\s+system$/, "")) ?? null;
}

export function starSystemDisplayName(
  slugOrName: string | null | undefined,
): string {
  if (!slugOrName?.trim()) return "—";
  const slug = normalizeStarSystemSlug(slugOrName) ?? slugOrName.trim();
  return getStarSystemBySlug(slug)?.name ?? slug;
}
