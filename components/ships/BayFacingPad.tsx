"use client";

/**
 * Compass pad for bay view direction (2D square turns + 3D iso facings).
 * Home / Left share the default orientation; arrows are 90° / view flips.
 */

export type BayFacing = "home" | "down" | "up" | "left" | "right";

export const defaultBayFacing: BayFacing = "home";

/**
 * CSS degrees for the 2D top grid — square snaps only (no iso skew).
 * Home/left: rear left · front right. Right: 180°. Down/up: ±90°.
 */
export function bayFacingSquareDegrees(facing: BayFacing): number {
  switch (facing) {
    case "home":
    case "left":
      return 0;
    case "right":
      return 180;
    case "down":
      return 90;
    case "up":
      return 270;
  }
}

/** Extra screen-left nudge for Bay labels on up/down (translate only; grid stays put). */
const VERTICAL_BAY_LABEL_NUDGE_PX = 14;

/**
 * Layout for "Zone N" labels inside a CSS-rotated top view.
 * Counter-rotates text so it stays horizontal. Home/left/right: label sits
 * screen-above the grid. Up/down: label sits screen-left (nudge via translate).
 */
export function topBayLabelChrome(degrees: number): {
  columnClass: string;
  /** When false, render the label after the grid (local “below”). */
  labelBeforeGrid: boolean;
  /**
   * Child transform. With parent `rotate(d)`, `rotate(-d) translate(tx,ty)`
   * applies `(tx,ty)` in screen space (grid layout unchanged).
   */
  labelTransform: string | undefined;
} {
  const d = ((degrees % 360) + 360) % 360;
  const column = "flex flex-col items-center gap-1.5";
  if (d === 0) {
    return {
      columnClass: column,
      labelBeforeGrid: true,
      labelTransform: undefined,
    };
  }
  if (d === 90) {
    // Local below → screen-left; translate further screen-left.
    return {
      columnClass: column,
      labelBeforeGrid: false,
      labelTransform: `rotate(${-d}deg) translate(-${VERTICAL_BAY_LABEL_NUDGE_PX}px, 0)`,
    };
  }
  if (d === 180) {
    // Local below → screen-above (same as home/left).
    return {
      columnClass: column,
      labelBeforeGrid: false,
      labelTransform: `rotate(${-d}deg)`,
    };
  }
  // 270°: local above → screen-left; translate further screen-left.
  return {
    columnClass: column,
    labelBeforeGrid: true,
    labelTransform: `rotate(${-d}deg) translate(-${VERTICAL_BAY_LABEL_NUDGE_PX}px, 0)`,
  };
}

function DefaultFacingIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 12 12"
      className={className}
      aria-hidden
      focusable="false"
    >
      <path
        d="M6 1.4 L10.4 3.9 L6 6.4 L1.6 3.9 Z"
        fill="currentColor"
        opacity="0.95"
      />
      <path
        d="M1.6 3.9 L6 6.4 L6 10.6 L1.6 8.1 Z"
        fill="currentColor"
        opacity="0.55"
      />
      <path
        d="M6 6.4 L10.4 3.9 L10.4 8.1 L6 10.6 Z"
        fill="currentColor"
        opacity="0.7"
      />
    </svg>
  );
}

export type BayFacingPadProps = {
  facing: BayFacing;
  onFacingChange: (facing: BayFacing) => void;
  /** Accessible name for the control group. */
  ariaLabel?: string;
};

export function BayFacingPad({
  facing,
  onFacingChange,
  ariaLabel = "Bay view direction",
}: BayFacingPadProps) {
  const buttonClass = (id: BayFacing) =>
    [
      "inline-flex size-5 items-center justify-center rounded-[3px] border font-mono text-[0.55rem] leading-none transition-colors",
      facing === id
        ? "border-rsi-accent/50 bg-rsi-accent-muted/40 text-rsi-accent"
        : "border-rsi-border bg-rsi-bg-deep/80 text-rsi-text-secondary hover:border-rsi-border-strong hover:text-rsi-text",
    ].join(" ");

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="pointer-events-auto absolute bottom-2 left-2 z-20 grid grid-cols-3 gap-px"
    >
      <span className="size-5" aria-hidden />
      <button
        type="button"
        aria-pressed={facing === "up"}
        aria-label="View up"
        title="Up"
        onClick={() => onFacingChange("up")}
        className={buttonClass("up")}
      >
        ↑
      </button>
      <span className="size-5" aria-hidden />
      <button
        type="button"
        aria-pressed={facing === "left"}
        aria-label="View left"
        title="Left"
        onClick={() => onFacingChange("left")}
        className={buttonClass("left")}
      >
        ←
      </button>
      <button
        type="button"
        aria-pressed={facing === "home"}
        aria-label="View default"
        title="Default"
        onClick={() => onFacingChange("home")}
        className={buttonClass("home")}
      >
        <DefaultFacingIcon className="size-2.5" />
      </button>
      <button
        type="button"
        aria-pressed={facing === "right"}
        aria-label="View right"
        title="Right"
        onClick={() => onFacingChange("right")}
        className={buttonClass("right")}
      >
        →
      </button>
      <span className="size-5" aria-hidden />
      <button
        type="button"
        aria-pressed={facing === "down"}
        aria-label="View down"
        title="Down"
        onClick={() => onFacingChange("down")}
        className={buttonClass("down")}
      >
        ↓
      </button>
      <span className="size-5" aria-hidden />
    </div>
  );
}
