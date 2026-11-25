import { describe, expect, it } from "vitest";
import type { HaulingChecklistRow } from "@/lib/missions/sessionChecklist";
import { stopCargoRole } from "@/lib/missions/stopDeliveryBoxes";

function bothStop(partial?: Partial<HaulingChecklistRow>): HaulingChecklistRow {
  return {
    id: "leg-1",
    routeAction: "pickup_delivery",
    locationSlug: "area18",
    cargoDeliveries: [
      {
        commoditySlug: "scrap",
        scu: 4,
        role: "delivery",
        isHandled: false,
      },
      {
        commoditySlug: "stims",
        scu: 2,
        role: "pickup",
        isHandled: false,
      },
    ],
    shipStorageLocation: "front",
    distanceToNext: null,
    isCompleted: false,
    ...partial,
  };
}

describe("stopCargoRole.arePresentRolesHandled", () => {
  it("requires only pickup on a pickup-only stop", () => {
    const row: HaulingChecklistRow = {
      id: "leg-p",
      routeAction: "pickup",
      locationSlug: "area18",
      cargoDeliveries: [
        { commoditySlug: "stims", scu: 2, isHandled: true },
      ],
      shipStorageLocation: "front",
      distanceToNext: null,
      isCompleted: false,
    };
    expect(stopCargoRole.arePresentRolesHandled(row)).toBe(true);
  });

  it("requires both pickup and delivery on a both-stop", () => {
    const open = bothStop();
    expect(stopCargoRole.arePresentRolesHandled(open)).toBe(false);
    const pickupOnly = stopCargoRole.withHandled(open, "pickup", true);
    expect(stopCargoRole.arePresentRolesHandled(pickupOnly)).toBe(false);
    const both = stopCargoRole.withHandled(pickupOnly, "delivery", true);
    expect(stopCargoRole.arePresentRolesHandled(both)).toBe(true);
  });
});

describe("stopCargoRole.isHandled", () => {
  it("treats Unloaded as done when every active cargo type is handled", () => {
    // 0 SCU skip line must not block the Unloaded mark.
    const row: HaulingChecklistRow = {
      id: "leg-drop",
      routeAction: "delivery",
      locationSlug: "baijini-point",
      cargoDeliveries: [
        {
          commoditySlug: "scrap",
          scu: 24,
          role: "delivery",
          isHandled: true,
        },
        {
          commoditySlug: "stims",
          scu: 9,
          role: "delivery",
          isHandled: true,
        },
        {
          commoditySlug: "waste",
          scu: 0,
          role: "delivery",
          isHandled: false,
        },
      ],
      shipStorageLocation: "middle",
      distanceToNext: null,
      isCompleted: false,
    };
    expect(stopCargoRole.isHandled(row, "delivery")).toBe(true);
  });

  it("stays open while any active cargo type is unchecked", () => {
    const row: HaulingChecklistRow = {
      id: "leg-drop-open",
      routeAction: "delivery",
      locationSlug: "baijini-point",
      cargoDeliveries: [
        {
          commoditySlug: "scrap",
          scu: 24,
          role: "delivery",
          isHandled: true,
        },
        {
          commoditySlug: "stims",
          scu: 9,
          role: "delivery",
          isHandled: false,
        },
      ],
      shipStorageLocation: "middle",
      distanceToNext: null,
      isCompleted: false,
    };
    expect(stopCargoRole.isHandled(row, "delivery")).toBe(false);
  });
});
