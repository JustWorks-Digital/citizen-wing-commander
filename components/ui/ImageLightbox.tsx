"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";

export type ImageLightboxItem = {
  src: string;
  alt?: string;
  title?: string;
};

export type ImageLightboxProps = {
  src: string;
  alt?: string;
  title?: string;
  onClose: () => void;
  /**
   * Optional gallery of related images (e.g. all contract shots for a stop).
   * When set with more than one item, prev/next + arrow keys navigate.
   */
  items?: ImageLightboxItem[];
  /** Index into `items` when gallery mode is active. */
  index?: number;
  onIndexChange?: (index: number) => void;
};

const ZOOM_MIN = 1;
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.25;

function clampZoom(value: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(value * 100) / 100));
}

function NavChevron({ direction }: { direction: "prev" | "next" }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {direction === "prev" ? (
        <polyline points="15 18 9 12 15 6" />
      ) : (
        <polyline points="9 18 15 12 9 6" />
      )}
    </svg>
  );
}

function ZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onReset,
}: {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}) {
  const buttonClass = [
    "inline-flex size-8 items-center justify-center border-0 font-mono text-[0.75rem]",
    "text-rsi-text-secondary transition-colors hover:text-rsi-accent",
    "disabled:cursor-default disabled:opacity-40",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
  ].join(" ");

  return (
    <div
      className="inline-flex shrink-0 overflow-hidden rounded-rsi border border-rsi-border bg-rsi-bg-deep/70"
      role="group"
      aria-label="Image zoom"
    >
      <button
        type="button"
        aria-label="Zoom out"
        title="Zoom out (−)"
        disabled={zoom <= ZOOM_MIN}
        onClick={onZoomOut}
        className={`${buttonClass} border-r border-rsi-border`}
      >
        −
      </button>
      <button
        type="button"
        aria-label="Reset zoom"
        title="Reset zoom"
        onClick={onReset}
        className={`${buttonClass} min-w-[3rem] border-r border-rsi-border px-1.5 text-[0.6rem] tabular-nums`}
      >
        {Math.round(zoom * 100)}%
      </button>
      <button
        type="button"
        aria-label="Zoom in"
        title="Zoom in (+)"
        disabled={zoom >= ZOOM_MAX}
        onClick={onZoomIn}
        className={buttonClass}
      >
        +
      </button>
    </div>
  );
}

/** Full-viewport lightbox; image scales to page width, with zoom for detail. */
export function ImageLightbox({
  src,
  alt = "",
  title,
  onClose,
  items,
  index = 0,
  onIndexChange,
}: ImageLightboxProps) {
  const gallery =
    items && items.length > 0 ? items : [{ src, alt, title }];
  const safeIndex = Math.min(Math.max(0, index), gallery.length - 1);
  const current = gallery[safeIndex] ?? { src, alt, title };
  const hasGallery = gallery.length > 1 && Boolean(onIndexChange);
  const [zoom, setZoom] = useState(1);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setZoom(1);
  }, [safeIndex, current.src]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      const delta = event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
      setZoom((value) => clampZoom(value + delta));
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        setZoom((value) => clampZoom(value + ZOOM_STEP));
        return;
      }
      if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        setZoom((value) => clampZoom(value - ZOOM_STEP));
        return;
      }
      if (event.key === "0") {
        event.preventDefault();
        setZoom(1);
        return;
      }
      if (!hasGallery || !onIndexChange) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        onIndexChange((safeIndex - 1 + gallery.length) % gallery.length);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        onIndexChange((safeIndex + 1) % gallery.length);
      }
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, hasGallery, onIndexChange, safeIndex, gallery.length]);

  if (typeof document === "undefined") return null;

  const label = current.title || current.alt || title || alt || "Image preview";

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className="fixed inset-0 z-[80] flex flex-col bg-rsi-bg"
    >
      <div className="relative flex shrink-0 items-center gap-3 border-b border-rsi-border bg-rsi-bg-deep/80 px-4 py-3 pr-12 sm:pr-14">
        <p className="min-w-0 flex-1 truncate font-mono text-[0.7rem] uppercase tracking-[0.18em] text-rsi-text-muted">
          {label}
        </p>
        <ZoomControls
          zoom={zoom}
          onZoomIn={() => setZoom((value) => clampZoom(value + ZOOM_STEP))}
          onZoomOut={() => setZoom((value) => clampZoom(value - ZOOM_STEP))}
          onReset={() => setZoom(1)}
        />
        {hasGallery ? (
          <p className="shrink-0 font-mono text-[0.65rem] tabular-nums tracking-[0.14em] text-rsi-text-secondary">
            {safeIndex + 1} / {gallery.length}
          </p>
        ) : null}
        <ModalCloseButton onClick={onClose} />
      </div>
      <div
        ref={scrollRef}
        className="relative min-h-0 flex-1 overflow-auto bg-rsi-bg-deep/40 p-4"
        onClick={onClose}
      >
        <div className="flex min-h-full w-full items-start justify-center">
          {/* Fit page width at 100%; zoom grows width so overflow scrolls for pan. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current.src}
            alt={current.alt || alt}
            className={[
              "h-auto max-w-none select-none transition-[width] duration-150",
              zoom > 1 ? "cursor-zoom-out" : "cursor-zoom-in",
            ].join(" ")}
            style={{ width: `${zoom * 100}%` }}
            draggable={false}
            onClick={(event) => {
              event.stopPropagation();
              setZoom((value) => (value > 1 ? 1 : 2));
            }}
          />
        </div>

        {hasGallery && onIndexChange ? (
          <>
            <button
              type="button"
              aria-label="Previous image"
              title="Previous (←)"
              onClick={(event) => {
                event.stopPropagation();
                onIndexChange((safeIndex - 1 + gallery.length) % gallery.length);
              }}
              className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-rsi border border-rsi-border bg-rsi-bg-deep/90 text-rsi-text shadow-rsi-panel transition-colors hover:border-rsi-accent hover:text-rsi-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)] sm:left-5"
            >
              <NavChevron direction="prev" />
            </button>
            <button
              type="button"
              aria-label="Next image"
              title="Next (→)"
              onClick={(event) => {
                event.stopPropagation();
                onIndexChange((safeIndex + 1) % gallery.length);
              }}
              className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-rsi border border-rsi-border bg-rsi-bg-deep/90 text-rsi-text shadow-rsi-panel transition-colors hover:border-rsi-accent hover:text-rsi-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)] sm:right-5"
            >
              <NavChevron direction="next" />
            </button>
          </>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
