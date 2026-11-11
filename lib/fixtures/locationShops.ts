import locationShopsFixture from "@/lib/fixtures/locationShops.json";
import type {
  FixtureLocationShop,
  FixtureLocationShops,
} from "@/lib/fixtures/types";

type LocationShopsFile = {
  source: string;
  sourceLabel: string;
  fetchedAt: string;
  matchedTerminals?: number;
  locationCount?: number;
  items: FixtureLocationShops[];
};

const file = locationShopsFixture as LocationShopsFile;

const shopsByLocationSlug = new Map(
  file.items.map((row) => [row.locationSlug, row.shops] as const),
);

const allShopsBySlug = new Map<string, FixtureLocationShop>();
for (const row of file.items) {
  for (const shop of row.shops) {
    if (!allShopsBySlug.has(shop.slug)) {
      allShopsBySlug.set(shop.slug, shop);
    }
  }
}

export function listLocationShops(
  locationSlug: string,
): FixtureLocationShop[] {
  return shopsByLocationSlug.get(locationSlug.trim()) ?? [];
}

export function getLocationShopBySlug(
  shopSlug: string,
): FixtureLocationShop | undefined {
  return allShopsBySlug.get(shopSlug.trim());
}

/** Resolve a shop slug or fuzzy name against shops at a location (or globally). */
export function resolveLocationShopSlug(
  query: string,
  locationSlug?: string | null,
): string | null {
  const raw = query.trim();
  if (!raw) return null;
  const needle = raw.toLowerCase();

  const pool =
    locationSlug && locationSlug.trim()
      ? listLocationShops(locationSlug)
      : [...allShopsBySlug.values()];

  const exactSlug = pool.find((shop) => shop.slug === needle);
  if (exactSlug) return exactSlug.slug;

  const exactName = pool.find(
    (shop) => shop.name.toLowerCase() === needle,
  );
  if (exactName) return exactName.slug;

  const partial = pool.filter(
    (shop) =>
      shop.name.toLowerCase().includes(needle) ||
      shop.slug.includes(needle.replace(/[^a-z0-9]+/g, "-")),
  );
  if (partial.length === 1) return partial[0]!.slug;
  return null;
}

export function searchLocationShops(
  locationSlug: string,
  query: string,
  limit = 20,
): FixtureLocationShop[] {
  const shops = listLocationShops(locationSlug);
  const q = query.trim().toLowerCase();
  if (!q) return shops.slice(0, limit);
  return shops
    .filter(
      (shop) =>
        shop.name.toLowerCase().includes(q) || shop.slug.includes(q),
    )
    .slice(0, limit);
}
