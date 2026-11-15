import { isPerfCaptureEnabled, timeAsync } from "@/lib/perf/capture";
import { recordServerSample } from "@/lib/perf/recordServer";

/** Time a DB query helper (dev only). No-op cost when capture is off. */
export async function timeDbQuery<T>(
  name: string,
  fn: () => Promise<T>,
  tags?: Record<string, string | number | boolean | null | undefined>,
): Promise<T> {
  if (!isPerfCaptureEnabled()) return fn();
  const { result, sample } = await timeAsync(name, "db", fn, tags);
  recordServerSample(sample);
  return result;
}
