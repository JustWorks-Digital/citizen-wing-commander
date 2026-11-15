import { isPerfCaptureEnabled } from "@/lib/perf/capture";
import { flushPerfSession } from "@/lib/perf/historyStore";
import { appendPerfSamples } from "@/lib/perf/sessionStore";
import type { PerfSample } from "@/lib/perf/types";

/** Append samples on the server (dev). May auto-flush to perf/history/. */
export function recordServerSamples(samples: PerfSample[]): {
  autoFlushedId: string | null;
} {
  if (!isPerfCaptureEnabled() || samples.length === 0) {
    return { autoFlushedId: null };
  }
  const { shouldAutoFlush } = appendPerfSamples(samples);
  if (!shouldAutoFlush) return { autoFlushedId: null };
  const { run } = flushPerfSession("session-flush");
  return { autoFlushedId: run?.id ?? null };
}

export function recordServerSample(sample: PerfSample): void {
  recordServerSamples([sample]);
}
