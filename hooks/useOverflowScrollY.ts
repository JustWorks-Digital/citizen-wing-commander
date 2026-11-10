"use client";

import { useLayoutEffect, useRef, useState, type RefObject } from "react";

/**
 * Apply vertical overflow scrolling only when content exceeds the box.
 * Avoids trapping wheel/trackpad scroll when nothing can scroll.
 *
 * Uses ResizeObserver only (no MutationObserver) so React reconciles of
 * legend buttons/sections do not schedule extra main-thread work per click.
 */
export function useOverflowScrollY(deps: readonly unknown[] = []): {
  overflowScrollRef: RefObject<HTMLDivElement | null>;
  overflowScrollClassName: string;
} {
  const overflowScrollRef = useRef<HTMLDivElement | null>(null);
  const [canScrollY, setCanScrollY] = useState(false);
  const rafRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    const el = overflowScrollRef.current;
    if (!el) {
      setCanScrollY(false);
      return;
    }

    const measure = () => {
      const next = el.scrollHeight > el.clientHeight + 1;
      setCanScrollY((prev) => (prev === next ? prev : next));
    };

    const scheduleMeasure = () => {
      if (rafRef.current != null) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        measure();
      });
    };

    measure();
    const resizeObserver = new ResizeObserver(scheduleMeasure);
    resizeObserver.observe(el);

    return () => {
      resizeObserver.disconnect();
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
    // Caller passes content/size deps (collapsed sections, height, etc.).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps from caller
  }, deps);

  return {
    overflowScrollRef,
    overflowScrollClassName: canScrollY
      ? "overflow-y-auto overscroll-contain"
      : "overflow-y-hidden",
  };
}
