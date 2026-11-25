import { describe, expect, it } from "vitest";
import {
  cargoBayScrollEdgePadPx,
  centerBayInScrollViewport,
} from "@/lib/ships/cargoBayScrollPad";

describe("cargoBayScrollEdgePadPx", () => {
  it("uses a higher floor for Galaxy when scroll el is missing", () => {
    expect(cargoBayScrollEdgePadPx(null, "galaxy")).toBe(240);
    expect(cargoBayScrollEdgePadPx(null, "c2-hercules-starlifter")).toBe(160);
  });

  it("uses half the shorter viewport axis when larger than the floor", () => {
    const el = {
      clientWidth: 800,
      clientHeight: 600,
    } as HTMLElement;
    expect(cargoBayScrollEdgePadPx(el, "galaxy")).toBe(300);
  });
});

describe("centerBayInScrollViewport", () => {
  it("scrolls so content center meets viewport center", () => {
    const scrollEl = {
      getBoundingClientRect: () => ({
        left: 0,
        top: 0,
        width: 200,
        height: 100,
        right: 200,
        bottom: 100,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
      scrollLeft: 0,
      scrollTop: 0,
    } as HTMLElement;

    const contentEl = {
      getBoundingClientRect: () => ({
        left: 50,
        top: 20,
        width: 100,
        height: 40,
        right: 150,
        bottom: 60,
        x: 50,
        y: 20,
        toJSON: () => ({}),
      }),
    } as HTMLElement;

    centerBayInScrollViewport(scrollEl, contentEl);
    // Content center (100, 40) vs viewport center (100, 50) → scrollTop += -10
    expect(scrollEl.scrollLeft).toBe(0);
    expect(scrollEl.scrollTop).toBe(-10);
  });
});
