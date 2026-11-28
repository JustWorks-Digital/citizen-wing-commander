import type { HaulingChecklistRow } from "@/lib/missions/sessionChecklist";

import { interpretCargoBayPackProgram } from "@/lib/ships/cargoBayPackInterpret";
import {
  compilePackProgramForMode,
  type CargoBayPackProgram,
} from "@/lib/ships/cargoBayPackProgram";
import {
  ALL_CONTRACTS_PACK_STOP_ID,
  CURRENT_ABOARD_PACK_STOP_ID,
  defaultCargoBayPackMode,
  filterBoxesAboardAtStop as filterPlacedBoxesAboardAtStop,
  filterBoxesRemainingAboard as filterPlacedBoxesRemainingAboard,
  packByCargoTypeAtStop,
  packDeliveriesFromStop,
  packSuggestedAtStop,
  placeUnplacedInOverflow,
  stopsForAllContractPickups,
  type CargoBayPackMode,
  type CargoGridPlacementPlan,
  type PlacedCargoBox,
  type SoftVisibleCargoAtStopOptions,
} from "@/lib/ships/cargoGridPlacement";
import type { ShipCargoGridSketch } from "@/lib/ships/cargoGrids";
import { settleFloatingBayBoxes } from "@/lib/ships/manualBayMove";
import { packBaysFromSketch } from "@/lib/ships/packBaysFromSketch";
import { derivePackSlotPolicy } from "@/lib/ships/packSlotPolicy";
import { validateCargoTypePackClusters } from "@/lib/ships/cargoTypePackValidate";
import { getShipBayPreferenceFixture } from "@/lib/ships/shipBayPreferences";

export {
  ALL_CONTRACTS_PACK_STOP_ID,
  CURRENT_ABOARD_PACK_STOP_ID,
} from "@/lib/ships/cargoGridPlacement";

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

    const packMode = options.packMode ?? defaultCargoBayPackMode;
    const biasXyMode = options.missionPrioritized
      ? (getShipBayPreferenceFixture(sketch.shipSlug).missionPriorityPacking
          ?.bias ?? null)
      : null;
    const program =
      options.packProgram ??
      compilePackProgramForMode({
        mode: packMode,
        bays: packBaysFromSketch(sketch),
        missionPrioritized: options.missionPrioritized,
        biasXyMode,
      });
    const plan = interpretCargoBayPackProgram(stopId, sketch, stops, program, {
      includeAboardCargo,
    });
    const packSlotPolicy = derivePackSlotPolicy(program);
    // Excess beyond snapped ship SCU → overflow/unstable grids when present.
    // Pass cluster policy so overflow re-pack does not bury cargo types
    // (session 6ff09a56 Everus Harbor Galaxy Cargo Type mix).
    const packed = placeUnplacedInOverflow(sketch, plan, {
      packSlotPolicy,
      // Only cargo-type preserves clusters through overflow; mission-location
      // still dense-repacks so official capacity snaps to 720+excess.
      clusterByKey: packMode === "by-cargo-type",
    });
    // Pack / overflow can leave elevated crates with empty space under them.
    const boxes = settleFloatingBayBoxes(sketch, packed.boxes);
    if (packMode !== "by-cargo-type") {
      return { ...packed, boxes };
    }
    return {
      ...packed,
      boxes,
      cargoTypeClusters: validateCargoTypePackClusters(boxes),
    };
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

  /**
   * Pack every contract pickup on the trip into one bay view (Cargo bay Planned).
   * Amounts match contracts-total SCU; crates may exceed a single stop’s peak.
   */
  packAllContractPickups(
    sketch: ShipCargoGridSketch,
    stops: HaulingChecklistRow[],
    packModeOrOptions:
      | CargoBayPackMode
      | CargoBayPackAtStopOptions = defaultCargoBayPackMode,
  ): CargoGridPlacementPlan {
    const packStops = stopsForAllContractPickups(stops);
    return cargoBay.packAtStop(
      ALL_CONTRACTS_PACK_STOP_ID,
      sketch,
      packStops,
      packModeOrOptions,
    );
  },

  /**
   * Location tab: filter All-tab boxes to cargo aboard at `stopId`.
   * Keeps All origins/cells — does not re-pack.
   */
  filterBoxesAboardAtStop(
    stopId: string,
    allBoxes: readonly PlacedCargoBox[],
    stops: HaulingChecklistRow[],
    options?: SoftVisibleCargoAtStopOptions,
  ): PlacedCargoBox[] {
    return filterPlacedBoxesAboardAtStop(stopId, allBoxes, stops, options);
  },

  /**
   * All tab after trip progress: filter packing plan to crates still aboard
   * from completed stops. Same origins/cells — does not re-pack.
   */
  filterBoxesRemainingAboard(
    allBoxes: readonly PlacedCargoBox[],
    stops: HaulingChecklistRow[],
  ): PlacedCargoBox[] {
    return filterPlacedBoxesRemainingAboard(allBoxes, stops);
  },
};
