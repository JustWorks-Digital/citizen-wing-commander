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
