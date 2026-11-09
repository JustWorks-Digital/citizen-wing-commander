import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  catalogMissionNotes,
  catalogMissionRuns,
  catalogMissions,
  type CatalogMission,
  type CatalogMissionNote,
  type CatalogMissionRun,
} from "@/db/schema";
import {
  buildHaulingCatalogMissionPayload,
  catalogMissionFingerprint,
  type CatalogMissionNoteSentiment,
  type HaulingCatalogMissionPayload,
} from "@/lib/missions/catalogMission";

export type UpsertHaulingCatalogMissionInput = {
  payload: Omit<
    HaulingCatalogMissionPayload,
    "kind" | "version" | "totalScu" | "boxBreakdown"
  > &
    Partial<Pick<HaulingCatalogMissionPayload, "totalScu" | "boxBreakdown">>;
};

/** Create/update a catalog mission. Currently implements `hauling`. */
export async function upsertCatalogMission(
  input: { type: "hauling" } & UpsertHaulingCatalogMissionInput,
): Promise<CatalogMission> {
  if (input.type !== "hauling") {
    throw new Error(`Unsupported mission type: ${String(input.type)}`);
  }

  const payload = buildHaulingCatalogMissionPayload(input.payload);
  const fingerprint = catalogMissionFingerprint(payload);
  const db = getDb();

  const updateSet: Record<string, unknown> = {
    type: "hauling",
    title: payload.title,
    contractor: payload.contractor ?? null,
    rewardAuec: payload.rewardAuec ?? null,
    offerLocationSlug: payload.offerLocationSlug ?? null,
    totalScu: payload.totalScu,
    maxContainerScu: payload.maxContainerScu ?? null,
    boxBreakdown: payload.boxBreakdown,
    payload,
    lastObservedAt: new Date(),
    updatedAt: new Date(),
  };
  if (payload.latestScreenshotPath) {
    updateSet.latestScreenshotPath = payload.latestScreenshotPath;
  }

  const [row] = await db
    .insert(catalogMissions)
    .values({
      type: "hauling",
      fingerprint,
      title: payload.title,
      contractor: payload.contractor ?? null,
      rewardAuec: payload.rewardAuec ?? null,
      offerLocationSlug: payload.offerLocationSlug ?? null,
      totalScu: payload.totalScu,
      maxContainerScu: payload.maxContainerScu ?? null,
      boxBreakdown: payload.boxBreakdown,
      payload,
      latestScreenshotPath: payload.latestScreenshotPath ?? null,
      lastObservedAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: catalogMissions.fingerprint,
      set: updateSet,
    })
    .returning();

  if (!row) {
    throw new Error("Failed to upsert catalog mission");
  }
  return row;
}

export async function getCatalogMission(
  id: string,
): Promise<CatalogMission | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(catalogMissions)
    .where(eq(catalogMissions.id, id))
    .limit(1);
  return row ?? null;
}

export async function getCatalogMissionsByIds(
  ids: string[],
): Promise<CatalogMission[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return [];
  const db = getDb();
  return db
    .select()
    .from(catalogMissions)
    .where(inArray(catalogMissions.id, unique));
}

export async function listCatalogMissions(input?: {
  offerLocationSlug?: string | null;
  type?: "hauling" | null;
  limit?: number;
}): Promise<CatalogMission[]> {
  const db = getDb();
  const limit = Math.min(Math.max(input?.limit ?? 50, 1), 200);
  const offer = input?.offerLocationSlug?.trim() || null;
  const type = input?.type ?? null;
  const filters = [
    offer ? eq(catalogMissions.offerLocationSlug, offer) : undefined,
    type ? eq(catalogMissions.type, type) : undefined,
  ].filter(Boolean);

  const whereClause =
    filters.length === 0
      ? undefined
      : filters.length === 1
        ? filters[0]
        : and(...filters);

  const base = db.select().from(catalogMissions);
  const filtered = whereClause ? base.where(whereClause) : base;
  return filtered.orderBy(desc(catalogMissions.lastObservedAt)).limit(limit);
}

export async function addCatalogMissionNote(input: {
  missionId: string;
  body: string;
  sentiment?: CatalogMissionNoteSentiment | null;
}): Promise<CatalogMissionNote> {
  const db = getDb();
  const [row] = await db
    .insert(catalogMissionNotes)
    .values({
      missionId: input.missionId,
      body: input.body.trim(),
      sentiment: input.sentiment ?? null,
    })
    .returning();
  if (!row) throw new Error("Failed to add mission note");
  return row;
}

export async function listCatalogMissionNotes(
  missionId: string,
): Promise<CatalogMissionNote[]> {
  const db = getDb();
  return db
    .select()
    .from(catalogMissionNotes)
    .where(eq(catalogMissionNotes.missionId, missionId))
    .orderBy(desc(catalogMissionNotes.createdAt));
}

export async function recordCatalogMissionRun(input: {
  missionId: string;
  durationMs: number;
  offerLocationSlug?: string | null;
  deliverySessionId?: string | null;
}): Promise<{ run: CatalogMissionRun; mission: CatalogMission }> {
  const db = getDb();
  const durationMs = Math.max(0, Math.floor(input.durationMs));

  const [run] = await db
    .insert(catalogMissionRuns)
    .values({
      missionId: input.missionId,
      durationMs,
      offerLocationSlug: input.offerLocationSlug ?? null,
      deliverySessionId: input.deliverySessionId ?? null,
    })
    .returning();
  if (!run) throw new Error("Failed to record mission run");

  const [mission] = await db
    .update(catalogMissions)
    .set({
      runCount: sql`${catalogMissions.runCount} + 1`,
      totalDurationMs: sql`${catalogMissions.totalDurationMs} + ${durationMs}`,
      avgDurationMs: sql`((${catalogMissions.totalDurationMs} + ${durationMs}) / (${catalogMissions.runCount} + 1))`,
      updatedAt: new Date(),
    })
    .where(eq(catalogMissions.id, input.missionId))
    .returning();

  if (!mission) throw new Error("Catalog mission not found for run");
  return { run, mission };
}
