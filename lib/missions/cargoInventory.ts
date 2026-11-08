import type { HaulingChecklistRow } from "@/lib/missions/mockSession";
import type { SessionMission } from "@/lib/missions/sessionMissions";

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

/**
 * Total SCU still owed by visible, incomplete missions.
 * Falls back to route pickup totals when the mission list is empty.
 */
export function estimateMissionCargoScu(
  missions: SessionMission[] | undefined,
  rows: HaulingChecklistRow[],
): number {
  const active = (missions ?? []).filter(
    (mission) => !mission.isHidden && !mission.isCompleted,
  );
  if (active.length > 0) {
    return active.reduce(
      (sum, mission) =>
        sum + mission.cargo.reduce((lineSum, line) => lineSum + line.scu, 0),
      0,
    );
  }

  let pickupTotal = 0;
  for (const row of rows) {
    const fallback = row.legKind === "both" ? null : row.legKind;
    for (const cargo of row.cargoDeliveries) {
      const role = cargo.role ?? fallback;
      if (role === "pickup") pickupTotal += cargo.scu;
    }
  }
  return pickupTotal;
}
