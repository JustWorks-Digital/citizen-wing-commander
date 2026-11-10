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
   * 3D floor. `upright`: vertical side rails for the top view.
   */
  slant?: "upright" | "iso";
  className?: string;
  children: ReactNode;
};

/**
 * Wraps bay sketch content with Front / Rear rails
 * (Rear left · Front right by default).
 */
export function ShipBayEndsFrame({
  flipped = false,
  slant = "upright",
  className,
  children,
}: ShipBayEndsFrameProps) {
  const left = flipped ? "front" : "rear";
  const right = flipped ? "rear" : "front";
  const iso = slant === "iso";

  return (
    <div
      className={["flex items-center justify-center gap-4", className]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex w-11 shrink-0 items-center justify-center self-stretch">
        <EndLabel
          end={left}
          className={
            iso
              ? "max-w-[5.5rem] whitespace-nowrap"
              : "max-w-[5rem] -rotate-90 whitespace-nowrap"
          }
          style={
            iso
              ? {
                  // Parallel to the SE-iso floor edge on the ramp/aft side.
                  transform: flipped ? "rotate(30deg)" : "rotate(-30deg)",
                }
              : undefined
          }
        />
      </div>
      <div className="min-w-0 shrink">{children}</div>
      <div className="flex w-11 shrink-0 items-center justify-center self-stretch">
        <EndLabel
          end={right}
          className={
            iso
              ? "max-w-[5.5rem] whitespace-nowrap"
              : "max-w-[5rem] rotate-90 whitespace-nowrap"
          }
          style={
            iso
              ? {
                  transform: flipped ? "rotate(-30deg)" : "rotate(30deg)",
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}
