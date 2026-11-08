import type { HaulingChecklistRow } from "@/lib/missions/mockSession";

/**
 * Estimate SCU currently aboard from completed legs only
 * (pickups add, deliveries subtract), in route order.
 */
export function estimateOnboardScu(rows: HaulingChecklistRow[]): number {
  let onboard = 0;
  for (const row of rows) {
    if (!row.isCompleted) break;
    const fallback =
      row.legKind === "both" ? null : row.legKind;
    for (const cargo of row.cargoDeliveries) {
      const role = cargo.role ?? fallback;
      if (role === "pickup") onboard += cargo.scu;
      else if (role === "delivery") onboard -= cargo.scu;
    }
  }
  return Math.max(0, onboard);
}
