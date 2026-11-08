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
};

export function namedCommodityColorToHex(
  color: string | null | undefined,
): string | null {
  if (!color) return null;
  return NAMED_COLOR_HEX[color.trim().toLowerCase()] ?? null;
}
