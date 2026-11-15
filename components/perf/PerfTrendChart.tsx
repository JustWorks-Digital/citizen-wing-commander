"use client";

import { useMemo, useState } from "react";
import type { PerfTrendSeries } from "@/lib/perf/trends";

const SERIES_COLORS = [
  "#7bc1f9", // accent hover (brighter cornflower)
  "#4fd4a3", // brighter success
  "#f0b84a", // brighter gold
  "#a8d7fc", // light accent
  "#f07070", // brighter danger
  "#c5ced6", // brighter secondary
];

type PerfTrendChartProps = {
  series: PerfTrendSeries[];
  title?: string;
  /** Display unit label (ms or MB). */
  valueLabel?: string;
  height?: number;
};

function formatTick(value: number, unit: "ms" | "bytes"): string {
  if (unit === "bytes") return `${(value / (1024 * 1024)).toFixed(0)}`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}s`;
  return `${Math.round(value)}`;
}

function shortTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/**
 * Multi-series SVG line chart for saved-run p50 trends (local perf page).
 */
export function PerfTrendChart({
  series,
  title = "p50 over saved runs",
  valueLabel = "ms",
  height = 220,
}: PerfTrendChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());

  const visible = useMemo(
    () => series.filter((s) => !hidden.has(s.key)),
    [series, hidden],
  );

  const pointCount = series[0]?.points.length ?? 0;
  const unit = series[0]?.unit ?? "ms";

  const { maxY, pathByKey, xAt } = useMemo(() => {
    const width = 640;
    const padL = 44;
    const padR = 12;
    const padT = 12;
    const padB = 28;
    const innerW = width - padL - padR;
    const innerH = height - padT - padB;

    let max = 0;
    for (const s of visible) {
      for (const p of s.points) {
        if (p.p50 != null && p.p50 > max) max = p.p50;
      }
    }
    if (max <= 0) max = 1;
    max *= 1.08;

    const xAtIndex = (i: number) =>
      padL + (pointCount <= 1 ? innerW / 2 : (i / (pointCount - 1)) * innerW);
    const yAt = (v: number) => padT + innerH - (v / max) * innerH;

    const paths = new Map<string, string>();
    for (const s of visible) {
      const parts: string[] = [];
      s.points.forEach((p, i) => {
        if (p.p50 == null) return;
        const cmd = parts.length === 0 ? "M" : "L";
        parts.push(`${cmd}${xAtIndex(i).toFixed(1)} ${yAt(p.p50).toFixed(1)}`);
      });
      paths.set(s.key, parts.join(" "));
    }

    return { maxY: max, pathByKey: paths, xAt: xAtIndex, padL, padT, padB, width, innerH };
  }, [visible, pointCount, height]);

  if (pointCount === 0 || series.length === 0) {
    return (
      <p className="text-sm text-rsi-text-muted">
        Save a few runs to see trends.
      </p>
    );
  }

  const width = 640;
  const padL = 44;
  const padT = 12;
  const padB = 28;
  const innerH = height - padT - padB;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => maxY * t);

  const toggle = (key: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="rounded-rsi border border-rsi-border bg-rsi-surface/80 p-3">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <h3 className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-rsi-text-muted">
          {title}
        </h3>
        <p className="font-mono text-[0.6rem] text-rsi-text-muted">
          {pointCount} runs · {valueLabel}
        </p>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {series.map((s, i) => {
          const color = SERIES_COLORS[i % SERIES_COLORS.length]!;
          const on = !hidden.has(s.key);
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => toggle(s.key)}
              className={[
                "inline-flex items-center gap-1.5 rounded-rsi border px-2 py-0.5 font-mono text-[0.55rem] uppercase tracking-[0.1em] transition-colors",
                on
                  ? "border-rsi-border-strong text-rsi-text-secondary"
                  : "border-rsi-border/50 text-rsi-text-muted opacity-50",
              ].join(" ")}
            >
              <span
                className="inline-block size-1.5 rounded-full"
                style={{ background: on ? color : "#7d8a97" }}
              />
              {s.kind}/{s.name}
            </button>
          );
        })}
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={title}
        onMouseLeave={() => setHover(null)}
      >
        {yTicks.map((v, i) => {
          const y = padT + innerH - (v / maxY) * innerH;
          return (
            <g key={i}>
              <line
                x1={padL}
                x2={width - 12}
                y1={y}
                y2={y}
                stroke="#2f4056"
                strokeDasharray="3 4"
              />
              <text
                x={padL - 6}
                y={y + 3}
                textAnchor="end"
                className="fill-rsi-text-muted"
                style={{ fontSize: 9, fontFamily: "var(--font-jetbrains)" }}
              >
                {formatTick(v, unit)}
              </text>
            </g>
          );
        })}

        {visible.map((s, i) => {
          const color =
            SERIES_COLORS[series.indexOf(s) % SERIES_COLORS.length] ??
            SERIES_COLORS[i]!;
          const d = pathByKey.get(s.key);
          if (!d) return null;
          return (
            <path
              key={s.key}
              d={d}
              fill="none"
              stroke={color}
              strokeWidth={1.25}
              strokeLinejoin="round"
              strokeLinecap="butt"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}

        {Array.from({ length: pointCount }, (_, i) => (
          <rect
            key={i}
            x={xAt(i) - 6}
            y={padT}
            width={12}
            height={innerH}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}

        {hover != null ? (
          <line
            x1={xAt(hover)}
            x2={xAt(hover)}
            y1={padT}
            y2={padT + innerH}
            stroke="#54adf7"
            strokeOpacity={0.45}
          />
        ) : null}

        {/* X labels: first / mid / last */}
        {[0, Math.floor((pointCount - 1) / 2), pointCount - 1]
          .filter((v, i, a) => a.indexOf(v) === i && v >= 0)
          .map((i) => (
            <text
              key={i}
              x={xAt(i)}
              y={height - 8}
              textAnchor="middle"
              className="fill-rsi-text-muted"
              style={{ fontSize: 9, fontFamily: "var(--font-jetbrains)" }}
            >
              {shortTime(series[0]!.points[i]!.at)}
            </text>
          ))}
      </svg>

      {hover != null && series[0]?.points[hover] ? (
        <div className="mt-2 grid gap-1 rounded-rsi border border-rsi-border bg-rsi-bg-deep/80 px-3 py-2 font-mono text-[0.65rem] text-rsi-text-secondary">
          <div className="text-rsi-text-muted">
            {series[0].points[hover]!.at}
            {series[0].points[hover]!.gitSha
              ? ` · ${series[0].points[hover]!.gitSha}`
              : ""}
          </div>
          {series.map((s, i) => {
            if (hidden.has(s.key)) return null;
            const p = s.points[hover];
            if (!p || p.p50 == null) return null;
            const color = SERIES_COLORS[i % SERIES_COLORS.length]!;
            const label =
              s.unit === "bytes"
                ? `${(p.p50 / (1024 * 1024)).toFixed(1)} MB`
                : `${p.p50.toFixed(1)} ms`;
            return (
              <div key={s.key} className="flex items-center gap-2">
                <span
                  className="size-1.5 rounded-full"
                  style={{ background: color }}
                />
                <span className="truncate">{s.name}</span>
                <span className="ml-auto text-rsi-text">{label}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-2 font-mono text-[0.6rem] text-rsi-text-muted">
          Hover a point for values
        </p>
      )}
    </div>
  );
}
