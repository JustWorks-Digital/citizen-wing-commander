import type { HaulingChecklistRow } from "@/lib/missions/mockSession";
import {
  derivePackStrategy,
  expandPackProgram,
  type CargoBayPackProgram,
} from "@/lib/ships/cargoBayPackProgram";
import {
  planOccupancyByCargoTypeAtStop,
  planOccupancyByMissionLocationAtStop,
  planZoneOccupancyAtStop,
  type CargoGridPlacementPlan,
} from "@/lib/ships/cargoGridPlacement";
import { derivePackSlotPolicy } from "@/lib/ships/packSlotPolicy";
import type { ShipCargoGridSketch } from "@/lib/ships/cargoGrids";

/**
 * Interpret a pack program against stop cargo + ship sketch.
 *
 * Expands / prioritizes primitive calls, derives item-construction strategy,
 * then places with pack-program slot policy + group/order item sequencing.
 */
export function interpretCargoBayPackProgram(
  sketch: ShipCargoGridSketch,
  rows: HaulingChecklistRow[],
  rowId: string,
  program: CargoBayPackProgram,
): CargoGridPlacementPlan {
  expandPackProgram(program);
  const strategy = derivePackStrategy(program);
  const packSlotPolicy = derivePackSlotPolicy(program);

  switch (strategy.kind) {
    case "suggested":
      // Route-authored chronological placement (no cluster reordering).
      return planZoneOccupancyAtStop(sketch, rows, rowId, null);
    case "by-cargo-type":
      return planOccupancyByCargoTypeAtStop(sketch, rows, rowId, {
        missionPrioritized: strategy.missionPrioritized,
        packProgram: program,
        packSlotPolicy,
      });
    case "by-mission-location":
      return planOccupancyByMissionLocationAtStop(sketch, rows, rowId, {
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
