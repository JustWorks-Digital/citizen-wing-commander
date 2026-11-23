import { describe, expect, it } from "vitest";
import {
  STACK_ROOM_OPACITY_SOLID_FULL,
  STACK_ROOM_OPACITY_SOLID_OPEN,
  STACK_ROOM_OPACITY_UNDERLAY_FULL,
  STACK_ROOM_OPACITY_UNDERLAY_OPEN,
  cargoBoxStackRoomOpacity,
  freeStackLayersAbove,
  type CargoBoxStackRoomFootprint,
} from "@/lib/ships/cargoBoxStackRoom";

function box(
  partial: CargoBoxStackRoomFootprint,
): CargoBoxStackRoomFootprint {
  return partial;
}

describe("freeStackLayersAbove", () => {
  // Bay height 4 (Z0–Z3): lone 1-high crate on the deck has 3 free layers.
  it("counts contiguous free cells to the bay ceiling", () => {
    const deck = box({
      id: "deck",
      origin: { x: 0, y: 0, z: 0 },
      footprint: { dx: 1, dy: 1, dz: 1 },
    });
    expect(freeStackLayersAbove(deck, [deck], 4)).toBe(3);
  });

  // Stack: deck at Z0, cap at Z2 — only 1 free cell (Z1) above the deck.
  it("stops at the next overlapping crate above", () => {
    const deck = box({
      id: "deck",
      origin: { x: 0, y: 0, z: 0 },
      footprint: { dx: 1, dy: 1, dz: 1 },
    });
    const cap = box({
      id: "cap",
      origin: { x: 0, y: 0, z: 2 },
      footprint: { dx: 1, dy: 1, dz: 1 },
    });
    expect(freeStackLayersAbove(deck, [deck, cap], 4)).toBe(1);
  });

  // Full-height 4 SCU column in a height-4 bay — no room on top.
  it("returns 0 when the crate already reaches the ceiling", () => {
    const column = box({
      id: "column",
      origin: { x: 1, y: 1, z: 0 },
      footprint: { dx: 1, dy: 1, dz: 4 },
    });
    expect(freeStackLayersAbove(column, [column], 4)).toBe(0);
  });

  // Neighbor beside the stack must not block free height on this footprint.
  it("ignores crates that do not overlap in XY", () => {
    const deck = box({
      id: "deck",
      origin: { x: 0, y: 0, z: 0 },
      footprint: { dx: 1, dy: 1, dz: 1 },
    });
    const beside = box({
      id: "beside",
      origin: { x: 2, y: 0, z: 1 },
      footprint: { dx: 1, dy: 1, dz: 2 },
    });
    expect(freeStackLayersAbove(deck, [deck, beside], 4)).toBe(3);
  });
});

describe("cargoBoxStackRoomOpacity", () => {
  // Opaque when nothing more fits on top.
  it("is fully opaque at 0 free layers", () => {
    expect(cargoBoxStackRoomOpacity(0, 4, "solid")).toBe(
      STACK_ROOM_OPACITY_SOLID_FULL,
    );
    expect(cargoBoxStackRoomOpacity(0, 4, "underlay")).toBe(
      STACK_ROOM_OPACITY_UNDERLAY_FULL,
    );
  });

  // Max open height → faintest fill (height 4 → maxFree 3).
  it("is faintest when free layers match max open height", () => {
    expect(cargoBoxStackRoomOpacity(3, 4, "solid")).toBe(
      STACK_ROOM_OPACITY_SOLID_OPEN,
    );
    expect(cargoBoxStackRoomOpacity(3, 4, "underlay")).toBe(
      STACK_ROOM_OPACITY_UNDERLAY_OPEN,
    );
  });

  // Mid stack room sits between full and open (height 4, 1 of 3 free).
  it("steps opacity between full and open for partial free room", () => {
    const midSolid = cargoBoxStackRoomOpacity(1, 4, "solid");
    expect(midSolid).toBeGreaterThan(STACK_ROOM_OPACITY_SOLID_OPEN);
    expect(midSolid).toBeLessThan(STACK_ROOM_OPACITY_SOLID_FULL);
    const midUnderlay = cargoBoxStackRoomOpacity(1, 4, "underlay");
    expect(midUnderlay).toBeGreaterThan(STACK_ROOM_OPACITY_UNDERLAY_OPEN);
    expect(midUnderlay).toBeLessThan(STACK_ROOM_OPACITY_UNDERLAY_FULL);
  });
});
