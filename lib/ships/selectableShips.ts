/**
 * Session UI ship dropdown allowlist (expand later).
 * Slugs must match UEX / `ships` table / fixtures.
 */
export const SELECTABLE_SHIP_SLUGS = [
  "c2-hercules-starlifter",
  "constellation-mk-v-centaurus",
] as const;

export type SelectableShipSlug = (typeof SELECTABLE_SHIP_SLUGS)[number];

export function isSelectableShipSlug(slug: string): slug is SelectableShipSlug {
  return (SELECTABLE_SHIP_SLUGS as readonly string[]).includes(slug);
}
