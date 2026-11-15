"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PerfBarChart } from "@/components/perf/PerfBarChart";
import { PerfTrendChart } from "@/components/perf/PerfTrendChart";
import {
  clearPerfSession,
  fetchPerfDashboard,
  flushPerfRun,
  type PerfLivePayload,
} from "@/lib/api/perfApi";
import { buildMemoryTrend, buildTrendSeries } from "@/lib/perf/trends";
import type { PerfMetricAgg, PerfSample } from "@/lib/perf/types";

function formatValue(metric: Pick<PerfMetricAgg, "p50" | "unit">): string {
  if (metric.unit === "bytes") {
    return `${(metric.p50 / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${metric.p50.toFixed(1)} ms`;
}

function formatSampleValue(sample: PerfSample): string {
  if (sample.unit === "bytes" || sample.kind === "memory") {
    return `${(sample.value / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${sample.value.toFixed(1)} ms`;
}

/**
 * Local-only continuous perf dashboard (`next dev`).
 * Charts trends across git-saved runs; flush writes perf/history/.
 */
export default function DevPerfPage() {
  const [data, setData] = useState<PerfLivePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await fetchPerfDashboard();
      setData(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load perf");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 4000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const msSeries = useMemo(
    () => (data ? buildTrendSeries(data.runs, { maxSeries: 6 }) : []),
    [data],
  );
  const memorySeries = useMemo(() => {
    if (!data) return null;
    return buildMemoryTrend(data.runs);
  }, [data]);

  const onFlush = async () => {
    setBusy(true);
    setHint(null);
    try {
      const result = await flushPerfRun(false);
      if (!result.ok) {
        setHint(result.reason ?? "Nothing to flush");
      } else {
        setHint(result.hint ?? `Saved ${result.run?.id}`);
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const onClear = async () => {
    setBusy(true);
    try {
      await clearPerfSession();
      setHint("Live session buffer cleared");
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-6 px-4 py-8 text-rsi-text">
      <header className="space-y-2">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-rsi-accent">
          Local only
        </p>
        <h1 className="font-sans text-2xl font-semibold tracking-wide">
          Performance
        </h1>
        <p className="max-w-2xl text-sm text-rsi-text-secondary">
          Continuous capture under{" "}
          <span className="font-mono text-rsi-text">next dev</span>. Charts use
          saved runs in{" "}
          <span className="font-mono text-rsi-text">perf/history/</span>.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void refresh()}
          className="rounded-rsi border border-rsi-border bg-rsi-surface px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-rsi-text-secondary hover:border-rsi-border-strong"
        >
          Refresh
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onFlush()}
          className="rounded-rsi border border-rsi-accent/40 bg-rsi-accent-muted/30 px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-rsi-accent hover:border-rsi-accent"
        >
          Save run
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onClear()}
          className="rounded-rsi border border-rsi-border bg-rsi-bg-deep px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-rsi-text-muted hover:border-rsi-border-strong"
        >
          Clear live
        </button>
      </div>

      {hint ? (
        <p className="rounded-rsi border border-rsi-border bg-rsi-surface/80 px-3 py-2 font-mono text-xs text-rsi-text-secondary">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-rsi border border-rsi-danger/40 bg-rsi-danger/10 px-3 py-2 text-sm text-rsi-danger">
          {error}
        </p>
      ) : null}

      {data ? (
        <>
          <section className="space-y-3">
            <h2 className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-rsi-text-muted">
              Trends
            </h2>
            <div className="grid gap-4 lg:grid-cols-1">
              <PerfTrendChart
                series={msSeries}
                title="Latency p50 across saved runs"
                valueLabel="ms"
              />
              {memorySeries ? (
                <PerfTrendChart
                  series={[memorySeries]}
                  title="Heap across saved runs"
                  valueLabel="MB"
                  height={160}
                />
              ) : null}
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <h2 className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-rsi-text-muted">
                Live session
              </h2>
              <p className="font-mono text-xs text-rsi-text-secondary">
                samples {data.live.meta.sampleCount} · since flush{" "}
                {data.live.meta.samplesSinceFlush}
              </p>
              <PerfBarChart metrics={data.live.metrics} title="Live p50" />
            </div>
            <div className="space-y-3">
              <h2 className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-rsi-text-muted">
                Live detail
              </h2>
              <MetricsTable metrics={data.live.metrics} />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-rsi-text-muted">
              Recent samples
            </h2>
            <SamplesTable samples={[...data.live.recentSamples].reverse()} />
          </section>

          <section className="space-y-3">
            <h2 className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-rsi-text-muted">
              Saved runs (git) · {data.history.runs.length}
            </h2>
            {data.history.runs.length === 0 ? (
              <p className="text-sm text-rsi-text-muted">
                No saved runs yet. Use the site, then Save run.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-rsi border border-rsi-border">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-rsi-bg-deep font-mono text-[0.6rem] uppercase tracking-[0.14em] text-rsi-text-muted">
                    <tr>
                      <th className="px-3 py-2">At</th>
                      <th className="px-3 py-2">Sha</th>
                      <th className="px-3 py-2">Source</th>
                      <th className="px-3 py-2">Samples</th>
                      <th className="px-3 py-2">Metrics</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.history.runs.slice(0, 25).map((run) => (
                      <tr
                        key={run.id}
                        className="border-t border-rsi-border/80 text-rsi-text-secondary"
                      >
                        <td className="px-3 py-2 font-mono text-xs">{run.at}</td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {run.gitSha ?? "—"}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {run.source}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {run.sampleCount}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {run.metricCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : !error ? (
        <p className="text-sm text-rsi-text-muted">Loading…</p>
      ) : null}
    </main>
  );
}

function MetricsTable({ metrics }: { metrics: PerfMetricAgg[] }) {
  if (metrics.length === 0) {
    return (
      <p className="text-sm text-rsi-text-muted">
        No aggregated metrics yet — browse the app to collect samples.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-rsi border border-rsi-border">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-rsi-bg-deep font-mono text-[0.6rem] uppercase tracking-[0.14em] text-rsi-text-muted">
          <tr>
            <th className="px-3 py-2">Kind</th>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">n</th>
            <th className="px-3 py-2">p50</th>
            <th className="px-3 py-2">p95</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map((m) => (
            <tr
              key={`${m.kind}:${m.name}`}
              className="border-t border-rsi-border/80 text-rsi-text-secondary"
            >
              <td className="px-3 py-2 font-mono text-xs">{m.kind}</td>
              <td className="px-3 py-2 font-mono text-xs">{m.name}</td>
              <td className="px-3 py-2 font-mono text-xs">{m.count}</td>
              <td className="px-3 py-2 font-mono text-xs">{formatValue(m)}</td>
              <td className="px-3 py-2 font-mono text-xs">
                {m.unit === "bytes"
                  ? `${(m.p95 / (1024 * 1024)).toFixed(1)} MB`
                  : `${m.p95.toFixed(1)} ms`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SamplesTable({ samples }: { samples: PerfSample[] }) {
  if (samples.length === 0) return null;
  return (
    <div className="overflow-x-auto rounded-rsi border border-rsi-border">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-rsi-bg-deep font-mono text-[0.6rem] uppercase tracking-[0.14em] text-rsi-text-muted">
          <tr>
            <th className="px-3 py-2">At</th>
            <th className="px-3 py-2">Kind</th>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Value</th>
          </tr>
        </thead>
        <tbody>
          {samples.slice(0, 40).map((s, i) => (
            <tr
              key={`${s.at}-${s.name}-${i}`}
              className="border-t border-rsi-border/80 text-rsi-text-secondary"
            >
              <td className="px-3 py-2 font-mono text-[0.65rem]">{s.at}</td>
              <td className="px-3 py-2 font-mono text-xs">{s.kind}</td>
              <td className="px-3 py-2 font-mono text-xs">{s.name}</td>
              <td className="px-3 py-2 font-mono text-xs">
                {formatSampleValue(s)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
