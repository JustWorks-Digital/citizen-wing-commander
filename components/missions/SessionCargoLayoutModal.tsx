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
import { useSessionCargoBayLayoutFullscreen } from "@/hooks/useSessionCargoBayLayoutFullscreen";
import { useSessionCargoBayLayoutWidth } from "@/hooks/useSessionCargoBayLayoutWidth";
import type { HaulingChecklistRow } from "@/lib/missions/sessionChecklist";
import type { SessionMission } from "@/lib/missions/sessionMissions";

import {
  MAX_CARGO_BAY_LAYOUT_HEIGHT_PX,
  MAX_CARGO_BAY_LAYOUT_WIDTH_PX,
  MIN_CARGO_BAY_LAYOUT_HEIGHT_PX,
  MIN_CARGO_BAY_LAYOUT_WIDTH_PX,
} from "@/lib/sessions/cargoBayLayoutClientPrefs";
import {
  CargoBayLayout,
  type CargoBayLayoutResizeApi,
  type CargoBayStopScope,
} from "./CargoBayLayout";

export type SessionCargoLayoutModalProps = {
  open: boolean;
  rows: HaulingChecklistRow[];
  /** Session contracts — Manual tray groups crates by mission. */
  missions?: SessionMission[];
  shipSlug?: string | null;
  focusedStopId?: string | null;
  sessionId?: string | null;
  /**
   * Inventory / capacity aside beside the Cargo bays title.
   * Render fn receives All-tab grid placed SCU for the On grid readout.
   */
  headerAside?:
    | ReactNode
    | ((ctx: { gridPlacedScu: number }) => ReactNode);
  onClose: () => void;
};

/**
 * Centered cargo bays modal — CargoBayLayout panel opened from the sticky
 * Cargo bay control. Bottom-right corner resizes width and height together.
 * Fullscreen fills the browser; close X / expand sit above the panel (or inset
 * when fullscreen).
 */
export function SessionCargoLayoutModal({
  open,
  rows,
  missions = [],
  shipSlug = null,
  focusedStopId = null,
  sessionId = null,
  headerAside = null,
  onClose,
}: SessionCargoLayoutModalProps) {
  const titleId = useId();
  const { widthPx, setWidthPx, resetWidthPx } =
    useSessionCargoBayLayoutWidth(sessionId);
  const { isFullscreen, setIsFullscreen, toggleFullscreen } =
    useSessionCargoBayLayoutFullscreen(sessionId);
  const [stopScope, setStopScope] = useState<CargoBayStopScope>("transfer");
  const [isResizing, setIsResizing] = useState(false);
  const layoutResizeRef = useRef<CargoBayLayoutResizeApi | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);
  const isFullscreenRef = useRef(isFullscreen);
  isFullscreenRef.current = isFullscreen;
  const widthPxRef = useRef(widthPx);
  widthPxRef.current = widthPx;

  useEffect(() => {
    if (!open) return;
    const openedAt = performance.now();
    const html = document.documentElement;
    const body = document.body;
    const scrollY = window.scrollY;
    const previous = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyLeft: body.style.left,
      bodyRight: body.style.right,
      bodyWidth: body.style.width,
    };
    // Freeze page scroll (overflow alone is not enough on many browsers / trackpads).
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (isFullscreenRef.current) {
        setIsFullscreen(false);
        return;
      }
      onClose();
    };
    window.addEventListener("keydown", onKey);
    const raf = requestAnimationFrame(() => {
      void import("@/lib/perf/clientMarks").then(
        ({ reportPerfMark, reportPerfMemory }) => {
          reportPerfMark("cargo-bays.open", performance.now() - openedAt);
          reportPerfMemory("heap.cargo-bays-open");
        },
      );
    });
    return () => {
      html.style.overflow = previous.htmlOverflow;
      body.style.overflow = previous.bodyOverflow;
      body.style.position = previous.bodyPosition;
      body.style.top = previous.bodyTop;
      body.style.left = previous.bodyLeft;
      body.style.right = previous.bodyRight;
      body.style.width = previous.bodyWidth;
      window.scrollTo(0, scrollY);
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, setIsFullscreen]);

  useEffect(() => {
    if (!isResizing) return;
    const previous = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "nwse-resize";
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.cursor = previous;
      document.body.style.userSelect = previousUserSelect;
    };
  }, [isResizing]);

  const applyCornerSize = useCallback(
    (width: number, height: number, options?: { persist?: boolean }) => {
      setWidthPx(width, options);
      layoutResizeRef.current?.setHeightPx(height, options);
    },
    [setWidthPx],
  );

  const resetCornerSize = useCallback(() => {
    resetWidthPx();
    layoutResizeRef.current?.resetHeightPx();
  }, [resetWidthPx]);

  const onResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const api = layoutResizeRef.current;
      if (!api) return;
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startWidth: widthPxRef.current,
        startHeight: api.getHeightPx(),
      };
      setIsResizing(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [],
  );

  const onResizePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const deltaX = event.clientX - drag.startX;
      const deltaY = event.clientY - drag.startY;
      applyCornerSize(drag.startWidth + deltaX, drag.startHeight + deltaY, {
        persist: false,
      });
    },
    [applyCornerSize],
  );

  const endResize = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const deltaX = event.clientX - drag.startX;
      const deltaY = event.clientY - drag.startY;
      dragRef.current = null;
      setIsResizing(false);
      applyCornerSize(drag.startWidth + deltaX, drag.startHeight + deltaY);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [applyCornerSize],
  );

  if (!open) return null;

  const heightNow =
    layoutResizeRef.current?.getHeightPx() ?? MIN_CARGO_BAY_LAYOUT_HEIGHT_PX;
  const heightMax =
    layoutResizeRef.current?.getMaxHeightPx() ?? MAX_CARGO_BAY_LAYOUT_HEIGHT_PX;

  const chromeButtons = (
    <>
      <button
        type="button"
        aria-pressed={isFullscreen}
        aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        onClick={toggleFullscreen}
        className={[
          "relative inline-flex size-9 shrink-0 items-center justify-center rounded-rsi",
          "border border-rsi-border bg-rsi-surface text-rsi-text-muted shadow-rsi-panel transition-colors",
          "hover:border-rsi-border-strong hover:bg-rsi-surface-raised hover:text-rsi-text",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
          isFullscreen ? "border-rsi-accent/50 text-rsi-accent" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {isFullscreen ? (
          <svg
            viewBox="0 0 16 16"
            width="14"
            height="14"
            aria-hidden
            className="shrink-0"
          >
            <path
              d="M5.5 2.5H3.5v2M10.5 2.5h2v2M5.5 13.5H3.5v-2M10.5 13.5h2v-2"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg
            viewBox="0 0 16 16"
            width="14"
            height="14"
            aria-hidden
            className="shrink-0"
          >
            <path
              d="M3.5 5.5V3.5h2M12.5 5.5V3.5h-2M3.5 10.5v2h2M12.5 10.5v2h-2"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
      <ModalCloseButton placement="inline" label="Dismiss" onClick={onClose} />
    </>
  );

  return (
    <div
      className={[
        "fixed inset-0 z-50 flex overflow-hidden overscroll-none bg-rsi-bg-deep/85",
        isFullscreen
          ? "items-stretch justify-stretch p-0"
          : "items-center justify-center px-3 pt-14 pb-3 sm:px-6 sm:pt-16 sm:pb-6",
      ].join(" ")}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={[
          "relative flex flex-col items-stretch",
          isFullscreen ? "h-full w-full max-w-none" : "max-w-full",
        ].join(" ")}
        style={isFullscreen ? undefined : { width: widthPx }}
      >
        <div
          className={[
            "z-20 flex items-center gap-2",
            isFullscreen
              ? "absolute top-2 right-2"
              : "absolute right-0 bottom-full mb-2",
          ].join(" ")}
        >
          {chromeButtons}
        </div>
        <h2 id={titleId} className="sr-only">
          Cargo bays
        </h2>
        <div
          data-cargo-bay-modal-shell
          className={[
            "relative min-w-0",
            isFullscreen
              ? "h-full overflow-hidden"
              : // Grow with the graph; clamp height so we never scroll the shell.
                "max-h-[min(85vh,52rem)] overflow-hidden",
          ].join(" ")}
        >
          <CargoBayLayout
            rows={rows}
            missions={missions}
            shipSlug={shipSlug}
            focusedStopId={focusedStopId}
            stopScope={stopScope}
            onStopScopeChange={setStopScope}
            sessionId={sessionId}
            headerAside={headerAside}
            isFullscreen={isFullscreen}
            layoutResizeRef={layoutResizeRef}
            className={isFullscreen ? "h-full rounded-none border-0" : undefined}
          />
          {!isFullscreen ? (
            <button
              type="button"
              role="slider"
              aria-label="Cargo bays size"
              aria-valuemin={MIN_CARGO_BAY_LAYOUT_WIDTH_PX}
              aria-valuemax={MAX_CARGO_BAY_LAYOUT_WIDTH_PX}
              aria-valuenow={widthPx}
              aria-orientation="horizontal"
              title="Drag corner to resize width and height · double-click to reset"
              onPointerDown={onResizePointerDown}
              onPointerMove={onResizePointerMove}
              onPointerUp={endResize}
              onPointerCancel={endResize}
              onDoubleClick={resetCornerSize}
              onKeyDown={(event) => {
                const step = event.shiftKey ? 48 : 16;
                const api = layoutResizeRef.current;
                const height = api?.getHeightPx() ?? heightNow;
                const maxH = api?.getMaxHeightPx() ?? heightMax;
                if (event.key === "ArrowRight") {
                  event.preventDefault();
                  setWidthPx(widthPx + step);
                } else if (event.key === "ArrowLeft") {
                  event.preventDefault();
                  setWidthPx(widthPx - step);
                } else if (event.key === "ArrowDown") {
                  event.preventDefault();
                  api?.setHeightPx(height + step);
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  api?.setHeightPx(height - step);
                } else if (event.key === "Home") {
                  event.preventDefault();
                  applyCornerSize(MAX_CARGO_BAY_LAYOUT_WIDTH_PX, maxH);
                } else if (event.key === "End") {
                  event.preventDefault();
                  applyCornerSize(
                    MIN_CARGO_BAY_LAYOUT_WIDTH_PX,
                    MIN_CARGO_BAY_LAYOUT_HEIGHT_PX,
                  );
                }
              }}
              className="group absolute right-0 bottom-0 z-20 flex size-5 cursor-nwse-resize items-end justify-end p-1"
            >
              <span
                aria-hidden
                className="block size-2.5 border-r-2 border-b-2 border-rsi-border-strong/80 group-hover:border-rsi-accent"
              />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
