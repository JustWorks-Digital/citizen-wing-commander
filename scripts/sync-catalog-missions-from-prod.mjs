#!/usr/bin/env node
/**
 * Pull catalog missions from production MCP `list_missions` into the local DB.
 *
 *   DATABASE_URL=… node scripts/sync-catalog-missions-from-prod.mjs
 *
 * Optional: MCP_URL=https://…/mcp
 */
import { createHash } from "node:crypto";
import postgres from "postgres";

const MCP_URL =
  process.env.MCP_URL ??
  "https://citizen-wing-commander-production.up.railway.app/mcp";
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

async function mcpCall(method, params, id = 1) {
  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
  const raw = await res.text();
  const datas = [...raw.matchAll(/^data:\s*(.+)$/gm)].map((m) => m[1]);
  for (const d of datas) {
    try {
      const obj = JSON.parse(d);
      if (obj.result != null || obj.error != null) return obj;
    } catch {
      // continue
    }
  }
  throw new Error(`No MCP result for ${method}: ${raw.slice(0, 240)}`);
}

function emptyScuBoxSplits() {
  return { scuOne: 0, scuTwo: 0, scuFour: 0, scuEight: 0 };
}

function fingerprintFromPayload(payload) {
  const cargoKey = [...(payload.cargo ?? [])]
    .map((line) => `${line.commoditySlug}:${line.scu}`)
    .sort()
    .join(",");
  const raw = [
    (payload.title ?? "").trim().toLowerCase(),
    (payload.contractorSlug ?? payload.contractor ?? "")
      .trim()
      .toLowerCase(),
    (payload.offerLocationSlug ?? "").trim().toLowerCase(),
    [...(payload.fromLocationSlugs ?? [])]
      .map((s) => s.toLowerCase())
      .sort()
      .join("|"),
    [...(payload.toLocationSlugs ?? [])]
      .map((s) => s.toLowerCase())
      .sort()
      .join("|"),
    cargoKey,
  ].join("::");
  return createHash("sha256").update(raw).digest("hex");
}

const listed = await mcpCall(
  "tools/call",
  { name: "list_missions", arguments: { limit: 200 } },
  3,
);
if (listed.error) {
  console.error(listed.error);
  process.exit(1);
}
const text = listed.result?.content?.[0]?.text;
if (!text) {
  console.error("Empty list_missions response");
  process.exit(1);
}
const parsed = JSON.parse(text);
if (parsed.error) {
  console.error(parsed.error);
  process.exit(1);
}
const missions = parsed.missions ?? [];
console.log(`Fetched ${missions.length} mission(s) from production MCP`);

const sql = postgres(DATABASE_URL, { max: 1 });
let upserted = 0;
try {
  for (const mission of missions) {
    const payload = mission.payload ?? {};
    const fingerprint =
      mission.fingerprint ?? fingerprintFromPayload(payload);
    await sql`
      INSERT INTO catalog_missions (
        id, type, fingerprint, title, rank, contractor_slug, rewards,
        offer_location_slug, scu_total, scu_max_container_size, scu_box_splits,
        scu_location_splits,
        payload, latest_screenshot_path, mission_run_count, mission_total_duration_ms,
        mission_avg_duration_ms, last_observed_at, created_at, updated_at
      ) VALUES (
        ${mission.id}::uuid,
        ${mission.type ?? "hauling"},
        ${fingerprint},
        ${mission.title},
        ${mission.rank ?? payload.rank ?? null},
        ${mission.contractorSlug ?? payload.contractorSlug ?? null},
        ${sql.json(
          mission.rewards ??
            (mission.rewardAuec != null && mission.rewardAuec > 0
              ? [{ kind: "auec", amount: mission.rewardAuec }]
              : []),
        )},
        ${mission.offerLocationSlug ?? null},
        ${mission.scuTotal ?? mission.totalScu ?? 0},
        ${mission.scuMaxContainerSize ?? mission.maxContainerScu ?? null},
        ${sql.json(
          mission.scuBoxSplits ??
            mission.boxBreakdown ??
            payload.scuBoxSplits ??
            payload.boxBreakdown ??
            emptyScuBoxSplits(),
        )},
        ${sql.json(
          mission.scuLocationSplits ??
            payload.scuLocationSplits ??
            null,
        )},
        ${sql.json((() => {
          const {
            contractor: _contractor,
            boxBreakdown: _boxBreakdown,
            ...rest
          } = payload;
          return {
            ...rest,
            contractorSlug:
              payload.contractorSlug ??
              mission.contractorSlug ??
              null,
            scuBoxSplits:
              payload.scuBoxSplits ??
              payload.boxBreakdown ??
              mission.scuBoxSplits ??
              mission.boxBreakdown ??
              emptyScuBoxSplits(),
            scuLocationSplits:
              payload.scuLocationSplits ??
              mission.scuLocationSplits ??
              null,
          };
        })())},
        ${mission.latestScreenshotPath ?? null},
        ${mission.missionRunCount ?? mission.runCount ?? 0},
        ${mission.missionTotalDurationMs ?? mission.totalDurationMs ?? 0},
        ${mission.missionAvgDurationMs ?? mission.avgDurationMs ?? null},
        ${mission.lastObservedAt ?? new Date().toISOString()},
        ${mission.createdAt ?? new Date().toISOString()},
        ${mission.updatedAt ?? new Date().toISOString()}
      )
      ON CONFLICT (fingerprint) DO UPDATE SET
        title = EXCLUDED.title,
        rank = EXCLUDED.rank,
        contractor_slug = EXCLUDED.contractor_slug,
        rewards = EXCLUDED.rewards,
        offer_location_slug = EXCLUDED.offer_location_slug,
        scu_total = EXCLUDED.scu_total,
        scu_max_container_size = EXCLUDED.scu_max_container_size,
        scu_box_splits = EXCLUDED.scu_box_splits,
        scu_location_splits = EXCLUDED.scu_location_splits,
        payload = EXCLUDED.payload,
        latest_screenshot_path = COALESCE(
          EXCLUDED.latest_screenshot_path,
          catalog_missions.latest_screenshot_path
        ),
        last_observed_at = EXCLUDED.last_observed_at,
        updated_at = EXCLUDED.updated_at
    `;
    upserted += 1;
  }
} finally {
  await sql.end({ timeout: 5 });
}

console.log(`Upserted ${upserted} catalog mission(s) into local database`);
