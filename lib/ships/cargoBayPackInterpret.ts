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

export type InterpretCargoBayPackProgramOptions = {
  /**
   * When false, pack only this stop’s pickup/delivery crates (no stay cargo).
   * Used when packing transfers-only (no stay cargo).
   */
  includeAboardCargo?: boolean;
};

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
  options?: InterpretCargoBayPackProgramOptions,
): CargoGridPlacementPlan {
  expandPackProgram(program);
  const strategy = derivePackStrategy(program);
  const packSlotPolicy = derivePackSlotPolicy(program);
  const includeAboardCargo = options?.includeAboardCargo;

  switch (strategy.kind) {
    case "suggested":
      // Route-authored chronological placement (no cluster reordering).
      return packSuggestedAtStop(stopId, sketch, stops, null, {
        includeAboardCargo,
      });
    case "by-cargo-type":
      return packByCargoTypeAtStop(stopId, sketch, stops, {
        missionPrioritized: strategy.missionPrioritized,
        packProgram: program,
        packSlotPolicy,
        includeAboardCargo,
      });
    case "by-mission-location":
      return packDeliveriesFromStop(stopId, sketch, stops, {
        priorityLocationCount: strategy.priorityLocationCount,
        packProgram: program,
        packSlotPolicy,
        includeAboardCargo,
      });
    default: {
      const _exhaustive: never = strategy.kind;
      return _exhaustive;
    }
  }
}
