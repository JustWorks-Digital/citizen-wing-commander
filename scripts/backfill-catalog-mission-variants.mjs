#!/usr/bin/env node
/**
 * Recompute variant_family_key and merge SCU-variant groups for existing rows.
 *
 * Usage:
 *   DATABASE_URL=… npm run db:backfill-catalog-variants
 *
 * Prefer the MCP tool `backfill_catalog_mission_variants` after deploy when
 * the app already has the TS helpers; this script is for local/ops use.
 */
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

async function loadEnvFiles() {
  try {
    const { config } = await import("dotenv");
    config({ path: path.join(root, ".env.local") });
    config({ path: path.join(root, ".env") });
  } catch {
    // optional
  }
}

function stripRankFromTitle(title) {
  const match = String(title ?? "").match(
    /^(Trainee|Rookie|Junior|Member|Experienced|Senior|Master)\s+Rank\s*[-–—:]\s*(.+)$/i,
  );
  if (!match) return { title: String(title ?? "").trim(), rank: null };
  return {
    rank: match[1].replace(/^\w/, (c) => c.toUpperCase()),
    title: match[2].trim(),
  };
}

function familyKeyFromPayload(payload) {
  const stripped = stripRankFromTitle(payload.title ?? "");
  const rank = (payload.rank ?? stripped.rank ?? "").toString().toLowerCase();
  const titleKey = stripped.title.trim().toLowerCase();
  const contractorKey = String(payload.contractorSlug ?? "")
    .trim()
    .toLowerCase();
  const offerKey = String(payload.offerLocationSlug ?? "")
    .trim()
    .toLowerCase();
  const fromKey = [...(payload.fromLocationSlugs ?? [])]
    .map((s) => String(s).toLowerCase())
    .sort()
    .join("|");
  const toKey = [...(payload.toLocationSlugs ?? [])]
    .map((s) => String(s).toLowerCase())
    .sort()
    .join("|");
  const commodityKey = [
    ...new Set(
      (payload.cargo ?? []).map((line) =>
        String(line.commoditySlug ?? "").toLowerCase(),
      ),
    ),
  ]
    .sort()
    .join(",");
  const raw = [
    titleKey,
    rank,
    contractorKey,
    offerKey,
    fromKey,
    toKey,
    commodityKey,
  ].join("::");
  return createHash("sha256").update(raw).digest("hex");
}

async function main() {
  await loadEnvFiles();
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    console.error("DATABASE_URL is required.");
    process.exit(1);
  }

  const sql = postgres(databaseUrl, { max: 1 });
  let updatedFamilyKeys = 0;
  let mergedGroups = 0;
  try {
    const rows = await sql`
      SELECT id, variant_group_id, variant_family_key, payload, created_at
      FROM catalog_missions
      ORDER BY created_at ASC
    `;
    const byFamily = new Map();

    for (const row of rows) {
      const familyKey = familyKeyFromPayload(row.payload ?? {});
      if (row.variant_family_key !== familyKey) {
        await sql`
          UPDATE catalog_missions
          SET variant_family_key = ${familyKey}, updated_at = NOW()
          WHERE id = ${row.id}::uuid
        `;
        updatedFamilyKeys += 1;
      }
      const list = byFamily.get(familyKey) ?? [];
      list.push({ ...row, variant_family_key: familyKey });
      byFamily.set(familyKey, list);
    }

    for (const siblings of byFamily.values()) {
      if (siblings.length < 2) continue;
      const groupId = siblings
        .map((row) => row.variant_group_id)
        .sort()[0];
      const needsMerge = siblings.some(
        (row) => row.variant_group_id !== groupId,
      );
      if (!needsMerge) continue;
      const ids = siblings.map((row) => row.id);
      await sql`
        UPDATE catalog_missions
        SET variant_group_id = ${groupId}::uuid, updated_at = NOW()
        WHERE id = ANY(${ids}::uuid[])
      `;
      mergedGroups += 1;
    }
  } finally {
    await sql.end({ timeout: 5 });
  }

  console.log(
    JSON.stringify({ ok: true, updatedFamilyKeys, mergedGroups }, null, 2),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
