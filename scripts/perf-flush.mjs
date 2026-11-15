/**
 * Flush the live local perf session buffer into perf/history/.
 * Prefer using the app while next dev is up; this calls the same store via tsx.
 *
 * Usage: npm run perf:flush
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const result = spawnSync(
  "npx",
  [
    "tsx",
    "-e",
    `
import { flushPerfSession } from "./lib/perf/historyStore.ts";
const { run, reason } = flushPerfSession("manual");
if (!run) {
  console.error(reason ?? "Nothing to flush");
  process.exit(1);
}
console.log(JSON.stringify({ id: run.id, sampleCount: run.sampleCount, metrics: run.metrics.length }, null, 2));
console.log("Commit perf/history/" + run.id + ".json and perf/history/index.json when you want this in git.");
`,
  ],
  { cwd: root, encoding: "utf8", stdio: "inherit" },
);

process.exit(result.status ?? 1);
