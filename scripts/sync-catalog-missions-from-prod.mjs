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

function routeFlagsFromMission(mission, payload) {
  const splits =
    mission.scuLocationSplits ?? payload.scuLocationSplits ?? null;
  let fromCount = splits?.from ? Object.keys(splits.from).length : 0;
  let toCount = splits?.to ? Object.keys(splits.to).length : 0;
  if (fromCount === 0) {
    fromCount = new Set(payload.fromLocationSlugs ?? []).size;
  }
  if (toCount === 0) {
    toCount = new Set(payload.toLocationSlugs ?? []).size;
  }
  const isOnePickup = fromCount === 1;
  const isOneDelivery = toCount === 1;
  return {
    isDirect: isOnePickup && isOneDelivery,
    isOnePickup,
    isOneDelivery,
  };
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
  // Full replace so local catalog IDs / fingerprints match production exactly.
  await sql.begin(async (tx) => {
    await tx`DELETE FROM catalog_mission_notes`;
    await tx`DELETE FROM catalog_mission_runs`;
    await tx`DELETE FROM catalog_missions`;

    for (const mission of missions) {
      const payload = mission.payload ?? {};
      const fingerprint =
        mission.fingerprint ?? fingerprintFromPayload(payload);
      const routeFlags = routeFlagsFromMission(mission, payload);
      await tx`
        INSERT INTO catalog_missions (
          id, type, fingerprint, variant_group_id, variant_family_key, title, rank, contractor_slug, rewards,
          offer_location_slug, offer_star_system_slug, scu_total, scu_max_container_size, scu_box_splits,
          scu_location_splits, is_direct, is_one_pickup, is_one_delivery,
          payload, latest_screenshot_path, mission_run_count, mission_total_duration_ms,
          mission_avg_duration_ms, last_observed_at, created_at, updated_at
        ) VALUES (
          ${mission.id}::uuid,
          ${mission.type ?? "hauling"},
          ${fingerprint},
          ${(mission.variantGroupId ?? mission.id)}::uuid,
          ${mission.variantFamilyKey ?? fingerprint},
          ${mission.title},
          ${mission.rank ?? payload.rank ?? null},
          ${mission.contractorSlug ?? payload.contractorSlug ?? null},
          ${tx.json(
            mission.rewards ??
              (mission.rewardAuec != null && mission.rewardAuec > 0
                ? [{ kind: "auec", amount: mission.rewardAuec }]
                : []),
          )},
          ${mission.offerLocationSlug ?? null},
          ${mission.offerStarSystemSlug ?? payload.offerStarSystemSlug ?? null},
          ${mission.scuTotal ?? mission.totalScu ?? 0},
          ${mission.scuMaxContainerSize ?? mission.maxContainerScu ?? null},
          ${tx.json(
            mission.scuBoxSplits ??
              mission.boxBreakdown ??
              payload.scuBoxSplits ??
              payload.boxBreakdown ??
              emptyScuBoxSplits(),
          )},
          ${tx.json(
            mission.scuLocationSplits ??
              payload.scuLocationSplits ??
              null,
          )},
          ${routeFlags.isDirect},
          ${routeFlags.isOnePickup},
          ${routeFlags.isOneDelivery},
          ${tx.json((() => {
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
      `;
      upserted += 1;
    }
  });
} finally {
  await sql.end({ timeout: 5 });
}

console.log(`Replaced local catalog with ${upserted} production mission(s)`);
