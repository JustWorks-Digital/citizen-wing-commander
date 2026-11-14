/**
 * Public URLs for ship badge icons under `public/icons/ships/`.
 * Add files as `{slug}.jpg` / `.png` / `.webp` and register them here.
 */
const SHIP_ICON_BY_SLUG: Record<string, string> = {
  "c2-hercules-starlifter": "c2-hercules-starlifter.png",
  "constellation-mk-v-centaurus": "constellation-mk-v-centaurus.png",
};

const PUBLIC_PATH = "/icons/ships";

/** Bump when replacing icon binaries so browsers don’t keep a stale badge. */
const SHIP_ICON_CACHE = "v12";

/** Public URL for a ship icon, or null when none is bundled. */
export function getShipIconSrc(
  shipSlug: string | null | undefined,
): string | null {
  if (!shipSlug?.trim()) return null;
  const file = SHIP_ICON_BY_SLUG[shipSlug.trim()];
  if (!file) return null;
  return `${PUBLIC_PATH}/${file}?${SHIP_ICON_CACHE}`;
}
