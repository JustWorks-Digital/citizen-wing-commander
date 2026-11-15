"use client";

import type { PerfMetricAgg } from "@/lib/perf/types";

type PerfBarChartProps = {
  metrics: PerfMetricAgg[];
  title?: string;
  /** Max bars to show (highest p50 first among ms metrics). */
  limit?: number;
};

function formatBar(metric: PerfMetricAgg): string {
  if (metric.unit === "bytes") {
    return `${(metric.p50 / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${metric.p50.toFixed(1)} ms`;
}

/**
 * Horizontal bar chart for live-session p50 comparison.
 */
export function PerfBarChart({
  metrics,
  title = "Live p50",
  limit = 12,
}: PerfBarChartProps) {
  const rows = metrics
    .filter((m) => m.unit !== "bytes" && m.p50 > 0)
    .sort((a, b) => b.p50 - a.p50)
    .slice(0, limit);

  if (rows.length === 0) {
    return (
      <p className="text-sm text-rsi-text-muted">No live ms metrics yet.</p>
    );
  }

  const max = Math.max(...rows.map((r) => r.p50), 1);

  return (
    <div className="rounded-rsi border border-rsi-border bg-rsi-surface/80 p-3">
      <h3 className="mb-3 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-rsi-text-muted">
        {title}
      </h3>
      <ul className="space-y-2">
        {rows.map((m) => {
          const pct = Math.max(2, (m.p50 / max) * 100);
          const tone =
            m.kind === "db"
              ? "bg-rsi-gold/80"
              : m.kind === "api"
                ? "bg-rsi-accent/80"
                : m.kind === "ui"
                  ? "bg-rsi-success/80"
                  : "bg-rsi-text-muted/60";
          return (
            <li key={`${m.kind}:${m.name}`} className="min-w-0">
              <div className="mb-0.5 flex items-baseline justify-between gap-2 font-mono text-[0.6rem]">
                <span className="truncate text-rsi-text-secondary">
                  <span className="text-rsi-text-muted">{m.kind}</span>{" "}
                  {m.name}
                </span>
                <span className="shrink-0 text-rsi-text">{formatBar(m)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-rsi bg-rsi-bg-deep">
                <div
                  className={`h-full rounded-rsi ${tone}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
