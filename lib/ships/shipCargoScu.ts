/**
 * Selectable / session cargo SCU overrides when UEX hull numbers omit modules.
 *
 * RSI Galaxy: UEX `scu` is hangar-only (64). With the cargo module (656) the
 * hauling config is 64 + 656 = 720 (wiki / RSI brochure).
 */
export const SHIP_CARGO_SCU_OVERRIDES: Readonly<Record<string, number>> = {
  galaxy: 720,
};

export function resolveShipCargoScu(slug: string, uexScu: number): number {
  return SHIP_CARGO_SCU_OVERRIDES[slug] ?? uexScu;
}
