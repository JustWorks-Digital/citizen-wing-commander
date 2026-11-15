import type { PerfSample } from "@/lib/perf/types";

/** Local continuous capture — development only (or PERF_CAPTURE=1). */
export function isPerfCaptureEnabled(): boolean {
  if (process.env.PERF_CAPTURE === "0") return false;
  if (process.env.PERF_CAPTURE === "1") return true;
  return process.env.NODE_ENV === "development";
}

export async function timeAsync<T>(
  name: string,
  kind: PerfSample["kind"],
  fn: () => Promise<T>,
  tags?: PerfSample["tags"],
): Promise<{ result: T; sample: PerfSample }> {
  const started = performance.now();
  const result = await fn();
  const sample: PerfSample = {
    at: new Date().toISOString(),
    kind,
    name,
    value: Math.round((performance.now() - started) * 1000) / 1000,
    unit: "ms",
    tags,
  };
  return { result, sample };
}

export function timeSync<T>(
  name: string,
  kind: PerfSample["kind"],
  fn: () => T,
  tags?: PerfSample["tags"],
): { result: T; sample: PerfSample } {
  const started = performance.now();
  const result = fn();
  const sample: PerfSample = {
    at: new Date().toISOString(),
    kind,
    name,
    value: Math.round((performance.now() - started) * 1000) / 1000,
    unit: "ms",
    tags,
  };
  return { result, sample };
}
