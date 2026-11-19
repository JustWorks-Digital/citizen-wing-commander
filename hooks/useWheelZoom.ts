"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  type RefObject,
} from "react";

type SetZoom = (next: number | ((value: number) => number)) => void;

type ZoomAnchor = {
  fracX: number;
  fracY: number;
  clientX: number;
  clientY: number;
};

/**
 * Wheel over a scroll surface zooms instead of scrolling, keeping the
 * content point under the cursor stable (zoom-toward-cursor).
 */
export function useWheelZoom(
  scrollRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  zoom: number,
  setZoom: SetZoom,
  options?: {
    enabled?: boolean;
    min?: number;
    max?: number;
    step?: number;
  },
): void {
  const enabled = options?.enabled ?? true;
  const min = options?.min ?? 0.5;
  const max = options?.max ?? 2.5;
  const step = options?.step ?? 0.1;
  const setZoomRef = useRef(setZoom);
  setZoomRef.current = setZoom;
  const pendingAnchorRef = useRef<ZoomAnchor | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const el = scrollRef.current;
    if (!el) return;

    const clamp = (value: number) =>
      Math.min(max, Math.max(min, Math.round(value * 100) / 100));

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.deltaY === 0) return;

      const contentEl = contentRef.current;
      const direction = event.deltaY > 0 ? -1 : 1;

      if (contentEl) {
        const contentRect = contentEl.getBoundingClientRect();
        if (contentRect.width > 0 && contentRect.height > 0) {
          pendingAnchorRef.current = {
            fracX: (event.clientX - contentRect.left) / contentRect.width,
            fracY: (event.clientY - contentRect.top) / contentRect.height,
            clientX: event.clientX,
            clientY: event.clientY,
          };
        } else {
          pendingAnchorRef.current = null;
        }
      } else {
        pendingAnchorRef.current = null;
      }

      setZoomRef.current((current) => {
        const next = clamp(current + direction * step);
        if (next === current) pendingAnchorRef.current = null;
        return next;
      });
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
    };
  }, [scrollRef, contentRef, enabled, min, max, step]);

  useLayoutEffect(() => {
    const anchor = pendingAnchorRef.current;
    if (!anchor) return;
    pendingAnchorRef.current = null;

    const scrollEl = scrollRef.current;
    const contentEl = contentRef.current;
    if (!scrollEl || !contentEl) return;

    const contentRect = contentEl.getBoundingClientRect();
    if (contentRect.width <= 0 || contentRect.height <= 0) return;

    const pointClientX =
      contentRect.left + anchor.fracX * contentRect.width;
    const pointClientY =
      contentRect.top + anchor.fracY * contentRect.height;

    scrollEl.scrollLeft += pointClientX - anchor.clientX;
    scrollEl.scrollTop += pointClientY - anchor.clientY;
  }, [zoom, scrollRef, contentRef]);
}
