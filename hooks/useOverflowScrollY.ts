"use client";

import { useLayoutEffect, useRef, useState, type RefObject } from "react";

/**
 * Prefer `overflow-y-auto` always so wheel/trackpad can scroll when content
 * overflows. Only add `overscroll-contain` when the box actually overflows —
 * that is what trapped parent scroll when the legend fit without scrolling.
 *
 * Never use `overflow-y-hidden`: a late/false overflow measure would lock
 * scrolling entirely (absolute legends do not scroll their parent).
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
    for (const child of el.children) {
      resizeObserver.observe(child);
    }

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
      : "overflow-y-auto",
  };
}
