#!/usr/bin/env node
/**
 * Copy one hauling delivery session from production → local Postgres +
 * `.data/mcp-screenshots/` (session Source folder + any mission-referenced
 * logical paths such as `<otherBatch>/<file>.png`).
 *
 * Usage:
 *   npm run session:copy-from-prod -- <sessionId|sessionUrl>
 *   npm run session:copy-from-prod -- https://…/sessions/<uuid>
 *
 * Env:
 *   DATABASE_URL          local Postgres (from .env.local)
 *   PROD_BASE_URL         production origin (required — see .env.example)
 *
 * Flags:
 *   --no-select           do not mark the copied session as the active tab
 *   --skip-screenshots    checklist only (no image download)
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { resolveProdBaseUrl } from "../lib/api/appOrigin.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

async function loadEnvFiles() {
  try {
    const { config } = await import("dotenv");
    config({ path: path.join(root, ".env.local") });
    config({ path: path.join(root, ".env") });
  } catch {
    // ignore
  }
}

function parseArgs(argv) {
  const flags = new Set();
  const positionals = [];
  for (const arg of argv) {
    if (arg.startsWith("--")) flags.add(arg);
    else positionals.push(arg);
  }
  return {
    select: !flags.has("--no-select"),
    skipScreenshots: flags.has("--skip-screenshots"),
    target: positionals[0] ?? "",
  };
}

function resolveSessionId(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const fromUrl = trimmed.match(UUID_RE);
  if (fromUrl) return fromUrl[0].toLowerCase();
  return null;
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

/** Collect `batchId/filename` refs from session mission screenshot fields. */
function missionScreenshotRefs(checklist) {
  /** @type {Map<string, { batchId: string, filename: string, logicalPath: string }>} */
  const byPath = new Map();
  for (const mission of checklist?.missions ?? []) {
    const candidates = [];
    if (Array.isArray(mission?.screenshots)) {
      candidates.push(...mission.screenshots);
    }
    if (typeof mission?.latestScreenshotPath === "string") {
      candidates.push(mission.latestScreenshotPath);
    }
    for (const candidate of candidates) {
      if (typeof candidate !== "string") continue;
      const parsed = parseLogicalPath(candidate);
      if (!parsed) continue;
      byPath.set(parsed.logicalPath, parsed);
    }
  }
  return [...byPath.values()];
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
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

async function downloadFile(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Download ${url} → ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(destPath, buf);
  return buf.length;
}

async function main() {
  await loadEnvFiles();

  const { select, skipScreenshots, target } = parseArgs(process.argv.slice(2));
  const sessionId = resolveSessionId(target);
  if (!sessionId) {
    console.error(
      "Usage: npm run session:copy-from-prod -- <sessionId|sessionUrl> [--no-select] [--skip-screenshots]",
    );
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    console.error("DATABASE_URL is required (set in .env.local)");
    process.exit(1);
  }

  let prodBase;
  try {
    prodBase = resolveProdBaseUrl();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }

  console.log(`Fetching session ${sessionId} from ${prodBase}`);
  const checklist = await fetchJson(
    `${prodBase}/api/checklist?sessionId=${encodeURIComponent(sessionId)}`,
  );
  if (!checklist?.id || !Array.isArray(checklist.rows)) {
    throw new Error("Production checklist response missing id/rows");
  }

  const sessionName =
    typeof checklist.sessionName === "string" && checklist.sessionName.trim()
      ? checklist.sessionName.trim()
      : "Copied trip";

  let screenshotMeta = { count: 0, screenshots: [] };
  if (!skipScreenshots) {
    screenshotMeta = await fetchJson(
      `${prodBase}/api/checklist/sessions/${encodeURIComponent(sessionId)}/screenshots?status=all`,
    );
  }

  const shots = Array.isArray(screenshotMeta.screenshots)
    ? screenshotMeta.screenshots
    : [];
  const batchDir = path.join(root, ".data", "mcp-screenshots", sessionId);
  if (!skipScreenshots) {
    await mkdir(batchDir, { recursive: true });
    let downloaded = 0;
    for (const shot of shots) {
      const filename = shot.filename;
      if (!filename || typeof filename !== "string") continue;
      const urlPath =
        typeof shot.url === "string" && shot.url.startsWith("/")
          ? shot.url
          : `/api/checklist/sessions/${encodeURIComponent(sessionId)}/screenshots/${encodeURIComponent(filename)}`;
      const bytes = await downloadFile(`${prodBase}${urlPath}`, path.join(batchDir, filename));
      downloaded += 1;
      console.log(`  screenshot ${filename} (${bytes} bytes)`);
    }
    const processedFilenames = shots
      .filter((shot) => shot.status === "processed" && shot.filename)
      .map((shot) => shot.filename)
      .sort((a, b) => a.localeCompare(b));
    await writeFile(
      path.join(batchDir, ".source-status.json"),
      `${JSON.stringify({ processedFilenames }, null, 2)}\n`,
      "utf8",
    );
    console.log(
      `Wrote ${downloaded} Source screenshot(s) + status (${processedFilenames.length} processed) → ${path.relative(root, batchDir)}`,
    );

    // Mission.screenshots often point at the intake/source batch, not this
    // session's Source folder — pull those logical paths too.
    const missionRefs = missionScreenshotRefs(checklist);
    let missionDownloaded = 0;
    for (const ref of missionRefs) {
      const destPath = path.join(
        root,
        ".data",
        "mcp-screenshots",
        ref.batchId,
        ref.filename,
      );
      await mkdir(path.dirname(destPath), { recursive: true });
      const url = `${prodBase}/api/checklist/sessions/${encodeURIComponent(ref.batchId)}/screenshots/${encodeURIComponent(ref.filename)}`;
      try {
        const bytes = await downloadFile(url, destPath);
        missionDownloaded += 1;
        console.log(`  mission shot ${ref.logicalPath} (${bytes} bytes)`);
      } catch (error) {
        console.error(
          `  FAIL ${ref.logicalPath}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }
    if (missionRefs.length > 0) {
      console.log(
        `Wrote ${missionDownloaded}/${missionRefs.length} mission-referenced screenshot(s)`,
      );
    }
  }

  const createdAt =
    checklist.startedAt && !Number.isNaN(Date.parse(checklist.startedAt))
      ? new Date(checklist.startedAt)
      : new Date();
  const updatedAt =
    checklist.updatedAt && !Number.isNaN(Date.parse(checklist.updatedAt))
      ? new Date(checklist.updatedAt)
      : new Date();

  const payload = {
    ...checklist,
    id: sessionId,
    sessionName,
  };

  const sql = postgres(databaseUrl, { max: 1 });
  try {
    await sql.begin(async (tx) => {
      if (select) {
        await tx`
          UPDATE delivery_sessions
          SET is_selected = false
          WHERE is_selected = true
        `;
      }
      await tx`
        INSERT INTO delivery_sessions (
          id, name, is_active, is_selected, checklist, created_at, updated_at
        ) VALUES (
          ${sessionId}::uuid,
          ${sessionName},
          true,
          ${select},
          ${tx.json(payload)},
          ${createdAt},
          ${updatedAt}
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          is_active = true,
          is_selected = EXCLUDED.is_selected,
          checklist = EXCLUDED.checklist,
          updated_at = EXCLUDED.updated_at
      `;
    });
  } finally {
    await sql.end({ timeout: 5 });
  }

  console.log(
    `Upserted local delivery_sessions row (${sessionName})${select ? " [selected]" : ""}`,
  );
  const { resolveAppOrigin } = await import("../lib/api/appOrigin.mjs");
  console.log(`Open: ${resolveAppOrigin()}/sessions/${sessionId}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
