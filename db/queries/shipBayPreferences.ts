import "server-only";

import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { shipBayPreferences, type ShipBayPreference } from "@/db/schema";
import type { ShipBayPreferencePayload } from "@/lib/ships/shipBayPreferences";
import { normalizeShipBayPreferencePayload } from "@/lib/ships/shipBayPreferences";

export async function listShipBayPreferencesFromDb(): Promise<
  ShipBayPreference[]
> {
  const db = getDb();
  return db
    .select()
    .from(shipBayPreferences)
    .orderBy(asc(shipBayPreferences.shipSlug));
}

export async function getShipBayPreferenceFromDb(
  shipSlug: string,
): Promise<ShipBayPreference | undefined> {
  const db = getDb();
  const rows = await db
    .select()
    .from(shipBayPreferences)
    .where(eq(shipBayPreferences.shipSlug, shipSlug))
    .limit(1);
  return rows[0];
}

export async function upsertShipBayPreference(input: {
  shipSlug: string;
  payload: ShipBayPreferencePayload;
  updatedBy?: string;
}): Promise<ShipBayPreference> {
  const db = getDb();
  const now = new Date();
  const payload = normalizeShipBayPreferencePayload(input.payload);
  const [row] = await db
    .insert(shipBayPreferences)
    .values({
      shipSlug: input.shipSlug,
      payload,
      updatedBy: input.updatedBy ?? "mcp",
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: shipBayPreferences.shipSlug,
      set: {
        payload,
        updatedBy: input.updatedBy ?? "mcp",
        updatedAt: now,
      },
    })
    .returning();
  return row!;
}
