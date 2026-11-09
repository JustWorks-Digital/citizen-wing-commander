import { getCommodityBySlug, getLocationBySlug } from "@/lib/fixtures";
import {
  cargoBoxOrientations,
  decomposeScuIntoBoxes,
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
import type {
  CargoDelivery,
  HaulingChecklistRow,
  LegKind,
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
   * When true, prefer stacking onto the same region (mixed cargo types OK)
   * instead of forcing each new cargo type onto empty deck.
   */
  preferRegionStacking?: boolean;
  /**
   * When the region already has cargo, only accept slots that touch it
   * (side-by-side or stacked) so mission groups stay one contiguous blob.
   */
  requireRegionContiguity?: boolean;
  /** 0 = earliest delivery; higher = later. */
  missionRank?: number;
  missionRankMax?: number;
  missionPriorityBias?: MissionPriorityPackBias;
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
 * True when every column under the footprint rests on the deck or on a crate
 * at least as large as `boxScu` (never larger-on-smaller).
 */
function hasValidSupport(
  origin: CargoGridCoord,
  footprint: CargoBoxFootprint,
  boxScu: number,
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
      if (supportSize < boxScu) return false;
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

/**
 * Early deliveries → edges (or center) based on ship bias.
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
  if (cluster.missionPriorityBias === "edges-first") {
    // Early: want high edge distance; late: want low (center).
    return edge * (1 - t) * 18 - edge * t * 18;
  }
  // center-first: early toward center, late toward edges
  return edge * t * 18 - edge * (1 - t) * 18;
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
    identicalSizeStack: boolean;
  };
  const preferRegionStacking = Boolean(cluster?.preferRegionStacking);
  const requireRegionContiguity = Boolean(cluster?.requireRegionContiguity);
  const candidates: Candidate[] = [];
  forEachPlacementOrigin(order, (origin) => {
    if (!fits(bounds, origin, footprint, occupied)) return;
    // Hard rule: larger crates never sit on smaller ones.
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
    // Identical SCU towers first (8 on 8, 4 on 4), then own-type contact.
    // Mission-based: reward stacking onto the same delivery-location pile even
    // when the cargo type differs (load one type, then the next on top).
    const offRegionOther = preferRegionStacking
      ? Math.max(0, supportCounts.other - regionSupport)
      : supportCounts.other;
    const score =
      scorePlacementSlot(ctx, origin) +
      (identicalSizeStack ? 80 : 0) +
      affinity.horizontal * 20 +
      affinity.vertical * 12 +
      regionPull.horizontal * (preferRegionStacking ? 18 : 8) +
      regionPull.vertical * (preferRegionStacking ? 14 : 4) +
      (origin.z === 0 ? 8 : 0) +
      supportCounts.same * 24 +
      (preferRegionStacking ? regionSupport * 36 : 0) +
      (touchesRegion && preferRegionStacking ? 40 : 0) -
      offRegionOther * 40 +
      missionPriorityScore(origin, footprint, bounds, cluster);
    candidates.push({
      origin,
      score,
      affinity,
      regionPull,
      onDeck: origin.z === 0,
      sameSupport: supportCounts.same,
      otherSupport: supportCounts.other,
      regionSupport,
      identicalSizeStack,
    });
  });
  if (candidates.length === 0) return null;

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
    c.regionPull.vertical > 0;

  let pool = candidates;

  // Mission groups must stay contiguous: once a location pile exists, every
  // new crate for that location must touch it (side or stack).
  if (requireRegionContiguity && hasRegion) {
    const touching = candidates.filter(touchesRegionPool);
    if (touching.length > 0) {
      const stackedOnRegion = touching.filter((c) => c.regionSupport > 0);
      const besideRegion = touching.filter(
        (c) => c.regionPull.horizontal > 0 || c.regionPull.vertical > 0,
      );
      if (hasCluster) {
        const identicalStacks = touching.filter(
          (c) => c.identicalSizeStack && c.otherSupport === 0,
        );
        const onOwn = touching.filter(
          (c) =>
            c.affinity.horizontal > 0 ||
            c.affinity.vertical > 0 ||
            c.sameSupport > 0,
        );
        if (identicalStacks.length > 0) pool = identicalStacks;
        else if (onOwn.length > 0) pool = onOwn;
        else if (stackedOnRegion.length > 0) pool = stackedOnRegion;
        else pool = besideRegion.length > 0 ? besideRegion : touching;
      } else if (stackedOnRegion.length > 0) {
        pool = stackedOnRegion;
      } else {
        pool = besideRegion.length > 0 ? besideRegion : touching;
      }

      let bestTouch: Candidate | null = null;
      for (const candidate of pool) {
        if (!bestTouch || candidate.score > bestTouch.score) bestTouch = candidate;
      }
      return bestTouch?.origin ?? null;
    }
    // No touching slot — refuse disconnected placement for this footprint.
    return null;
  }

  // New cargo-type pile.
  if (cluster != null && !hasCluster) {
    if (preferRegionStacking && hasRegion) {
      // Next cargo type: stack onto the existing location pile when possible.
      const stackedOnRegion = candidates.filter((c) => c.regionSupport > 0);
      const besideRegion = candidates.filter(touchesRegionPool);
      if (stackedOnRegion.length > 0) pool = stackedOnRegion;
      else if (besideRegion.length > 0) pool = besideRegion;
      else {
        const onDeck = candidates.filter((c) => c.onDeck);
        if (onDeck.length > 0) pool = onDeck;
      }
    } else {
      // Start on the deck so large crates form the base. Prefer beside the
      // same delivery-location region when set.
      const besideRegion = candidates.filter(
        (c) =>
          c.onDeck &&
          (c.regionPull.horizontal > 0 || c.regionPull.vertical > 0),
      );
      const onDeck = candidates.filter((c) => c.onDeck);
      if (besideRegion.length > 0) pool = besideRegion;
      else if (onDeck.length > 0) pool = onDeck;
    }
  }

  if (hasCluster) {
    // 1) Stack identical SCU sizes on themselves before anything else.
    const identicalStacks = candidates.filter(
      (c) => c.identicalSizeStack && c.otherSupport === 0,
    );
    // 2) Otherwise grow on our own pile (sideways or smaller-on-larger).
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
    if (identicalStacks.length > 0) {
      pool = identicalStacks;
    } else if (stackedOnOwn.length > 0 && boxScu <= 2) {
      // Remainders (2 / 1 SCU): sit on our own larger crates when we can.
      pool = stackedOnOwn;
    } else if (sideBySide.length > 0) {
      pool = sideBySide;
    } else if (sideOrOwnStack.length > 0) {
      pool = sideOrOwnStack;
    } else if (onOwn.length > 0) {
      pool = onOwn;
    } else if (preferRegionStacking && hasRegion) {
      const touching = candidates.filter(touchesRegionPool);
      if (touching.length > 0) pool = touching;
    }
  } else if (hasRegion && !preferRegionStacking) {
    // New cargo type inside an existing location blob: stay beside it.
    const besideRegion = candidates.filter(
      (c) => c.regionPull.horizontal > 0 || c.regionPull.vertical > 0,
    );
    if (besideRegion.length > 0) pool = besideRegion;
  }

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
   * Mission-based: allow / prefer stacking the next cargo type onto an
   * existing delivery-location pile.
   */
  preferRegionStacking?: boolean;
  /**
   * Mission-based: once a location pile exists, new crates must touch it.
   */
  requireRegionContiguity?: boolean;
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
  const missionRankMax = pending.reduce(
    (max, item) => Math.max(max, item.missionRank ?? 0),
    0,
  );

  if (options?.clusterByKey) {
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
          locGroup.sort((a, b) => b.size - a.size);
          pending.push(...locGroup);
        }
      }
    } else {
      // Group by cluster key; order by delivery rank when prioritized,
      // then by total SCU (largest cargo type first), then label.
      // Largest crates first within each group.
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
        group.sort((a, b) => b.size - a.size);
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
    const cluster: FindSlotCluster | null = options?.clusterByKey
      ? {
          clusterKey,
          occupiedClusters,
          regionKey,
          occupiedRegions,
          preferRegionStacking: options.preferRegionStacking,
          requireRegionContiguity: options.requireRegionContiguity,
          missionRank: item.missionRank,
          missionRankMax,
          missionPriorityBias: missionPriorityBias ?? undefined,
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
      boxes.push({
        id: `${zone}-${index}-${item.size}-${clusterKey}`,
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
  legKind: LegKind,
  role: CargoDelivery["role"],
): "pickup" | "delivery" | null {
  if (role) return role;
  if (legKind === "pickup" || legKind === "delivery") return legKind;
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
    const role = resolveCargoRole(row.legKind, cargo.role);
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
 * View plan for `rowId`: cargo delivered / picked up at this stop.
 * Pass `zone` to limit to one bay; omit for the whole location (all bays).
 */
export function planZoneOccupancyAtStop(
  sketch: ShipCargoGridSketch,
  rows: HaulingChecklistRow[],
  rowId: string,
  zone?: CargoGridStorageLocation | null,
): CargoGridPlacementPlan {
  const occupied = new Set<string>();
  const lotsByKey = new Map<string, OnboardLot[]>();
  const gapRanges = gapXRangesForSketch(sketch);

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
    label: "Mission based",
    summary:
      "Load one cargo type at a time into contiguous delivery-location piles; later types stack on those piles.",
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
    return [
      {
        locationSlug: only.locationSlug,
        sizes: sizesForSegment({
          ...segment,
          scu: only.scu,
          boxSizes:
            segment.boxSizes && segment.scu === only.scu
              ? segment.boxSizes
              : undefined,
        }),
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
  return splits.map((split) => ({
    locationSlug: split.locationSlug,
    sizes: decomposeScuIntoBoxes(split.scu),
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
  action: CargoGridBoxAction,
): PlacedCargoBox[] {
  if (boxes.length === 0) return boxes;
  if (splits.length === 0) {
    return boxes.map((box) => ({ ...box, action }));
  }
  if (splits.length === 1) {
    const meta = locationMetaForSlug(splits[0]!.locationSlug, locationGroups);
    return boxes.map((box) => ({ ...box, action, ...meta }));
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
      tagged.push({ ...fit.box, action, ...meta });
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
    tagged.push({ ...entry.box, action, ...meta });
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

/**
 * Pack this stop’s pickup/delivery crates by commodity into each bay:
 * same cargo type clusters together (missions merged), using configured
 * `boxSizes` when present, and fitting against the ship grid rules.
 */
export function planOccupancyByCargoTypeAtStop(
  sketch: ShipCargoGridSketch,
  rows: HaulingChecklistRow[],
  rowId: string,
  options?: { missionPrioritized?: boolean },
): CargoGridPlacementPlan {
  const row = rows.find((entry) => entry.id === rowId);
  if (!row) {
    return { zone: "front", boxes: [], unplaced: [] };
  }

  const missionPrioritized = Boolean(options?.missionPrioritized);
  const shipPrefs = getShipBayPreferenceFixture(sketch.shipSlug);
  const missionPriorityBias =
    missionPrioritized && shipPrefs.missionPriorityPacking
      ? shipPrefs.missionPriorityPacking.bias
      : null;
  const deliveryRanks = missionPrioritized
    ? missionDeliveryRanks(rows, rowId)
    : null;
  const defaultRank = deliveryRanks
    ? Math.max(0, ...deliveryRanks.values(), 0) + 1
    : 0;

  const { deliveries, pickups } = splitRowCargo(row);
  const rowIndex = rows.findIndex((entry) => entry.id === rowId);
  const locationGroups = locationGroupIndexMap(
    upcomingDeliveryLocationSlugs(rows, rowId),
  );
  // Shared pool so multi-mission aggregates still map boxes to real unload stops.
  const deliveryPool = buildDeliveryScuPool(rows, rowIndex);

  const itemsByStorage = new Map<
    CargoGridStorageLocation,
    CargoPlacementItem[]
  >();

  const pushCargo = (
    cargo: CargoDelivery,
    storage: ShipStorageLocation,
    action: CargoGridBoxAction,
  ) => {
    const segment = segmentFromCargo(cargo);
    const missionRank = deliveryRanks
      ? (deliveryRanks.get(cargoMissionKey(cargo)) ?? defaultRank)
      : undefined;
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
  };

  for (const { cargo, storage } of deliveries) {
    pushCargo(cargo, storage, "delivery");
  }
  for (const { cargo, storage } of pickups) {
    pushCargo(cargo, storage, "pickup");
  }

  const occupied: CargoGridCoord[] = [];
  const occupiedClusters = new Map<string, string>();
  const boxes: PlacedCargoBox[] = [];
  const unplaced: CargoGridPlacementPlan["unplaced"] = [];

  for (const storage of storageBayOrder) {
    const items = itemsByStorage.get(storage);
    if (!items || items.length === 0) continue;
    const placed = placeCargoItemsInZone(sketch, storage, items, {
      occupied,
      occupiedClusters,
      clusterByKey: true,
      missionPriorityBias,
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

/**
 * Pack remaining route deliveries as mission-location piles, loaded one cargo
 * type at a time: place each type into location piles (edge bias), then stack
 * the next type onto those piles. Early stops toward bay edges when the ship
 * bias says so.
 */
export function planOccupancyByMissionLocationAtStop(
  sketch: ShipCargoGridSketch,
  rows: HaulingChecklistRow[],
  rowId: string,
): CargoGridPlacementPlan {
  const from = rows.findIndex((row) => row.id === rowId);
  if (from < 0) {
    return { zone: "front", boxes: [], unplaced: [] };
  }

  const shipPrefs = getShipBayPreferenceFixture(sketch.shipSlug);
  const missionPriorityBias =
    shipPrefs.missionPriorityPacking?.bias ?? null;

  const locationOrder: string[] = [];
  const itemsByStorage = new Map<
    CargoGridStorageLocation,
    CargoPlacementItem[]
  >();

  for (let index = from; index < rows.length; index += 1) {
    const stop = rows[index]!;
    const { deliveries } = splitRowCargo(stop);
    if (deliveries.length === 0) continue;
    if (!locationOrder.includes(stop.locationSlug)) {
      locationOrder.push(stop.locationSlug);
    }
    const missionRank = locationOrder.indexOf(stop.locationSlug);
    const locationGroupIndex = missionRank + 1;
    const locationName =
      getLocationBySlug(stop.locationSlug)?.name ?? stop.locationSlug;

    for (const { cargo, storage } of deliveries) {
      const segment = segmentFromCargo(cargo);
      const list = itemsByStorage.get(storage) ?? [];
      for (const size of sizesForSegment(segment)) {
        list.push({
          size,
          commoditySlug: segment.commoditySlug,
          commodityName: segment.commodityName,
          color: segment.color,
          color2: segment.color2,
          action: "delivery",
          missionRank,
          // Hard cluster = cargo type within a location; region = location pile
          // so the next cargo type can stack onto the same mission group.
          clusterKey: `${stop.locationSlug}::${segment.commoditySlug}`,
          clusterLabel: `${segment.commodityName} · ${locationName}`,
          regionKey: stop.locationSlug,
          deliveryLocationSlug: stop.locationSlug,
          deliveryLocationName: locationName,
          locationGroupIndex,
        });
      }
      itemsByStorage.set(storage, list);
    }
  }

  const occupied: CargoGridCoord[] = [];
  const occupiedClusters = new Map<string, string>();
  const occupiedRegions = new Map<string, string>();
  const boxes: PlacedCargoBox[] = [];
  const unplaced: CargoGridPlacementPlan["unplaced"] = [];

  for (const storage of storageBayOrder) {
    const items = itemsByStorage.get(storage);
    if (!items || items.length === 0) continue;
    const placed = placeCargoItemsInZone(sketch, storage, items, {
      occupied,
      occupiedClusters,
      occupiedRegions,
      clusterByKey: true,
      clusterOrder: "cargo-then-location",
      preferRegionStacking: true,
      requireRegionContiguity: true,
      missionPriorityBias,
    });
    boxes.push(...placed.boxes);
    unplaced.push(...placed.unplaced);
    for (const box of placed.boxes) {
      occupied.push(...box.cells);
    }
  }

  return { zone: "front", boxes, unplaced };
}

export type PlanStopOccupancyOptions = {
  packMode?: CargoBayPackMode;
  /** Cargo type only: bias placement by upcoming delivery order (ship prefs). */
  missionPrioritized?: boolean;
};

/** Whole-stop bay plan (all front/middle/rear cargo at `rowId`). */
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
  const packMode = options.packMode ?? defaultCargoBayPackMode;
  switch (packMode) {
    case "suggested":
      return planZoneOccupancyAtStop(sketch, rows, rowId, null);
    case "by-cargo-type":
      return planOccupancyByCargoTypeAtStop(sketch, rows, rowId, {
        missionPrioritized: options.missionPrioritized,
      });
    case "by-mission-location":
      return planOccupancyByMissionLocationAtStop(sketch, rows, rowId);
    default: {
      const _exhaustive: never = packMode;
      return _exhaustive;
    }
  }
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
