import fs from "node:fs";
import path from "node:path";
import { readGitShaShort } from "@/lib/perf/gitSha";
import {
  PERF_HISTORY_DIR,
  PERF_HISTORY_INDEX,
  PERF_RECENT_SAMPLE_CAP,
} from "@/lib/perf/paths";
import { aggregateSamples } from "@/lib/perf/stats";
import {
  markSessionFlushed,
  readAllSessionSamples,
  readSessionMeta,
} from "@/lib/perf/sessionStore";
import type {
  PerfHistoryIndex,
  PerfHistoryIndexEntry,
  PerfMetricAgg,
  PerfRun,
  PerfSample,
} from "@/lib/perf/types";

function ensureHistoryDir(): void {
  fs.mkdirSync(PERF_HISTORY_DIR, { recursive: true });
}

function emptyIndex(): PerfHistoryIndex {
  return { updatedAt: new Date().toISOString(), runs: [] };
}

export function getPerfHistoryIndex(): PerfHistoryIndex {
  try {
    const raw = fs.readFileSync(PERF_HISTORY_INDEX, "utf8");
    const parsed = JSON.parse(raw) as PerfHistoryIndex;
    if (parsed && Array.isArray(parsed.runs)) return parsed;
  } catch {
    /* empty */
  }
  return emptyIndex();
}

function writeIndex(index: PerfHistoryIndex): void {
  ensureHistoryDir();
  fs.writeFileSync(PERF_HISTORY_INDEX, `${JSON.stringify(index, null, 2)}\n`);
}

export function getPerfRun(id: string): PerfRun | null {
  const file = path.join(PERF_HISTORY_DIR, `${id}.json`);
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as PerfRun;
  } catch {
    return null;
  }
}

export function getPerfHistory(): PerfRun[] {
  const index = getPerfHistoryIndex();
  const runs: PerfRun[] = [];
  for (const entry of index.runs) {
    const run = getPerfRun(entry.id);
    if (run) runs.push(run);
  }
  return runs;
}

function runId(at: Date, sha: string | null): string {
  const stamp = at.toISOString().replace(/[:.]/g, "-");
  return sha ? `${stamp}-${sha}` : stamp;
}

function writePerfRun(run: PerfRun): PerfRun {
  ensureHistoryDir();
  const file = path.join(PERF_HISTORY_DIR, `${run.id}.json`);
  fs.writeFileSync(file, `${JSON.stringify(run, null, 2)}\n`);

  const index = getPerfHistoryIndex();
  const entry: PerfHistoryIndexEntry = {
    id: run.id,
    at: run.at,
    gitSha: run.gitSha,
    source: run.source,
    sampleCount: run.sampleCount,
    metricCount: run.metrics.length,
  };
  index.runs = [entry, ...index.runs.filter((r) => r.id !== run.id)].slice(
    0,
    200,
  );
  index.updatedAt = run.at;
  writeIndex(index);

  return run;
}

/** Save samples as a git-tracked history run. */
export function savePerfRun(input: {
  samples: PerfSample[];
  source: PerfRun["source"];
}): PerfRun {
  const at = new Date();
  const gitSha = readGitShaShort();
  const id = runId(at, gitSha);
  const metrics = aggregateSamples(input.samples);
  return writePerfRun({
    id,
    at: at.toISOString(),
    gitSha,
    source: input.source,
    sampleCount: input.samples.length,
    metrics,
    recentSamples: input.samples.slice(-PERF_RECENT_SAMPLE_CAP),
  });
}

/**
 * Save a curated metric snapshot (e.g. poll-era baseline) without re-aggregating
 * raw samples. Use for promoting a filtered subset of an existing run.
 */
export function savePerfMetricSnapshot(input: {
  metrics: PerfMetricAgg[];
  source: PerfRun["source"];
  sampleCount?: number;
  recentSamples?: PerfSample[];
  /** Optional id suffix after timestamp-sha, e.g. `poll-pre-sse`. */
  idSuffix?: string;
}): PerfRun {
  const at = new Date();
  const gitSha = readGitShaShort();
  const baseId = runId(at, gitSha);
  const id = input.idSuffix ? `${baseId}-${input.idSuffix}` : baseId;
  return writePerfRun({
    id,
    at: at.toISOString(),
    gitSha,
    source: input.source,
    sampleCount: input.sampleCount ?? input.metrics.reduce((n, m) => n + m.count, 0),
    metrics: [...input.metrics].sort(
      (a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name),
    ),
    recentSamples: (input.recentSamples ?? []).slice(-PERF_RECENT_SAMPLE_CAP),
  });
}

/** Flush the live session buffer into perf/history/. */
export function flushPerfSession(source: PerfRun["source"] = "session-flush"): {
  run: PerfRun | null;
  reason?: string;
} {
  const samples = readAllSessionSamples();
  if (samples.length === 0) {
    return { run: null, reason: "No samples in the live session buffer." };
  }
  const sinceFlush = readSessionMeta().lastFlushAt;
  const fresh = sinceFlush
    ? samples.filter((s) => s.at >= sinceFlush)
    : samples;
  const toSave = fresh.length > 0 ? fresh : samples;
  const run = savePerfRun({ samples: toSave, source });
  markSessionFlushed();
  return { run };
}
