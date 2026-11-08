"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";

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
      <div className="relative flex shrink-0 items-center border-b border-rsi-border bg-rsi-bg-deep/80 px-4 py-3 pr-12 sm:pr-14">
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-rsi-text-muted">
          {title || "Reference"}
        </p>
        <ModalCloseButton onClick={onClose} />
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
