/** Named crate colors (UEX-style) → UI hex on dark backgrounds. */
const NAMED_COLOR_HEX: Record<string, string> = {
  red: "#e25555",
  blue: "#54adf7",
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

/**
 * Single display hex for icons / cargo text.
 * Waste blends gray + rust; other commodities keep primary (then color2).
 */
export function resolveCommodityColorHex(
  color?: string | null,
  color2?: string | null,
  commoditySlug?: string | null,
): string | null {
  const primary = namedCommodityColorToHex(color);
  const secondary = namedCommodityColorToHex(color2);
  const shouldBlend =
    commoditySlug?.trim().toLowerCase() === "waste" && primary && secondary;
  if (shouldBlend) return mixHexColors(primary, secondary);
  return primary ?? secondary;
}
