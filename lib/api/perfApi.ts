import { appApi } from "@/lib/api/appRoutes";
import type {
  PerfHistoryIndex,
  PerfMetricAgg,
  PerfRun,
  PerfSample,
} from "@/lib/perf/types";

export type PerfLivePayload = {
  live: {
    meta: {
      startedAt: string;
      sampleCount: number;
      lastFlushAt: string | null;
      samplesSinceFlush: number;
    };
    metrics: PerfMetricAgg[];
    recentSamples: PerfSample[];
  };
  history: PerfHistoryIndex;
  runs: PerfRun[];
};

export async function fetchPerfDashboard(): Promise<PerfLivePayload> {
  const res = await fetch(appApi.devPerf, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Perf dashboard failed (${res.status})`);
  }
  return (await res.json()) as PerfLivePayload;
}

export async function postPerfSamples(samples: PerfSample[]): Promise<{
  autoFlushedId: string | null;
}> {
  if (samples.length === 0) return { autoFlushedId: null };
  const res = await fetch(appApi.devPerf, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "samples", samples }),
  });
  if (!res.ok) return { autoFlushedId: null };
  const data = (await res.json()) as { autoFlushedId?: string | null };
  return { autoFlushedId: data.autoFlushedId ?? null };
}

export async function flushPerfRun(clear = false): Promise<{
  ok: boolean;
  run?: PerfRun;
  reason?: string;
  hint?: string;
}> {
  const res = await fetch(appApi.devPerf, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "flush", clear }),
  });
  return (await res.json()) as {
    ok: boolean;
    run?: PerfRun;
    reason?: string;
    hint?: string;
  };
}

export async function clearPerfSession(): Promise<void> {
  await fetch(appApi.devPerf, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "clear" }),
  });
}
