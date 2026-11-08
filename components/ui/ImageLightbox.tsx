"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

export type ImageLightboxProps = {
  src: string;
  alt?: string;
  title?: string;
  onClose: () => void;
};

/** Full-viewport lightbox; image scales to page width and keeps aspect ratio. */
export function ImageLightbox({
  src,
  alt = "",
  title,
  onClose,
}: ImageLightboxProps) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title || alt || "Image preview"}
      className="fixed inset-0 z-[80] flex flex-col bg-rsi-bg"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-rsi-border bg-rsi-bg-deep/80 px-4 py-3">
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-rsi-text-muted">
          {title || "Reference"}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-rsi border border-rsi-border bg-rsi-surface px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-rsi-text-secondary transition-colors hover:border-rsi-border-strong hover:text-rsi-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]"
        >
          Close
        </button>
      </div>
      <div
        className="relative min-h-0 flex-1 overflow-auto bg-rsi-bg-deep/40 p-4"
        onClick={onClose}
      >
        <div className="flex min-h-full w-full items-start justify-center">
          {/* Fit page width; keep aspect ratio (no crop). */}
          <img
            src={src}
            alt={alt}
            className="h-auto w-full max-w-full select-none"
            draggable={false}
            onClick={(event) => {
              event.stopPropagation();
            }}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
