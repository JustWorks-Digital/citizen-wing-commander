import type { PerfMetricAgg, PerfSample } from "@/lib/perf/types";

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0]!;
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo]!;
  const w = rank - lo;
  return sorted[lo]! * (1 - w) + sorted[hi]! * w;
}

/** Aggregate samples by kind+name. */
export function aggregateSamples(samples: PerfSample[]): PerfMetricAgg[] {
  const buckets = new Map<string, PerfSample[]>();
  for (const sample of samples) {
    const key = `${sample.kind}\0${sample.name}`;
    const list = buckets.get(key);
    if (list) list.push(sample);
    else buckets.set(key, [sample]);
  }

  const metrics: PerfMetricAgg[] = [];
  for (const group of buckets.values()) {
    const values = group.map((s) => s.value).sort((a, b) => a - b);
    const first = group[0]!;
    metrics.push({
      name: first.name,
      kind: first.kind,
      count: values.length,
      p50: percentile(values, 50),
      p95: percentile(values, 95),
      min: values[0]!,
      max: values[values.length - 1]!,
      unit: first.unit ?? (first.kind === "memory" ? "bytes" : "ms"),
    });
  }

  return metrics.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
}
