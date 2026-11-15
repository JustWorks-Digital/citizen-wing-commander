import type { PerfMetricAgg, PerfRun } from "@/lib/perf/types";

export type PerfTrendPoint = {
  runId: string;
  at: string;
  gitSha: string | null;
  p50: number | null;
  p95: number | null;
  unit: "ms" | "bytes";
};

export type PerfTrendSeries = {
  key: string;
  kind: PerfMetricAgg["kind"];
  name: string;
  unit: "ms" | "bytes";
  points: PerfTrendPoint[];
};

const DEFAULT_FOCUS = [
  "db:deliverySessions.listActiveTabs",
  "api:checklist.sessions.get",
  "api:/api/checklist/sessions",
  "db:deliverySessions.get",
  "api:checklist.get",
] as const;

function metricKey(kind: string, name: string): string {
  return `${kind}:${name}`;
}

/** Oldest → newest runs for charting. */
export function runsChronological(runs: PerfRun[]): PerfRun[] {
  return [...runs].sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );
}

/**
 * Build p50 trend series for focus metrics (plus any other frequent ms metrics).
 */
export function buildTrendSeries(
  runs: PerfRun[],
  options?: { maxSeries?: number; focusKeys?: string[] },
): PerfTrendSeries[] {
  const chrono = runsChronological(runs);
  if (chrono.length === 0) return [];

  const focus = new Set(options?.focusKeys ?? DEFAULT_FOCUS);
  const maxSeries = options?.maxSeries ?? 6;

  const counts = new Map<string, { kind: PerfMetricAgg["kind"]; name: string; unit: "ms" | "bytes"; n: number }>();
  for (const run of chrono) {
    for (const m of run.metrics) {
      if (m.unit === "bytes") continue;
      const key = metricKey(m.kind, m.name);
      const prev = counts.get(key);
      if (prev) prev.n += 1;
      else counts.set(key, { kind: m.kind, name: m.name, unit: m.unit, n: 1 });
    }
  }

  const ranked = [...counts.entries()].sort((a, b) => {
    const aFocus = focus.has(a[0]) ? 0 : 1;
    const bFocus = focus.has(b[0]) ? 0 : 1;
    if (aFocus !== bFocus) return aFocus - bFocus;
    return b[1].n - a[1].n;
  });

  const chosen = ranked.slice(0, maxSeries);
  return chosen.map(([key, meta]) => ({
    key,
    kind: meta.kind,
    name: meta.name,
    unit: meta.unit,
    points: chrono.map((run) => {
      const hit = run.metrics.find(
        (m) => metricKey(m.kind, m.name) === key,
      );
      return {
        runId: run.id,
        at: run.at,
        gitSha: run.gitSha,
        p50: hit?.p50 ?? null,
        p95: hit?.p95 ?? null,
        unit: meta.unit,
      };
    }),
  }));
}

export function buildMemoryTrend(runs: PerfRun[]): PerfTrendSeries | null {
  const chrono = runsChronological(runs);
  const points: PerfTrendPoint[] = chrono.map((run) => {
    const hit = run.metrics.find(
      (m) => m.kind === "memory" && m.name === "heap.periodic",
    ) ?? run.metrics.find((m) => m.kind === "memory");
    return {
      runId: run.id,
      at: run.at,
      gitSha: run.gitSha,
      p50: hit?.p50 ?? null,
      p95: hit?.p95 ?? null,
      unit: "bytes" as const,
    };
  });
  if (!points.some((p) => p.p50 != null)) return null;
  return {
    key: "memory:heap",
    kind: "memory",
    name: "heap",
    unit: "bytes",
    points,
  };
}
