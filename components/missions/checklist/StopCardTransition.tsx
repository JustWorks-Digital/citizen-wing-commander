"use client";

import {
  useLayoutEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

/** Done pinwheel — brief feedback before the slide. */
export const STOP_COMPLETE_SPINNER_MS = 180;
/** One shared slide duration for leave + enter. */
export const STOP_SLIDE_MS = 300;

export type StopHandoffPhase = "spinning" | "sliding";

export type StopCompleteHandoff = {
  fromStopId: string;
  toStopId: string | null;
  phase: StopHandoffPhase;
};

export type StopBodyMotion = "open" | "closed" | "slide-up" | "slide-down";

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const SLIDE_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

/**
 * Stop body reveal — height + vertical slide in one motion.
 * `slide-up` = leaving (collapse while content moves up).
 * `slide-down` = entering (expand while content moves down into place).
 */
export function StopBodyReveal({
  motion,
  children,
  className,
}: {
  motion: StopBodyMotion;
  children: ReactNode;
  className?: string;
}) {
  const animating = motion === "slide-up" || motion === "slide-down";
  /** `from` = first painted frame of a slide; `to` = animate toward end state. */
  const [slideTick, setSlideTick] = useState<"from" | "to">("from");

  useLayoutEffect(() => {
    if (!animating) {
      setSlideTick("from");
      return;
    }
    setSlideTick("from");
    const id = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setSlideTick("to"));
    });
    return () => window.cancelAnimationFrame(id);
  }, [animating, motion]);

  const expanded =
    motion === "open" ||
    (motion === "slide-up" && slideTick === "from") ||
    (motion === "slide-down" && slideTick === "to");

  const slidAway =
    (motion === "slide-up" && slideTick === "to") ||
    (motion === "slide-down" && slideTick === "from");

  const durationMs = animating ? STOP_SLIDE_MS : 0;
  const gridStyle: CSSProperties = {
    transitionProperty: "grid-template-rows",
    transitionDuration: `${durationMs}ms`,
    transitionTimingFunction: SLIDE_EASE,
  };
  const contentStyle: CSSProperties = {
    transitionProperty: "transform, opacity",
    transitionDuration: `${durationMs}ms`,
    transitionTimingFunction: SLIDE_EASE,
  };

  return (
    <div
      className={[
        "grid motion-reduce:transition-none",
        expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={gridStyle}
    >
      <div className="min-h-0 overflow-hidden">
        <div
          className={[
            "origin-top will-change-transform motion-reduce:transition-none motion-reduce:transform-none",
            slidAway
              ? motion === "slide-up"
                ? "-translate-y-6 opacity-0"
                : "translate-y-6 opacity-0"
              : "translate-y-0 opacity-100",
          ].join(" ")}
          style={contentStyle}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
