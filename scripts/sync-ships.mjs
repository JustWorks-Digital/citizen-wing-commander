#!/usr/bin/env node
/**
 * Sync UEX vehicle (spaceship) stats into Postgres `ships`.
 *
 * Usage:
 *   DATABASE_URL=... npm run db:sync-ships
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import { uexApi } from "../lib/api/externalEndpoints.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const SELECTABLE_SHIP_SLUGS = [
  "c2-hercules-starlifter",
  "constellation-mk-v-centaurus",
];

async function loadEnvFiles() {
  try {
    const { config } = await import("dotenv");
    config({ path: path.join(root, ".env.local") });
    config({ path: path.join(root, ".env") });
  } catch {
    // Production: DATABASE_URL from environment.
  }
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response.json();
}

async function fetchShips() {
  const body = await fetchJson(uexApi.vehicles);
  if (body.status !== "ok" && body.http_code !== 200) {
    throw new Error(`UEX vehicles status: ${JSON.stringify(body.status)}`);
  }

  return (body.data ?? [])
    .filter((row) => row.is_spaceship === 1)
    .map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      nameFull: row.name_full,
      manufacturer: row.company_name ?? null,
      cargoScu: typeof row.scu === "number" ? row.scu : 0,
      isCargo: row.is_cargo === 1,
      containerSizes: row.container_sizes
        ? String(row.container_sizes)
            .split(",")
            .map((v) => Number(v.trim()))
            .filter((n) => Number.isFinite(n))
        : [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function main() {
  await loadEnvFiles();
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    console.error("DATABASE_URL is required.");
    process.exit(1);
  }

  const vehicles = await fetchShips();
  console.log(`fetched ${vehicles.length} spaceships from UEX`);

  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client);
  const nowIso = new Date().toISOString();
  const selectable = new Set(SELECTABLE_SHIP_SLUGS);

  try {
    // UEX can reuse slugs across vehicle ids; replace snapshot by slug.
    const seenSlugs = new Set();
    const uniqueVehicles = [];
    for (const ship of vehicles) {
      if (seenSlugs.has(ship.slug)) continue;
      seenSlugs.add(ship.slug);
      uniqueVehicles.push(ship);
    }

    await db.execute(sql`DELETE FROM ships`);

    for (const ship of uniqueVehicles) {
      const isSelectable = selectable.has(ship.slug);
      await db.execute(sql`
        INSERT INTO ships (
          id, slug, name, name_full, manufacturer, cargo_scu, is_cargo,
          container_sizes, is_selectable, source, synced_at, created_at, updated_at
        ) VALUES (
          ${ship.id},
          ${ship.slug},
          ${ship.name},
          ${ship.nameFull},
          ${ship.manufacturer},
          ${ship.cargoScu},
          ${ship.isCargo},
          ${JSON.stringify(ship.containerSizes)}::jsonb,
          ${isSelectable},
          ${"uex"},
          ${nowIso}::timestamptz,
          ${nowIso}::timestamptz,
          ${nowIso}::timestamptz
        )
      `);
    }

    // Keep allowlist selectable even if UEX omits a slug this run.
    for (const slug of SELECTABLE_SHIP_SLUGS) {
      await db.execute(sql`
        UPDATE ships
        SET is_selectable = true, updated_at = ${nowIso}::timestamptz
        WHERE slug = ${slug}
      `);
    }

    const selectableRows = await db.execute(sql`
      SELECT slug, name, cargo_scu FROM ships
      WHERE is_selectable = true
      ORDER BY name
    `);
    const listed = Array.isArray(selectableRows)
      ? selectableRows
      : selectableRows.rows ?? [];
    console.log(
      `synced ${uniqueVehicles.length} ships (from ${vehicles.length} UEX rows); selectable:`,
      listed.map((row) => `${row.slug} (${row.cargo_scu} SCU)`).join(", "),
    );
  } finally {
    await client.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
