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
import { catalogRouteFlagsFromLocationSplits } from "@/lib/missions/catalogRouteFlags";

export type UpsertHaulingCatalogMissionInput = {
  /** Accepts builder input (including legacy rewardAuec → rewards). */
  payload: Parameters<typeof buildHaulingCatalogMissionPayload>[0];
};

/** Create/update a catalog mission. Currently implements `hauling`. */
export async function upsertCatalogMission(
  input: { type: "hauling" } & UpsertHaulingCatalogMissionInput,
): Promise<CatalogMission> {
  if (input.type !== "hauling") {
    throw new Error(`Unsupported mission type: ${String(input.type)}`);
  }

  let payload = buildHaulingCatalogMissionPayload(input.payload);
  const fingerprint = catalogMissionFingerprint(payload);
  const db = getDb();

  // Preserve scuSplits / scuLocationSplits / objectives when an upsert omits them.
  if (
    payload.scuSplits === undefined ||
    payload.scuLocationSplits === undefined ||
    payload.objectives === undefined
  ) {
    const [existing] = await db
      .select()
      .from(catalogMissions)
      .where(eq(catalogMissions.fingerprint, fingerprint))
      .limit(1);
    const existingPayload = existing?.payload as HaulingCatalogMissionPayload | null;
    if (existingPayload) {
      payload = buildHaulingCatalogMissionPayload({
        ...payload,
        scuSplits: payload.scuSplits ?? existingPayload.scuSplits,
        scuLocationSplits:
          payload.scuLocationSplits ?? existingPayload.scuLocationSplits,
        objectives: payload.objectives ?? existingPayload.objectives,
      });
    }
  }

  const routeFlags = catalogRouteFlagsFromLocationSplits(
    payload.scuLocationSplits,
    {
      fromSlugs: payload.fromLocationSlugs,
      toSlugs: payload.toLocationSlugs,
    },
  );

  const updateSet: Record<string, unknown> = {
    type: "hauling",
    title: payload.title,
    rank: payload.rank ?? null,
    contractorSlug: payload.contractorSlug ?? null,
    rewards: payload.rewards,
    offerLocationSlug: payload.offerLocationSlug ?? null,
    scuTotal: payload.scuTotal,
    scuMaxContainerSize: payload.scuMaxContainerSize ?? null,
    scuBoxSplits: payload.scuBoxSplits,
    scuLocationSplits: payload.scuLocationSplits ?? null,
    isDirect: routeFlags.isDirect,
    isOnePickup: routeFlags.isOnePickup,
    isOneDelivery: routeFlags.isOneDelivery,
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
      rank: payload.rank ?? null,
      contractorSlug: payload.contractorSlug ?? null,
      rewards: payload.rewards,
      offerLocationSlug: payload.offerLocationSlug ?? null,
      scuTotal: payload.scuTotal,
      scuMaxContainerSize: payload.scuMaxContainerSize ?? null,
      scuBoxSplits: payload.scuBoxSplits,
      scuLocationSplits: payload.scuLocationSplits ?? null,
      isDirect: routeFlags.isDirect,
      isOnePickup: routeFlags.isOnePickup,
      isOneDelivery: routeFlags.isOneDelivery,
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

/** Patch screenshot path + payload on a specific catalog mission (by id). */
export async function updateCatalogMissionScreenshotPath(input: {
  missionId: string;
  latestScreenshotPath: string;
  payload: HaulingCatalogMissionPayload;
}): Promise<CatalogMission> {
  const db = getDb();
  const payload = buildHaulingCatalogMissionPayload({
    ...input.payload,
    latestScreenshotPath: input.latestScreenshotPath,
  });
  const routeFlags = catalogRouteFlagsFromLocationSplits(
    payload.scuLocationSplits,
    {
      fromSlugs: payload.fromLocationSlugs,
      toSlugs: payload.toLocationSlugs,
    },
  );
  const [row] = await db
    .update(catalogMissions)
    .set({
      latestScreenshotPath: input.latestScreenshotPath,
      payload,
      scuLocationSplits: payload.scuLocationSplits ?? null,
      isDirect: routeFlags.isDirect,
      isOnePickup: routeFlags.isOnePickup,
      isOneDelivery: routeFlags.isOneDelivery,
      updatedAt: new Date(),
    })
    .where(eq(catalogMissions.id, input.missionId))
    .returning();
  if (!row) {
    throw new Error(`Catalog mission not found: ${input.missionId}`);
  }
  return row;
}

/** Rewrite title/rank/fingerprint for one catalog mission (by id). */
export async function updateCatalogMissionRankFields(input: {
  missionId: string;
  title: string;
  rank: HaulingCatalogMissionPayload["rank"];
  payload: HaulingCatalogMissionPayload;
  fingerprint: string;
}): Promise<CatalogMission> {
  const db = getDb();
  const [row] = await db
    .update(catalogMissions)
    .set({
      title: input.title,
      rank: input.rank ?? null,
      fingerprint: input.fingerprint,
      payload: input.payload,
      updatedAt: new Date(),
    })
    .where(eq(catalogMissions.id, input.missionId))
    .returning();
  if (!row) {
    throw new Error(`Catalog mission not found: ${input.missionId}`);
  }
  return row;
}

/** Rewrite denormalized route flags for one catalog mission (by id). */
export async function updateCatalogMissionRouteFlags(input: {
  missionId: string;
  isDirect: boolean;
  isOnePickup: boolean;
  isOneDelivery: boolean;
}): Promise<CatalogMission> {
  const db = getDb();
  const [row] = await db
    .update(catalogMissions)
    .set({
      isDirect: input.isDirect,
      isOnePickup: input.isOnePickup,
      isOneDelivery: input.isOneDelivery,
      updatedAt: new Date(),
    })
    .where(eq(catalogMissions.id, input.missionId))
    .returning();
  if (!row) {
    throw new Error(`Catalog mission not found: ${input.missionId}`);
  }
  return row;
}

/** Delete catalog missions by id (notes/runs cascade). */
export async function deleteCatalogMissionsByIds(
  ids: string[],
): Promise<number> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return 0;
  const db = getDb();
  const deleted = await db
    .delete(catalogMissions)
    .where(inArray(catalogMissions.id, unique))
    .returning({ id: catalogMissions.id });
  return deleted.length;
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
  const limit = Math.min(Math.max(input?.limit ?? 50, 1), 500);
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
      missionRunCount: sql`${catalogMissions.missionRunCount} + 1`,
      missionTotalDurationMs: sql`${catalogMissions.missionTotalDurationMs} + ${durationMs}`,
      missionAvgDurationMs: sql`((${catalogMissions.missionTotalDurationMs} + ${durationMs}) / (${catalogMissions.missionRunCount} + 1))`,
      updatedAt: new Date(),
    })
    .where(eq(catalogMissions.id, input.missionId))
    .returning();

  if (!mission) throw new Error("Catalog mission not found for run");
  return { run, mission };
}
