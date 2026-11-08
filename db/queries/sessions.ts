import { asc, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import {
  checklistProgress,
  missions,
  players,
  sessionPlayers,
  sessions,
} from "@/db/schema";
import {
  emptyHaulingPayload,
  type HaulingMissionPayload,
} from "@/lib/missions/types";

function makeJoinCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export async function createSessionWithOwner(input: {
  sessionName: string;
  ownerDisplayName: string;
  ownerHandle?: string;
}) {
  const db = getDb();

  return db.transaction(async (tx) => {
    const [player] = await tx
      .insert(players)
      .values({
        displayName: input.ownerDisplayName,
        handle: input.ownerHandle,
      })
      .returning();

    const [session] = await tx
      .insert(sessions)
      .values({
        name: input.sessionName,
        joinCode: makeJoinCode(),
      })
      .returning();

    await tx.insert(sessionPlayers).values({
      sessionId: session.id,
      playerId: player.id,
      role: "owner",
    });

    return { session, owner: player };
  });
}

export async function listSessions() {
  const db = getDb();
  return db.select().from(sessions).orderBy(desc(sessions.updatedAt));
}

export async function getSessionByJoinCode(joinCode: string) {
  const db = getDb();
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.joinCode, joinCode.toUpperCase()))
    .limit(1);
  return session ?? null;
}

export async function getSessionBundle(sessionId: string) {
  const db = getDb();

  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  if (!session) return null;

  const members = await db
    .select({
      playerId: players.id,
      displayName: players.displayName,
      handle: players.handle,
      role: sessionPlayers.role,
      joinedAt: sessionPlayers.joinedAt,
    })
    .from(sessionPlayers)
    .innerJoin(players, eq(players.id, sessionPlayers.playerId))
    .where(eq(sessionPlayers.sessionId, sessionId));

  const missionRows = await db
    .select()
    .from(missions)
    .where(eq(missions.sessionId, sessionId))
    .orderBy(asc(missions.sortOrder), asc(missions.createdAt));

  const progress =
    missionRows.length === 0
      ? []
      : await db
          .select()
          .from(checklistProgress)
          .where(
            inArray(
              checklistProgress.missionId,
              missionRows.map((m) => m.id),
            ),
          );

  return {
    session,
    members,
    missions: missionRows,
    progress,
  };
}

export async function addHaulingMission(input: {
  sessionId: string;
  title: string;
  payload?: Partial<HaulingMissionPayload>;
  sortOrder?: number;
}) {
  const db = getDb();
  const payload = emptyHaulingPayload(input.payload);

  const [mission] = await db
    .insert(missions)
    .values({
      sessionId: input.sessionId,
      type: "hauling",
      title: input.title,
      status: "planned",
      sortOrder: input.sortOrder ?? 0,
      payload,
    })
    .returning();

  return mission;
}

export async function upsertChecklistItem(input: {
  missionId: string;
  playerId: string;
  itemKey: string;
  completed: boolean;
  notes?: string;
}) {
  const db = getDb();

  const [row] = await db
    .insert(checklistProgress)
    .values({
      missionId: input.missionId,
      playerId: input.playerId,
      itemKey: input.itemKey,
      completed: input.completed,
      notes: input.notes,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        checklistProgress.missionId,
        checklistProgress.playerId,
        checklistProgress.itemKey,
      ],
      set: {
        completed: input.completed,
        notes: input.notes,
        updatedAt: new Date(),
      },
    })
    .returning();

  return row;
}
