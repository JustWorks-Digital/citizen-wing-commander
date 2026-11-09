#!/usr/bin/env node
/**
 * Apply `.ai-progress/scu-location-backfill-extractions.json` onto local catalog_missions.
 * Derives scuLocationSplits from scuSplits; updates cargo/from/to when splits are present.
 *
 * Usage: node scripts/apply-scu-location-backfill.mjs
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import postgres from "postgres";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
config({ path: path.join(root, ".env.local") });
config({ path: path.join(root, ".env") });

const extractionsPath = path.join(
  root,
  ".ai-progress/scu-location-backfill-extractions.json",
);
const queuePath = path.join(
  root,
  ".ai-progress/scu-location-backfill-queue.json",
);

if (!fs.existsSync(extractionsPath)) {
  console.error("Missing extractions file:", extractionsPath);
  process.exit(1);
}

const { byPath } = JSON.parse(fs.readFileSync(extractionsPath, "utf8"));
const queue = JSON.parse(fs.readFileSync(queuePath, "utf8"));

function scuLocationSplitsFromScuSplits(scuSplits) {
  const from = {};
  const to = {};
  for (const split of scuSplits) {
    const scu = Math.max(0, Math.floor(split.scu ?? 0));
    if (scu <= 0) continue;
    if (split.fromLocationSlug) {
      from[split.fromLocationSlug] = (from[split.fromLocationSlug] ?? 0) + scu;
    }
    if (split.toLocationSlug) {
      to[split.toLocationSlug] = (to[split.toLocationSlug] ?? 0) + scu;
    }
  }
  return { from, to };
}

function cargoFromScuSplits(scuSplits) {
  const bySlug = new Map();
  for (const split of scuSplits) {
    const scu = Math.max(0, Math.floor(split.scu ?? 0));
    const existing = bySlug.get(split.commoditySlug);
    if (existing) {
      existing.scu += scu;
      continue;
    }
    bySlug.set(split.commoditySlug, {
      commoditySlug: split.commoditySlug,
      commodityName: split.commodityName,
      scu,
    });
  }
  return [...bySlug.values()];
}

function locationsFromScuSplits(scuSplits) {
  const fromLocationSlugs = [];
  const toLocationSlugs = [];
  for (const split of scuSplits) {
    if (
      split.fromLocationSlug &&
      !fromLocationSlugs.includes(split.fromLocationSlug)
    ) {
      fromLocationSlugs.push(split.fromLocationSlug);
    }
    if (
      split.toLocationSlug &&
      !toLocationSlugs.includes(split.toLocationSlug)
    ) {
      toLocationSlugs.push(split.toLocationSlug);
    }
  }
  return { fromLocationSlugs, toLocationSlugs };
}

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
let updated = 0;
let skipped = 0;
const byMission = [];

try {
  for (const mission of queue) {
    const extraction = byPath[mission.path];
    if (!extraction || !extraction.scuSplits?.length) {
      skipped += 1;
      continue;
    }
    const scuSplits = extraction.scuSplits;
    const scuLocationSplits = scuLocationSplitsFromScuSplits(scuSplits);
    const cargo = cargoFromScuSplits(scuSplits);
    const { fromLocationSlugs, toLocationSlugs } =
      locationsFromScuSplits(scuSplits);
    const scuTotal = cargo.reduce((sum, line) => sum + line.scu, 0);
    const [row] = await sql`
      SELECT payload, rewards FROM catalog_missions WHERE id = ${mission.id}::uuid
    `;
    if (!row) {
      skipped += 1;
      continue;
    }
    const payload = { ...(row.payload ?? {}) };
    payload.scuSplits = scuSplits;
    payload.scuLocationSplits = scuLocationSplits;
    payload.cargo = cargo;
    payload.fromLocationSlugs = fromLocationSlugs;
    payload.toLocationSlugs = toLocationSlugs;
    payload.scuTotal = scuTotal;
    if (extraction.objectives?.length) {
      payload.objectives = extraction.objectives;
    }
    if (extraction.scuMaxContainerSize != null) {
      payload.scuMaxContainerSize = extraction.scuMaxContainerSize;
    }
    if (extraction.rewardAuec != null && extraction.rewardAuec > 0) {
      payload.rewards = [{ kind: "auec", amount: extraction.rewardAuec }];
    }

    await sql`
      UPDATE catalog_missions
      SET
        payload = ${sql.json(payload)},
        scu_total = ${scuTotal},
        scu_location_splits = ${sql.json(scuLocationSplits)},
        scu_max_container_size = COALESCE(
          ${extraction.scuMaxContainerSize ?? null},
          scu_max_container_size
        ),
        rewards = CASE
          WHEN ${extraction.rewardAuec ?? null}::int IS NOT NULL
            AND ${extraction.rewardAuec ?? null}::int > 0
          THEN ${sql.json([{ kind: "auec", amount: extraction.rewardAuec }])}::jsonb
          ELSE rewards
        END,
        updated_at = now()
      WHERE id = ${mission.id}::uuid
    `;
    updated += 1;
    byMission.push({ id: mission.id, path: mission.path, scuTotal, splits: scuSplits.length });
  }
} finally {
  await sql.end({ timeout: 5 });
}

console.log(JSON.stringify({ updated, skipped, byMissionCount: byMission.length }, null, 2));
fs.writeFileSync(
  path.join(root, ".ai-progress/scu-location-backfill-applied.json"),
  JSON.stringify({ updated, skipped, byMission }, null, 2),
);
