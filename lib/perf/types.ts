/** One timing / memory observation while using the app locally. */
export type PerfSample = {
  at: string;
  kind: "api" | "db" | "ui" | "vital" | "memory" | "lib";
  name: string;
  /** Duration in ms, or heap bytes for kind=memory. */
  value: number;
  unit?: "ms" | "bytes";
  tags?: Record<string, string | number | boolean | null | undefined>;
};

export type PerfMetricAgg = {
  name: string;
  kind: PerfSample["kind"];
  count: number;
  p50: number;
  p95: number;
  min: number;
  max: number;
  unit: "ms" | "bytes";
};

export type PerfRun = {
  id: string;
  at: string;
  gitSha: string | null;
  source: "session-flush" | "baseline" | "manual";
  sampleCount: number;
  metrics: PerfMetricAgg[];
  /** Tail of raw samples for the table (capped). */
  recentSamples: PerfSample[];
};

export type PerfHistoryIndexEntry = {
  id: string;
  at: string;
  gitSha: string | null;
  source: PerfRun["source"];
  sampleCount: number;
  metricCount: number;
};

export type PerfHistoryIndex = {
  updatedAt: string;
  runs: PerfHistoryIndexEntry[];
};
