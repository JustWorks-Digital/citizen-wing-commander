/**
 * Free stack room above a placed crate — drives 2D fill opacity.
 * Solid = no room on top; fainter = more free layers above.
 */

export type CargoBoxStackRoomFootprint = {
  id?: string;
  origin: { x: number; y: number; z: number };
  footprint: { dx: number; dy: number; dz: number };
};

function footprintsOverlapXY(
  a: CargoBoxStackRoomFootprint,
  b: CargoBoxStackRoomFootprint,
): boolean {
  return !(
    a.origin.x + a.footprint.dx <= b.origin.x ||
    b.origin.x + b.footprint.dx <= a.origin.x ||
    a.origin.y + a.footprint.dy <= b.origin.y ||
    b.origin.y + b.footprint.dy <= a.origin.y
  );
}

/**
 * Contiguous free Z cells above the box’s top face within its XY footprint,
 * until the bay ceiling or another overlapping crate.
 */
export function freeStackLayersAbove(
  box: CargoBoxStackRoomFootprint,
  boxes: readonly CargoBoxStackRoomFootprint[],
  heightCells: number,
): number {
  if (!Number.isFinite(heightCells) || heightCells <= 0) return 0;
  const topZ = box.origin.z + box.footprint.dz - 1;
  let free = 0;
  for (let z = topZ + 1; z < heightCells; z += 1) {
    const blocked = boxes.some((other) => {
      if (box.id != null && other.id != null && other.id === box.id) {
        return false;
      }
      if (other === box) return false;
      const otherBottom = other.origin.z;
      const otherTop = other.origin.z + other.footprint.dz - 1;
      if (z < otherBottom || z > otherTop) return false;
      return footprintsOverlapXY(box, other);
    });
    if (blocked) break;
    free += 1;
  }
  return free;
}

export type CargoBoxStackRoomRole = "solid" | "underlay" | "overlay";

/** Opaque fill when the stack is full (no free layers). */
export const STACK_ROOM_OPACITY_SOLID_FULL = 0.95;
/** Faintest solid fill when the bay has maximum free height above. */
export const STACK_ROOM_OPACITY_SOLID_OPEN = 0.48;
/** Near-solid underlay when nothing more fits on top. */
export const STACK_ROOM_OPACITY_UNDERLAY_FULL = 0.78;
/** Faintest underlay ghost when many layers remain open. */
export const STACK_ROOM_OPACITY_UNDERLAY_OPEN = 0.14;
/**
 * Bleed patch on a support crate (upper footprint tint). Strong enough to
 * read through the base color; hatch handles same-commodity stacks.
 */
export const STACK_ROOM_OPACITY_OVERLAY_FULL = 0.72;
/** Fainter bleed when the upper crate still has free room above it. */
export const STACK_ROOM_OPACITY_OVERLAY_OPEN = 0.42;

/**
 * How a crate paints as a 2D layer host.
 * - solid — intersects the active Z (interactive)
 * - underlay — entirely below (ghost footprint)
 * - overlay — entirely above (ghost footprint; also bleeds into supports via
 *   `cargoBoxesStackedAbove` when a solid is present)
 */
export function cargoBox2dLayerRole(
  box: CargoBoxStackRoomFootprint,
  activeLayer: number,
): "solid" | "underlay" | "overlay" | null {
  if (!Number.isFinite(activeLayer)) return null;
  const z = Math.floor(activeLayer);
  const topZ = box.origin.z + box.footprint.dz - 1;
  if (box.origin.z <= z && z <= topZ) return "solid";
  if (topZ < z) return "underlay";
  if (box.origin.z > z) return "overlay";
  return null;
}

/**
 * Crates above `support` that overlap its XY (for 2D bleed tint on the
 * active-layer base). Ordered bottom → top.
 */
export function cargoBoxesStackedAbove(
  support: CargoBoxStackRoomFootprint,
  boxes: readonly CargoBoxStackRoomFootprint[],
): CargoBoxStackRoomFootprint[] {
  const supportTop = support.origin.z + support.footprint.dz - 1;
  return boxes
    .filter((other) => {
      if (support.id != null && other.id != null && other.id === support.id) {
        return false;
      }
      if (other === support) return false;
      if (other.origin.z <= supportTop) return false;
      return footprintsOverlapXY(support, other);
    })
    .slice()
    .sort(
      (a, b) =>
        a.origin.z - b.origin.z ||
        (a.id ?? "").localeCompare(b.id ?? ""),
    );
}

/**
 * Map free stack layers → 2D crate opacity.
 * `freeLayers === 0` → opaque (cannot fit on top).
 * More free layers → lower opacity.
 */
export function cargoBoxStackRoomOpacity(
  freeLayers: number,
  heightCells: number,
  role: CargoBoxStackRoomRole = "solid",
): number {
  const maxFree = Math.max(1, Math.floor(heightCells) - 1);
  const free = Number.isFinite(freeLayers)
    ? Math.max(0, Math.min(maxFree, Math.floor(freeLayers)))
    : 0;
  // t=0 full (opaque); t=1 max open (faint).
  const t = free / maxFree;
  const full =
    role === "underlay"
      ? STACK_ROOM_OPACITY_UNDERLAY_FULL
      : role === "overlay"
        ? STACK_ROOM_OPACITY_OVERLAY_FULL
        : STACK_ROOM_OPACITY_SOLID_FULL;
  const open =
    role === "underlay"
      ? STACK_ROOM_OPACITY_UNDERLAY_OPEN
      : role === "overlay"
        ? STACK_ROOM_OPACITY_OVERLAY_OPEN
        : STACK_ROOM_OPACITY_SOLID_OPEN;
  return full + (open - full) * t;
}
