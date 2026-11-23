import { describe, expect, it } from "vitest";
import {
  clampWheelZoom,
  isHorizontalWheelPan,
  normalizeWheelDeltaPixels,
  wheelZoomFactor,
} from "@/hooks/useWheelZoom";

describe("normalizeWheelDeltaPixels", () => {
  it("passes through pixel-mode trackpad deltas", () => {
    expect(normalizeWheelDeltaPixels(12.5, 0)).toBe(12.5);
  });

  it("converts line mode to pixels", () => {
    expect(normalizeWheelDeltaPixels(3, 1)).toBe(48);
  });
});

describe("isHorizontalWheelPan", () => {
  it("treats dominant deltaX as a horizontal pan", () => {
    expect(
      isHorizontalWheelPan({ deltaX: 40, deltaY: 5, ctrlKey: false }),
    ).toBe(true);
  });

  it("treats equal |deltaX| and |deltaY| as horizontal pan", () => {
    expect(
      isHorizontalWheelPan({ deltaX: -20, deltaY: 20, ctrlKey: false }),
    ).toBe(true);
  });

  it("treats dominant deltaY as zoom, not pan", () => {
    expect(
      isHorizontalWheelPan({ deltaX: 5, deltaY: 40, ctrlKey: false }),
    ).toBe(false);
  });

  it("never pans on pinch (ctrlKey)", () => {
    expect(
      isHorizontalWheelPan({ deltaX: 40, deltaY: 0, ctrlKey: true }),
    ).toBe(false);
  });
});

describe("wheelZoomFactor", () => {
  it("zooms in on negative deltaY (scroll up / pinch out)", () => {
    expect(wheelZoomFactor(-180, { ctrlKey: true })).toBeCloseTo(2, 5);
  });

  it("zooms out on positive deltaY", () => {
    expect(wheelZoomFactor(180, { ctrlKey: true })).toBeCloseTo(0.5, 5);
  });

  it("is gentler for plain scroll than for pinch (ctrlKey)", () => {
    const scroll = wheelZoomFactor(-100, { ctrlKey: false });
    const pinch = wheelZoomFactor(-100, { ctrlKey: true });
    expect(scroll).toBeGreaterThan(1);
    expect(pinch).toBeGreaterThan(scroll);
  });

  it("returns 1 for a zero delta", () => {
    expect(wheelZoomFactor(0)).toBe(1);
  });
});

describe("clampWheelZoom", () => {
  it("rounds to hundredths inside the range", () => {
    expect(clampWheelZoom(1.234, 0.25, 2.5)).toBe(1.23);
  });

  it("clamps to min and max", () => {
    expect(clampWheelZoom(0.1, 0.25, 2.5)).toBe(0.25);
    expect(clampWheelZoom(9, 0.25, 2.5)).toBe(2.5);
  });
});
