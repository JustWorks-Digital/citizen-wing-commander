import type { CSSProperties, ReactNode } from "react";

/**
 * Ship-end labels for cargo bay sketches.
 * Default (home) orientation: Rear on the left (ramp/aft), Front on the right (nose).
 */

const LABEL_CLASS =
  "pointer-events-none select-none font-mono text-[0.55rem] uppercase tracking-[0.16em] text-rsi-text-muted";

/** Shift Front/Rear toward the grids on up/down (Bay labels sit screen-left). */
const VERTICAL_END_LABEL_NUDGE_PX = 12;

function EndLabel({
  end,
  className,
  style,
}: {
  end: "front" | "rear";
  className?: string;
  style?: CSSProperties;
}) {
  const isFront = end === "front";
  return (
    <span
      title={isFront ? "Nose / fore" : "Ramp / aft"}
      className={[LABEL_CLASS, className].filter(Boolean).join(" ")}
      style={style}
    >
      {isFront ? "Front" : "Rear"}
    </span>
  );
}

export type ShipBayEndsFrameProps = {
  /**
   * When true, swap sides (3D facing pad Right / Up mirrors bay length).
   */
  flipped?: boolean;
  /**
   * `iso`: slant Front/Rear with the classic SE bay (~±30°), matching the
   * 3D floor. `upright`: vertical side rails for the 2D view.
   */
  slant?: "upright" | "iso";
  /**
   * Tighter rails (split view) so Front/Rear sit closer to the grid and
   * are less likely to clip in a narrow pane.
   */
  compact?: boolean;
  /**
   * 2D square facing degrees (0/90/180/270). Drives upright Front/Rear
   * counter-rotation and centering when the bay is turned on end.
   */
  squareDegrees?: number;
  className?: string;
  children: ReactNode;
};

/**
 * Same footprint as the 2D “Zone 1” header so Front/Rear center on the grids,
 * not on the label+grid column (home / left / right only).
 */
function BayLabelSpacer() {
  return (
    <span
      className="pointer-events-none invisible shrink-0 select-none font-mono text-[0.55rem] uppercase tracking-[0.14em]"
      aria-hidden
    >
      Zone 1
    </span>
  );
}

function EndRail({
  end,
  iso,
  railWidth,
  labelClassName,
  labelStyle,
  /** Match Zone N chrome: before = home/left; after = right (180°). */
  baySpacer,
}: {
  end: "front" | "rear";
  iso: boolean;
  railWidth: string;
  labelClassName: string;
  labelStyle?: CSSProperties;
  baySpacer: "before" | "after" | "none";
}) {
  const label = (
    <EndLabel end={end} className={labelClassName} style={labelStyle} />
  );

  if (iso) {
    return (
      <div
        className={[
          "flex shrink-0 items-center justify-center self-stretch",
          railWidth,
        ].join(" ")}
      >
        {label}
      </div>
    );
  }

  return (
    <div
      className={[
        "flex shrink-0 flex-col items-center gap-1.5 self-stretch",
        railWidth,
      ].join(" ")}
    >
      {baySpacer === "before" ? <BayLabelSpacer /> : null}
      <div className="flex min-h-0 flex-1 items-center justify-center">
        {label}
      </div>
      {baySpacer === "after" ? <BayLabelSpacer /> : null}
    </div>
  );
}

/**
 * Upright (2D) Front/Rear chrome for a given square facing.
 * Bottom end gets +180° so it reads L→R; vertical facings nudge toward grids.
 *
 * With parent `rotate(d)` and label `rotate(rot) translate(tx,0)` (translate
 * first), when net rotation is 0 the translate is in screen space — so +tx
 * moves Front/Rear toward screen-right (onto the grids).
 */
function uprightEndChrome(
  side: "left" | "right",
  degrees: number,
): { className: string; style?: CSSProperties } {
  const d = ((degrees % 360) + 360) % 360;
  // Home: left −90°, right +90°.
  let rot = side === "left" ? -90 : 90;
  // After parent rotate, the screen-bottom end is upside down — flip it.
  if (d === 90 && side === "right") rot += 180;
  if (d === 270 && side === "left") rot += 180;

  const nudge =
    d === 90 || d === 270 ? VERTICAL_END_LABEL_NUDGE_PX : 0;

  return {
    className: "max-w-[5rem] whitespace-nowrap",
    style: {
      transform:
        nudge > 0
          ? `rotate(${rot}deg) translate(${nudge}px, 0)`
          : `rotate(${rot}deg)`,
    },
  };
}

/**
 * Wraps bay sketch content with Front / Rear rails
 * (Rear left · Front right by default).
 */
export function ShipBayEndsFrame({
  flipped = false,
  slant = "upright",
  compact = false,
  squareDegrees = 0,
  className,
  children,
}: ShipBayEndsFrameProps) {
  const left = flipped ? "front" : "rear";
  const right = flipped ? "rear" : "front";
  const iso = slant === "iso";
  const railWidth = compact ? "w-8" : "w-11";
  const gap = compact ? "gap-2" : "gap-4";
  const d = ((squareDegrees % 360) + 360) % 360;
  // Home/left: Zone N above grid → spacer before label.
  // Right (180°): Zone N below grid locally (screen-above after turn) → spacer after.
  // Up/down: Zone N screen-left → no spacer; ends center on grids.
  const baySpacer: "before" | "after" | "none" = iso
    ? "none"
    : d === 180
      ? "after"
      : d === 90 || d === 270
        ? "none"
        : "before";

  const leftChrome = iso
    ? {
        className: "max-w-[5.5rem] whitespace-nowrap",
        style: {
          transform: flipped ? "rotate(30deg)" : "rotate(-30deg)",
        } as CSSProperties,
      }
    : uprightEndChrome("left", d);
  const rightChrome = iso
    ? {
        className: "max-w-[5.5rem] whitespace-nowrap",
        style: {
          transform: flipped ? "rotate(-30deg)" : "rotate(30deg)",
        } as CSSProperties,
      }
    : uprightEndChrome("right", d);

  return (
    <div
      className={["flex items-center justify-center", gap, className]
        .filter(Boolean)
        .join(" ")}
    >
      <EndRail
        end={left}
        iso={iso}
        railWidth={railWidth}
        labelClassName={leftChrome.className}
        labelStyle={leftChrome.style}
        baySpacer={baySpacer}
      />
      <div className="min-w-0 shrink">{children}</div>
      <EndRail
        end={right}
        iso={iso}
        railWidth={railWidth}
        labelClassName={rightChrome.className}
        labelStyle={rightChrome.style}
        baySpacer={baySpacer}
      />
    </div>
  );
}
