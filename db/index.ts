import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Server-only Drizzle client.
 * Requires `DATABASE_URL` (see `.env.example`).
 */
const globalForDb = globalThis as unknown as {
  postgres?: ReturnType<typeof postgres>;
};

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and configure Postgres.",
    );
  }

  const queryClient =
    globalForDb.postgres ??
    postgres(url, {
      max: 10,
      prepare: false,
    });

  if (process.env.NODE_ENV !== "production") {
    globalForDb.postgres = queryClient;
  }

  return drizzle(queryClient, { schema });
}

let dbInstance: ReturnType<typeof createClient> | undefined;

export function getDb() {
  if (!dbInstance) {
    dbInstance = createClient();
  }
  return dbInstance;
}

export type Db = ReturnType<typeof getDb>;
