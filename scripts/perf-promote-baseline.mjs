/**
 * Promote an existing perf/history run into a curated poll-era baseline.
 *
 * Usage:
 *   npm run perf:baseline-poll
 *   npm run perf:baseline-poll -- 2026-11-19T19-37-11-891Z-73a69bf
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const historyDir = path.join(root, "perf", "history");
const indexPath = path.join(historyDir, "index.json");
const baselinesDir = path.join(root, "perf", "baselines");

function pickDefaultRunId() {
  const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  const ranked = [...index.runs].sort((a, b) => b.sampleCount - a.sampleCount);
  const hit = ranked.find((r) => {
    const file = path.join(historyDir, `${r.id}.json`);
    if (!fs.existsSync(file)) return false;
    const run = JSON.parse(fs.readFileSync(file, "utf8"));
    return run.metrics?.some((m) => m.name === "checklist.get" && m.count > 100);
  });
  if (!hit) {
    throw new Error("No history run with substantial checklist.get metrics found.");
  }
  return hit.id;
}

const runId = process.argv[2] || pickDefaultRunId();

const result = spawnSync(
  "npx",
  [
    "tsx",
    "-e",
    `
import fs from "node:fs";
import path from "node:path";
import { getPerfRun, savePerfMetricSnapshot } from "./lib/perf/historyStore.ts";
import {
  buildPollBaselineCompare,
  filterPollBaselineMetrics,
} from "./lib/perf/pollBaseline.ts";

const sourceId = ${JSON.stringify(runId)};
const source = getPerfRun(sourceId);
if (!source) {
  console.error("Run not found:", sourceId);
  process.exit(1);
}

const metrics = filterPollBaselineMetrics(source.metrics);
if (metrics.length === 0) {
  console.error("No poll-baseline metrics in", sourceId);
  process.exit(1);
}

const baseline = savePerfMetricSnapshot({
  metrics,
  source: "baseline",
  sampleCount: metrics.reduce((n, m) => n + m.count, 0),
  recentSamples: [
    {
      at: new Date().toISOString(),
      kind: "lib",
      name: "poll.baseline.promoted",
      value: metrics.length,
      unit: "ms",
      tags: { basedOnRunId: source.id, label: "poll-pre-sse" },
    },
  ],
  idSuffix: "poll-pre-sse",
});

const compare = buildPollBaselineCompare(
  { ...source, metrics: baseline.metrics },
  "poll-pre-sse",
);
compare.basedOnRunId = source.id;

const baselinesDir = path.join(process.cwd(), "perf", "baselines");
fs.mkdirSync(baselinesDir, { recursive: true });
const comparePath = path.join(baselinesDir, "poll-pre-sse.json");
fs.writeFileSync(comparePath, JSON.stringify(compare, null, 2) + "\\n");

console.log(JSON.stringify({
  baselineId: baseline.id,
  basedOnRunId: source.id,
  metricCount: baseline.metrics.length,
  comparePath: "perf/baselines/poll-pre-sse.json",
  checklistGetsPerPut: compare.checklistGetsPerPut,
  sessionsGetsPerPut: compare.sessionsGetsPerPut,
}, null, 2));
`,
  ],
  { cwd: root, encoding: "utf8", stdio: "inherit" },
);

process.exit(result.status ?? 1);
