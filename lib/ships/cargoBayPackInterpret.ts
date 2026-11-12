import type { HaulingChecklistRow } from "@/lib/missions/mockSession";
import {
  derivePackStrategy,
  expandPackProgram,
  type CargoBayPackProgram,
} from "@/lib/ships/cargoBayPackProgram";
import {
  packByCargoTypeAtStop,
  packDeliveriesFromStop,
  packSuggestedAtStop,
  type CargoGridPlacementPlan,
} from "@/lib/ships/cargoGridPlacement";
import { derivePackSlotPolicy } from "@/lib/ships/packSlotPolicy";
import type { ShipCargoGridSketch } from "@/lib/ships/cargoGrids";

/**
 * Interpret a pack program against stop cargo + ship sketch.
 *
 * Expands / prioritizes primitive calls, derives item-construction strategy,
 * then places with pack-program slot policy + group/order item sequencing.
 * `stopId` is first (entity the call is about).
 */
export function interpretCargoBayPackProgram(
  stopId: string,
  sketch: ShipCargoGridSketch,
  stops: HaulingChecklistRow[],
  program: CargoBayPackProgram,
): CargoGridPlacementPlan {
  expandPackProgram(program);
  const strategy = derivePackStrategy(program);
  const packSlotPolicy = derivePackSlotPolicy(program);

  switch (strategy.kind) {
    case "suggested":
      // Route-authored chronological placement (no cluster reordering).
      return packSuggestedAtStop(stopId, sketch, stops, null);
    case "by-cargo-type":
      return packByCargoTypeAtStop(stopId, sketch, stops, {
        missionPrioritized: strategy.missionPrioritized,
        packProgram: program,
        packSlotPolicy,
      });
    case "by-mission-location":
      return packDeliveriesFromStop(stopId, sketch, stops, {
        priorityLocationCount: strategy.priorityLocationCount,
        packProgram: program,
        packSlotPolicy,
      });
    default: {
      const _exhaustive: never = strategy.kind;
      return _exhaustive;
    }
  }
}
