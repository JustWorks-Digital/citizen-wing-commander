import "server-only";

import { asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { ships, type Ship } from "@/db/schema";
import { getShipBySlug } from "@/lib/fixtures";
import { SELECTABLE_SHIP_SLUGS } from "@/lib/ships/selectableShips";
import { resolveShipCargoScu } from "@/lib/ships/shipCargoScu";

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

function withResolvedCargoScu(ship: Ship): Ship {
  const cargoScu = resolveShipCargoScu(ship.slug, ship.cargoScu);
  return cargoScu === ship.cargoScu ? ship : { ...ship, cargoScu };
}

/**
 * Session dropdown ships: allowlisted slugs, with module SCU overrides applied.
 * Falls back to fixtures when a slug is missing from Postgres (pre-sync).
 */
export async function listSelectableShips(): Promise<Ship[]> {
  const db = getDb();
  const allowlist = [...SELECTABLE_SHIP_SLUGS];
  const rows = await db
    .select()
    .from(ships)
    .where(inArray(ships.slug, allowlist))
    .orderBy(asc(ships.name));

  const bySlug = new Map(rows.map((row) => [row.slug, row] as const));
  const now = new Date();
  const result: Ship[] = [];

  for (const slug of allowlist) {
    const row = bySlug.get(slug);
    if (row) {
      result.push(withResolvedCargoScu(row));
      continue;
    }
    const fixture = getShipBySlug(slug);
    if (!fixture) continue;
    result.push({
      id: fixture.id,
      slug: fixture.slug,
      name: fixture.name,
      nameFull: fixture.nameFull,
      manufacturer: fixture.manufacturer,
      cargoScu: fixture.cargoScu,
      isCargo: fixture.isCargo,
      containerSizes: fixture.containerSizes,
      isSelectable: true,
      source: "fixture",
      syncedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }

  return result.sort((a, b) => a.name.localeCompare(b.name));
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
