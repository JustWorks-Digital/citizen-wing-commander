#!/usr/bin/env node
/**
 * Apply pending Drizzle SQL migrations (deploy / upgrade path).
 *
 * Uses drizzle-orm's migrator against committed files in `drizzle/`.
 * Safe for production: does not require drizzle-kit (devDependency).
 *
 * Usage:
 *   DATABASE_URL=... npm run db:upgrade
 *
 * Locally, loads `.env.local` / `.env` when dotenv is available.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const migrationsFolder = path.join(root, "drizzle");

async function loadEnvFiles() {
  try {
    const { config } = await import("dotenv");
    config({ path: path.join(root, ".env.local") });
    config({ path: path.join(root, ".env") });
  } catch {
    // Production / CI: DATABASE_URL is expected in the process environment.
  }
}

async function main() {
  await loadEnvFiles();

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    console.error(
      "DATABASE_URL is required. Copy .env.example → .env.local or set it in the deploy environment.",
    );
    process.exit(1);
  }

  console.log(`Applying migrations from ${path.relative(root, migrationsFolder)} …`);

  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client);

  try {
    await migrate(db, { migrationsFolder });
    console.log("Database upgrade complete.");
  } finally {
    await client.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error("Database upgrade failed:", error);
  process.exit(1);
});
