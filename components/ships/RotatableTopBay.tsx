"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

export type RotatableTopBayProps = {
  /** CSS degrees; 90° snaps only for the top grid. */
  degrees: number;
  className?: string;
  children: ReactNode;
};

/**
 * Rotates 2D bay content in square increments and swaps the layout box
 * on quarter turns so Front/Rear rails stay inside the scroll area.
 */
export function RotatableTopBay({
  degrees,
  className,
  children,
}: RotatableTopBayProps) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const normalized = ((degrees % 360) + 360) % 360;
  const quarterTurn = normalized === 90 || normalized === 270;

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const measure = () => {
      setSize({ width: el.offsetWidth, height: el.offsetHeight });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [children, normalized]);

  const boxStyle: CSSProperties | undefined =
    size.width > 0 && size.height > 0
      ? {
          width: quarterTurn ? size.height : size.width,
          height: quarterTurn ? size.width : size.height,
        }
      : undefined;

  return (
    <div
      className={["relative flex items-center justify-center", className]
        .filter(Boolean)
        .join(" ")}
      style={boxStyle ?? {}}
    >
      <div
        ref={innerRef}
        className="origin-center"
        style={{ transform: `rotate(${normalized}deg)` }}
      >
        {children}
      </div>
    </div>
  );
}
