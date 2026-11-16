#!/usr/bin/env node
/**
 * Capture a production hauling session into a curated test fixture pack.
 *
 *   npm run session:capture-fixture -- <sessionId|tripUrl> [--slug=name] [--assets=referenced|none]
 *
 * Writes tests/sessions/<slug>/{meta,session,expectations}.json and optional assets/.
 * Does not upsert local DB (use session:copy-from-prod for that).
 *
 * Env: PROD_BASE_URL (required)
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveProdBaseUrl } from "../lib/api/appOrigin.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const packsRoot = path.join(root, "tests", "sessions");

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
  let slug = "";
  let assets = "none";
  const positionals = [];
  for (const arg of argv) {
    if (arg.startsWith("--slug=")) slug = arg.slice("--slug=".length).trim();
    else if (arg.startsWith("--assets="))
      assets = arg.slice("--assets=".length).trim();
    else if (!arg.startsWith("--")) positionals.push(arg);
  }
  return { slug, assets, target: positionals[0] ?? "" };
}

function resolveSessionId(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const fromUrl = trimmed.match(UUID_RE);
  if (fromUrl) return fromUrl[0].toLowerCase();
  return null;
}

function kebabSlug(name, sessionId) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  const date = new Date().toISOString().slice(0, 10);
  return `${base || "session"}-${date}-${sessionId.slice(0, 8)}`;
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

async function downloadFile(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download ${url} → ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(destPath, buf);
  return buf.length;
}

function referencedScreenshotPaths(checklist) {
  const names = new Set();
  for (const mission of checklist.missions ?? []) {
    for (const shot of mission.screenshots ?? []) {
      if (typeof shot === "string" && shot.trim()) {
        const file = shot.split("/").pop();
        if (file) names.add(file);
      }
    }
  }
  return [...names];
}

async function main() {
  await loadEnvFiles();
  const { slug: slugArg, assets: assetsMode, target } = parseArgs(
    process.argv.slice(2),
  );
  const sessionId = resolveSessionId(target);
  if (!sessionId) {
    console.error(
      "Usage: npm run session:capture-fixture -- <sessionId|tripUrl> [--slug=name] [--assets=referenced|none]",
    );
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
      : "Captured trip";
  const slug = slugArg || kebabSlug(sessionName, sessionId);
  const packDir = path.join(packsRoot, slug);
  const assetsDir = path.join(packDir, "assets");
  await mkdir(assetsDir, { recursive: true });

  const assetNames =
    assetsMode === "referenced" ? referencedScreenshotPaths(checklist) : [];
  const writtenAssets = [];

  if (assetNames.length > 0) {
    for (const filename of assetNames) {
      const urlPath = `/api/checklist/sessions/${encodeURIComponent(sessionId)}/screenshots/${encodeURIComponent(filename)}`;
      try {
        const bytes = await downloadFile(
          `${prodBase}${urlPath}`,
          path.join(assetsDir, filename),
        );
        writtenAssets.push(filename);
        console.log(`  asset ${filename} (${bytes} bytes)`);
      } catch (error) {
        console.warn(
          `  skip ${filename}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }
  }

  const session = {
    ...checklist,
    id: sessionId,
    sessionName,
  };

  const meta = {
    slug,
    sourceSessionId: sessionId,
    capturedAt: new Date().toISOString(),
    notes: `Captured from ${prodBase}`,
    assets: writtenAssets,
  };

  const expectations = {
    sessionName,
    startLocationSlug: session.startLocationSlug ?? null,
    missionCount: session.missionCount ?? session.missions?.length ?? 0,
    rowCount: Array.isArray(session.rows) ? session.rows.length : 0,
    peakStopId: null,
    peakScu: null,
    tripCargo: { ok: true, issueCount: 0 },
  };

  await writeFile(
    path.join(packDir, "meta.json"),
    `${JSON.stringify(meta, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    path.join(packDir, "session.json"),
    `${JSON.stringify(session, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    path.join(packDir, "expectations.json"),
    `${JSON.stringify(expectations, null, 2)}\n`,
    "utf8",
  );

  console.log(`Wrote pack → ${path.relative(root, packDir)}`);
  console.log(
    "Fill expectations.json (peakStopId / tripCargo) via domain helpers, then add domain.test.ts.",
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
