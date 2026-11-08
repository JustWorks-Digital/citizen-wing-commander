"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { getOutdoorFreightReferenceSrc } from "@/lib/fixtures/outdoorFreightReferences";

export type OutdoorFreightIconProps = {
  /** Wiki location slug — selects the station-specific reference photo. */
  locationSlug: string;
  tooltipDelayMs?: number;
  /** Visual size — use `preview` while iterating on the glyph; `xs` for badges. */
  size?: "xs" | "sm" | "md" | "preview";
  /** Keep tooltip open (Storybook / sample previews). */
  forceOpen?: boolean;
  className?: string;
};

const SIZE_CLASS = {
  xs: { hit: "size-3.5", glyph: "size-3" },
  sm: { hit: "size-5", glyph: "size-4" },
  md: { hit: "size-8", glyph: "size-7" },
  /** Large review size so the glyph can be inspected and adjusted. */
  preview: { hit: "size-32", glyph: "size-28" },
} as const;

/** Marks a location that has an outdoor / external freight elevator (UEX). */
export function OutdoorFreightIcon({
  locationSlug,
  tooltipDelayMs = 450,
  size = "sm",
  forceOpen = false,
  className = "",
}: OutdoorFreightIconProps) {
  const sizeClass = SIZE_CLASS[size];
  const referenceSrc = getOutdoorFreightReferenceSrc(locationSlug);
  const tooltipId = useId();
  const [isOpen, setIsOpen] = useState(forceOpen);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const showTooltip = forceOpen || isOpen || isLightboxOpen;
  const showTimer = useRef<number | null>(null);
  const hideTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (showTimer.current != null) window.clearTimeout(showTimer.current);
      if (hideTimer.current != null) window.clearTimeout(hideTimer.current);
    };
  }, []);

  const clearTimers = () => {
    if (showTimer.current != null) {
      window.clearTimeout(showTimer.current);
      showTimer.current = null;
    }
    if (hideTimer.current != null) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };

  const openLightbox = () => {
    if (!referenceSrc) return;
    clearTimers();
    setIsLightboxOpen(true);
    setIsOpen(false);
  };

  return (
    <>
      <span
        className="relative inline-flex"
        onMouseEnter={() => {
          if (isLightboxOpen) return;
          clearTimers();
          showTimer.current = window.setTimeout(() => {
            setIsOpen(true);
          }, tooltipDelayMs);
        }}
        onMouseLeave={() => {
          if (isLightboxOpen) return;
          clearTimers();
          hideTimer.current = window.setTimeout(() => {
            setIsOpen(false);
          }, 80);
        }}
        onFocus={() => {
          if (isLightboxOpen) return;
          clearTimers();
          showTimer.current = window.setTimeout(() => {
            setIsOpen(true);
          }, tooltipDelayMs);
        }}
        onBlur={() => {
          if (isLightboxOpen) return;
          clearTimers();
          setIsOpen(false);
        }}
      >
        <span
          role="img"
          aria-label="Outdoor freight elevator"
          aria-describedby={showTooltip ? tooltipId : undefined}
          tabIndex={0}
          className={[
            "inline-flex shrink-0 items-center justify-center rounded-sm text-rsi-text-secondary outline-none",
            "focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
            sizeClass.hit,
            className,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {/* Front-on outdoor FE bay: frame, hazard sides, grated deck */}
          <svg
            aria-hidden
            viewBox="0 0 20 20"
            fill="none"
            className={sizeClass.glyph}
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Bay frame */}
            <rect
              x="2.5"
              y="3.5"
              width="15"
              height="13"
              rx="0.75"
              stroke="currentColor"
              strokeWidth="1.2"
            />
            {/* Hazard stripes (L/R) */}
            <g stroke="var(--rsi-warn)" strokeWidth="1.15" strokeLinecap="square">
              <path d="M3.2 5.2l1.5 1.5M3.2 7.4l1.5 1.5M3.2 9.6l1.5 1.5M3.2 11.8l1.5 1.5" />
              <path d="M15.3 5.2l1.5 1.5M15.3 7.4l1.5 1.5M15.3 9.6l1.5 1.5M15.3 11.8l1.5 1.5" />
            </g>
            {/* Grated platform (2× prior width) */}
            <rect
              x="4.5"
              y="6"
              width="11"
              height="7.5"
              rx="0.4"
              stroke="currentColor"
              strokeWidth="1"
            />
            <path
              d="M6.1 6.8v6M7.9 6.8v6M9.7 6.8v6M11.5 6.8v6M13.3 6.8v6"
              stroke="currentColor"
              strokeWidth="0.9"
              opacity="0.75"
            />
          </svg>
        </span>
        {showTooltip ? (
          <span
            id={tooltipId}
            role="tooltip"
            className="absolute bottom-full left-0 z-20 mb-1.5 inline-flex w-max flex-col gap-1.5 rounded-rsi border border-rsi-border bg-rsi-bg-deep px-2 py-1.5 shadow-rsi-panel"
          >
            {referenceSrc ? (
              <button
                type="button"
                onClick={openLightbox}
                className="block cursor-zoom-in rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]"
                aria-label="Open outdoor freight elevator photo full screen"
              >
                <img
                  src={referenceSrc}
                  alt=""
                  className="block h-auto w-0 min-w-full rounded-sm object-cover"
                />
              </button>
            ) : null}
            <span className="whitespace-nowrap font-mono text-[0.65rem] tracking-wide text-rsi-text">
              Outdoor freight elevator
            </span>
          </span>
        ) : null}
      </span>
      {isLightboxOpen && referenceSrc ? (
        <ImageLightbox
          src={referenceSrc}
          alt="Outdoor freight elevator"
          title="Outdoor freight elevator"
          onClose={() => {
            setIsLightboxOpen(false);
          }}
        />
      ) : null}
    </>
  );
}
