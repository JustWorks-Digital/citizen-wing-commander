import { and, desc, eq, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { deliverySessions, type DeliverySession } from "@/db/schema";
import type { SessionChecklistModel } from "@/lib/missions/mockSession";
import {
  emptySessionChecklist,
  normalizeSessionChecklist,
  summarizeSessionChecklist,
  type SessionTabSummary,
} from "@/lib/missions/sessionChecklist";

function rowToChecklist(row: DeliverySession): SessionChecklistModel {
  return normalizeSessionChecklist(row.checklist ?? {}, {
    preferId: row.id,
  });
}

export async function listActiveDeliverySessionTabs(): Promise<{
  activeSessionId: string;
  sessions: SessionTabSummary[];
  rows: DeliverySession[];
}> {
  const db = getDb();
  const rows = await db
    .select()
    .from(deliverySessions)
    .where(eq(deliverySessions.isActive, true))
    .orderBy(desc(deliverySessions.updatedAt));

  const selected = rows.find((row) => row.isSelected) ?? rows[0] ?? null;
  return {
    activeSessionId: selected?.id ?? "",
    sessions: rows.map((row) =>
      summarizeSessionChecklist(rowToChecklist(row)),
    ),
    rows,
  };
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

export async function getSelectedDeliverySession() {
  const db = getDb();
  const [selected] = await db
    .select()
    .from(deliverySessions)
    .where(
      and(
        eq(deliverySessions.isActive, true),
        eq(deliverySessions.isSelected, true),
      ),
    )
    .orderBy(desc(deliverySessions.updatedAt))
    .limit(1);
  if (selected) return selected;

  const [latest] = await db
    .select()
    .from(deliverySessions)
    .where(eq(deliverySessions.isActive, true))
    .orderBy(desc(deliverySessions.updatedAt))
    .limit(1);
  return latest ?? null;
}

export async function createDeliverySession(input?: {
  name?: string;
  checklist?: SessionChecklistModel;
  select?: boolean;
}) {
  const db = getDb();
  const name = input?.name?.trim() || "New session";
  const checklist = normalizeSessionChecklist(
    input?.checklist ?? emptySessionChecklist({ sessionName: name }),
    { touchUpdatedAt: true },
  );
  const select = input?.select !== false;

  return db.transaction(async (tx) => {
    if (select) {
      await tx
        .update(deliverySessions)
        .set({ isSelected: false })
        .where(eq(deliverySessions.isSelected, true));
    }

    const [row] = await tx
      .insert(deliverySessions)
      .values({
        id: checklist.id,
        name: checklist.sessionName,
        checklist: { ...checklist, id: checklist.id },
        isActive: true,
        isSelected: select,
      })
      .returning();
    return row!;
  });
}

export async function selectDeliverySession(id: string) {
  const db = getDb();
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(deliverySessions)
      .where(
        and(eq(deliverySessions.id, id), eq(deliverySessions.isActive, true)),
      )
      .limit(1);
    if (!existing) return null;

    await tx
      .update(deliverySessions)
      .set({ isSelected: false })
      .where(
        and(
          eq(deliverySessions.isSelected, true),
          ne(deliverySessions.id, id),
        ),
      );

    const [row] = await tx
      .update(deliverySessions)
      .set({
        isSelected: true,
        updatedAt: new Date(),
      })
      .where(eq(deliverySessions.id, id))
      .returning();
    return row ?? null;
  });
}

export async function updateDeliverySessionChecklist(
  id: string,
  checklist: SessionChecklistModel,
) {
  const db = getDb();
  const normalized = normalizeSessionChecklist(checklist, {
    preferId: id,
    touchUpdatedAt: true,
  });
  const [row] = await db
    .update(deliverySessions)
    .set({
      name: normalized.sessionName,
      checklist: { ...normalized, id },
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
      isSelected: false,
      updatedAt: new Date(),
    })
    .where(
      and(eq(deliverySessions.id, id), eq(deliverySessions.isActive, true)),
    )
    .returning();

  if (row) {
    const [stillSelected] = await db
      .select()
      .from(deliverySessions)
      .where(
        and(
          eq(deliverySessions.isActive, true),
          eq(deliverySessions.isSelected, true),
        ),
      )
      .limit(1);
    if (!stillSelected) {
      const [latest] = await db
        .select()
        .from(deliverySessions)
        .where(eq(deliverySessions.isActive, true))
        .orderBy(desc(deliverySessions.updatedAt))
        .limit(1);
      if (latest) {
        await selectDeliverySession(latest.id);
      }
    }
  }

  return row ?? null;
}

export { rowToChecklist };
