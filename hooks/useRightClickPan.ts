"use client";

import { useEffect, type RefObject } from "react";

/**
 * Right-button drag pans an overflow scroll container (scrollLeft / scrollTop).
 * Suppresses the context menu on that element so drag does not open it.
 */
export function useRightClickPan(
  scrollRef: RefObject<HTMLElement | null>,
  enabled = true,
): void {
  useEffect(() => {
    if (!enabled) return;
    const el = scrollRef.current;
    if (!el) return;

    let isPanning = false;
    let pointerId: number | null = null;
    let lastX = 0;
    let lastY = 0;
    let moved = false;

    const endPan = (event: PointerEvent) => {
      if (!isPanning || event.pointerId !== pointerId) return;
      isPanning = false;
      pointerId = null;
      el.style.removeProperty("cursor");
      if (el.hasPointerCapture(event.pointerId)) {
        el.releasePointerCapture(event.pointerId);
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 2) return;
      isPanning = true;
      moved = false;
      pointerId = event.pointerId;
      lastX = event.clientX;
      lastY = event.clientY;
      el.style.cursor = "grabbing";
      el.setPointerCapture(event.pointerId);
      event.preventDefault();
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!isPanning || event.pointerId !== pointerId) return;
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      if (dx !== 0 || dy !== 0) moved = true;
      lastX = event.clientX;
      lastY = event.clientY;
      // Drag right/down moves the view that way (content follows the pointer).
      el.scrollLeft -= dx;
      el.scrollTop -= dy;
    };

    const onContextMenu = (event: Event) => {
      // Always block on this surface so a right-drag does not flash the menu.
      event.preventDefault();
      if (moved) event.stopPropagation();
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", endPan);
    el.addEventListener("pointercancel", endPan);
    el.addEventListener("contextmenu", onContextMenu);

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", endPan);
      el.removeEventListener("pointercancel", endPan);
      el.removeEventListener("contextmenu", onContextMenu);
      el.style.removeProperty("cursor");
    };
  }, [scrollRef, enabled]);
}
