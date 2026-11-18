#!/usr/bin/env node
/**
 * Download catalog mission source screenshots from production into local
 * `.data/mcp-screenshots/<batchId>/<filename>` (paths from `latestScreenshotPath`).
 *
 * Capture shots are often moved to `intake-processed/` while catalog rows still
 * point at `intake-pending/` — this script falls back to the processed batch,
 * writes the file under the resolved path, and rewrites local catalog paths.
 *
 * Does not replace the database catalog — pair with `npm run db:sync-catalog-missions`
 * (which invokes this script afterward).
 *
 * Usage:
 *   npm run catalog:copy-screenshots-from-prod
 *   npm run catalog:copy-screenshots-from-prod -- --mission-id <uuid>
 *   npm run catalog:copy-screenshots-from-prod -- --dry-run
 *   npm run catalog:copy-screenshots-from-prod -- --force
 *
 * Env:
 *   PROD_BASE_URL   production origin (required — see .env.example)
 *   CATALOG_API_URL optional override (default ${PROD_BASE_URL}/api/catalog/missions)
 *   DATABASE_URL    optional; when set, remaps local intake-pending → intake-processed paths
 */
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveProdBaseUrl } from "../lib/api/appOrigin.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INTAKE_PENDING_BATCH = "intake-pending";
const INTAKE_PROCESSED_BATCH = "intake-processed";

function parseArgs(argv) {
  const flags = new Set();
  /** @type {Record<string, string>} */
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run" || arg === "--force") {
      flags.add(arg);
      continue;
    }
    if (arg === "--mission-id") {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("--mission-id requires a catalog mission UUID");
      }
      options.missionId = value;
      i += 1;
      continue;
    }
    if (arg.startsWith("--")) {
      throw new Error(`Unknown flag: ${arg}`);
    }
    throw new Error(`Unexpected argument: ${arg}`);
  }
  return {
    dryRun: flags.has("--dry-run"),
    force: flags.has("--force"),
    missionId: options.missionId ?? "",
  };
}

/**
 * @param {string | null | undefined} logicalPath
 * @returns {{ batchId: string, filename: string, logicalPath: string } | null}
 */
function parseLogicalPath(logicalPath) {
  const trimmed = logicalPath?.trim();
  if (!trimmed) return null;
  const parts = trimmed.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const batchId = parts[0];
  const filename = parts.slice(1).join("/");
  if (!batchId || !filename) return null;
  return { batchId, filename, logicalPath: `${batchId}/${filename}` };
}

function screenshotUrl(prodBase, batchId, filename) {
  return `${prodBase}/api/checklist/sessions/${encodeURIComponent(batchId)}/screenshots/${encodeURIComponent(filename)}`;
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${url} → non-JSON (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    throw new Error(
      `${url} → ${res.status}: ${body?.error ?? text.slice(0, 200)}`,
    );
  }
  if (body?.error) throw new Error(String(body.error));
  return body;
}

async function pathExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function downloadFile(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    const err = new Error(
      `Download ${url} → ${res.status}${detail ? `: ${detail.slice(0, 160)}` : ""}`,
    );
    err.status = res.status;
    throw err;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await mkdir(path.dirname(destPath), { recursive: true });
  await writeFile(destPath, buf);
  return buf.length;
}

/**
 * Prefer the catalog path; if intake-pending 404s, try intake-processed.
 * @returns {{ batchId: string, filename: string, logicalPath: string, remappedFrom: string | null, bytes: number }}
 */
async function downloadWithIntakeFallback(
  prodBase,
  entry,
  destRoot,
  { dryRun },
) {
  const attempts = [{ batchId: entry.batchId, remappedFrom: null }];
  if (entry.batchId === INTAKE_PENDING_BATCH) {
    attempts.push({
      batchId: INTAKE_PROCESSED_BATCH,
      remappedFrom: entry.logicalPath,
    });
  }

  let lastError = null;
  for (const attempt of attempts) {
    const logicalPath = `${attempt.batchId}/${entry.filename}`;
    const destPath = path.join(
      destRoot,
      ".data",
      "mcp-screenshots",
      attempt.batchId,
      entry.filename,
    );
    const url = screenshotUrl(prodBase, attempt.batchId, entry.filename);
    if (dryRun) {
      return {
        batchId: attempt.batchId,
        filename: entry.filename,
        logicalPath,
        remappedFrom: attempt.remappedFrom,
        bytes: 0,
        destPath,
        url,
      };
    }
    try {
      const bytes = await downloadFile(url, destPath);
      return {
        batchId: attempt.batchId,
        filename: entry.filename,
        logicalPath,
        remappedFrom: attempt.remappedFrom,
        bytes,
        destPath,
        url,
      };
    } catch (error) {
      lastError = error;
      const canFallback =
        error?.status === 404 &&
        attempt.batchId === INTAKE_PENDING_BATCH &&
        attempts.length > 1;
      if (canFallback) continue;
      throw error;
    }
  }
  throw lastError ?? new Error(`Failed to download ${entry.logicalPath}`);
}

async function rewriteLocalCatalogPaths(fromLogicalPath, toLogicalPath) {
  const DATABASE_URL = process.env.DATABASE_URL?.trim();
  if (!DATABASE_URL) return 0;
  const postgres = (await import("postgres")).default;
  const sql = postgres(DATABASE_URL, { max: 1 });
  try {
    const updated = await sql`
      UPDATE catalog_missions
      SET
        latest_screenshot_path = ${toLogicalPath},
        payload = CASE
          WHEN jsonb_typeof(payload::jsonb) = 'object'
            THEN jsonb_set(
              payload::jsonb,
              '{latestScreenshotPath}',
              to_jsonb(${toLogicalPath}::text),
              true
            )
          ELSE payload
        END,
        updated_at = now()
      WHERE latest_screenshot_path = ${fromLogicalPath}
      RETURNING id
    `;
    return updated.length;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    console.error(
      "Usage: npm run catalog:copy-screenshots-from-prod -- [--mission-id <uuid>] [--dry-run] [--force]",
    );
    process.exit(1);
  }

  if (args.missionId && !UUID_RE.test(args.missionId)) {
    console.error("--mission-id must be a UUID");
    process.exit(1);
  }

  try {
    const { config } = await import("dotenv");
    config({ path: path.join(root, ".env.local") });
    config({ path: path.join(root, ".env") });
  } catch {
    // ignore
  }

  let prodBase;
  try {
    prodBase = resolveProdBaseUrl();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
  const catalogApi =
    process.env.CATALOG_API_URL?.trim() || `${prodBase}/api/catalog/missions`;

  const listUrl = new URL(catalogApi);
  if (args.missionId) {
    listUrl.searchParams.set("ids", args.missionId);
  } else {
    listUrl.searchParams.set("limit", "500");
  }

  console.log(`Fetching catalog missions from ${listUrl}`);
  const body = await fetchJson(listUrl.toString());
  const missions = Array.isArray(body?.missions) ? body.missions : [];
  if (missions.length === 0) {
    console.log("No missions returned.");
    return;
  }

  /** @type {Map<string, { batchId: string, filename: string, logicalPath: string, missionIds: string[] }>} */
  const byPath = new Map();
  let missingPath = 0;
  for (const mission of missions) {
    const parsed = parseLogicalPath(mission.latestScreenshotPath);
    if (!parsed) {
      missingPath += 1;
      continue;
    }
    const existing = byPath.get(parsed.logicalPath);
    if (existing) {
      existing.missionIds.push(String(mission.id));
      continue;
    }
    byPath.set(parsed.logicalPath, {
      ...parsed,
      missionIds: [String(mission.id)],
    });
  }

  console.log(
    `Missions: ${missions.length}; with screenshot path: ${byPath.size}; without: ${missingPath}`,
  );

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;
  let remapped = 0;

  for (const entry of byPath.values()) {
    const pendingDest = path.join(
      root,
      ".data",
      "mcp-screenshots",
      entry.batchId,
      entry.filename,
    );
    const processedDest =
      entry.batchId === INTAKE_PENDING_BATCH
        ? path.join(
            root,
            ".data",
            "mcp-screenshots",
            INTAKE_PROCESSED_BATCH,
            entry.filename,
          )
        : null;

    if (
      !args.force &&
      ((await pathExists(pendingDest)) ||
        (processedDest && (await pathExists(processedDest))))
    ) {
      skipped += 1;
      console.log(`  skip ${entry.logicalPath} (exists)`);
      if (
        processedDest &&
        (await pathExists(processedDest)) &&
        entry.batchId === INTAKE_PENDING_BATCH &&
        !args.dryRun
      ) {
        const n = await rewriteLocalCatalogPaths(
          entry.logicalPath,
          `${INTAKE_PROCESSED_BATCH}/${entry.filename}`,
        );
        if (n > 0) {
          remapped += n;
          console.log(
            `    remapped ${n} local catalog path(s) → ${INTAKE_PROCESSED_BATCH}/${entry.filename}`,
          );
        }
      }
      continue;
    }

    try {
      const result = await downloadWithIntakeFallback(prodBase, entry, root, {
        dryRun: args.dryRun,
      });
      downloaded += 1;
      const relative = path.relative(root, result.destPath);
      if (args.dryRun) {
        console.log(
          `  would download ${entry.logicalPath}${
            result.remappedFrom ? ` (via ${result.logicalPath})` : ""
          } → ${relative}`,
        );
      } else {
        console.log(
          `  ${result.logicalPath} (${result.bytes} bytes) → ${relative}`,
        );
      }
      if (result.remappedFrom && !args.dryRun) {
        const n = await rewriteLocalCatalogPaths(
          result.remappedFrom,
          result.logicalPath,
        );
        remapped += n;
        if (n > 0) {
          console.log(
            `    remapped ${n} local catalog path(s) → ${result.logicalPath}`,
          );
        }
      }
    } catch (error) {
      failed += 1;
      console.error(
        `  FAIL ${entry.logicalPath}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  console.log(
    args.dryRun
      ? `Dry run: ${downloaded} to fetch, ${skipped} already local, ${failed} failed`
      : `Done: ${downloaded} downloaded, ${skipped} skipped, ${failed} failed, ${remapped} catalog path(s) remapped`,
  );
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
