"use client";

import { useEffect, useId, useRef, useState } from "react";
import { getCommodityIconSrc } from "@/lib/fixtures";
import { namedCommodityColorToHex } from "@/lib/fixtures/commodityColors";

export type CommodityIconProps = {
  commoditySlug: string;
  label: string;
  color?: string | null;
  color2?: string | null;
  size?: "sm" | "md";
  /** Hover delay before the tooltip appears (ms). */
  tooltipDelayMs?: number;
  /** When false, no hover/focus tooltip (use when the label is shown inline). */
  showTooltip?: boolean;
};

const SIZE_CLASS = {
  sm: "size-4",
  md: "size-5",
} as const;

/**
 * Color-tinted commodity icon with a delayed hover tooltip (commodity name).
 */
export function CommodityIcon({
  commoditySlug,
  label,
  color,
  color2,
  size = "sm",
  tooltipDelayMs = 450,
  showTooltip = true,
}: CommodityIconProps) {
  const tooltipId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const showTimer = useRef<number | null>(null);
  const hideTimer = useRef<number | null>(null);
  const iconSrc = getCommodityIconSrc(commoditySlug);
  const cargoHex =
    namedCommodityColorToHex(color) ?? namedCommodityColorToHex(color2);

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

  const openSoon = () => {
    if (!showTooltip) return;
    clearTimers();
    showTimer.current = window.setTimeout(() => {
      setIsOpen(true);
    }, tooltipDelayMs);
  };

  const closeSoon = () => {
    if (!showTooltip) return;
    clearTimers();
    hideTimer.current = window.setTimeout(() => {
      setIsOpen(false);
    }, 80);
  };

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={openSoon}
      onMouseLeave={closeSoon}
      onFocus={openSoon}
      onBlur={closeSoon}
    >
      <span
        role="img"
        aria-label={label}
        aria-describedby={isOpen ? tooltipId : undefined}
        tabIndex={showTooltip ? 0 : undefined}
        className={[
          "inline-block shrink-0 rounded-sm outline-none",
          "focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
          SIZE_CLASS[size],
          cargoHex ? "text-[inherit]" : "text-rsi-text-muted",
        ].join(" ")}
        style={cargoHex ? { color: cargoHex } : undefined}
      >
        <span
          aria-hidden
          className="block size-full bg-current"
          style={{
            WebkitMaskImage: `url(${iconSrc})`,
            maskImage: `url(${iconSrc})`,
            WebkitMaskSize: "contain",
            maskSize: "contain",
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
            WebkitMaskPosition: "center",
            maskPosition: "center",
          }}
        />
      </span>
      {showTooltip && isOpen ? (
        <span
          id={tooltipId}
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-rsi border border-rsi-border bg-rsi-bg-deep px-2 py-1 font-mono text-[0.65rem] tracking-wide text-rsi-text shadow-rsi-panel"
        >
          {label}
        </span>
      ) : null}
    </span>
  );
}
