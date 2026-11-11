import type { HaulingChecklistRow } from "@/lib/missions/mockSession";
import { interpretCargoBayPackProgram } from "@/lib/ships/cargoBayPackInterpret";
import {
  compilePackProgramForMode,
  type CargoBayPackProgram,
} from "@/lib/ships/cargoBayPackProgram";
import {
  defaultCargoBayPackMode,
  type CargoBayPackMode,
  type CargoGridPlacementPlan,
} from "@/lib/ships/cargoGridPlacement";
import type { ShipCargoGridSketch } from "@/lib/ships/cargoGrids";
import { packBaysFromSketch } from "@/lib/ships/packBaysFromSketch";
import { getShipBayPreferenceFixture } from "@/lib/ships/shipBayPreferences";

export type PlanStopOccupancyOptions = {
  packMode?: CargoBayPackMode;
  /** Cargo type only: bias placement by upcoming delivery order (ship prefs). */
  missionPrioritized?: boolean;
  /**
   * Optional pre-built pack program (DSL). When set, overrides packMode
   * compilation — UI/MCP can pass a custom program.
   */
  packProgram?: CargoBayPackProgram;
};

/** Whole-stop bay plan via pack-program DSL (compile preset or use provided program). */
export function planStopOccupancyAtStop(
  sketch: ShipCargoGridSketch,
  rows: HaulingChecklistRow[],
  rowId: string,
  packModeOrOptions:
    | CargoBayPackMode
    | PlanStopOccupancyOptions = defaultCargoBayPackMode,
): CargoGridPlacementPlan {
  const options: PlanStopOccupancyOptions =
    typeof packModeOrOptions === "string"
      ? { packMode: packModeOrOptions }
      : packModeOrOptions;

  if (options.packProgram) {
    return interpretCargoBayPackProgram(
      sketch,
      rows,
      rowId,
      options.packProgram,
    );
  }

  const packMode = options.packMode ?? defaultCargoBayPackMode;
  const biasXyMode = options.missionPrioritized
    ? (getShipBayPreferenceFixture(sketch.shipSlug).missionPriorityPacking
        ?.bias ?? null)
    : null;
  const program = compilePackProgramForMode({
    mode: packMode,
    bays: packBaysFromSketch(sketch),
    missionPrioritized: options.missionPrioritized,
    biasXyMode,
  });
  return interpretCargoBayPackProgram(sketch, rows, rowId, program);
}
