import { getCommodityBySlug, getLocationBySlug } from "@/lib/fixtures";
import {
  cargoBoxOrientations,
  decomposeScuIntoBoxes,
  maxCargoBoxScu,
  type CargoBoxFootprint,
  type CargoBoxScu,
} from "@/lib/ships/cargoBoxSizes";
import {
  cargoGridCoordKey,
  cargoGridZoneStorageLocation,
  type CargoGridCoord,
} from "@/lib/ships/cargoGridCoords";
import {
  cargoGridMaxWidth,
  cargoGridZoneWidth,
  type CargoGridStorageLocation,
  type ShipCargoGridSketch,
} from "@/lib/ships/cargoGrids";
import {
  forEachPlacementOrigin,
  resolvePlacementSlotOrder,
  scorePlacementSlot,
} from "@/lib/ships/cargoGridPlacementRules";
import {
  getShipBayPreferenceFixture,
  type MissionPriorityPackBias,
} from "@/lib/ships/shipBayPreferences";
import {
  comparePackSlotCandidates,
  countEmptyOnLayer,
  supportScuMinUnder,
  type PackSlotCandidateMetrics,
  type PackSlotPolicy,
} from "@/lib/ships/packSlotPolicy";
import { orderPackItemsByProgram } from "@/lib/ships/packItemOrder";
import type { CargoBayPackProgram } from "@/lib/ships/cargoBayPackProgram";
import type {
  CargoDelivery,
  HaulingChecklistRow,
  RouteAction,
  ShipStorageLocation,
} from "@/lib/missions/mockSession";

export type CargoPlacementSegment = {
  /** Explicit crates; when set, skips greedy decompose. */
  boxSizes?: CargoBoxScu[];
  commoditySlug: string;
  commodityName: string;
  scu: number;
  color: string | null;
  color2: string | null;
};

export type CargoGridBoxAction = "pickup" | "delivery";

export type PlacedCargoBox = {
  id: string;
  /** SCU volume of this crate (may be a partial split from a larger crate). */
  size: number;
  /** Origin cell (min X/Y/Z corner of the box). */
  origin: CargoGridCoord;
  footprint: CargoBoxFootprint;
  commoditySlug: string;
  commodityName: string;
  color: string | null;
  color2: string | null;
  /** Every 1 SCU cell occupied by this crate. */
  cells: CargoGridCoord[];
  /** Set when this box is shown for a stop: load vs unload. */
  action?: CargoGridBoxAction;
  /** Session mission this crate belongs to (pad / hangar views). */
  missionId?: string | null;
  /** Delivery stop this crate is packed for (from route location splits). */
  deliveryLocationSlug?: string;
  deliveryLocationName?: string;
  /** 1-based delivery-order index for outlines / labels. */
  locationGroupIndex?: number;
};

export type CargoGridPlacementPlan = {
  zone: CargoGridStorageLocation;
  boxes: PlacedCargoBox[];
  /** Cells that could not be placed (overflow). */
  unplaced: Array<{
    size: CargoBoxScu;
    commoditySlug: string;
    commodityName: string;
  }>;
};

type ZoneBounds = {
  xStart: number;
  xEnd: number;
  yStart: number;
  yEnd: number;
  zEnd: number;
};

function boundsForZoneEntry(
  sketch: ShipCargoGridSketch,
  targetId: string,
): ZoneBounds | null {
  const maxWidth = cargoGridMaxWidth(sketch);
  let x = 0;
  for (const entry of sketch.zones) {
    const width = cargoGridZoneWidth(sketch, entry);
    const yStart = Math.floor((maxWidth - width) / 2);
    if (entry.id === targetId && entry.kind === "cargo") {
      return {
        xStart: x,
        xEnd: x + entry.lengthCells,
        yStart,
        yEnd: yStart + width,
        zEnd: sketch.heightCells,
      };
    }
    x += entry.lengthCells;
  }
  return null;
}

/**
 * Resolve bay bounds for a coarse storage location.
 * Ships without that bay (e.g. C2 has no `middle`) fall back to another cargo
 * zone so crates still pack instead of all going to "no free space".
 */
function zoneBoundsForStorage(
  sketch: ShipCargoGridSketch,
  zone: CargoGridStorageLocation,
): ZoneBounds | null {
  const maxWidth = cargoGridMaxWidth(sketch);
  let x = 0;
  for (const entry of sketch.zones) {
    const width = cargoGridZoneWidth(sketch, entry);
    const yStart = Math.floor((maxWidth - width) / 2);
    if (
      entry.kind === "cargo" &&
      cargoGridZoneStorageLocation(entry) === zone
    ) {
      return {
        xStart: x,
        xEnd: x + entry.lengthCells,
        yStart,
        yEnd: yStart + width,
        zEnd: sketch.heightCells,
      };
    }
    x += entry.lengthCells;
  }

  // Fallback order when the requested bay isn't on this ship's grid.
  const cargoZones = sketch.zones.filter((entry) => entry.kind === "cargo");
  if (cargoZones.length === 0) return null;

  const fallbackId = (() => {
    if (zone === "middle") {
      // Prefer a dedicated hold, else the largest bay (C2 → rear).
      const hold = cargoZones.find((entry) => entry.id === "hold");
      if (hold) return hold.id;
      return [...cargoZones].sort(
        (a, b) =>
          cargoGridZoneWidth(sketch, b) * b.lengthCells -
          cargoGridZoneWidth(sketch, a) * a.lengthCells,
      )[0]!.id;
    }
    if (zone === "front") {
      return (
        cargoZones.find((entry) => entry.id === "forward" || entry.id === "hold")
          ?.id ?? cargoZones[0]!.id
      );
    }
    // rear
    return (
      cargoZones.find((entry) => entry.id === "rear" || entry.id === "hold")
        ?.id ?? cargoZones[cargoZones.length - 1]!.id
    );
  })();

  return boundsForZoneEntry(sketch, fallbackId);
}

function cellsForBox(
  origin: CargoGridCoord,
  footprint: CargoBoxFootprint,
): CargoGridCoord[] {
  const cells: CargoGridCoord[] = [];
  for (let dx = 0; dx < footprint.dx; dx += 1) {
    for (let dy = 0; dy < footprint.dy; dy += 1) {
      for (let dz = 0; dz < footprint.dz; dz += 1) {
        cells.push({
          x: origin.x + dx,
          y: origin.y + dy,
          z: origin.z + dz,
        });
      }
    }
  }
  return cells;
}

function fits(
  bounds: ZoneBounds,
  origin: CargoGridCoord,
  footprint: CargoBoxFootprint,
  occupied: Set<string>,
): boolean {
  if (origin.x + footprint.dx > bounds.xEnd) return false;
  if (origin.y + footprint.dy > bounds.yEnd) return false;
  if (origin.z + footprint.dz > bounds.zEnd) return false;
  if (origin.x < bounds.xStart || origin.y < bounds.yStart || origin.z < 0) {
    return false;
  }
  for (const cell of cellsForBox(origin, footprint)) {
    if (occupied.has(cargoGridCoordKey(cell))) return false;
  }
  return true;
}

type FindSlotCluster = {
  /**
   * Hard affinity key (same pile). Commodity slug, or
   * `location::commodity` in mission-based mode.
   */
  clusterKey: string;
  occupiedClusters: ReadonlyMap<string, string>;
  /**
   * Soft affinity (delivery-location pile). Mission-based uses this so the
   * next cargo type can stack onto an existing location group.
   */
  regionKey?: string;
  occupiedRegions?: ReadonlyMap<string, string>;
  /**
   * When true, keep delivery-location piles easy to access: grow on the deck
   * beside the pile (with a gap from other piles when possible) before stacking
   * onto a different location. Same-location cargo types may still share a
   * stack once the deck is full.
   */
  preferRegionStacking?: boolean;
  /**
   * When the region already has cargo, only accept slots that touch it
   * (side-by-side or stacked) so mission groups stay one contiguous blob.
   */
  requireRegionContiguity?: boolean;
  /**
   * Never sit on a different region's crates (keeps priority mission piles
   * clear of foreign cargo on top).
   */
  forbidForeignRegionSupport?: boolean;
  /**
   * Mission-based priority piles: pull toward one length-wise bay end
   * (not the middle). `"high-x"` ≈ rear/ramp side of the zone.
   */
  preferBayEnd?: "low-x" | "high-x";
  /** 0 = earliest delivery; higher = later. */
  missionRank?: number;
  missionRankMax?: number;
  missionPriorityBias?: MissionPriorityPackBias;
  /** When set, slot pick uses pack-program tiered compare. */
  packSlotPolicy?: PackSlotPolicy | null;
};

/** Neighbor cells (face-adjacent) — used to keep same-commodity crates clustered. */
function neighborCoords(coord: CargoGridCoord): CargoGridCoord[] {
  return [
    { x: coord.x - 1, y: coord.y, z: coord.z },
    { x: coord.x + 1, y: coord.y, z: coord.z },
    { x: coord.x, y: coord.y - 1, z: coord.z },
    { x: coord.x, y: coord.y + 1, z: coord.z },
    { x: coord.x, y: coord.y, z: coord.z - 1 },
    { x: coord.x, y: coord.y, z: coord.z + 1 },
  ];
}

type ClusterAffinity = {
  /** Face-adjacent contacts on the same Z (side-by-side). */
  horizontal: number;
  /** Face-adjacent contacts above/below (stacking). */
  vertical: number;
};

function clusterAffinity(
  origin: CargoGridCoord,
  footprint: CargoBoxFootprint,
  cluster: FindSlotCluster | null,
): ClusterAffinity {
  if (!cluster) return { horizontal: 0, vertical: 0 };
  let horizontal = 0;
  let vertical = 0;
  for (const cell of cellsForBox(origin, footprint)) {
    for (const neighbor of neighborCoords(cell)) {
      if (
        cluster.occupiedClusters.get(cargoGridCoordKey(neighbor)) !==
        cluster.clusterKey
      ) {
        continue;
      }
      if (neighbor.z === cell.z) horizontal += 1;
      else vertical += 1;
    }
  }
  return { horizontal, vertical };
}

/** Side contacts with a different cargo-type cluster (gap preference). */
function otherClusterSideCount(
  origin: CargoGridCoord,
  footprint: CargoBoxFootprint,
  cluster: FindSlotCluster | null,
): number {
  if (!cluster) return 0;
  let side = 0;
  for (const cell of cellsForBox(origin, footprint)) {
    for (const neighbor of neighborCoords(cell)) {
      if (neighbor.z !== cell.z) continue;
      const other = cluster.occupiedClusters.get(cargoGridCoordKey(neighbor));
      if (other == null || other === cluster.clusterKey) continue;
      side += 1;
    }
  }
  return side;
}

/** Weaker neighbor pull toward the same delivery-location region. */
function regionAffinity(
  origin: CargoGridCoord,
  footprint: CargoBoxFootprint,
  cluster: FindSlotCluster | null,
): ClusterAffinity {
  if (!cluster?.regionKey || !cluster.occupiedRegions) {
    return { horizontal: 0, vertical: 0 };
  }
  let horizontal = 0;
  let vertical = 0;
  for (const cell of cellsForBox(origin, footprint)) {
    for (const neighbor of neighborCoords(cell)) {
      if (
        cluster.occupiedRegions.get(cargoGridCoordKey(neighbor)) !==
        cluster.regionKey
      ) {
        continue;
      }
      // Exact cargo-type contacts are already counted in clusterAffinity.
      if (
        cluster.occupiedClusters.get(cargoGridCoordKey(neighbor)) ===
        cluster.clusterKey
      ) {
        continue;
      }
      if (neighbor.z === cell.z) horizontal += 1;
      else vertical += 1;
    }
  }
  return { horizontal, vertical };
}

/**
 * True when every column under the footprint rests on a filled cell (deck or
 * crate). Size mixing is allowed when the support forms a flat platform
 * (e.g. 8 on 4, or 8/4 on two adjacent 2s). A lone 1 or 2 cannot support an
 * 8 because it cannot cover the 2×2 footprint alone.
 */
function hasValidSupport(
  origin: CargoGridCoord,
  footprint: CargoBoxFootprint,
  _boxScu: number,
  occupiedSizes: ReadonlyMap<string, number>,
): boolean {
  if (origin.z === 0) return true;
  for (let dx = 0; dx < footprint.dx; dx += 1) {
    for (let dy = 0; dy < footprint.dy; dy += 1) {
      const supportSize = occupiedSizes.get(
        cargoGridCoordKey({
          x: origin.x + dx,
          y: origin.y + dy,
          z: origin.z - 1,
        }),
      );
      if (supportSize == null) return false;
    }
  }
  return true;
}

/** How much of the footprint sits on the same cluster vs another. */
function supportClusterCounts(
  origin: CargoGridCoord,
  footprint: CargoBoxFootprint,
  clusterKey: string,
  occupiedClusters: ReadonlyMap<string, string>,
): { same: number; other: number } {
  if (origin.z === 0) return { same: 0, other: 0 };
  let same = 0;
  let other = 0;
  for (let dx = 0; dx < footprint.dx; dx += 1) {
    for (let dy = 0; dy < footprint.dy; dy += 1) {
      const key = occupiedClusters.get(
        cargoGridCoordKey({
          x: origin.x + dx,
          y: origin.y + dy,
          z: origin.z - 1,
        }),
      );
      if (key == null) continue;
      if (key === clusterKey) same += 1;
      else other += 1;
    }
  }
  return { same, other };
}

/** How much of the footprint rests on the same delivery-location region. */
function supportRegionCount(
  origin: CargoGridCoord,
  footprint: CargoBoxFootprint,
  regionKey: string | undefined,
  occupiedRegions: ReadonlyMap<string, string> | undefined,
): number {
  if (origin.z === 0 || !regionKey || !occupiedRegions) return 0;
  let same = 0;
  for (let dx = 0; dx < footprint.dx; dx += 1) {
    for (let dy = 0; dy < footprint.dy; dy += 1) {
      if (
        occupiedRegions.get(
          cargoGridCoordKey({
            x: origin.x + dx,
            y: origin.y + dy,
            z: origin.z - 1,
          }),
        ) === regionKey
      ) {
        same += 1;
      }
    }
  }
  return same;
}

/**
 * Contact with a *different* delivery-location pile — used to keep a 1-cell
 * visual gap between groups (especially on narrow “churro” bays).
 */
function foreignRegionContact(
  origin: CargoGridCoord,
  footprint: CargoBoxFootprint,
  regionKey: string | undefined,
  occupiedRegions: ReadonlyMap<string, string> | undefined,
): { side: number; support: number } {
  if (!occupiedRegions || occupiedRegions.size === 0) {
    return { side: 0, support: 0 };
  }
  let side = 0;
  let support = 0;
  for (const cell of cellsForBox(origin, footprint)) {
    for (const neighbor of neighborCoords(cell)) {
      const other = occupiedRegions.get(cargoGridCoordKey(neighbor));
      if (other == null) continue;
      if (regionKey != null && other === regionKey) continue;
      if (neighbor.z === cell.z) side += 1;
      else if (neighbor.z < cell.z) support += 1;
    }
  }
  return { side, support };
}

/** Manhattan distance from footprint center to bay center (XY). */
function edgeDistanceFromBayCenter(
  origin: CargoGridCoord,
  footprint: CargoBoxFootprint,
  bounds: ZoneBounds,
): number {
  const bayCx = (bounds.xStart + bounds.xEnd - 1) / 2;
  const bayCy = (bounds.yStart + bounds.yEnd - 1) / 2;
  const fx = origin.x + (footprint.dx - 1) / 2;
  const fy = origin.y + (footprint.dy - 1) / 2;
  return Math.abs(fx - bayCx) + Math.abs(fy - bayCy);
}

/** Signed offset along bay length from center (positive = high-X / rear side). */
function lengthOffsetFromBayCenter(
  origin: CargoGridCoord,
  footprint: CargoBoxFootprint,
  bounds: ZoneBounds,
): number {
  const bayCx = (bounds.xStart + bounds.xEnd - 1) / 2;
  const fx = origin.x + (footprint.dx - 1) / 2;
  return fx - bayCx;
}

/**
 * Outer length band for priority mission piles (not the whole half-bay).
 * Keeps mid-bay deck free for remaining cargo-type packs.
 */
function preferredBayEndDepth(bounds: ZoneBounds): number {
  const bayLength = bounds.xEnd - bounds.xStart;
  // Outer ~20% each end (min 2 cells) so mid-bay keeps most of the deck.
  return Math.max(2, Math.round(bayLength * 0.2));
}

function isOnPreferredBayEnd(
  origin: CargoGridCoord,
  footprint: CargoBoxFootprint,
  bounds: ZoneBounds,
  preferBayEnd: "low-x" | "high-x",
): boolean {
  const fx = origin.x + (footprint.dx - 1) / 2;
  const depth = preferredBayEndDepth(bounds);
  if (preferBayEnd === "high-x") {
    return fx >= bounds.xEnd - depth;
  }
  return fx < bounds.xStart + depth;
}

/** Strong pull toward a chosen bay end for mission priority piles. */
function bayEndScore(
  origin: CargoGridCoord,
  footprint: CargoBoxFootprint,
  bounds: ZoneBounds,
  preferBayEnd: "low-x" | "high-x" | undefined,
): number {
  if (!preferBayEnd) return 0;
  const offset = lengthOffsetFromBayCenter(origin, footprint, bounds);
  const towardPreferred = preferBayEnd === "high-x" ? offset : -offset;
  // Prefer the chosen half strongly; mild extra for being farther from center.
  return towardPreferred * 48 + Math.max(0, towardPreferred) * 12;
}

/**
 * Early deliveries → edges (or center) based on ship bias, and higher layers
 * so first-to-deliver cargo sits on top of later deliveries of the same type.
 * Rank 0 is earliest; rankMax is latest.
 */
function missionPriorityScore(
  origin: CargoGridCoord,
  footprint: CargoBoxFootprint,
  bounds: ZoneBounds,
  cluster: FindSlotCluster | null,
): number {
  if (
    !cluster?.missionPriorityBias ||
    cluster.missionRank == null ||
    cluster.missionRankMax == null ||
    cluster.missionRankMax <= 0
  ) {
    return 0;
  }
  const edge = edgeDistanceFromBayCenter(origin, footprint, bounds);
  const t = cluster.missionRank / cluster.missionRankMax; // 0 early → 1 late
  // Early unload → prefer higher Z; late unload → prefer lower Z.
  const layer =
    origin.z * (1 - t) * 14 - origin.z * t * 6;
  if (cluster.missionPriorityBias === "edges-first") {
    // Early: want high edge distance; late: want low (center).
    return layer + edge * (1 - t) * 18 - edge * t * 18;
  }
  // center-first: early toward center, late toward edges
  return layer + edge * t * 18 - edge * (1 - t) * 18;
}

/**
 * True when the whole footprint stacks on same-cluster crates of the exact
 * same SCU size (e.g. 4 on 4, 8 on 8).
 */
function isIdenticalSizeStack(
  origin: CargoGridCoord,
  footprint: CargoBoxFootprint,
  boxScu: number,
  clusterKey: string,
  occupiedSizes: ReadonlyMap<string, number>,
  occupiedClusters: ReadonlyMap<string, string>,
): boolean {
  if (origin.z === 0) return false;
  for (let dx = 0; dx < footprint.dx; dx += 1) {
    for (let dy = 0; dy < footprint.dy; dy += 1) {
      const key = cargoGridCoordKey({
        x: origin.x + dx,
        y: origin.y + dy,
        z: origin.z - 1,
      });
      if (occupiedSizes.get(key) !== boxScu) return false;
      if (occupiedClusters.get(key) !== clusterKey) return false;
    }
  }
  return true;
}

/**
 * Pick a slot using `cargoGridPlacementRules` scan order + preference scores
 * (flat layers first, smaller-on-larger, full-height toward the back, …).
 */
function findSlot(
  bounds: ZoneBounds,
  footprint: CargoBoxFootprint,
  occupied: Set<string>,
  occupiedSizes: ReadonlyMap<string, number>,
  zone: CargoGridStorageLocation,
  cluster: FindSlotCluster | null = null,
): CargoGridCoord | null {
  const boxScu = footprint.dx * footprint.dy * footprint.dz;
  const ctx = {
    bounds,
    footprint,
    boxScu,
    zone,
    occupiedSizes,
  };
  const order = resolvePlacementSlotOrder(ctx);

  type Candidate = {
    origin: CargoGridCoord;
    score: number;
    affinity: ClusterAffinity;
    regionPull: ClusterAffinity;
    onDeck: boolean;
    sameSupport: number;
    otherSupport: number;
    regionSupport: number;
    foreignSide: number;
    foreignSupport: number;
    identicalSizeStack: boolean;
    packMetrics: PackSlotCandidateMetrics;
  };
  const preferRegionStacking = Boolean(cluster?.preferRegionStacking);
  const requireRegionContiguity = Boolean(
    cluster?.requireRegionContiguity ||
      cluster?.packSlotPolicy?.requireRegionContiguity,
  );
  const forbidForeignRegionSupport = Boolean(
    cluster?.forbidForeignRegionSupport ||
      cluster?.packSlotPolicy?.forbidForeignSupport,
  );
  const packSlotPolicy = cluster?.packSlotPolicy ?? null;
  const candidates: Candidate[] = [];
  forEachPlacementOrigin(order, (origin) => {
    if (!fits(bounds, origin, footprint, occupied)) return;
    // Hard rule: stacked crates need a complete flat support under the footprint.
    if (!hasValidSupport(origin, footprint, boxScu, occupiedSizes)) return;
    const affinity = clusterAffinity(origin, footprint, cluster);
    const regionPull = regionAffinity(origin, footprint, cluster);
    const supportCounts =
      cluster != null
        ? supportClusterCounts(
            origin,
            footprint,
            cluster.clusterKey,
            cluster.occupiedClusters,
          )
        : { same: 0, other: 0 };
    const regionSupport = supportRegionCount(
      origin,
      footprint,
      cluster?.regionKey,
      cluster?.occupiedRegions,
    );
    const foreign = foreignRegionContact(
      origin,
      footprint,
      cluster?.regionKey,
      cluster?.occupiedRegions,
    );
    if (forbidForeignRegionSupport && foreign.support > 0) return;
    const identicalSizeStack =
      cluster != null &&
      isIdenticalSizeStack(
        origin,
        footprint,
        boxScu,
        cluster.clusterKey,
        occupiedSizes,
        cluster.occupiedClusters,
      );
    const touchesRegion =
      regionSupport > 0 ||
      regionPull.horizontal > 0 ||
      regionPull.vertical > 0;
    // Prefer deck growth; soft gap from other location piles (don't starve
    // later missions of deck — that pushed whole piles into the air).
    const offRegionOther = preferRegionStacking
      ? Math.max(0, supportCounts.other - regionSupport)
      : supportCounts.other;
    const score =
      scorePlacementSlot(ctx, origin) +
      (identicalSizeStack ? 80 : 0) +
      affinity.horizontal * 20 +
      affinity.vertical * 12 +
      regionPull.horizontal * (preferRegionStacking ? 24 : 8) +
      regionPull.vertical * (preferRegionStacking ? 8 : 4) +
      (origin.z === 0 ? (preferRegionStacking ? 36 : 8) : 0) +
      supportCounts.same * 24 +
      (preferRegionStacking ? regionSupport * 12 : 0) +
      (touchesRegion && preferRegionStacking && origin.z === 0 ? 40 : 0) +
      (touchesRegion && preferRegionStacking && origin.z > 0 ? 8 : 0) -
      offRegionOther * 40 -
      foreign.side * (preferRegionStacking ? 18 : 12) -
      foreign.support * (preferRegionStacking ? 48 : 20) +
      bayEndScore(origin, footprint, bounds, cluster?.preferBayEnd) +
      missionPriorityScore(origin, footprint, bounds, cluster);
    const packMetrics: PackSlotCandidateMetrics = {
      origin,
      sameClusterTouch: affinity.horizontal + affinity.vertical,
      sameRegionTouch: regionPull.horizontal + regionPull.vertical,
      sameClusterSupport: supportCounts.same,
      otherClusterSupport: supportCounts.other,
      otherClusterSide: otherClusterSideCount(origin, footprint, cluster),
      regionSupport,
      foreignSide: foreign.side,
      foreignSupport: foreign.support,
      supportScuMin: supportScuMinUnder(
        origin,
        footprint,
        occupiedSizes,
        cargoGridCoordKey,
      ),
      emptyCellsOnSameZ: countEmptyOnLayer(
        bounds,
        origin.z,
        occupied,
        cargoGridCoordKey,
      ),
      bayEndToward: bayEndScore(
        origin,
        footprint,
        bounds,
        cluster?.preferBayEnd,
      ),
      edgeDistance: edgeDistanceFromBayCenter(origin, footprint, bounds),
      identicalSizeStack,
      placementRuleScore: score,
    };
    candidates.push({
      origin,
      score,
      affinity,
      regionPull,
      onDeck: origin.z === 0,
      sameSupport: supportCounts.same,
      otherSupport: supportCounts.other,
      regionSupport,
      foreignSide: foreign.side,
      foreignSupport: foreign.support,
      identicalSizeStack,
      packMetrics,
    });
  });
  if (candidates.length === 0) return null;

  /** Pack-program path: hard filters + tiered pack-call compare. */
  if (packSlotPolicy) {
    let pool = candidates;
    const hasCluster =
      cluster != null &&
      [...cluster.occupiedClusters.values()].includes(cluster.clusterKey);
    const hasRegion =
      cluster?.regionKey != null &&
      cluster.occupiedRegions != null &&
      [...cluster.occupiedRegions.values()].includes(cluster.regionKey);
    const touchesRegionPool = (c: Candidate) =>
      c.regionSupport > 0 ||
      c.regionPull.horizontal > 0 ||
      c.regionPull.vertical > 0 ||
      c.affinity.horizontal > 0 ||
      c.affinity.vertical > 0 ||
      c.sameSupport > 0;
    if (requireRegionContiguity && hasRegion) {
      pool = candidates.filter(touchesRegionPool);
      if (pool.length === 0) return null;
    }
    // New pile: seed on deck when possible (matches require/order z intent).
    if (!hasCluster) {
      const onDeck = pool.filter((c) => c.onDeck);
      if (onDeck.length > 0) pool = onDeck;
    }
    if (cluster?.preferBayEnd) {
      const onEnd = pool.filter((c) =>
        isOnPreferredBayEnd(c.origin, footprint, bounds, cluster.preferBayEnd!),
      );
      if (onEnd.length > 0) pool = onEnd;
    }
    let best: Candidate | null = null;
    for (const candidate of pool) {
      const cmp = best
        ? comparePackSlotCandidates(
            candidate.packMetrics,
            best.packMetrics,
            packSlotPolicy,
            boxScu,
          )
        : -1;
      if (!best || cmp < 0) {
        best = candidate;
      } else if (
        cmp === 0 &&
        candidate.packMetrics.bayEndToward > best.packMetrics.bayEndToward
      ) {
        best = candidate;
      }
    }
    return best?.origin ?? null;
  }

  const hasCluster =
    cluster != null &&
    [...cluster.occupiedClusters.values()].includes(cluster.clusterKey);
  const hasRegion =
    cluster?.regionKey != null &&
    cluster.occupiedRegions != null &&
    [...cluster.occupiedRegions.values()].includes(cluster.regionKey);

  // Same-cluster side contacts count too — priority mission piles use the
  // location as both clusterKey and regionKey, so regionPull skips them.
  const touchesRegionPool = (c: Candidate) =>
    c.regionSupport > 0 ||
    c.regionPull.horizontal > 0 ||
    c.regionPull.vertical > 0 ||
    c.affinity.horizontal > 0 ||
    c.affinity.vertical > 0 ||
    c.sameSupport > 0;
  const spaced = (c: Candidate) =>
    c.foreignSide === 0 && c.foreignSupport === 0;
  const besideOwnOnDeck = (c: Candidate) =>
    c.onDeck &&
    (c.regionPull.horizontal > 0 || c.affinity.horizontal > 0);
  const onOwnGroup = (c: Candidate) =>
    c.affinity.horizontal > 0 ||
    c.affinity.vertical > 0 ||
    c.sameSupport > 0 ||
    c.regionSupport > 0 ||
    c.regionPull.horizontal > 0 ||
    c.regionPull.vertical > 0;

  /** Prefer first non-empty filter list (mission ease-of-access order). */
  function pickPool(
    ...groups: Candidate[][]
  ): Candidate[] {
    for (const group of groups) {
      if (group.length > 0) return group;
    }
    return [];
  }

  const onDeckCandidates = candidates.filter((c) => c.onDeck);
  const lowestElevatedZ = candidates.reduce(
    (min, c) => (c.onDeck ? min : Math.min(min, c.origin.z)),
    Number.POSITIVE_INFINITY,
  );
  const lowestElevated = Number.isFinite(lowestElevatedZ)
    ? candidates.filter((c) => !c.onDeck && c.origin.z === lowestElevatedZ)
    : [];

  let pool = candidates;

  // Mission groups must stay contiguous: once a location pile exists, every
  // new crate for that location must touch it (side or stack). With a preferred
  // bay end, fill that half (deck then stack up) before spilling mid-bay so
  // later cargo-type packs still have deck room.
  if (requireRegionContiguity && hasRegion) {
    const touching = candidates.filter(touchesRegionPool);
    if (touching.length === 0) return null;

    const preferBayEnd = cluster?.preferBayEnd;
    const onPreferredEnd =
      preferBayEnd != null
        ? (c: Candidate) =>
            isOnPreferredBayEnd(c.origin, footprint, bounds, preferBayEnd)
        : null;
    const preferred = (list: Candidate[]) =>
      onPreferredEnd != null ? list.filter((c) => onPreferredEnd(c)) : list;

    const deckBeside = touching.filter((c) => besideOwnOnDeck(c));
    const deckSpaced = deckBeside.filter((c) => spaced(c));
    const identicalOwn = touching.filter(
      (c) => c.identicalSizeStack && c.foreignSupport === 0,
    );
    const stackOwnCluster = touching.filter(
      (c) =>
        (c.identicalSizeStack || c.sameSupport > 0 || c.affinity.vertical > 0) &&
        c.foreignSupport === 0,
    );
    const stackOwnRegion = touching.filter(
      (c) => c.regionSupport > 0 && c.foreignSupport === 0,
    );
    const ownGroup = touching.filter(onOwnGroup);

    pool = pickPool(
      preferred(deckBeside),
      preferred(deckSpaced),
      preferred(identicalOwn),
      preferred(stackOwnCluster),
      preferred(stackOwnRegion),
      preferred(ownGroup),
      deckBeside,
      deckSpaced,
      identicalOwn,
      stackOwnCluster,
      stackOwnRegion,
      ownGroup,
      touching,
    );

    let bestTouch: Candidate | null = null;
    for (const candidate of pool) {
      if (!bestTouch || candidate.score > bestTouch.score) bestTouch = candidate;
    }
    return bestTouch?.origin ?? null;
  }

  // New cargo-type / new location pile.
  if (cluster != null && !hasCluster) {
    const preferBayEnd = cluster.preferBayEnd;
    const onPreferredEnd = preferBayEnd
      ? (c: Candidate) =>
          isOnPreferredBayEnd(c.origin, footprint, bounds, preferBayEnd)
      : null;
    if (preferRegionStacking && hasRegion) {
      // Same location, new commodity: grow on the deck beside the pile first;
      // only then stack onto that location's crates.
      const deckBeside = candidates.filter((c) => besideOwnOnDeck(c));
      const deckSpaced = deckBeside.filter((c) => spaced(c));
      const stackOwnRegion = candidates.filter(
        (c) => c.regionSupport > 0 && c.foreignSupport === 0,
      );
      const touching = candidates.filter(touchesRegionPool);
      pool = pickPool(
        deckBeside,
        deckSpaced,
        onDeckCandidates,
        stackOwnRegion,
        touching,
        lowestElevated,
      );
    } else {
      // Always seed on the deck when any deck cell is free — never start a
      // new location pile floating on someone else's crates. Priority mission
      // piles seed on their preferred front/rear half when possible.
      const preferredDeck =
        onPreferredEnd != null
          ? onDeckCandidates.filter((c) => onPreferredEnd(c))
          : [];
      const spacedPreferred = preferredDeck.filter((c) => spaced(c));
      const spacedDeck = onDeckCandidates.filter((c) => spaced(c));
      pool = pickPool(
        spacedPreferred,
        preferredDeck,
        onDeckCandidates,
        spacedDeck,
        lowestElevated,
      );
    }
  }

  if (hasCluster) {
    // 1) Stack identical SCU sizes on themselves before anything else.
    const identicalStacks = candidates.filter(
      (c) => c.identicalSizeStack && c.otherSupport === 0,
    );
    // 2) Otherwise grow on our own pile (sideways or on our own support).
    const onOwn = candidates.filter(
      (c) =>
        c.affinity.horizontal > 0 ||
        c.affinity.vertical > 0 ||
        c.sameSupport > 0,
    );
    const sideOrOwnStack = onOwn.filter(
      (c) => c.otherSupport === 0 || c.sameSupport > 0,
    );
    const sideBySide = candidates.filter(
      (c) => c.affinity.horizontal > 0 && c.otherSupport === 0,
    );
    const stackedOnOwn = candidates.filter(
      (c) => c.sameSupport > 0 && c.otherSupport === 0,
    );
    // Larger crates prefer their own column/stack over riding smaller others.
    const ownDeckOrSide = candidates.filter(
      (c) =>
        c.otherSupport === 0 &&
        (c.onDeck || c.affinity.horizontal > 0 || c.sameSupport > 0),
    );
    // Prioritized unload: grow height on the existing type pile before
    // spreading a new deck column (early stops should sit on top of later).
    const preferUnloadStack = Boolean(cluster?.missionPriorityBias);
    if (preferRegionStacking) {
      // Deck beside own group first; gap is a soft score preference only.
      pool = pickPool(
        candidates.filter((c) => besideOwnOnDeck(c)),
        sideBySide,
        identicalStacks,
        stackedOnOwn,
        ownDeckOrSide,
        onDeckCandidates,
        sideOrOwnStack,
        onOwn,
        candidates.filter(touchesRegionPool),
        lowestElevated,
      );
    } else if (identicalStacks.length > 0) {
      pool = identicalStacks;
    } else if (preferUnloadStack && stackedOnOwn.length > 0) {
      pool = stackedOnOwn;
    } else if (boxScu >= 4 && ownDeckOrSide.length > 0) {
      pool = ownDeckOrSide;
    } else if (stackedOnOwn.length > 0 && boxScu <= 2) {
      // Remainders (2 / 1 SCU): sit on our own larger crates when we can.
      pool = stackedOnOwn;
    } else if (sideBySide.length > 0) {
      pool = sideBySide;
    } else if (sideOrOwnStack.length > 0) {
      pool = sideOrOwnStack;
    } else if (onOwn.length > 0) {
      pool = onOwn;
    }
  } else if (hasRegion && !preferRegionStacking) {
    // New cargo type inside an existing location blob: stay beside it.
    const besideRegion = candidates.filter(
      (c) => c.regionPull.horizontal > 0 || c.regionPull.vertical > 0,
    );
    if (besideRegion.length > 0) pool = besideRegion;
  }

  if (pool.length === 0) pool = candidates;

  let best: Candidate | null = null;
  for (const candidate of pool) {
    if (!best || candidate.score > best.score) best = candidate;
  }
  return best?.origin ?? null;
}

export type CargoPlacementItem = {
  size: CargoBoxScu;
  commoditySlug: string;
  commodityName: string;
  color: string | null;
  color2: string | null;
  action?: CargoGridBoxAction;
  /** Earliest delivery stop rank (0 = first). Used with mission priority. */
  missionRank?: number;
  /**
   * Hard affinity / pack group key. Defaults to `commoditySlug`.
   * Mission-based uses `location::commodity` so cargo types stack inside a stop.
   */
  clusterKey?: string;
  clusterLabel?: string;
  /**
   * Soft region (delivery location). Keeps mixed commodities for one stop nearby.
   */
  regionKey?: string;
  /** Prefer this length-wise bay end when seeding/growing the pile. */
  preferBayEnd?: "low-x" | "high-x";
  deliveryLocationSlug?: string;
  deliveryLocationName?: string;
  /** 1-based delivery-order index for outlines / labels. */
  locationGroupIndex?: number;
};

/** How `placeCargoItemsInZone` orders clusters when `clusterByKey` is on. */
export type CargoClusterOrder =
  /** Delivery rank (if biased), then largest group SCU, then label. */
  | "rank-then-size"
  /**
   * One cargo type at a time (largest total SCU first); within each type,
   * place by delivery-location rank so mission piles form, then later types
   * stack onto those piles.
   */
  | "cargo-then-location";

export type PlaceCargoInZoneOptions = {
  /**
   * Cells already taken (must stay unique). Later pickups skip these until a
   * matching delivery frees them on the route.
   */
  occupied?: Iterable<CargoGridCoord>;
  /**
   * Cell key → cluster key already in the bay (for clustering).
   * Mutated when clustering places new crates.
   */
  occupiedClusters?: Map<string, string>;
  /**
   * Cell key → region key (delivery location). Mutated with clustering.
   */
  occupiedRegions?: Map<string, string>;
  /**
   * Place one cluster fully (largest crates first) before the next.
   * Cluster key defaults to commodity; mission-based uses location::commodity.
   */
  clusterByKey?: boolean;
  /** Cluster traversal order. Defaults to `rank-then-size`. */
  clusterOrder?: CargoClusterOrder;
  /**
   * When set with clustering, order groups by delivery rank and bias XY
   * placement (edges vs center) per ship prefs.
   */
  missionPriorityBias?: MissionPriorityPackBias | null;
  /**
   * Mission-based: prefer growing a delivery-location pile on the deck /
   * on itself before spreading elsewhere.
   */
  preferRegionStacking?: boolean;
  /**
   * Mission-based: once a location pile exists, new crates must touch it.
   */
  requireRegionContiguity?: boolean;
  /**
   * Never stack onto a different region's crates (priority mission piles).
   */
  forbidForeignRegionSupport?: boolean;
  /**
   * Pack-program slot policy: when set, `findSlot` uses tiered pack-call
   * comparison instead of legacy magic-number scores.
   */
  packSlotPolicy?: PackSlotPolicy | null;
  /**
   * When true, items are already ordered by the pack program — skip internal
   * cluster reordering and place in list order (still clusterByKey affinity).
   */
  itemsPreordered?: boolean;
  /**
   * Prefix for crate ids so successive place calls (route simulation) do not
   * collide when zone/index/size/commodity repeat.
   */
  idNamespace?: string;
};

function sizesForSegment(segment: CargoPlacementSegment): CargoBoxScu[] {
  if (segment.boxSizes && segment.boxSizes.length > 0) {
    return segment.boxSizes;
  }
  return decomposeScuIntoBoxes(segment.scu);
}

function itemClusterKey(item: CargoPlacementItem): string {
  return item.clusterKey ?? item.commoditySlug;
}

function itemClusterLabel(item: CargoPlacementItem): string {
  return item.clusterLabel ?? item.commodityName;
}

/**
 * Within one cluster: when prioritized, place later delivery stops before
 * earlier ones so first-to-unload ends up on higher layers (placer fills
 * bottom-up). Within the same stop, largest crates first.
 */
function sortItemsForStackPriority(
  items: CargoPlacementItem[],
  prioritized: boolean,
): void {
  items.sort((a, b) => {
    if (prioritized) {
      const rankA = a.missionRank ?? Number.POSITIVE_INFINITY;
      const rankB = b.missionRank ?? Number.POSITIVE_INFINITY;
      if (rankA !== rankB) return rankB - rankA;
    }
    if (a.size !== b.size) return b.size - a.size;
    return 0;
  });
}

/**
 * Place explicit crates into one bay zone. Optionally keeps each cluster
 * contiguous (by cargo type or by delivery location).
 */
export function placeCargoItemsInZone(
  sketch: ShipCargoGridSketch,
  zone: CargoGridStorageLocation,
  items: CargoPlacementItem[],
  options?: PlaceCargoInZoneOptions,
): CargoGridPlacementPlan {
  const bounds = zoneBoundsForStorage(sketch, zone);
  const boxes: PlacedCargoBox[] = [];
  const unplaced: CargoGridPlacementPlan["unplaced"] = [];
  const occupied = new Set<string>(
    [...(options?.occupied ?? [])].map(cargoGridCoordKey),
  );
  /** Cell → owning crate SCU (unknown prior occupancy treated as large support). */
  const occupiedSizes = new Map<string, number>();
  for (const key of occupied) {
    occupiedSizes.set(key, Number.POSITIVE_INFINITY);
  }
  const occupiedClusters =
    options?.occupiedClusters ?? new Map<string, string>();
  const occupiedRegions =
    options?.occupiedRegions ?? new Map<string, string>();

  if (!bounds) {
    for (const item of items) {
      unplaced.push({
        size: item.size,
        commoditySlug: item.commoditySlug,
        commodityName: item.commodityName,
      });
    }
    return { zone, boxes, unplaced };
  }

  const pending: CargoPlacementItem[] = [...items];
  const missionPriorityBias = options?.missionPriorityBias ?? null;
  const packSlotPolicy = options?.packSlotPolicy ?? null;
  const missionRankMax = pending.reduce(
    (max, item) => Math.max(max, item.missionRank ?? 0),
    0,
  );

  if (options?.itemsPreordered) {
    // Pack program already ordered items — keep list order.
  } else if (options?.clusterByKey) {
    const clusterOrder = options.clusterOrder ?? "rank-then-size";
    if (clusterOrder === "cargo-then-location") {
      // Load order: finish one cargo type across all mission piles, then the
      // next type (which may stack onto those piles).
      const byCommodity = new Map<string, CargoPlacementItem[]>();
      const commodityOrder: string[] = [];
      for (const item of pending) {
        const key = item.commoditySlug;
        const list = byCommodity.get(key);
        if (list) {
          list.push(item);
          continue;
        }
        byCommodity.set(key, [item]);
        commodityOrder.push(key);
      }
      commodityOrder.sort((a, b) => {
        const groupA = byCommodity.get(a)!;
        const groupB = byCommodity.get(b)!;
        const scuA = groupA.reduce((sum, item) => sum + item.size, 0);
        const scuB = groupB.reduce((sum, item) => sum + item.size, 0);
        if (scuA !== scuB) return scuB - scuA;
        return (groupA[0]?.commodityName ?? a).localeCompare(
          groupB[0]?.commodityName ?? b,
        );
      });
      pending.length = 0;
      for (const commodity of commodityOrder) {
        const group = byCommodity.get(commodity)!;
        const byLocation = new Map<string, CargoPlacementItem[]>();
        const locationOrder: string[] = [];
        for (const item of group) {
          const loc = item.regionKey ?? itemClusterKey(item);
          const list = byLocation.get(loc);
          if (list) {
            list.push(item);
            continue;
          }
          byLocation.set(loc, [item]);
          locationOrder.push(loc);
        }
        locationOrder.sort((a, b) => {
          const rankA = Math.min(
            ...(byLocation.get(a) ?? []).map(
              (item) => item.missionRank ?? missionRankMax,
            ),
          );
          const rankB = Math.min(
            ...(byLocation.get(b) ?? []).map(
              (item) => item.missionRank ?? missionRankMax,
            ),
          );
          if (rankA !== rankB) return rankA - rankB;
          return a.localeCompare(b);
        });
        for (const loc of locationOrder) {
          const locGroup = byLocation.get(loc)!;
          sortItemsForStackPriority(locGroup, Boolean(missionPriorityBias));
          pending.push(...locGroup);
        }
      }
    } else {
      // Group by cluster key; order by delivery rank when prioritized,
      // then by total SCU (largest cargo type first), then label.
      // Within a type: largest crates first; late deliveries before early
      // so first-to-deliver ends up on higher layers.
      const byKey = new Map<string, CargoPlacementItem[]>();
      const keyOrder: string[] = [];
      for (const item of pending) {
        const key = itemClusterKey(item);
        const list = byKey.get(key);
        if (list) {
          list.push(item);
          continue;
        }
        byKey.set(key, [item]);
        keyOrder.push(key);
      }
      keyOrder.sort((a, b) => {
        const groupA = byKey.get(a)!;
        const groupB = byKey.get(b)!;
        if (missionPriorityBias) {
          const rankA = Math.min(
            ...groupA.map((item) => item.missionRank ?? missionRankMax),
          );
          const rankB = Math.min(
            ...groupB.map((item) => item.missionRank ?? missionRankMax),
          );
          if (rankA !== rankB) return rankA - rankB;
        }
        const scuA = groupA.reduce((sum, item) => sum + item.size, 0);
        const scuB = groupB.reduce((sum, item) => sum + item.size, 0);
        if (scuA !== scuB) return scuB - scuA;
        return itemClusterLabel(groupA[0]!).localeCompare(
          itemClusterLabel(groupB[0]!),
        );
      });
      pending.length = 0;
      for (const key of keyOrder) {
        const group = byKey.get(key)!;
        sortItemsForStackPriority(group, Boolean(missionPriorityBias));
        pending.push(...group);
      }
    }
  } else {
    pending.sort((a, b) => b.size - a.size);
  }

  let index = 0;
  for (const item of pending) {
    const clusterKey = itemClusterKey(item);
    const regionKey = item.regionKey;
    const preferRegionStacking =
      options?.preferRegionStacking ||
      Boolean(packSlotPolicy?.preferSameDeliveryLocation);
    const requireRegionContiguity =
      options?.requireRegionContiguity ||
      Boolean(packSlotPolicy?.requireRegionContiguity);
    const forbidForeignRegionSupport =
      options?.forbidForeignRegionSupport ||
      Boolean(packSlotPolicy?.forbidForeignSupport);
    const cluster: FindSlotCluster | null =
      options?.clusterByKey || packSlotPolicy
        ? {
            clusterKey,
            occupiedClusters,
            regionKey,
            occupiedRegions,
            preferRegionStacking,
            requireRegionContiguity,
            forbidForeignRegionSupport,
            preferBayEnd: item.preferBayEnd,
            missionRank: item.missionRank,
            missionRankMax,
            missionPriorityBias:
              missionPriorityBias ??
              packSlotPolicy?.biasXyMode ??
              undefined,
            packSlotPolicy,
          }
        : null;
    let placed = false;
    for (const footprint of cargoBoxOrientations(item.size)) {
      const origin = findSlot(
        bounds,
        footprint,
        occupied,
        occupiedSizes,
        zone,
        cluster,
      );
      if (!origin) continue;
      const cells = cellsForBox(origin, footprint);
      for (const cell of cells) {
        const key = cargoGridCoordKey(cell);
        occupied.add(key);
        occupiedSizes.set(key, item.size);
        occupiedClusters.set(key, clusterKey);
        if (regionKey) occupiedRegions.set(key, regionKey);
      }
      const idRoot = options?.idNamespace ?? zone;
      boxes.push({
        id: `${idRoot}-${index}-${item.size}-${clusterKey}`,
        size: item.size,
        origin,
        footprint,
        commoditySlug: item.commoditySlug,
        commodityName: item.commodityName,
        color: item.color,
        color2: item.color2,
        cells,
        action: item.action,
        deliveryLocationSlug: item.deliveryLocationSlug,
        deliveryLocationName: item.deliveryLocationName,
        locationGroupIndex: item.locationGroupIndex,
      });
      index += 1;
      placed = true;
      break;
    }
    if (!placed) {
      unplaced.push({
        size: item.size,
        commoditySlug: item.commoditySlug,
        commodityName: item.commodityName,
      });
    }
  }

  return { zone, boxes, unplaced };
}

/**
 * Place crates for one bay zone: decompose each segment with 8/4/2/1,
 * largest crates first, fill lower layers before stacking, prefer smaller
 * crates on larger ones. Never reuses a cell listed in `occupied` or claimed
 * earlier in this call.
 */
export function placeCargoInZone(
  sketch: ShipCargoGridSketch,
  zone: CargoGridStorageLocation,
  segments: CargoPlacementSegment[],
  options?: PlaceCargoInZoneOptions,
): CargoGridPlacementPlan {
  const items: CargoPlacementItem[] = [];
  for (const segment of segments) {
    for (const size of sizesForSegment(segment)) {
      items.push({
        size,
        commoditySlug: segment.commoditySlug,
        commodityName: segment.commodityName,
        color: segment.color,
        color2: segment.color2,
      });
    }
  }
  return placeCargoItemsInZone(sketch, zone, items, options);
}

function resolveCargoRole(
  routeAction: RouteAction,
  role: CargoDelivery["role"],
): "pickup" | "delivery" | null {
  if (role) return role;
  if (routeAction === "pickup" || routeAction === "delivery") return routeAction;
  return null;
}

function lotKey(
  zone: CargoGridStorageLocation,
  commoditySlug: string,
): string {
  return `${zone}:${commoditySlug}`;
}

type OnboardLot = {
  zone: CargoGridStorageLocation;
  commoditySlug: string;
  commodityName: string;
  color: string | null;
  color2: string | null;
  boxes: PlacedCargoBox[];
  cells: CargoGridCoord[];
};

function syncLotCells(lot: OnboardLot) {
  lot.cells = lot.boxes.flatMap((box) => box.cells);
}

type LotCellRef = {
  lot: OnboardLot;
  box: PlacedCargoBox;
  cell: CargoGridCoord;
};

type GapXRange = { xStart: number; xEnd: number };

/** Nose→ramp X spans of gap / walkway zones (e.g. C2 mid-gap). */
function gapXRangesForSketch(sketch: ShipCargoGridSketch): GapXRange[] {
  const ranges: GapXRange[] = [];
  let x = 0;
  for (const zone of sketch.zones) {
    if (zone.kind === "gap") {
      ranges.push({ xStart: x, xEnd: x + zone.lengthCells });
    }
    x += zone.lengthCells;
  }
  return ranges;
}

/** Distance along X to the nearest gap block (larger = farther from walkway). */
function distanceFromGaps(cell: CargoGridCoord, gaps: GapXRange[]): number {
  if (gaps.length === 0) return 0;
  let min = Infinity;
  for (const gap of gaps) {
    if (cell.x < gap.xStart) {
      min = Math.min(min, gap.xStart - cell.x);
    } else if (cell.x >= gap.xEnd) {
      min = Math.min(min, cell.x - (gap.xEnd - 1));
    } else {
      min = 0;
    }
  }
  return min === Infinity ? 0 : min;
}

/**
 * Highest Z first (don't dig under stacks), then farther from gap blocks
 * (C2: nose-side of front bay / ramp-side of rear bay before cells by the gap).
 */
function compareCellsUnloadPriority(
  a: CargoGridCoord,
  b: CargoGridCoord,
  gaps: GapXRange[],
): number {
  if (b.z !== a.z) return b.z - a.z;
  const distDelta = distanceFromGaps(b, gaps) - distanceFromGaps(a, gaps);
  if (distDelta !== 0) return distDelta;
  if (a.x !== b.x) return a.x - b.x;
  return a.y - b.y;
}

function listLotCellsUnloadPriority(
  queue: OnboardLot[],
  gaps: GapXRange[],
): LotCellRef[] {
  const refs: LotCellRef[] = [];
  for (const lot of queue) {
    for (const box of lot.boxes) {
      for (const cell of box.cells) {
        refs.push({ lot, box, cell });
      }
    }
  }
  refs.sort((a, b) => compareCellsUnloadPriority(a.cell, b.cell, gaps));
  return refs;
}

function removeEmptyBoxes(queue: OnboardLot[]) {
  for (let i = queue.length - 1; i >= 0; i -= 1) {
    const lot = queue[i]!;
    lot.boxes = lot.boxes.filter((box) => box.cells.length > 0);
    for (const box of lot.boxes) {
      box.size = box.cells.length;
      box.origin = box.cells[0] ?? box.origin;
    }
    syncLotCells(lot);
    if (lot.boxes.length === 0) queue.splice(i, 1);
  }
}

/**
 * Peek which cells a delivery of `scu` would unload. Prefers higher Z (top of
 * stack) and splits larger crates when the delivery is smaller than a crate.
 */
function peekScuFromLots(
  queue: OnboardLot[],
  scu: number,
  idPrefix: string,
  gaps: GapXRange[],
): PlacedCargoBox[] {
  const selected = listLotCellsUnloadPriority(queue, gaps).slice(
    0,
    Math.max(0, scu),
  );
  if (selected.length === 0) return [];

  // Group contiguous selections back into per-box view crates when possible.
  const byBox = new Map<PlacedCargoBox, CargoGridCoord[]>();
  for (const ref of selected) {
    const list = byBox.get(ref.box) ?? [];
    list.push({ ...ref.cell });
    byBox.set(ref.box, list);
  }

  const taken: PlacedCargoBox[] = [];
  let splitIndex = 0;
  for (const [box, cells] of byBox) {
    cells.sort((a, b) => compareCellsUnloadPriority(a, b, gaps));
    if (cells.length === box.cells.length) {
      taken.push({
        ...box,
        cells: cells.map((cell) => ({ ...cell })),
        origin: { ...box.origin },
        footprint: { ...box.footprint },
      });
      continue;
    }
    taken.push({
      id: `${idPrefix}-${box.id}-${splitIndex}`,
      size: cells.length,
      origin: { ...cells[0]! },
      footprint: { dx: 1, dy: 1, dz: 1 },
      commoditySlug: box.commoditySlug,
      commodityName: box.commodityName,
      color: box.color,
      color2: box.color2,
      cells,
    });
    splitIndex += 1;
  }
  return taken;
}

/** Unload `scu` preferring high Z then far-from-gap; frees occupied / splits. */
function consumeScuFromLots(
  queue: OnboardLot[],
  scu: number,
  occupied: Set<string>,
  gaps: GapXRange[],
): void {
  const selected = listLotCellsUnloadPriority(queue, gaps).slice(
    0,
    Math.max(0, scu),
  );
  if (selected.length === 0) return;

  const removeKeys = new Set(
    selected.map((ref) => cargoGridCoordKey(ref.cell)),
  );

  for (const key of removeKeys) {
    occupied.delete(key);
  }

  for (const lot of queue) {
    for (const box of lot.boxes) {
      box.cells = box.cells.filter(
        (cell) => !removeKeys.has(cargoGridCoordKey(cell)),
      );
    }
  }

  removeEmptyBoxes(queue);
}

function segmentFromCargo(cargo: CargoDelivery): CargoPlacementSegment {
  const commodity = getCommodityBySlug(cargo.commoditySlug);
  return {
    commoditySlug: cargo.commoditySlug,
    commodityName: commodity?.name ?? cargo.commoditySlug,
    scu: cargo.scu,
    color: commodity?.color ?? null,
    color2: commodity?.color2 ?? null,
    boxSizes: cargo.boxSizes,
  };
}

function splitRowCargo(row: HaulingChecklistRow): {
  deliveries: Array<{ cargo: CargoDelivery; storage: ShipStorageLocation }>;
  pickups: Array<{ cargo: CargoDelivery; storage: ShipStorageLocation }>;
} {
  const deliveries: Array<{
    cargo: CargoDelivery;
    storage: ShipStorageLocation;
  }> = [];
  const pickups: Array<{
    cargo: CargoDelivery;
    storage: ShipStorageLocation;
  }> = [];
  for (const cargo of row.cargoDeliveries) {
    const role = resolveCargoRole(row.routeAction, cargo.role);
    const storage = cargo.shipStorageLocation ?? row.shipStorageLocation;
    if (role === "delivery") deliveries.push({ cargo, storage });
    else if (role === "pickup") pickups.push({ cargo, storage });
  }
  return { deliveries, pickups };
}

/**
 * Walk the checklist in order. Pickups claim unique cells; deliveries free
 * matching FIFO lots so later pickups can reuse those coordinates.
 * At `both` stops, deliveries run before pickups.
 *
 * View plan for `stopId`: cargo delivered / picked up at this stop.
 * Pass `zone` to limit to one bay; omit for the whole location (all bays).
 * `stopId` is first (entity the call is about).
 */
export function packSuggestedAtStop(
  stopId: string,
  sketch: ShipCargoGridSketch,
  stops: HaulingChecklistRow[],
  zone?: CargoGridStorageLocation | null,
): CargoGridPlacementPlan {
  const rows = stops;
  const rowId = stopId;
  const occupied = new Set<string>();
  const lotsByKey = new Map<string, OnboardLot[]>();
  const gapRanges = gapXRangesForSketch(sketch);
  let pickupSeq = 0;

  const occupiedCoords = (): CargoGridCoord[] =>
    [...occupied].map((key) => {
      const [x, y, z] = key.split(",").map(Number);
      return { x: x!, y: y!, z: z! };
    });

  /** Prefer the tagged bay; if empty, fall back to any bay holding this commodity. */
  const lotsForDelivery = (
    cargo: CargoDelivery,
    storage: ShipStorageLocation,
  ): { key: string; queue: OnboardLot[] } => {
    const preferredKey = lotKey(storage, cargo.commoditySlug);
    const preferred = lotsByKey.get(preferredKey) ?? [];
    const preferredScu = preferred.reduce(
      (sum, lot) => sum + lot.boxes.reduce((n, box) => n + box.cells.length, 0),
      0,
    );
    if (preferredScu > 0) {
      return { key: preferredKey, queue: preferred };
    }
    for (const [key, queue] of lotsByKey) {
      if (!key.endsWith(`:${cargo.commoditySlug}`)) continue;
      const scu = queue.reduce(
        (sum, lot) =>
          sum + lot.boxes.reduce((n, box) => n + box.cells.length, 0),
        0,
      );
      if (scu > 0) return { key, queue };
    }
    return { key: preferredKey, queue: preferred };
  };

  const peekDeliverBoxes = (
    cargo: CargoDelivery,
    storage: ShipStorageLocation,
  ): PlacedCargoBox[] => {
    const { queue } = lotsForDelivery(cargo, storage);
    return peekScuFromLots(
      queue,
      cargo.scu,
      `deliver-${cargo.commoditySlug}`,
      gapRanges,
    );
  };

  const deliver = (
    cargo: CargoDelivery,
    storage: ShipStorageLocation,
  ) => {
    const { key, queue } = lotsForDelivery(cargo, storage);
    consumeScuFromLots(queue, cargo.scu, occupied, gapRanges);
    lotsByKey.set(key, queue);
  };

  const pickup = (
    cargo: CargoDelivery,
    storage: ShipStorageLocation,
  ): CargoGridPlacementPlan => {
    const segment = segmentFromCargo(cargo);
    const plan = placeCargoInZone(sketch, storage, [segment], {
      occupied: occupiedCoords(),
      idNamespace: `onboard-${pickupSeq++}`,
    });
    for (const box of plan.boxes) {
      for (const cell of box.cells) occupied.add(cargoGridCoordKey(cell));
    }
    if (plan.boxes.length > 0) {
      const lot: OnboardLot = {
        zone: storage,
        commoditySlug: cargo.commoditySlug,
        commodityName: segment.commodityName,
        color: segment.color,
        color2: segment.color2,
        boxes: [...plan.boxes],
        cells: plan.boxes.flatMap((box) => box.cells),
      };
      const key = lotKey(storage, cargo.commoditySlug);
      const queue = lotsByKey.get(key) ?? [];
      queue.push(lot);
      lotsByKey.set(key, queue);
    }
    return plan;
  };

  const viewBoxes: PlacedCargoBox[] = [];
  const viewUnplaced: CargoGridPlacementPlan["unplaced"] = [];
  const seenBoxIds = new Set<string>();

  const pushUniqueBoxes = (boxes: PlacedCargoBox[]) => {
    for (const box of boxes) {
      if (seenBoxIds.has(box.id)) continue;
      seenBoxIds.add(box.id);
      viewBoxes.push(box);
    }
  };

  const inViewZone = (storage: ShipStorageLocation) =>
    zone == null || storage === zone;

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex]!;
    const { deliveries, pickups } = splitRowCargo(row);
    const isTarget = row.id === rowId;
    const locationGroups = isTarget
      ? locationGroupIndexMap(upcomingDeliveryLocationSlugs(rows, rowId))
      : null;
    const pickupDeliveryPool = isTarget
      ? buildDeliveryScuPool(rows, rowIndex)
      : null;

    if (isTarget && locationGroups) {
      // Show crates leaving the bay(s) (find them before freeing cells).
      for (const { cargo, storage } of deliveries) {
        if (!inViewZone(storage)) continue;
        const splits = deliveryLocationScuSplitsForCargo(
          rows,
          rowIndex,
          cargo,
          "delivery",
        );
        pushUniqueBoxes(
          applyDeliveryLocationSplitsToBoxes(
            peekDeliverBoxes(cargo, storage),
            splits,
            locationGroups,
            "delivery",
          ),
        );
      }
    }

    for (const { cargo, storage } of deliveries) {
      deliver(cargo, storage);
    }

    for (const { cargo, storage } of pickups) {
      const plan = pickup(cargo, storage);
      if (isTarget && inViewZone(storage) && locationGroups && pickupDeliveryPool) {
        const splits = takeDeliveryLocationScuSplits(
          pickupDeliveryPool,
          cargo,
          cargo.scu,
        );
        pushUniqueBoxes(
          applyDeliveryLocationSplitsToBoxes(
            plan.boxes,
            splits,
            locationGroups,
            "pickup",
          ),
        );
        viewUnplaced.push(...plan.unplaced);
      }
    }

    if (isTarget) {
      // Also show cargo still aboard from earlier pickups (not just this
      // stop’s load/unload actions). Dedupes boxes already pushed above.
      if (locationGroups && pickupDeliveryPool) {
        for (const [, queue] of lotsByKey) {
          for (const lot of queue) {
            if (zone != null && lot.zone !== zone) continue;
            const aboardBoxes = lot.boxes.filter(
              (box) => !seenBoxIds.has(box.id),
            );
            if (aboardBoxes.length === 0) continue;
            const aboardScu = aboardBoxes.reduce(
              (sum, box) => sum + box.size,
              0,
            );
            const aboardCargo: CargoDelivery = {
              commoditySlug: lot.commoditySlug,
              scu: aboardScu,
            };
            const splits = takeDeliveryLocationScuSplits(
              pickupDeliveryPool,
              aboardCargo,
              aboardScu,
            );
            pushUniqueBoxes(
              applyDeliveryLocationSplitsToBoxes(
                aboardBoxes,
                splits,
                locationGroups,
              ),
            );
          }
        }
      }
      return {
        zone: zone ?? "front",
        boxes: viewBoxes,
        unplaced: viewUnplaced,
      };
    }
  }

  return {
    zone: zone ?? "front",
    boxes: viewBoxes,
    unplaced: viewUnplaced,
  };
}

/** How to organize crates in the session cargo-layout 3D/top view. */
export const cargoBayPackModes = [
  {
    id: "suggested",
    label: "Suggested",
    summary:
      "Use the AI / route-authored bay layout (chronological pickup and delivery placement).",
  },
  {
    id: "by-cargo-type",
    label: "Cargo type",
    summary: "Group crates by commodity, then pack into the ship bay.",
  },
  {
    id: "by-mission-location",
    label: "Contract based",
    summary:
      "First two delivery locations as exclusive piles (nothing stacked on them); remaining crates grouped by cargo type.",
  },
] as const;

export type CargoBayPackMode = (typeof cargoBayPackModes)[number]["id"];

export const defaultCargoBayPackMode: CargoBayPackMode = "suggested";

const storageBayOrder: CargoGridStorageLocation[] = [
  "front",
  "middle",
  "rear",
];

/**
 * Ships like the Centaurus map front/rear labels onto one physical hold.
 * Merge those item lists so we pack the bay once (otherwise the second pass
 * stacks on a full deck and crates look like they float off the grid).
 */
function mergeItemsByResolvedBay(
  sketch: ShipCargoGridSketch,
  itemsByStorage: Map<CargoGridStorageLocation, CargoPlacementItem[]>,
): Array<{ storage: CargoGridStorageLocation; items: CargoPlacementItem[] }> {
  const merged: Array<{
    storage: CargoGridStorageLocation;
    items: CargoPlacementItem[];
    key: string;
  }> = [];
  for (const storage of storageBayOrder) {
    const items = itemsByStorage.get(storage);
    if (!items || items.length === 0) continue;
    const bounds = zoneBoundsForStorage(sketch, storage);
    const key = bounds
      ? `${bounds.xStart}:${bounds.xEnd}:${bounds.yStart}:${bounds.yEnd}:${bounds.zEnd}`
      : `missing:${storage}`;
    const existing = merged.find((entry) => entry.key === key);
    if (existing) {
      existing.items.push(...items);
      continue;
    }
    merged.push({ storage, items: [...items], key });
  }
  return merged.map(({ storage, items }) => ({ storage, items }));
}

/**
 * Earliest delivery stop rank per cargo key (mission+commodity or commodity).
 * Rank 0 = first upcoming delivery in the route; higher = later.
 */
export function missionDeliveryRanks(
  rows: HaulingChecklistRow[],
  rowId: string,
): Map<string, number> {
  const from = rows.findIndex((row) => row.id === rowId);
  const start = from >= 0 ? from : 0;
  const firstStopIndex = new Map<string, number>();
  for (let index = start; index < rows.length; index += 1) {
    const { deliveries } = splitRowCargo(rows[index]!);
    for (const { cargo } of deliveries) {
      const key = cargo.missionId
        ? `${cargo.missionId}:${cargo.commoditySlug}`
        : cargo.commoditySlug;
      if (!firstStopIndex.has(key)) firstStopIndex.set(key, index);
    }
  }
  const uniqueStops = [...new Set(firstStopIndex.values())].sort(
    (a, b) => a - b,
  );
  const stopRank = new Map(uniqueStops.map((stop, rank) => [stop, rank]));
  const ranks = new Map<string, number>();
  for (const [key, stop] of firstStopIndex) {
    ranks.set(key, stopRank.get(stop) ?? 0);
  }
  return ranks;
}

function cargoMissionKey(cargo: CargoDelivery): string {
  return cargo.missionId
    ? `${cargo.missionId}:${cargo.commoditySlug}`
    : cargo.commoditySlug;
}

/** Per-stop delivery SCU taken from the route (location splits). */
export type DeliveryLocationScuSplit = {
  locationSlug: string;
  scu: number;
};

type DeliveryScuPoolEntry = {
  locationSlug: string;
  commoditySlug: string;
  missionId?: string;
  remaining: number;
};

function cargoMatchesDeliveryPoolEntry(
  cargo: CargoDelivery,
  entry: DeliveryScuPoolEntry,
): boolean {
  if (cargo.commoditySlug !== entry.commoditySlug) return false;
  if (cargo.missionId && entry.missionId) {
    return cargo.missionId === entry.missionId;
  }
  // Route legs often omit missionId on one or both sides after merge.
  return true;
}

/**
 * Upcoming delivery amounts from stops after `fromRowIndex`, in route order.
 * Mutable pool — consume with `takeDeliveryLocationScuSplits` so multiple
 * pickup lines of the same commodity do not double-claim destinations.
 */
function buildDeliveryScuPool(
  rows: HaulingChecklistRow[],
  fromRowIndex: number,
): DeliveryScuPoolEntry[] {
  const pool: DeliveryScuPoolEntry[] = [];
  for (let index = fromRowIndex + 1; index < rows.length; index += 1) {
    const stop = rows[index]!;
    const { deliveries } = splitRowCargo(stop);
    for (const { cargo } of deliveries) {
      if (cargo.scu <= 0) continue;
      const existing = pool.find(
        (entry) =>
          entry.locationSlug === stop.locationSlug &&
          entry.commoditySlug === cargo.commoditySlug &&
          (entry.missionId ?? null) === (cargo.missionId ?? null),
      );
      if (existing) {
        existing.remaining += cargo.scu;
        continue;
      }
      pool.push({
        locationSlug: stop.locationSlug,
        commoditySlug: cargo.commoditySlug,
        missionId: cargo.missionId,
        remaining: cargo.scu,
      });
    }
  }
  return pool;
}

/**
 * Consume up to `scu` from the pool for this cargo line, returning the
 * location split amounts (route order).
 */
function takeDeliveryLocationScuSplits(
  pool: DeliveryScuPoolEntry[],
  cargo: CargoDelivery,
  scu: number,
): DeliveryLocationScuSplit[] {
  let remaining = Math.max(0, Math.floor(scu));
  if (remaining <= 0) return [];
  const splits: DeliveryLocationScuSplit[] = [];
  for (const entry of pool) {
    if (remaining <= 0) break;
    if (entry.remaining <= 0) continue;
    if (!cargoMatchesDeliveryPoolEntry(cargo, entry)) continue;
    const take = Math.min(remaining, entry.remaining);
    entry.remaining -= take;
    remaining -= take;
    const last = splits[splits.length - 1];
    if (last && last.locationSlug === entry.locationSlug) {
      last.scu += take;
    } else {
      splits.push({ locationSlug: entry.locationSlug, scu: take });
    }
  }
  return splits;
}

/**
 * Delivery destination splits for a cargo line at `rowIndex`.
 * Deliveries use this stop; pickups draw from upcoming delivery-leg amounts
 * (the real location splits on the route — no invented destinations).
 */
export function deliveryLocationScuSplitsForCargo(
  rows: HaulingChecklistRow[],
  rowIndex: number,
  cargo: CargoDelivery,
  action: CargoGridBoxAction,
): DeliveryLocationScuSplit[] {
  const row = rows[rowIndex];
  if (!row || cargo.scu <= 0) return [];
  if (action === "delivery") {
    return [{ locationSlug: row.locationSlug, scu: cargo.scu }];
  }
  const pool = buildDeliveryScuPool(rows, rowIndex);
  return takeDeliveryLocationScuSplits(pool, cargo, cargo.scu);
}

/** One commodity slice inside a hangar pile for a delivery location. */
export type PickupHangarPileSegment = {
  locationSlug: string;
  locationName: string;
  locationGroupIndex: number;
  commoditySlug: string;
  commodityName: string;
  color: string | null;
  color2: string | null;
  missionId: string | null;
  scu: number;
  sizes: CargoBoxScu[];
};

/**
 * Attribute this stop’s pickup crates to upcoming delivery locations
 * (shared pool — same rules as mission-based bay packing).
 * Used by the pickup pad “Piles” view.
 */
export function pickupHangarPileSegments(
  rows: HaulingChecklistRow[],
  rowId: string,
): PickupHangarPileSegment[] {
  const rowIndex = rows.findIndex((row) => row.id === rowId);
  if (rowIndex < 0) return [];
  const row = rows[rowIndex]!;
  const { pickups } = splitRowCargo(row);
  if (pickups.length === 0) return [];

  const locationOrder = upcomingDeliveryLocationSlugs(rows, rowId);
  const locationGroups = locationGroupIndexMap(locationOrder);
  const pool = buildDeliveryScuPool(rows, rowIndex);
  const merged = new Map<string, PickupHangarPileSegment>();

  for (const { cargo } of pickups) {
    if (cargo.scu <= 0) continue;
    const segment = segmentFromCargo(cargo);
    const splits = takeDeliveryLocationScuSplits(pool, cargo, cargo.scu);
    if (splits.length === 0) continue;
    const byLocation = sizesByDeliveryLocation(segment, splits);
    for (const slice of byLocation) {
      if (!slice.locationSlug || slice.sizes.length === 0) continue;
      const scu = slice.sizes.reduce((sum, size) => sum + size, 0);
      if (scu <= 0) continue;
      const key = `${slice.locationSlug}::${segment.commoditySlug}::${cargo.missionId ?? "_"}`;
      const existing = merged.get(key);
      if (existing) {
        existing.scu += scu;
        existing.sizes.push(...slice.sizes);
        continue;
      }
      merged.set(key, {
        locationSlug: slice.locationSlug,
        locationName:
          getLocationBySlug(slice.locationSlug)?.name ?? slice.locationSlug,
        locationGroupIndex: locationGroups.get(slice.locationSlug) ?? 0,
        commoditySlug: segment.commoditySlug,
        commodityName: segment.commodityName,
        color: segment.color,
        color2: segment.color2,
        missionId: cargo.missionId ?? null,
        scu,
        sizes: [...slice.sizes],
      });
    }
  }

  return [...merged.values()].sort((a, b) => {
    const loc =
      (a.locationGroupIndex || 99) - (b.locationGroupIndex || 99) ||
      a.locationSlug.localeCompare(b.locationSlug);
    if (loc !== 0) return loc;
    return b.scu - a.scu || a.commodityName.localeCompare(b.commodityName);
  });
}

/**
 * Partition explicit crate sizes across location SCU splits when every box
 * fits a remaining destination; otherwise null (caller decomposes per split).
 */
function partitionBoxSizesAcrossLocationSplits(
  boxSizes: CargoBoxScu[],
  splits: DeliveryLocationScuSplit[],
): Array<{ locationSlug: string; sizes: CargoBoxScu[] }> | null {
  if (boxSizes.length === 0 || splits.length === 0) return null;
  const ordered = [...boxSizes].sort((a, b) => b - a);
  const alloc = splits.map((split) => ({
    locationSlug: split.locationSlug,
    remaining: split.scu,
    sizes: [] as CargoBoxScu[],
  }));
  for (const box of ordered) {
    const hit = alloc.find((entry) => entry.remaining >= box);
    if (!hit) return null;
    hit.sizes.push(box);
    hit.remaining -= box;
  }
  if (alloc.some((entry) => entry.remaining !== 0)) return null;
  return alloc.map(({ locationSlug, sizes }) => ({ locationSlug, sizes }));
}

/**
 * Build per-destination crate lists from route location splits so each box
 * can be filtered by delivery stop.
 */
function sizesByDeliveryLocation(
  segment: CargoPlacementSegment,
  splits: DeliveryLocationScuSplit[],
): Array<{ locationSlug: string; sizes: CargoBoxScu[] }> {
  if (splits.length === 0) {
    return [{ locationSlug: "", sizes: sizesForSegment(segment) }];
  }
  if (splits.length === 1) {
    const only = splits[0]!;
    if (segment.boxSizes && segment.scu === only.scu) {
      return [
        {
          locationSlug: only.locationSlug,
          sizes: sizesForSegment(segment),
        },
      ];
    }
    return [
      {
        locationSlug: only.locationSlug,
        sizes: decomposeScuIntoBoxes(
          only.scu,
          maxCargoBoxScu(segment.boxSizes),
        ),
      },
    ];
  }
  if (segment.boxSizes && segment.boxSizes.length > 0) {
    const partitioned = partitionBoxSizesAcrossLocationSplits(
      segment.boxSizes,
      splits,
    );
    if (partitioned) return partitioned;
  }
  // Keep contract max container size when partition cannot assign whole crates.
  const maxBox = maxCargoBoxScu(segment.boxSizes);
  return splits.map((split) => ({
    locationSlug: split.locationSlug,
    sizes: decomposeScuIntoBoxes(split.scu, maxBox),
  }));
}

function locationMetaForSlug(
  locationSlug: string,
  locationGroups: Map<string, number>,
): {
  deliveryLocationSlug?: string;
  deliveryLocationName?: string;
  locationGroupIndex?: number;
} {
  if (!locationSlug) return {};
  return {
    deliveryLocationSlug: locationSlug,
    deliveryLocationName:
      getLocationBySlug(locationSlug)?.name ?? locationSlug,
    locationGroupIndex: locationGroups.get(locationSlug),
  };
}

/**
 * Stamp delivery locations onto already-placed boxes using route SCU splits
 * (best-effort whole-crate assignment when sizes do not cross-cut cleanly).
 */
function applyDeliveryLocationSplitsToBoxes(
  boxes: PlacedCargoBox[],
  splits: DeliveryLocationScuSplit[],
  locationGroups: Map<string, number>,
  action?: CargoGridBoxAction,
): PlacedCargoBox[] {
  const withAction = (
    box: PlacedCargoBox,
    meta: ReturnType<typeof locationMetaForSlug> = {},
  ): PlacedCargoBox =>
    action != null ? { ...box, action, ...meta } : { ...box, ...meta };

  if (boxes.length === 0) return boxes;
  if (splits.length === 0) {
    return boxes.map((box) => withAction(box));
  }
  if (splits.length === 1) {
    const meta = locationMetaForSlug(splits[0]!.locationSlug, locationGroups);
    return boxes.map((box) => withAction(box, meta));
  }

  const pending = boxes
    .map((box) => ({ box, assigned: false }))
    .sort((a, b) => b.box.size - a.box.size);
  const tagged: PlacedCargoBox[] = [];
  const needBySlug = new Map(
    splits.map((split) => [split.locationSlug, split.scu]),
  );

  for (const split of splits) {
    let need = needBySlug.get(split.locationSlug) ?? 0;
    const meta = locationMetaForSlug(split.locationSlug, locationGroups);
    // Prefer exact-fit crates, then largest that still fits.
    while (need > 0) {
      const exact = pending.find(
        (entry) => !entry.assigned && entry.box.size === need,
      );
      const fit =
        exact ??
        pending
          .filter((entry) => !entry.assigned && entry.box.size <= need)
          .sort((a, b) => b.box.size - a.box.size)[0];
      if (!fit) break;
      fit.assigned = true;
      need -= fit.box.size;
      tagged.push(withAction(fit.box, meta));
    }
    needBySlug.set(split.locationSlug, need);
  }

  for (const entry of pending) {
    if (entry.assigned) continue;
    // Leftover crate: attach to the split that still needs the most SCU.
    let bestSlug = splits[0]!.locationSlug;
    let bestNeed = needBySlug.get(bestSlug) ?? 0;
    for (const split of splits) {
      const need = needBySlug.get(split.locationSlug) ?? 0;
      if (need > bestNeed) {
        bestNeed = need;
        bestSlug = split.locationSlug;
      }
    }
    const meta = locationMetaForSlug(bestSlug, locationGroups);
    const need = needBySlug.get(bestSlug) ?? 0;
    needBySlug.set(bestSlug, Math.max(0, need - entry.box.size));
    tagged.push(withAction(entry.box, meta));
  }

  return tagged;
}

/** Stable 1-based indexes for delivery-location filter / outlines. */
function locationGroupIndexMap(slugs: Iterable<string>): Map<string, number> {
  const map = new Map<string, number>();
  for (const slug of slugs) {
    if (!slug || map.has(slug)) continue;
    map.set(slug, map.size + 1);
  }
  return map;
}

/**
 * Upcoming delivery location slugs from this stop forward
 * (same order mission-based packing uses).
 */
export function upcomingDeliveryLocationSlugs(
  rows: HaulingChecklistRow[],
  rowId: string,
): string[] {
  const from = rows.findIndex((row) => row.id === rowId);
  if (from < 0) return [];
  const order: string[] = [];
  for (let index = from; index < rows.length; index += 1) {
    const stop = rows[index]!;
    const { deliveries } = splitRowCargo(stop);
    if (deliveries.length === 0) continue;
    if (!order.includes(stop.locationSlug)) {
      order.push(stop.locationSlug);
    }
  }
  return order;
}

/** Soft (unplaced) onboard lot used when re-packing by cargo type / contract. */
type SoftOnboardLot = {
  storage: ShipStorageLocation;
  cargo: CargoDelivery;
};

/** One cargo line visible in the bay at a stop (Suggested parity). */
type SoftVisibleCargo = {
  cargo: CargoDelivery;
  storage: ShipStorageLocation;
  action: CargoGridBoxAction;
};

function softLotKey(
  storage: ShipStorageLocation,
  commoditySlug: string,
): string {
  return `${storage}:${commoditySlug}`;
}

function addSoftOnboardLot(
  lots: Map<string, SoftOnboardLot>,
  storage: ShipStorageLocation,
  cargo: CargoDelivery,
): void {
  const key = softLotKey(storage, cargo.commoditySlug);
  const existing = lots.get(key);
  if (existing) {
    existing.cargo = {
      ...existing.cargo,
      scu: existing.cargo.scu + cargo.scu,
    };
    return;
  }
  lots.set(key, {
    storage,
    cargo: { ...cargo },
  });
}

/** How much of `cargo` is currently aboard in soft lots (preferred bay first). */
function availableSoftOnboardScu(
  lots: Map<string, SoftOnboardLot>,
  storage: ShipStorageLocation,
  cargo: CargoDelivery,
): number {
  let available = 0;
  const preferredKey = softLotKey(storage, cargo.commoditySlug);
  const preferred = lots.get(preferredKey);
  if (preferred) available += preferred.cargo.scu;
  for (const [key, lot] of lots) {
    if (key === preferredKey) continue;
    if (!key.endsWith(`:${cargo.commoditySlug}`)) continue;
    available += lot.cargo.scu;
  }
  return Math.min(cargo.scu, available);
}

/**
 * Subtract SCU from soft lots (prefer tagged bay, else any bay with commodity).
 * Mirrors Suggested’s `lotsForDelivery` fallback. Returns SCU actually removed.
 */
function consumeSoftOnboardLot(
  lots: Map<string, SoftOnboardLot>,
  storage: ShipStorageLocation,
  cargo: CargoDelivery,
): number {
  let remaining = cargo.scu;
  if (remaining <= 0) return 0;
  let taken = 0;

  const preferredKey = softLotKey(storage, cargo.commoditySlug);
  const preferred = lots.get(preferredKey);
  if (preferred && preferred.cargo.scu > 0) {
    const take = Math.min(remaining, preferred.cargo.scu);
    preferred.cargo = { ...preferred.cargo, scu: preferred.cargo.scu - take };
    remaining -= take;
    taken += take;
    if (preferred.cargo.scu <= 0) lots.delete(preferredKey);
  }

  if (remaining <= 0) return taken;

  for (const [key, lot] of lots) {
    if (remaining <= 0) break;
    if (!key.endsWith(`:${cargo.commoditySlug}`)) continue;
    if (lot.cargo.scu <= 0) continue;
    const take = Math.min(remaining, lot.cargo.scu);
    lot.cargo = { ...lot.cargo, scu: lot.cargo.scu - take };
    remaining -= take;
    taken += take;
    if (lot.cargo.scu <= 0) lots.delete(key);
  }
  return taken;
}

/**
 * Cargo visible in the bay at `rowId` (Suggested parity):
 * aboard deliveries leaving + this stop’s pickups + cargo still aboard from earlier pickups.
 * Returns null when `rowId` is missing.
 */
function collectSoftVisibleCargoAtStop(
  rows: HaulingChecklistRow[],
  rowId: string,
): SoftVisibleCargo[] | null {
  const rowIndex = rows.findIndex((entry) => entry.id === rowId);
  if (rowIndex < 0) return null;

  const softLots = new Map<string, SoftOnboardLot>();
  const visible: SoftVisibleCargo[] = [];

  for (let index = 0; index <= rowIndex; index += 1) {
    const stop = rows[index]!;
    const { deliveries, pickups } = splitRowCargo(stop);
    const isTarget = index === rowIndex;

    if (!isTarget) {
      for (const { cargo, storage } of deliveries) {
        consumeSoftOnboardLot(softLots, storage, cargo);
      }
      for (const { cargo, storage } of pickups) {
        addSoftOnboardLot(softLots, storage, cargo);
      }
      continue;
    }

    for (const { cargo, storage } of deliveries) {
      const aboard = availableSoftOnboardScu(softLots, storage, cargo);
      if (aboard > 0) {
        visible.push({
          cargo: { ...cargo, scu: aboard },
          storage,
          action: "delivery",
        });
      }
      consumeSoftOnboardLot(softLots, storage, cargo);
    }
    for (const { cargo, storage } of pickups) {
      visible.push({ cargo, storage, action: "pickup" });
    }
    for (const lot of softLots.values()) {
      if (lot.cargo.scu <= 0) continue;
      visible.push({
        cargo: lot.cargo,
        storage: lot.storage,
        action: "pickup",
      });
    }
  }

  return visible;
}

/**
 * Pack crates aboard at this stop by commodity into each bay:
 * same cargo type clusters together (missions merged), using configured
 * `boxSizes` when present, and fitting against the ship grid rules.
 *
 * Includes cargo still aboard from earlier pickups (not only the current stop’s cargo),
 * matching Suggested’s before-delivery inventory.
 * `stopId` is first (entity the call is about).
 */
export function packByCargoTypeAtStop(
  stopId: string,
  sketch: ShipCargoGridSketch,
  stops: HaulingChecklistRow[],
  options?: {
    missionPrioritized?: boolean;
    /** When set, order + slot pick come from the pack program. */
    packProgram?: CargoBayPackProgram;
    packSlotPolicy?: PackSlotPolicy | null;
  },
): CargoGridPlacementPlan {
  const rows = stops;
  const rowId = stopId;
  const rowIndex = rows.findIndex((entry) => entry.id === rowId);
  const visible = collectSoftVisibleCargoAtStop(rows, rowId);
  if (rowIndex < 0 || !visible) {
    return { zone: "front", boxes: [], unplaced: [] };
  }

  const missionPrioritized = Boolean(options?.missionPrioritized);
  const shipPrefs = getShipBayPreferenceFixture(sketch.shipSlug);
  const missionPriorityBias =
    missionPrioritized && shipPrefs.missionPriorityPacking
      ? shipPrefs.missionPriorityPacking.bias
      : null;
  const packSlotPolicy = options?.packSlotPolicy ?? null;
  const packProgram = options?.packProgram ?? null;

  // Rank by upcoming delivery *stop* (0 = first unload), not by mission
  // first-seen — multi-stop contracts split crates across locations.
  const locationOrder = upcomingDeliveryLocationSlugs(rows, rowId);
  const locationGroups = locationGroupIndexMap(locationOrder);
  const defaultRank = locationOrder.length;
  // Shared pool so multi-mission aggregates still map boxes to real unload stops.
  const deliveryPool = buildDeliveryScuPool(rows, rowIndex);

  const itemsByStorage = new Map<
    CargoGridStorageLocation,
    CargoPlacementItem[]
  >();

  for (const { cargo, storage, action } of visible) {
    const segment = segmentFromCargo(cargo);
    const splits =
      action === "delivery"
        ? deliveryLocationScuSplitsForCargo(rows, rowIndex, cargo, action)
        : takeDeliveryLocationScuSplits(deliveryPool, cargo, cargo.scu);
    const list = itemsByStorage.get(storage) ?? [];
    for (const { locationSlug, sizes } of sizesByDeliveryLocation(
      segment,
      splits,
    )) {
      const meta = locationMetaForSlug(locationSlug, locationGroups);
      const missionRank = missionPrioritized
        ? locationSlug
          ? locationGroups.has(locationSlug)
            ? locationGroups.get(locationSlug)! - 1
            : defaultRank
          : defaultRank
        : undefined;
      for (const size of sizes) {
        list.push({
          size,
          commoditySlug: segment.commoditySlug,
          commodityName: segment.commodityName,
          color: segment.color,
          color2: segment.color2,
          action,
          missionRank,
          ...meta,
        });
      }
    }
    itemsByStorage.set(storage, list);
  }

  const occupied: CargoGridCoord[] = [];
  const occupiedClusters = new Map<string, string>();
  const boxes: PlacedCargoBox[] = [];
  const unplaced: CargoGridPlacementPlan["unplaced"] = [];

  for (const { storage, items } of mergeItemsByResolvedBay(
    sketch,
    itemsByStorage,
  )) {
    let ordered = items;
    let itemsPreordered = false;
    if (packProgram) {
      ordered = orderPackItemsByProgram(items, packProgram);
      itemsPreordered = true;
    }
    const placed = placeCargoItemsInZone(sketch, storage, ordered, {
      occupied,
      occupiedClusters,
      clusterByKey: true,
      missionPriorityBias,
      packSlotPolicy,
      itemsPreordered,
    });
    boxes.push(...placed.boxes);
    unplaced.push(...placed.unplaced);
    for (const box of placed.boxes) {
      occupied.push(...box.cells);
    }
  }

  return {
    zone: "front",
    boxes,
    unplaced,
  };
}

/** First N upcoming delivery locations get exclusive accessible piles. */
const MISSION_PRIORITY_LOCATION_COUNT = 2;

/**
 * Pack deliveries from a trip stop id (bay plan for when you are at that stop).
 * Groups for easy unload by upcoming destinations:
 * 1) First delivery location — one tight pile, nothing else on top
 * 2) Second location — same
 * 3) Everything else — group by cargo type (not location)
 *
 * Uses the same aboard inventory as Suggested / Cargo type (earlier pickups +
 * this stop’s pickups + deliveries that are actually loaded) — never packs
 * future deliveries that are not yet aboard.
 *
 * `stopId` is first: the stop the plan is for (not a grid-cell “origin”).
 */
export function packDeliveriesFromStop(
  stopId: string,
  sketch: ShipCargoGridSketch,
  stops: HaulingChecklistRow[],
  options?: {
    priorityLocationCount?: number;
    packProgram?: CargoBayPackProgram;
    packSlotPolicy?: PackSlotPolicy | null;
  },
): CargoGridPlacementPlan {
  const rows = stops;
  const from = rows.findIndex((row) => row.id === stopId);
  const visible = collectSoftVisibleCargoAtStop(rows, stopId);
  if (from < 0 || !visible) {
    return { zone: "front", boxes: [], unplaced: [] };
  }

  const priorityCount =
    options?.priorityLocationCount ?? MISSION_PRIORITY_LOCATION_COUNT;
  const packSlotPolicy = options?.packSlotPolicy ?? null;
  const packProgram = options?.packProgram ?? null;

  const locationOrder = upcomingDeliveryLocationSlugs(rows, stopId);
  const locationGroups = locationGroupIndexMap(locationOrder);
  const defaultRank = locationOrder.length;
  const deliveryPool = buildDeliveryScuPool(rows, from);
  const targetStop = rows[from]!;

  const itemsByStorage = new Map<
    CargoGridStorageLocation,
    CargoPlacementItem[]
  >();

  for (const { cargo, storage, action } of visible) {
    const segment = segmentFromCargo(cargo);
    const splits =
      action === "delivery"
        ? [
            {
              locationSlug: targetStop.locationSlug,
              scu: cargo.scu,
            },
          ]
        : takeDeliveryLocationScuSplits(deliveryPool, cargo, cargo.scu);
    const list = itemsByStorage.get(storage) ?? [];
    for (const { locationSlug, sizes } of sizesByDeliveryLocation(
      segment,
      splits,
    )) {
      const resolvedSlug = locationSlug || "";
      const missionRank = resolvedSlug
        ? locationGroups.has(resolvedSlug)
          ? locationGroups.get(resolvedSlug)! - 1
          : defaultRank
        : defaultRank;
      const locationGroupIndex =
        resolvedSlug && locationGroups.has(resolvedSlug)
          ? locationGroups.get(resolvedSlug)!
          : 0;
      const locationName = resolvedSlug
        ? (getLocationBySlug(resolvedSlug)?.name ?? resolvedSlug)
        : segment.commodityName;
      const isPriorityLocation = missionRank < priorityCount;
      // Priority missions sit on opposite ends (rear vs front), never mid-bay.
      const preferBayEnd: "low-x" | "high-x" | undefined = isPriorityLocation
        ? missionRank === 0
          ? "high-x"
          : "low-x"
        : undefined;

      for (const size of sizes) {
        list.push({
          size,
          commoditySlug: segment.commoditySlug,
          commodityName: segment.commodityName,
          color: segment.color,
          color2: segment.color2,
          action,
          missionRank,
          // Priority locations: whole stop is one pile. Rest: cargo type only.
          clusterKey: isPriorityLocation
            ? resolvedSlug || segment.commoditySlug
            : segment.commoditySlug,
          clusterLabel: isPriorityLocation
            ? locationName
            : segment.commodityName,
          regionKey: isPriorityLocation
            ? resolvedSlug || undefined
            : undefined,
          preferBayEnd,
          deliveryLocationSlug: resolvedSlug || undefined,
          deliveryLocationName: resolvedSlug ? locationName : undefined,
          locationGroupIndex: locationGroupIndex || undefined,
        });
      }
    }
    itemsByStorage.set(storage, list);
  }

  const occupied: CargoGridCoord[] = [];
  const occupiedClusters = new Map<string, string>();
  const occupiedRegions = new Map<string, string>();
  const boxes: PlacedCargoBox[] = [];
  const unplaced: CargoGridPlacementPlan["unplaced"] = [];

  const appendPlaced = (placed: CargoGridPlacementPlan) => {
    boxes.push(...placed.boxes);
    unplaced.push(...placed.unplaced);
    for (const box of placed.boxes) {
      occupied.push(...box.cells);
    }
  };

  for (const { storage, items } of mergeItemsByResolvedBay(
    sketch,
    itemsByStorage,
  )) {
    const priorityByRank: CargoPlacementItem[][] = Array.from(
      { length: priorityCount },
      () => [],
    );
    const restItems: CargoPlacementItem[] = [];
    for (const item of items) {
      const rank = item.missionRank ?? Number.POSITIVE_INFINITY;
      if (rank < priorityCount) {
        priorityByRank[rank]!.push(item);
      } else {
        restItems.push(item);
      }
    }

    const orderMaybe = (list: CargoPlacementItem[]) => {
      if (!packProgram) return { ordered: list, itemsPreordered: false };
      return {
        ordered: orderPackItemsByProgram(list, packProgram),
        itemsPreordered: true,
      };
    };

    for (const priorityItems of priorityByRank) {
      if (priorityItems.length === 0) continue;
      const { ordered, itemsPreordered } = orderMaybe(priorityItems);
      appendPlaced(
        placeCargoItemsInZone(sketch, storage, ordered, {
          occupied,
          occupiedClusters,
          occupiedRegions,
          clusterByKey: true,
          preferRegionStacking: true,
          requireRegionContiguity: true,
          forbidForeignRegionSupport: true,
          // End bias comes from preferBayEnd on each item, not rank/max.
          missionPriorityBias: null,
          packSlotPolicy,
          itemsPreordered,
        }),
      );
    }

    if (restItems.length > 0) {
      const { ordered, itemsPreordered } = orderMaybe(restItems);
      appendPlaced(
        placeCargoItemsInZone(sketch, storage, ordered, {
          occupied,
          occupiedClusters,
          occupiedRegions,
          clusterByKey: true,
          forbidForeignRegionSupport: true,
          // Fill leftover (typically mid-bay) by cargo type.
          missionPriorityBias: null,
          packSlotPolicy,
          itemsPreordered,
        }),
      );
    }
  }

  return { zone: "front", boxes, unplaced };
}

/** Flat set of all occupied cells in a plan (for view highlighting). */
export function placementPlanCells(
  plan: CargoGridPlacementPlan,
): CargoGridCoord[] {
  return plan.boxes.flatMap((box) => box.cells);
}

/** Per-cell commodity tint data for color-coded grid views. */
export type CargoGridPlacementTint = {
  coord: CargoGridCoord;
  commoditySlug: string;
  commodityName: string;
  color: string | null;
  color2: string | null;
  action?: CargoGridBoxAction;
};

export function placementPlanTints(
  plan: CargoGridPlacementPlan,
): CargoGridPlacementTint[] {
  return plan.boxes.flatMap((box) =>
    box.cells.map((coord) => ({
      coord,
      commoditySlug: box.commoditySlug,
      commodityName: box.commodityName,
      color: box.color,
      color2: box.color2,
      action: box.action,
    })),
  );
}

export type CargoBoxCountBySize = {
  size: number;
  count: number;
};

/** Unique commodities in placement order (for legends), with crate breakdown. */
export function placementPlanLegend(
  plan: CargoGridPlacementPlan,
): Array<{
  commoditySlug: string;
  commodityName: string;
  color: string | null;
  color2: string | null;
  scu: number;
  /** Counts of each physical crate size (8 / 4 / 2 / 1), largest first. */
  boxCounts: CargoBoxCountBySize[];
}> {
  const map = new Map<
    string,
    {
      commoditySlug: string;
      commodityName: string;
      color: string | null;
      color2: string | null;
      scu: number;
      sizeTallies: Map<number, number>;
    }
  >();
  for (const box of plan.boxes) {
    const existing = map.get(box.commoditySlug);
    if (existing) {
      existing.scu += box.size;
      existing.sizeTallies.set(
        box.size,
        (existing.sizeTallies.get(box.size) ?? 0) + 1,
      );
      continue;
    }
    map.set(box.commoditySlug, {
      commoditySlug: box.commoditySlug,
      commodityName: box.commodityName,
      color: box.color,
      color2: box.color2,
      scu: box.size,
      sizeTallies: new Map([[box.size, 1]]),
    });
  }
  return [...map.values()].map((entry) => ({
    commoditySlug: entry.commoditySlug,
    commodityName: entry.commodityName,
    color: entry.color,
    color2: entry.color2,
    scu: entry.scu,
    boxCounts: [...entry.sizeTallies.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([size, count]) => ({ size, count })),
  }));
}

/** e.g. "12×8" or "2×8 1×4 1×1". */
export function formatCargoBoxCounts(
  boxCounts: CargoBoxCountBySize[],
): string {
  if (boxCounts.length === 0) return "";
  return boxCounts.map(({ count, size }) => `${count}×${size}`).join(" ");
}

/**
 * Stroke colors for mission-based location groups (1-based index).
 * Ordered so neighbors are far apart on the hue wheel (no near-duplicates).
 */
export const locationGroupStrokePalette = [
  "var(--rsi-accent)", // blue
  "var(--rsi-warn)", // gold
  "var(--rsi-success)", // green
  "var(--rsi-danger)", // red
  "color-mix(in srgb, var(--rsi-accent) 45%, var(--rsi-danger))", // violet
  "color-mix(in srgb, var(--rsi-warn) 55%, var(--rsi-success))", // chartreuse
  "color-mix(in srgb, var(--rsi-accent) 50%, var(--rsi-success))", // teal
  "color-mix(in srgb, var(--rsi-danger) 55%, var(--rsi-warn))", // coral
] as const;

export function locationGroupStroke(index: number | undefined): string | null {
  if (index == null || index < 1) return null;
  return (
    locationGroupStrokePalette[
      (index - 1) % locationGroupStrokePalette.length
    ] ?? locationGroupStrokePalette[0]!
  );
}

export type PlacementLocationLegendItem = {
  locationSlug: string;
  locationName: string;
  groupIndex: number;
  stroke: string;
  scu: number;
};

/** Delivery-location groups for the bay legend / show-hide filter. */
export function placementPlanLocationLegend(
  plan: CargoGridPlacementPlan,
  options?: {
    /** When set, include every upcoming route location (even 0 SCU in this plan). */
    locationOrder?: string[];
  },
): PlacementLocationLegendItem[] {
  const scuBySlug = new Map<string, number>();
  const nameBySlug = new Map<string, string>();
  const indexBySlug = new Map<string, number>();
  for (const box of plan.boxes) {
    if (!box.deliveryLocationSlug) continue;
    scuBySlug.set(
      box.deliveryLocationSlug,
      (scuBySlug.get(box.deliveryLocationSlug) ?? 0) + box.size,
    );
    if (!nameBySlug.has(box.deliveryLocationSlug)) {
      nameBySlug.set(
        box.deliveryLocationSlug,
        box.deliveryLocationName ??
          getLocationBySlug(box.deliveryLocationSlug)?.name ??
          box.deliveryLocationSlug,
      );
    }
    if (
      box.locationGroupIndex != null &&
      !indexBySlug.has(box.deliveryLocationSlug)
    ) {
      indexBySlug.set(box.deliveryLocationSlug, box.locationGroupIndex);
    }
  }

  const order =
    options?.locationOrder && options.locationOrder.length > 0
      ? options.locationOrder
      : [...scuBySlug.keys()].sort(
          (a, b) => (indexBySlug.get(a) ?? 99) - (indexBySlug.get(b) ?? 99),
        );
  const fallbackIndexes = locationGroupIndexMap(order);

  return order.map((locationSlug, orderIndex) => {
    const groupIndex =
      indexBySlug.get(locationSlug) ??
      fallbackIndexes.get(locationSlug) ??
      orderIndex + 1;
    return {
      locationSlug,
      locationName:
        nameBySlug.get(locationSlug) ??
        getLocationBySlug(locationSlug)?.name ??
        locationSlug,
      groupIndex,
      scu: scuBySlug.get(locationSlug) ?? 0,
      stroke:
        locationGroupStroke(groupIndex) ?? locationGroupStrokePalette[0]!,
    };
  });
}
