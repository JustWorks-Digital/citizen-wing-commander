import "server-only";

import shipBayPreferencesFixture from "@/lib/fixtures/shipBayPreferences.json";
import {
  getShipBayPreferenceFromDb,
  listShipBayPreferencesFromDb,
  upsertShipBayPreference,
} from "@/db/queries/shipBayPreferences";
import {
  emptyShipBayPreferencePayload,
  mergeShipBayPreferencePayload,
  normalizeShipBayPreferencePayload,
  type ShipBayPreferencePayload,
  type ShipBayPreferenceRecord,
} from "@/lib/ships/shipBayPreferences";

type FixtureFile = {
  items: Array<{
    shipSlug: string;
    payload: Partial<ShipBayPreferencePayload>;
  }>;
};

const fixture = shipBayPreferencesFixture as FixtureFile;

const fileBySlug = new Map(
  fixture.items.map((row) => [
    row.shipSlug,
    normalizeShipBayPreferencePayload(row.payload),
  ]),
);

function fileRecord(shipSlug: string): ShipBayPreferenceRecord | null {
  const payload = fileBySlug.get(shipSlug);
  if (!payload) return null;
  return { shipSlug, payload, source: "file" };
}

/**
 * Resolve bay prefs for a ship. Database wins over the committed file fixture.
 */
export async function resolveShipBayPreferences(
  shipSlug: string,
): Promise<ShipBayPreferenceRecord> {
  const slug = shipSlug.trim().toLowerCase();
  const dbRow = await getShipBayPreferenceFromDb(slug);
  if (dbRow) {
    return {
      shipSlug: dbRow.shipSlug,
      payload: normalizeShipBayPreferencePayload(dbRow.payload),
      source: "database",
      updatedAt: dbRow.updatedAt?.toISOString?.() ?? null,
    };
  }
  return (
    fileRecord(slug) ?? {
      shipSlug: slug,
      payload: emptyShipBayPreferencePayload(),
      source: "file",
    }
  );
}

export async function listResolvedShipBayPreferences(): Promise<
  ShipBayPreferenceRecord[]
> {
  const dbRows = await listShipBayPreferencesFromDb();
  const bySlug = new Map<string, ShipBayPreferenceRecord>();

  for (const [shipSlug, payload] of fileBySlug) {
    bySlug.set(shipSlug, { shipSlug, payload, source: "file" });
  }
  for (const row of dbRows) {
    bySlug.set(row.shipSlug, {
      shipSlug: row.shipSlug,
      payload: normalizeShipBayPreferencePayload(row.payload),
      source: "database",
      updatedAt: row.updatedAt?.toISOString?.() ?? null,
    });
  }

  return [...bySlug.values()].sort((a, b) =>
    a.shipSlug.localeCompare(b.shipSlug),
  );
}

export async function updateShipBayPreferences(input: {
  shipSlug: string;
  patch: Partial<ShipBayPreferencePayload> & {
    appendGuidelines?: string[];
    replaceNotes?: boolean;
  };
  updatedBy?: string;
}): Promise<ShipBayPreferenceRecord> {
  const current = await resolveShipBayPreferences(input.shipSlug);
  const merged = mergeShipBayPreferencePayload(current.payload, input.patch);
  const saved = await upsertShipBayPreference({
    shipSlug: input.shipSlug.trim().toLowerCase(),
    payload: merged,
    updatedBy: input.updatedBy ?? "mcp",
  });
  return {
    shipSlug: saved.shipSlug,
    payload: normalizeShipBayPreferencePayload(saved.payload),
    source: "database",
    updatedAt: saved.updatedAt?.toISOString?.() ?? null,
  };
}
