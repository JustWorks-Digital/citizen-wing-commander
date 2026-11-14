#!/usr/bin/env node
/**
 * Copy one hauling delivery session from production → local Postgres +
 * `.data/mcp-screenshots/<sessionId>/` (including Source pending/processed status).
 *
 * Usage:
 *   npm run session:copy-from-prod -- <sessionId|tripUrl>
 *   npm run session:copy-from-prod -- https://…/sessions/<uuid>
 *
 * Env:
 *   DATABASE_URL          local Postgres (from .env.local)
 *   PROD_BASE_URL         default https://citizen-wing-commander-production.up.railway.app
 *
 * Flags:
 *   --no-select           do not mark the copied session as the active tab
 *   --skip-screenshots    checklist only (no image download)
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const DEFAULT_PROD =
  "https://citizen-wing-commander-production.up.railway.app";

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
      "Usage: npm run session:copy-from-prod -- <sessionId|tripUrl> [--no-select] [--skip-screenshots]",
    );
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    console.error("DATABASE_URL is required (set in .env.local)");
    process.exit(1);
  }

  const prodBase = (
    process.env.PROD_BASE_URL?.trim() || DEFAULT_PROD
  ).replace(/\/$/, "");

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
      `Wrote ${downloaded} screenshot(s) + status (${processedFilenames.length} processed) → ${path.relative(root, batchDir)}`,
    );
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
  console.log(`Open: http://localhost:3000/sessions/${sessionId}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
