import "server-only";

import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { ships, type Ship } from "@/db/schema";
import { SELECTABLE_SHIP_SLUGS } from "@/lib/ships/selectableShips";

export type ShipUpsertInput = {
  id: number;
  slug: string;
  name: string;
  nameFull: string;
  manufacturer: string | null;
  cargoScu: number;
  isCargo: boolean;
  containerSizes: number[];
  isSelectable?: boolean;
  source?: string;
};

export async function listSelectableShips(): Promise<Ship[]> {
  const db = getDb();
  return db
    .select()
    .from(ships)
    .where(eq(ships.isSelectable, true))
    .orderBy(asc(ships.name));
}

export async function listAllShips(): Promise<Ship[]> {
  const db = getDb();
  return db.select().from(ships).orderBy(asc(ships.name));
}

export async function getShipBySlugFromDb(
  slug: string,
): Promise<Ship | undefined> {
  const db = getDb();
  const rows = await db
    .select()
    .from(ships)
    .where(eq(ships.slug, slug))
    .limit(1);
  return rows[0];
}

export async function upsertShips(rows: ShipUpsertInput[]): Promise<number> {
  if (rows.length === 0) return 0;
  const db = getDb();
  const now = new Date();
  const selectable = new Set<string>(SELECTABLE_SHIP_SLUGS);

  for (const row of rows) {
    const isSelectable = row.isSelectable ?? selectable.has(row.slug);
    await db
      .insert(ships)
      .values({
        id: row.id,
        slug: row.slug,
        name: row.name,
        nameFull: row.nameFull,
        manufacturer: row.manufacturer,
        cargoScu: row.cargoScu,
        isCargo: row.isCargo,
        containerSizes: row.containerSizes,
        isSelectable,
        source: row.source ?? "uex",
        syncedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: ships.id,
        set: {
          slug: row.slug,
          name: row.name,
          nameFull: row.nameFull,
          manufacturer: row.manufacturer,
          cargoScu: row.cargoScu,
          isCargo: row.isCargo,
          containerSizes: row.containerSizes,
          isSelectable,
          source: row.source ?? "uex",
          syncedAt: now,
          updatedAt: now,
        },
      });
  }

  return rows.length;
}

/** Ensure allowlisted ships exist (seed from caller) and are selectable. */
export async function markSelectableShips(
  slugs: readonly string[] = SELECTABLE_SHIP_SLUGS,
): Promise<void> {
  const db = getDb();
  for (const slug of slugs) {
    await db
      .update(ships)
      .set({ isSelectable: true, updatedAt: new Date() })
      .where(eq(ships.slug, slug));
  }
}
