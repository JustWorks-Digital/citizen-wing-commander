import type { PerfSample } from "@/lib/perf/types";

type PerfMarkListener = (sample: PerfSample) => void;

const listeners = new Set<PerfMarkListener>();

/** Subscribe from PerfCaptureProvider (client only). */
export function subscribePerfMarks(listener: PerfMarkListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Record a UI timing from feature code (Cargo bays open, etc.). */
export function reportPerfMark(
  name: string,
  valueMs: number,
  tags?: PerfSample["tags"],
): void {
  if (typeof window === "undefined") return;
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_PERF_CAPTURE !== "1") {
    return;
  }
  const sample: PerfSample = {
    at: new Date().toISOString(),
    kind: "ui",
    name,
    value: Math.round(valueMs * 1000) / 1000,
    unit: "ms",
    tags,
  };
  for (const listener of listeners) listener(sample);
}

export function reportPerfMemory(name: string): void {
  if (typeof window === "undefined") return;
  const perf = performance as Performance & {
    memory?: { usedJSHeapSize: number };
  };
  const used = perf.memory?.usedJSHeapSize;
  if (typeof used !== "number") return;
  const sample: PerfSample = {
    at: new Date().toISOString(),
    kind: "memory",
    name,
    value: used,
    unit: "bytes",
  };
  for (const listener of listeners) listener(sample);
}
