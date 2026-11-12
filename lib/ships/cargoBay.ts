import type { HaulingChecklistRow } from "@/lib/missions/mockSession";
import { interpretCargoBayPackProgram } from "@/lib/ships/cargoBayPackInterpret";
import {
  compilePackProgramForMode,
  type CargoBayPackProgram,
} from "@/lib/ships/cargoBayPackProgram";
import {
  defaultCargoBayPackMode,
  packByCargoTypeAtStop,
  packDeliveriesFromStop,
  packSuggestedAtStop,
  type CargoBayPackMode,
  type CargoGridPlacementPlan,
} from "@/lib/ships/cargoGridPlacement";
import type { ShipCargoGridSketch } from "@/lib/ships/cargoGrids";
import { packBaysFromSketch } from "@/lib/ships/packBaysFromSketch";
import { getShipBayPreferenceFixture } from "@/lib/ships/shipBayPreferences";

export type CargoBayPackAtStopOptions = {
  packMode?: CargoBayPackMode;
  /** Cargo type only: bias placement by upcoming delivery order (ship prefs). */
  missionPrioritized?: boolean;
  /**
   * Optional pre-built pack program (DSL). When set, overrides packMode
   * compilation — UI/MCP can pass a custom program.
   */
  packProgram?: CargoBayPackProgram;
  /**
   * When false, pack only this stop’s pickup/delivery (no stay cargo).
   * Transfer bay scope can use false so only pickup/delivery crates are packed.
   */
  includeAboardCargo?: boolean;
};

/**
 * Place cargo boxes in the bay grid for one trip stop.
 * Amounts / transfers live on `cargoInventory`; this is layout only.
 * Entity id (`stopId`) is always first.
 */
export const cargoBay = {
  /** Sorting preset or custom pack program → placed boxes. */
  packAtStop(
    stopId: string,
    sketch: ShipCargoGridSketch,
    stops: HaulingChecklistRow[],
    packModeOrOptions:
      | CargoBayPackMode
      | CargoBayPackAtStopOptions = defaultCargoBayPackMode,
  ): CargoGridPlacementPlan {
    const options: CargoBayPackAtStopOptions =
      typeof packModeOrOptions === "string"
        ? { packMode: packModeOrOptions }
        : packModeOrOptions;

    const includeAboardCargo = options.includeAboardCargo;

    if (options.packProgram) {
      return interpretCargoBayPackProgram(
        stopId,
        sketch,
        stops,
        options.packProgram,
        { includeAboardCargo },
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
    return interpretCargoBayPackProgram(stopId, sketch, stops, program, {
      includeAboardCargo,
    });
  },

  /** Suggested: chronological route-authored placement. */
  packSuggestedAtStop: packSuggestedAtStop,

  /** Cargo type: cluster by commodity. */
  packByCargoTypeAtStop: packByCargoTypeAtStop,

  /**
   * Pack deliveries from a trip stop (Contract Sorting).
   * `stopId` first = the stop the bay plan is for (not a grid-cell origin).
   */
  packDeliveriesFromStop: packDeliveriesFromStop,
};
