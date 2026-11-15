"use client";

import { useEffect, useState } from "react";
import type { MarketingOverlaySlide } from "@/lib/marketing/overlays";

export type MarketingOverlayCarouselProps = {
  slides: MarketingOverlaySlide[];
  /** Auto-advance interval in ms (default 8000). */
  intervalMs?: number;
  /** When true, fill the viewport (OBS browser source). */
  isFullscreen?: boolean;
  className?: string;
};

/**
 * Auto-rotating feature overlays for a single OBS aspect-ratio family.
 */
export function MarketingOverlayCarousel({
  slides,
  intervalMs = 8000,
  isFullscreen = false,
  className = "",
}: MarketingOverlayCarouselProps) {
  const [index, setIndex] = useState(0);
  const safeSlides = slides.length > 0 ? slides : [];
  const active = safeSlides[index % Math.max(safeSlides.length, 1)];

  useEffect(() => {
    if (safeSlides.length <= 1) return;
    const id = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % safeSlides.length);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs, safeSlides.length]);

  if (!active) {
    return (
      <p className="font-mono text-sm text-rsi-text-muted">No overlays yet.</p>
    );
  }

  const frameClass = isFullscreen
    ? "flex h-[100dvh] w-[100dvw] items-center justify-center bg-transparent"
    : "relative w-full overflow-hidden border border-rsi-border/70 bg-rsi-bg-deep shadow-[0_18px_50px_rgba(0,0,0,0.35)]";

  return (
    <div
      className={[frameClass, className].filter(Boolean).join(" ")}
      style={
        isFullscreen
          ? undefined
          : { aspectRatio: `${active.width} / ${active.height}` }
      }
      aria-live="polite"
      aria-label={`${active.title}: ${active.caption}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={active.file}
        src={active.file}
        alt={`${active.title} — ${active.caption}`}
        className={
          isFullscreen
            ? "h-full w-full object-contain"
            : "absolute inset-0 h-full w-full object-cover motion-safe:animate-[marketing-fade_0.55s_ease-out]"
        }
        width={active.width}
        height={active.height}
      />
      {!isFullscreen ? (
        <div className="pointer-events-none absolute bottom-3 right-3 flex gap-1.5">
          {safeSlides.map((slide, i) => (
            <span
              key={`${slide.family}-${slide.id}`}
              className={[
                "size-1.5 rounded-full",
                i === index % safeSlides.length
                  ? "bg-rsi-accent"
                  : "bg-rsi-border",
              ].join(" ")}
              aria-hidden
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
