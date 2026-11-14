"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { useSessionCargoBayLayoutWidth } from "@/hooks/useSessionCargoBayLayoutWidth";
import type { HaulingChecklistRow } from "@/lib/missions/mockSession";
import {
  MAX_CARGO_BAY_LAYOUT_WIDTH_PX,
  MIN_CARGO_BAY_LAYOUT_WIDTH_PX,
} from "@/lib/sessions/cargoBayLayoutClientPrefs";
import {
  CargoBayLayout,
  type CargoBayStopScope,
} from "./CargoBayLayout";

export type SessionCargoLayoutModalProps = {
  open: boolean;
  rows: HaulingChecklistRow[];
  shipSlug?: string | null;
  focusedStopId?: string | null;
  sessionId?: string | null;
  /** Inventory / capacity aside shown beside the Storage bays title. */
  headerAside?: ReactNode;
  onClose: () => void;
};

/**
 * Centered storage bays modal — CargoBayLayout panel opened from the sticky
 * Storage bays control. Height follows content; left edge resizes width.
 * Close X sits in the backdrop above the panel so it does not steal bay width.
 */
export function SessionCargoLayoutModal({
  open,
  rows,
  shipSlug = null,
  focusedStopId = null,
  sessionId = null,
  headerAside = null,
  onClose,
}: SessionCargoLayoutModalProps) {
  const titleId = useId();
  const { widthPx, setWidthPx, resetWidthPx } =
    useSessionCargoBayLayoutWidth(sessionId);
  const [stopScope, setStopScope] = useState<CargoBayStopScope>("transfer");
  const [isResizing, setIsResizing] = useState(false);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startWidth: number;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!isResizing) return;
    const previous = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.cursor = previous;
      document.body.style.userSelect = previousUserSelect;
    };
  }, [isResizing]);

  const onResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startWidth: widthPx,
      };
      setIsResizing(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [widthPx],
  );

  const onResizePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      // Dragging the left edge leftward grows the panel.
      const delta = drag.startX - event.clientX;
      setWidthPx(drag.startWidth + delta, { persist: false });
    },
    [setWidthPx],
  );

  const endResize = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const delta = drag.startX - event.clientX;
      dragRef.current = null;
      setIsResizing(false);
      setWidthPx(drag.startWidth + delta);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [setWidthPx],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-rsi-bg-deep/85 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="relative flex max-w-full flex-col items-stretch"
        style={{ width: widthPx }}
      >
        <div className="pointer-events-none absolute inset-x-0 bottom-full mb-2 flex justify-end">
          <ModalCloseButton
            label="Dismiss"
            onClick={onClose}
            className="pointer-events-auto static top-auto right-auto rounded-rsi border border-rsi-border bg-rsi-bg-deep/90 shadow-rsi-panel"
          />
        </div>
        <h2 id={titleId} className="sr-only">
          Storage bays
        </h2>
        <div className="relative min-w-0">
          <button
            type="button"
            role="slider"
            aria-label="Storage bays width"
            aria-orientation="horizontal"
            aria-valuemin={MIN_CARGO_BAY_LAYOUT_WIDTH_PX}
            aria-valuemax={MAX_CARGO_BAY_LAYOUT_WIDTH_PX}
            aria-valuenow={widthPx}
            title="Drag to resize · double-click to reset"
            onPointerDown={onResizePointerDown}
            onPointerMove={onResizePointerMove}
            onPointerUp={endResize}
            onPointerCancel={endResize}
            onDoubleClick={resetWidthPx}
            onKeyDown={(event) => {
              const step = event.shiftKey ? 48 : 16;
              if (event.key === "ArrowLeft") {
                event.preventDefault();
                setWidthPx(widthPx + step);
              } else if (event.key === "ArrowRight") {
                event.preventDefault();
                setWidthPx(widthPx - step);
              } else if (event.key === "Home") {
                event.preventDefault();
                setWidthPx(MAX_CARGO_BAY_LAYOUT_WIDTH_PX);
              } else if (event.key === "End") {
                event.preventDefault();
                setWidthPx(MIN_CARGO_BAY_LAYOUT_WIDTH_PX);
              }
            }}
            className="group absolute top-0 bottom-0 left-0 z-20 flex w-3 -translate-x-1/2 cursor-ew-resize items-center justify-center"
          >
            <span
              aria-hidden
              className="h-10 w-0.5 rounded-full bg-rsi-border-strong/80 group-hover:bg-rsi-accent"
            />
          </button>
          <CargoBayLayout
            rows={rows}
            shipSlug={shipSlug}
            focusedStopId={focusedStopId}
            stopScope={stopScope}
            onStopScopeChange={setStopScope}
            sessionId={sessionId}
            headerAside={headerAside}
            className="max-h-[min(85vh,52rem)] overflow-hidden"
          />
        </div>
      </div>
    </div>
  );
}
