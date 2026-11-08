import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";

/** Proves DB connectivity when DATABASE_URL is configured. */
export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      {
        ok: false,
        error: "DATABASE_URL is not set",
        hint: "Copy .env.example to .env.local",
      },
      { status: 503 },
    );
  }

  try {
    const db = getDb();
    const result = await db.execute(sql`select 1 as ready`);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown DB error",
      },
      { status: 503 },
    );
  }
}
