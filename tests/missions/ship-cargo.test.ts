import { describe, expect, it } from "vitest";
import { shipCargo } from "@/lib/missions/shipCargo";

describe("shipCargo", () => {
  it("adds and merges matching commodity and mission lines", () => {
    let ship = shipCargo.empty();
    ship = shipCargo.add(ship, [
      { commoditySlug: "scrap", scu: 10, missionId: "a" },
      { commoditySlug: "scrap", scu: 5, missionId: "a" },
    ]);
    expect(ship.lines).toEqual([
      { commoditySlug: "scrap", scu: 15, missionId: "a" },
    ]);
    expect(ship.scuTotal).toBe(15);
  });

  it("reports shortfall when unloading cargo that is not aboard", () => {
    const ship = shipCargo.add(shipCargo.empty(), [
      { commoditySlug: "hydrogen-fuel", scu: 20, missionId: "out" },
    ]);
    const result = shipCargo.remove(ship, [
      { commoditySlug: "scrap", scu: 10, missionId: "back" },
    ]);
    expect(result.shortfalls).toEqual([
      {
        missing: { commoditySlug: "scrap", scu: 10, missionId: "back" },
        shortfallScu: 10,
      },
    ]);
    expect(result.ship.scuTotal).toBe(20);
  });
});
