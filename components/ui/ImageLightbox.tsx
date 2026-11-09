"use client";

import { useEffect } from "react";
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

/** Full-viewport lightbox; image scales to page width and keeps aspect ratio. */
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
    items && items.length > 0
      ? items
      : [{ src, alt, title }];
  const safeIndex = Math.min(Math.max(0, index), gallery.length - 1);
  const current = gallery[safeIndex] ?? { src, alt, title };
  const hasGallery = gallery.length > 1 && Boolean(onIndexChange);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
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
        {hasGallery ? (
          <p className="shrink-0 font-mono text-[0.65rem] tabular-nums tracking-[0.14em] text-rsi-text-secondary">
            {safeIndex + 1} / {gallery.length}
          </p>
        ) : null}
        <ModalCloseButton onClick={onClose} />
      </div>
      <div
        className="relative min-h-0 flex-1 overflow-auto bg-rsi-bg-deep/40 p-4"
        onClick={onClose}
      >
        <div className="flex min-h-full w-full items-start justify-center">
          {/* Fit page width; keep aspect ratio (no crop). */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current.src}
            alt={current.alt || alt}
            className="h-auto w-full max-w-full select-none"
            draggable={false}
            onClick={(event) => {
              event.stopPropagation();
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
