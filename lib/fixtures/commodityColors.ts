import commoditiesFixture from "@/lib/fixtures/commodities.json";
import commodityCrateColorsFixture from "@/lib/fixtures/commodityCrateColors.json";

/** Named crate colors (UEX-style) → UI hex on dark backgrounds. */
const NAMED_COLOR_HEX: Record<string, string> = {
  red: "#e25555",
  blue: "#54adf7",
  sky: "#87ceeb",
  navy: "#1f4e8c",
  green: "#3dbf8f",
  yellow: "#e0a63a",
  orange: "#e07a3a",
  purple: "#9b7bde",
  pink: "#e07ab0",
  brown: "#a67c52",
  black: "#7d8a97",
  white: "#f3f6f9",
  gray: "#a9b3bd",
  grey: "#a9b3bd",
  tan: "#c4a574",
  rust: "#c4724a",
};

/** Golden angle — consecutive palette slots stay far apart on the hue wheel. */
const GOLDEN_ANGLE_DEG = 137.508;

/** Coprime step into the palette so alphabetical neighbors diverge hard. */
const PALETTE_STEP = 11;

/** Enough slots that common hauling sets rarely share a color. */
const PALETTE_SIZE = 96;

/**
 * Explicit display colors for commodities that must stay easy to tell apart
 * (or match a requested light/dark pairing).
 */
const SLUG_COLOR_OVERRIDES: Record<string, string> = {
  corundum: "#8ec8f8", // light blue
  quartz: "#1f4e8c", // dark blue
  aluminum: "#6e7680", // gray, lighter than titanium
  "aluminum-ore": "#5a626c",
  titanium: "#4a5058", // cool dark gray
  "titanium-ore": "#383e46",
  tin: "#8b949e", // neutral mid gray (between cool Al and warm Ti)
  "tin-ore": "#6f7882",
  // Warm graphite — distinct from cool titanium / mid aluminum grays.
  iron: "#5a5652",
  "iron-ore": "#3f3c39",
  waste: "#9a7a62", // rust brown mixed with gray
  tungsten: "#9a6a6a", // grayer red
  "tungsten-ore": "#7e5555",
  carbon: "#7a9280", // gray-green
  silicon: "#2f6b48", // deeper green
  "silicone-raw": "#25563a",
  stims: "#f3f6f9", // white
  // Sky blue (#87CEEB) + dark blue (#1F4E8C).
  "pressurized-ice": "#538ebc",
};

type CrateColorRow = {
  slug: string;
  colorHex: string;
  colorHex2?: string | null;
  image?: string | null;
  sourceUrl?: string;
  colorSource?: string;
};

const crateColorBySlug = new Map<string, CrateColorRow>(
  (commodityCrateColorsFixture.items as CrateColorRow[]).map((row) => [
    row.slug,
    row,
  ]),
);

const slugIndexBySlug = (() => {
  const slugs = [
    ...new Set(
      (commoditiesFixture.items as Array<{ slug: string }>).map((row) =>
        row.slug.trim().toLowerCase(),
      ),
    ),
  ].sort((a, b) => a.localeCompare(b));
  return new Map(slugs.map((slug, index) => [slug, index] as const));
})();

function parseHex(hex: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match?.[1]) return null;
  const value = match[1];
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function toHex(r: number, g: number, b: number): string {
  const channel = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Stable 32-bit hash for unknown slugs not in the fixture index. */
function hashSlug(slug: string): number {
  let hash = 2166136261;
  for (let i = 0; i < slug.length; i += 1) {
    hash ^= slug.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function hslToHex(h: number, s: number, l: number): string {
  const sat = clamp(s, 0, 100) / 100;
  const light = clamp(l, 0, 100) / 100;
  const hue = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = light - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hue < 60) [r, g, b] = [c, x, 0];
  else if (hue < 120) [r, g, b] = [x, c, 0];
  else if (hue < 180) [r, g, b] = [0, c, x];
  else if (hue < 240) [r, g, b] = [0, x, c];
  else if (hue < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return toHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

/** Precomputed high-chroma swatches, golden-angle spaced. */
const DISTINCT_PALETTE: string[] = Array.from({ length: PALETTE_SIZE }, (_, i) => {
  const hue = (i * GOLDEN_ANGLE_DEG) % 360;
  // Alternate sat/light bands so even near-hue slots still read apart.
  const sat = [72, 64, 78][i % 3]!;
  const light = [46, 56, 40][i % 3]!;
  return hslToHex(hue, sat, light);
});

/** Average two hex colors for dual-crate tints (e.g. Waste gray + rust). */
export function mixHexColors(a: string, b: string): string {
  const left = parseHex(a);
  const right = parseHex(b);
  if (!left || !right) return a;
  return toHex(
    (left[0] + right[0]) / 2,
    (left[1] + right[1]) / 2,
    (left[2] + right[2]) / 2,
  );
}

export function namedCommodityColorToHex(
  color: string | null | undefined,
): string | null {
  if (!color) return null;
  return NAMED_COLOR_HEX[color.trim().toLowerCase()] ?? null;
}

/** Sampled hex from Star Citizen Wiki cargo-crate / product images. */
export function getCommodityCrateColor(
  commoditySlug?: string | null,
): CrateColorRow | null {
  const slug = commoditySlug?.trim().toLowerCase();
  if (!slug) return null;
  return crateColorBySlug.get(slug) ?? null;
}

function baseNamedHex(
  color?: string | null,
  color2?: string | null,
): string | null {
  const primary = namedCommodityColorToHex(color);
  const secondary = namedCommodityColorToHex(color2);
  if (primary && secondary) return mixHexColors(primary, secondary);
  return primary ?? secondary;
}

/**
 * Stable high-contrast color for a commodity slug.
 * Alphabetical neighbors (aluminum / agricium) step far across the palette
 * so bay legends stay obviously different.
 */
function uniqueHexForSlug(slug: string): string {
  const key = slug.trim().toLowerCase();
  const override = SLUG_COLOR_OVERRIDES[key];
  if (override) return override;
  const index = slugIndexBySlug.get(key) ?? hashSlug(key) % 10_000;
  const slot = (index * PALETTE_STEP) % DISTINCT_PALETTE.length;
  return DISTINCT_PALETTE[slot]!;
}

/**
 * Single display hex for icons / cargo text / bay tinting.
 * Prefer a stable high-contrast per-slug color when a slug is available.
 * Without a slug, fall back to named / crate-image colors.
 */
export function resolveCommodityColorHex(
  color?: string | null,
  color2?: string | null,
  commoditySlug?: string | null,
): string | null {
  const slug = commoditySlug?.trim();
  if (slug) return uniqueHexForSlug(slug);
  const fromImage = getCommodityCrateColor(commoditySlug);
  return fromImage?.colorHex ?? baseNamedHex(color, color2);
}

function relativeLuminance(r: number, g: number, b: number): number {
  const toLinear = (channel: number) => {
    const s = channel / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
  );
}

/**
 * Muted chip fill matching Badge (`bg-*-muted`): commodity hue into bg-deep.
 */
export function commodityBadgeBackground(hex: string): string {
  return `color-mix(in srgb, ${hex} 28%, var(--rsi-bg-deep))`;
}

/**
 * Chip rim matching Badge border at 40% opacity.
 * Dark hues lift so the edge still reads on the muted fill.
 */
export function commodityBadgeBorder(hex: string): string {
  const rgb = parseHex(hex);
  if (rgb && relativeLuminance(rgb[0], rgb[1], rgb[2]) < 0.28) {
    return `color-mix(in srgb, color-mix(in srgb, ${hex} 55%, white) 45%, transparent)`;
  }
  return `color-mix(in srgb, ${hex} 40%, transparent)`;
}

/**
 * Icon/label color on muted badge chips. Dark commodity hues (quartz,
 * carbon, titanium, …) lift into white so they contrast like Badge text.
 */
export function commodityBadgeForeground(hex: string): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  if (relativeLuminance(rgb[0], rgb[1], rgb[2]) < 0.28) {
    return `color-mix(in srgb, ${hex} 52%, white)`;
  }
  return hex;
}


