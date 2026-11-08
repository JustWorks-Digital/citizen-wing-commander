import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { deliverySessions } from "@/db/schema";
import {
  applySessionCompletionTiming,
  mockSessionChecklist,
  type SessionChecklistModel,
} from "@/lib/missions/mockSession";

function normalizeChecklist(
  checklist: SessionChecklistModel,
  name?: string,
): SessionChecklistModel {
  return applySessionCompletionTiming({
    sessionName: (name ?? checklist.sessionName).trim() || "Delivery session",
    shipSlugs: Array.isArray(checklist.shipSlugs) ? checklist.shipSlugs : [],
    startedAt: checklist.startedAt || new Date().toISOString(),
    completedAt: checklist.completedAt ?? null,
    updatedAt: checklist.updatedAt || new Date().toISOString(),
    rows: Array.isArray(checklist.rows) ? checklist.rows : [],
  });
}

export async function listActiveDeliverySessions() {
  const db = getDb();
  return db
    .select({
      id: deliverySessions.id,
      name: deliverySessions.name,
      isActive: deliverySessions.isActive,
      updatedAt: deliverySessions.updatedAt,
      createdAt: deliverySessions.createdAt,
    })
    .from(deliverySessions)
    .where(eq(deliverySessions.isActive, true))
    .orderBy(desc(deliverySessions.updatedAt));
}

export async function getDeliverySession(id: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(deliverySessions)
    .where(eq(deliverySessions.id, id))
    .limit(1);
  return row ?? null;
}

export async function createDeliverySession(input?: {
  name?: string;
  checklist?: SessionChecklistModel;
}) {
  const db = getDb();
  const name = input?.name?.trim() || "Delivery session";
  const checklist = normalizeChecklist(
    input?.checklist ?? {
      ...structuredClone(mockSessionChecklist),
      sessionName: name,
      rows: [],
      shipSlugs: [],
    },
    name,
  );

  const [row] = await db
    .insert(deliverySessions)
    .values({
      name,
      checklist,
      isActive: true,
    })
    .returning();
  return row;
}

export async function updateDeliverySessionChecklist(
  id: string,
  checklist: SessionChecklistModel,
) {
  const db = getDb();
  const normalized = normalizeChecklist(checklist);
  const [row] = await db
    .update(deliverySessions)
    .set({
      name: normalized.sessionName,
      checklist: normalized,
      updatedAt: new Date(),
    })
    .where(
      and(eq(deliverySessions.id, id), eq(deliverySessions.isActive, true)),
    )
    .returning();
  return row ?? null;
}

/** Soft-delete: mark inactive, keep history. */
export async function softDeleteDeliverySession(id: string) {
  const db = getDb();
  const [row] = await db
    .update(deliverySessions)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(
      and(eq(deliverySessions.id, id), eq(deliverySessions.isActive, true)),
    )
    .returning();
  return row ?? null;
}
