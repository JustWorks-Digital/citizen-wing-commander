import type { CSSProperties, ReactNode } from "react";

/**
 * Ship-end labels for cargo bay sketches.
 * Default (home) orientation: Rear on the left (ramp/aft), Front on the right (nose).
 */

const LABEL_CLASS =
  "pointer-events-none select-none font-mono text-[0.55rem] uppercase tracking-[0.16em] text-rsi-text-muted";

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
  className?: string;
  children: ReactNode;
};

/**
 * Same footprint as the 2D “Bay N” header so Front/Rear center on the grids,
 * not on the label+grid column.
 */
function BayLabelSpacer() {
  return (
    <span
      className="pointer-events-none invisible shrink-0 select-none font-mono text-[0.55rem] uppercase tracking-[0.14em]"
      aria-hidden
    >
      Bay 0
    </span>
  );
}

function EndRail({
  end,
  iso,
  railWidth,
  labelClassName,
  labelStyle,
}: {
  end: "front" | "rear";
  iso: boolean;
  railWidth: string;
  labelClassName: string;
  labelStyle?: CSSProperties;
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
      <BayLabelSpacer />
      <div className="flex min-h-0 flex-1 items-center justify-center">
        {label}
      </div>
    </div>
  );
}

/**
 * Wraps bay sketch content with Front / Rear rails
 * (Rear left · Front right by default).
 */
export function ShipBayEndsFrame({
  flipped = false,
  slant = "upright",
  compact = false,
  className,
  children,
}: ShipBayEndsFrameProps) {
  const left = flipped ? "front" : "rear";
  const right = flipped ? "rear" : "front";
  const iso = slant === "iso";
  const railWidth = compact ? "w-8" : "w-11";
  const gap = compact ? "gap-2" : "gap-4";

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
        labelClassName={
          iso
            ? "max-w-[5.5rem] whitespace-nowrap"
            : "max-w-[5rem] -rotate-90 whitespace-nowrap"
        }
        labelStyle={
          iso
            ? {
                // Parallel to the SE-iso floor edge on the ramp/aft side.
                transform: flipped ? "rotate(30deg)" : "rotate(-30deg)",
              }
            : undefined
        }
      />
      <div className="min-w-0 shrink">{children}</div>
      <EndRail
        end={right}
        iso={iso}
        railWidth={railWidth}
        labelClassName={
          iso
            ? "max-w-[5.5rem] whitespace-nowrap"
            : "max-w-[5rem] rotate-90 whitespace-nowrap"
        }
        labelStyle={
          iso
            ? {
                transform: flipped ? "rotate(-30deg)" : "rotate(30deg)",
              }
            : undefined
        }
      />
    </div>
  );
}
