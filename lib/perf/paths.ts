import path from "node:path";

export const PERF_HISTORY_DIR = path.join(process.cwd(), "perf", "history");
export const PERF_HISTORY_INDEX = path.join(PERF_HISTORY_DIR, "index.json");
/** Scratch buffer while next dev is running (gitignored via .data/). */
export const PERF_SESSION_FILE = path.join(
  process.cwd(),
  ".data",
  "perf",
  "session.jsonl",
);
export const PERF_SESSION_META = path.join(
  process.cwd(),
  ".data",
  "perf",
  "session-meta.json",
);

export const PERF_RECENT_SAMPLE_CAP = 200;
export const PERF_AUTO_FLUSH_SAMPLE_COUNT = 40;
export const PERF_AUTO_FLUSH_MS = 5 * 60 * 1000;
