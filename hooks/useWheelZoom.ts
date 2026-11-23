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

/** Pixel scroll distance that roughly doubles / halves zoom (trackpad feel). */
export const WHEEL_ZOOM_PIXELS_PER_OCTAVE = 180;

/**
 * Normalize a wheel axis delta to CSS pixels (line/page modes → pixels).
 * Mac trackpad / pinch already report pixel deltas.
 */
export function normalizeWheelDeltaPixels(
  delta: number,
  deltaMode: number,
): number {
  if (deltaMode === 1) return delta * 16;
  if (deltaMode === 2) {
    const page =
      typeof window !== "undefined" ? window.innerHeight || 800 : 800;
    return delta * page;
  }
  return delta;
}

/**
 * True when this wheel event should pan horizontally instead of zoom.
 * Pinch (`ctrlKey`) always zooms. Horizontal dominates when |deltaX| ≥ |deltaY|.
 */
export function isHorizontalWheelPan(
  event: Pick<WheelEvent, "deltaX" | "deltaY" | "ctrlKey">,
): boolean {
  if (event.ctrlKey) return false;
  return Math.abs(event.deltaX) >= Math.abs(event.deltaY);
}

/**
 * Multiplicative zoom factor from a wheel/pinch delta.
 * Negative deltaY (scroll up / pinch out) → zoom in.
 * `ctrlKey` pinches on macOS Chrome/Safari use a slightly hotter curve.
 */
export function wheelZoomFactor(
  deltaPixels: number,
  options?: { ctrlKey?: boolean; pixelsPerOctave?: number },
): number {
  if (!Number.isFinite(deltaPixels) || deltaPixels === 0) return 1;
  const pixelsPerOctave =
    options?.pixelsPerOctave ?? WHEEL_ZOOM_PIXELS_PER_OCTAVE;
  // Pinch gestures already feel like zoom; scroll-to-zoom is gentler.
  const scale = options?.ctrlKey ? 1 : 0.55;
  return Math.exp((-deltaPixels * scale * Math.LN2) / pixelsPerOctave);
}

export function clampWheelZoom(
  value: number,
  min: number,
  max: number,
): number {
  if (!Number.isFinite(value)) return min;
  // Hundredths keep the % readout stable without chunky 0.25 jumps.
  return Math.min(max, Math.max(min, Math.round(value * 100) / 100));
}

/**
 * Vertical wheel / trackpad pinch zooms (toward cursor). Horizontal wheel
 * pans left/right and never changes zoom.
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
    /** @deprecated Discrete button step — wheel uses continuous deltas. */
    step?: number;
    pixelsPerOctave?: number;
  },
): void {
  const enabled = options?.enabled ?? true;
  const min = options?.min ?? 0.5;
  const max = options?.max ?? 2.5;
  const pixelsPerOctave =
    options?.pixelsPerOctave ?? WHEEL_ZOOM_PIXELS_PER_OCTAVE;
  const setZoomRef = useRef(setZoom);
  setZoomRef.current = setZoom;
  const pendingAnchorRef = useRef<ZoomAnchor | null>(null);
  const pendingFactorRef = useRef(1);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const el = scrollRef.current;
    if (!el) return;

    const flush = () => {
      rafRef.current = null;
      const factor = pendingFactorRef.current;
      pendingFactorRef.current = 1;
      if (factor === 1) {
        pendingAnchorRef.current = null;
        return;
      }
      setZoomRef.current((current) => {
        const next = clampWheelZoom(current * factor, min, max);
        if (next === current) pendingAnchorRef.current = null;
        return next;
      });
    };

    const onWheel = (event: WheelEvent) => {
      // Horizontal trackpad / shift-wheel → pan only (never zoom).
      if (isHorizontalWheelPan(event)) {
        const dx = normalizeWheelDeltaPixels(event.deltaX, event.deltaMode);
        if (dx === 0) return;
        event.preventDefault();
        event.stopPropagation();
        el.scrollLeft += dx;
        return;
      }

      const deltaPixels = normalizeWheelDeltaPixels(
        event.deltaY,
        event.deltaMode,
      );
      if (deltaPixels === 0) return;

      // Capture pinch + vertical scroll; else Chrome page-zooms on ctrl+wheel.
      event.preventDefault();
      event.stopPropagation();

      const contentEl = contentRef.current;
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

      pendingFactorRef.current *= wheelZoomFactor(deltaPixels, {
        ctrlKey: event.ctrlKey,
        pixelsPerOctave,
      });

      if (rafRef.current == null) {
        rafRef.current = window.requestAnimationFrame(flush);
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      pendingFactorRef.current = 1;
    };
  }, [scrollRef, contentRef, enabled, min, max, pixelsPerOctave]);

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
