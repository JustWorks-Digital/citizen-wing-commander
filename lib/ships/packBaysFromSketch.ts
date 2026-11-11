import {
  cargoGridZoneWidth,
  type ShipCargoGridSketch,
} from "@/lib/ships/cargoGrids";
import type { PackBay, PackBayAlias } from "@/lib/ships/cargoBayPackProgram";

const aliasFromStorage = (
  storage: "front" | "middle" | "rear" | null | undefined,
  index: number,
): PackBayAlias => {
  if (storage === "front" || storage === "middle" || storage === "rear") {
    return storage;
  }
  if (index === 0) return "rear";
  if (index === 1) return "front";
  return "middle";
};

/**
 * Build portable pack-program bay context from a cargo-grid sketch.
 * Logical X is nose→ramp; towardShipFront = low-x, towardShipRear = high-x
 * (matches placer “back of bay” = high X).
 */
export function packBaysFromSketch(sketch: ShipCargoGridSketch): PackBay[] {
  const cargoZones = sketch.zones.filter((zone) => zone.kind === "cargo");
  return cargoZones.map((zone, index) => ({
    id: index + 1,
    alias: aliasFromStorage(zone.storageLocation, index),
    size: {
      width: cargoGridZoneWidth(sketch, zone),
      length: zone.lengthCells,
      height: sketch.heightCells,
    },
    orientation: {
      towardShipFront: "low-x",
      towardShipRear: "high-x",
    },
  }));
}
