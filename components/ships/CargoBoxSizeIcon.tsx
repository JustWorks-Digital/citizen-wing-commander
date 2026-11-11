import type { CargoBoxScu } from "@/lib/ships/cargoBoxSizes";
import { cargoBoxOrientations } from "@/lib/ships/cargoBoxSizes";

export type CargoBoxSizeIconProps = {
  size: CargoBoxScu;
  /** Fill color for the crate faces (commodity tint). */
  color?: string;
  className?: string;
  title?: string;
};

type Pt = { x: number; y: number };

function project(lx: number, wy: number, hz: number): Pt {
  const cos = Math.cos(Math.PI / 6);
  const sin = Math.sin(Math.PI / 6);
  const s = 3.2;
  return {
    x: (lx - wy) * s * cos,
    y: (lx + wy) * s * sin - hz * s,
  };
}

function poly(points: Pt[]): string {
  return points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
}

/**
 * Miniature isometric glyph for a 32 / 16 / 8 / 4 / 2 / 1 SCU crate footprint.
 * Uses the same visible faces + shading as CargoGridIsoView crates.
 */
export function CargoBoxSizeIcon({
  size,
  color = "#54a0f7",
  className,
  title,
}: CargoBoxSizeIconProps) {
  const footprint = cargoBoxOrientations(size)[0]!;
  const { dx, dy, dz } = footprint;

  // Same corner layout as IsoView `boxFaces` (origin at floor, top at +dz).
  const topA = project(0, 0, dz);
  const topB = project(dx, 0, dz);
  const topC = project(dx, dy, dz);
  const topD = project(0, dy, dz);
  const botB = project(dx, 0, 0);
  const botC = project(dx, dy, 0);
  const botD = project(0, dy, 0);

  // Frame at least 8 SCU (2×2×2); larger crates expand the view so they fit.
  const frameSize = size >= 16 ? size : 8;
  const frame = cargoBoxOrientations(frameSize)[0]!;
  const frameCorners = [
    project(0, 0, frame.dz),
    project(frame.dx, 0, frame.dz),
    project(frame.dx, frame.dy, frame.dz),
    project(0, frame.dy, frame.dz),
    project(frame.dx, 0, 0),
    project(frame.dx, frame.dy, 0),
    project(0, frame.dy, 0),
  ];
  const xs = frameCorners.map((p) => p.x);
  const ys = frameCorners.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const pad = 1.2;
  const vb = `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`;

  // Match `facesFromCommodityHex` in CargoGridIsoView.
  const topFill = color;
  const leftFill = `color-mix(in srgb, ${color} 55%, black)`;
  const rightFill = `color-mix(in srgb, ${color} 68%, black)`;

  return (
    <svg
      viewBox={vb}
      className={["inline-block size-4.5 shrink-0", className]
        .filter(Boolean)
        .join(" ")}
      role="img"
      aria-label={title ?? `${size} SCU crate`}
    >
      {title ? <title>{title}</title> : null}
      {/* South (+Y) — left iso face */}
      <polygon
        points={poly([topD, topC, botC, botD])}
        fill={leftFill}
        stroke="var(--rsi-border)"
        strokeWidth={0.35}
      />
      {/* East (+X) — right iso face */}
      <polygon
        points={poly([topB, topC, botC, botB])}
        fill={rightFill}
        stroke="var(--rsi-border)"
        strokeWidth={0.35}
      />
      <polygon
        points={poly([topA, topB, topC, topD])}
        fill={topFill}
        stroke="var(--rsi-border-strong)"
        strokeWidth={0.4}
      />
    </svg>
  );
}

export type CargoBoxCountIconsProps = {
  boxCounts: Array<{ size: number; count: number }>;
  color?: string;
  className?: string;
};

/** Compact `icon×count` groups for each crate size present. */
export function CargoBoxCountIcons({
  boxCounts,
  color,
  className,
}: CargoBoxCountIconsProps) {
  const entries = boxCounts.filter(
    (entry): entry is { size: CargoBoxScu; count: number } =>
      entry.count > 0 &&
      (entry.size === 32 ||
        entry.size === 16 ||
        entry.size === 8 ||
        entry.size === 4 ||
        entry.size === 2 ||
        entry.size === 1),
  );
  if (entries.length === 0) return null;

  return (
    <span
      className={[
        "inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {entries.map(({ size, count }) => (
        <span
          key={size}
          className="inline-flex items-center gap-0.5 font-mono text-[0.65rem] tabular-nums text-rsi-text-muted"
          title={`${count}×${size} SCU`}
        >
          <CargoBoxSizeIcon size={size} color={color} />
          <span>{count}</span>
        </span>
      ))}
    </span>
  );
}
