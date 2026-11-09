/**
 * Upload remaining Covalex offer screenshots to production and attach
 * likely CSV matches onto catalog_missions.latestScreenshotPath via MCP create_mission.
 *
 * Usage:
 *   node scripts/seed-covalex-remaining-screenshots.mjs
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const BASE =
  process.env.APP_BASE_URL ||
  "https://citizen-wing-commander-production.up.railway.app";
const SESSION_ID = "2c7b4d42-2321-4c50-b56b-5bb5c4ad8059";
const SHOTS_DIR = "/tmp/covalex-shots/all/screenshots";
const CSV_PATH = "/tmp/covalex-shots/p1/full_reconciliation_mapping.csv";
const CATALOG_PATH = "/tmp/catalog-missions.json";
const MAP_OUT = "/tmp/covalex-shots/upload-map.json";

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",");
  return lines.slice(1).map((line) => {
    // filenames have no commas; simple split is fine for this CSV
    const cols = line.split(",");
    const row = {};
    headers.forEach((h, i) => {
      row[h] = cols[i] ?? "";
    });
    return row;
  });
}

async function uploadOne(localPath, originalName) {
  const form = new FormData();
  const buf = readFileSync(localPath);
  form.append(
    "file",
    new Blob([buf], { type: "image/png" }),
    originalName,
  );
  const res = await fetch(
    `${BASE}/api/checklist/sessions/${SESSION_ID}/screenshots`,
    { method: "POST", body: form },
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `upload ${originalName} failed (${res.status}): ${body.error || res.statusText}`,
    );
  }
  return body;
}

async function mcpCall(method, params, id = 1) {
  const res = await fetch(`${BASE}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
  const text = await res.text();
  const match = text.match(/data:\s*(\{[\s\S]*\})/);
  if (!match) throw new Error(`MCP ${method} bad response: ${text.slice(0, 200)}`);
  return JSON.parse(match[1]);
}

async function createMission(args) {
  const listed = await mcpCall("tools/call", {
    name: "create_mission",
    arguments: args,
  });
  return listed;
}

function cargoFromMission(mission) {
  return (mission.payload?.cargo || []).map((line) => ({
    commodity: line.commodityName || line.commoditySlug,
    scu: line.scu,
  }));
}

function locationsFromSlugs(slugs) {
  return (slugs || []).map((slug) => slug);
}

async function main() {
  const files = readdirSync(SHOTS_DIR).filter((f) => f.endsWith(".png"));
  console.log(`Uploading ${files.length} screenshots to ${SESSION_ID}…`);

  const uploadMap = {}; // original filename -> logicalPath
  let uploaded = 0;
  for (const filename of files.sort()) {
    const localPath = path.join(SHOTS_DIR, filename);
    try {
      const result = await uploadOne(localPath, filename);
      uploadMap[filename] = {
        logicalPath: result.logicalPath,
        filename: result.filename,
        bytes: result.bytes,
      };
      uploaded += 1;
      if (uploaded % 10 === 0 || uploaded === files.length) {
        console.log(`  uploaded ${uploaded}/${files.length}`);
      }
    } catch (err) {
      console.error(`  FAIL ${filename}:`, err.message || err);
      uploadMap[filename] = { error: String(err.message || err) };
    }
  }
  writeFileSync(MAP_OUT, JSON.stringify(uploadMap, null, 2));
  console.log(`Wrote ${MAP_OUT}`);

  const rows = parseCsv(readFileSync(CSV_PATH, "utf8"));
  const catalog = JSON.parse(readFileSync(CATALOG_PATH, "utf8")).missions;
  const byId = new Map(catalog.map((m) => [m.id, m]));

  // Warm MCP
  await mcpCall("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "seed-covalex-shots", version: "1" },
  });

  let linked = 0;
  let skipped = 0;
  let failed = 0;
  for (const row of rows) {
    if (row.status !== "likely_catalog_match") {
      skipped += 1;
      continue;
    }
    const up = uploadMap[row.filename];
    if (!up?.logicalPath) {
      console.warn(`skip no upload for ${row.filename}`);
      skipped += 1;
      continue;
    }
    const mission = byId.get(row.catalog_mission_id);
    if (!mission) {
      console.warn(`skip missing catalog ${row.catalog_mission_id} (${row.expected_cargo})`);
      skipped += 1;
      continue;
    }
    const payload = mission.payload || {};
    const args = {
      type: "hauling",
      title: mission.title,
      contractor: mission.contractor || undefined,
      rewardAuec: mission.rewardAuec ?? undefined,
      offerLocation: mission.offerLocationSlug || undefined,
      from: locationsFromSlugs(payload.fromLocationSlugs),
      to: locationsFromSlugs(payload.toLocationSlugs),
      cargo: cargoFromMission(mission),
      maxContainerScu: mission.maxContainerScu ?? undefined,
      latestScreenshotPath: up.logicalPath,
    };
    try {
      const result = await createMission(args);
      const content = result?.result?.content?.[0]?.text || JSON.stringify(result);
      if (String(content).includes('"ok":true') || String(content).includes('"ok": true')) {
        linked += 1;
      } else {
        failed += 1;
        console.error(`link fail ${row.filename}:`, content.slice(0, 300));
      }
    } catch (err) {
      failed += 1;
      console.error(`link error ${row.filename}:`, err.message || err);
    }
  }

  console.log(
    JSON.stringify(
      {
        uploaded,
        uploadErrors: Object.values(uploadMap).filter((v) => v.error).length,
        linked,
        skipped,
        failed,
        sessionId: SESSION_ID,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
