import fs from "node:fs";
import path from "node:path";
import {
  PERF_AUTO_FLUSH_MS,
  PERF_AUTO_FLUSH_SAMPLE_COUNT,
  PERF_RECENT_SAMPLE_CAP,
  PERF_SESSION_FILE,
  PERF_SESSION_META,
} from "@/lib/perf/paths";
import { aggregateSamples } from "@/lib/perf/stats";
import type { PerfMetricAgg, PerfSample } from "@/lib/perf/types";

type SessionMeta = {
  startedAt: string;
  sampleCount: number;
  lastFlushAt: string | null;
  samplesSinceFlush: number;
};

function ensureDir(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function defaultMeta(): SessionMeta {
  return {
    startedAt: new Date().toISOString(),
    sampleCount: 0,
    lastFlushAt: null,
    samplesSinceFlush: 0,
  };
}

export function readSessionMeta(): SessionMeta {
  try {
    const raw = fs.readFileSync(PERF_SESSION_META, "utf8");
    const parsed = JSON.parse(raw) as SessionMeta;
    if (parsed && typeof parsed.sampleCount === "number") return parsed;
  } catch {
    /* empty */
  }
  return defaultMeta();
}

function writeSessionMeta(meta: SessionMeta): void {
  ensureDir(PERF_SESSION_META);
  fs.writeFileSync(PERF_SESSION_META, `${JSON.stringify(meta, null, 2)}\n`);
}

export function readSessionSamples(limit = PERF_RECENT_SAMPLE_CAP): PerfSample[] {
  try {
    const raw = fs.readFileSync(PERF_SESSION_FILE, "utf8");
    const lines = raw.split("\n").filter(Boolean);
    const slice = lines.slice(-limit);
    const samples: PerfSample[] = [];
    for (const line of slice) {
      try {
        samples.push(JSON.parse(line) as PerfSample);
      } catch {
        /* skip bad line */
      }
    }
    return samples;
  } catch {
    return [];
  }
}

export function readAllSessionSamples(): PerfSample[] {
  try {
    const raw = fs.readFileSync(PERF_SESSION_FILE, "utf8");
    const samples: PerfSample[] = [];
    for (const line of raw.split("\n")) {
      if (!line) continue;
      try {
        samples.push(JSON.parse(line) as PerfSample);
      } catch {
        /* skip */
      }
    }
    return samples;
  } catch {
    return [];
  }
}

export function appendPerfSamples(samples: PerfSample[]): {
  meta: SessionMeta;
  shouldAutoFlush: boolean;
} {
  if (samples.length === 0) {
    return { meta: readSessionMeta(), shouldAutoFlush: false };
  }
  ensureDir(PERF_SESSION_FILE);
  const chunk = samples.map((s) => JSON.stringify(s)).join("\n") + "\n";
  fs.appendFileSync(PERF_SESSION_FILE, chunk);

  const meta = readSessionMeta();
  meta.sampleCount += samples.length;
  meta.samplesSinceFlush += samples.length;
  writeSessionMeta(meta);

  const elapsedSinceFlush = meta.lastFlushAt
    ? Date.now() - new Date(meta.lastFlushAt).getTime()
    : Date.now() - new Date(meta.startedAt).getTime();

  const shouldAutoFlush =
    meta.samplesSinceFlush >= PERF_AUTO_FLUSH_SAMPLE_COUNT ||
    elapsedSinceFlush >= PERF_AUTO_FLUSH_MS;

  return { meta, shouldAutoFlush };
}

export function markSessionFlushed(): SessionMeta {
  const meta = readSessionMeta();
  meta.lastFlushAt = new Date().toISOString();
  meta.samplesSinceFlush = 0;
  writeSessionMeta(meta);
  return meta;
}

export function clearSessionBuffer(): void {
  ensureDir(PERF_SESSION_FILE);
  fs.writeFileSync(PERF_SESSION_FILE, "");
  writeSessionMeta(defaultMeta());
}

export function summarizeSession(samples?: PerfSample[]): {
  meta: SessionMeta;
  metrics: PerfMetricAgg[];
  recentSamples: PerfSample[];
} {
  const all = samples ?? readAllSessionSamples();
  return {
    meta: readSessionMeta(),
    metrics: aggregateSamples(all),
    recentSamples: all.slice(-PERF_RECENT_SAMPLE_CAP),
  };
}
