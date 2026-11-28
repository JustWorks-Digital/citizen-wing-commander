import { describe, expect, it } from "vitest";
import { rotatableTopBayBoxSize } from "@/components/ships/RotatableTopBay";

describe("rotatableTopBayBoxSize", () => {
  // Long bay (Galaxy-like): wide × short. Quarter turns must swap so scroll
  // fit can keep Front/Rear on-screen after facing pad up/down.
  const content = { width: 400, height: 120 };

  it("keeps axes on 0° and 180°", () => {
    expect(rotatableTopBayBoxSize(content.width, content.height, 0)).toEqual(
      content,
    );
    expect(rotatableTopBayBoxSize(content.width, content.height, 180)).toEqual(
      content,
    );
  });

  it("swaps axes on 90° and 270°", () => {
    expect(rotatableTopBayBoxSize(content.width, content.height, 90)).toEqual({
      width: 120,
      height: 400,
    });
    expect(rotatableTopBayBoxSize(content.width, content.height, 270)).toEqual({
      width: 120,
      height: 400,
    });
  });
});
