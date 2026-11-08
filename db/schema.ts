import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { SessionChecklistModel } from "@/lib/missions/mockSession";
import type {
  ChecklistItemProgressMeta,
  HaulingMissionPayload,
  MissionPayload,
} from "@/lib/missions/types";

/** Extensible mission kinds. Start with hauling; add more without reshaping tables. */
export const missionTypeEnum = pgEnum("mission_type", [
  "hauling",
  // future: "bounty", "bunker", "salvage", ...
]);

export const missionStatusEnum = pgEnum("mission_status", [
  "planned",
  "active",
  "blocked",
  "completed",
  "abandoned",
]);

export const sessionRoleEnum = pgEnum("session_role", [
  "owner",
  "member",
  "spectator",
]);

export const players = pgTable(
  "players",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    displayName: text("display_name").notNull(),
    handle: text("handle"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("players_handle_uidx").on(table.handle)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Short join code for sharing a checklist room */
    joinCode: text("join_code").notNull(),
    name: text("name").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("sessions_join_code_uidx").on(table.joinCode)],
);

/**
 * Nightly hauling / delivery run (checklist UI document).
 * Soft-delete via `isActive=false` — rows are kept for history.
 */
export const deliverySessions = pgTable(
  "delivery_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    /** false = soft-deleted (hidden from tabs, retained in DB). */
    isActive: boolean("is_active").notNull().default(true),
    /** UI / MCP default target when sessionId is omitted. */
    isSelected: boolean("is_selected").notNull().default(false),
    /** Checklist document: ships + hauling rows. */
    checklist: jsonb("checklist")
      .$type<SessionChecklistModel>()
      .notNull()
      .default(
        sql`'{"id":"","sessionName":"","shipSlugs":[],"startLocationSlug":null,"missionCount":0,"missionsCompleted":0,"missions":[],"rows":[]}'::jsonb`,
      ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("delivery_sessions_active_updated_idx").on(
      table.isActive,
      table.updatedAt,
    ),
    index("delivery_sessions_selected_idx").on(table.isSelected),
  ],
);

export const sessionPlayers = pgTable(
  "session_players",
  {
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    role: sessionRoleEnum("role").notNull().default("member"),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.sessionId, table.playerId] }),
    index("session_players_player_idx").on(table.playerId),
  ],
);

/**
 * Normalized mission row + type-specific JSONB payload.
 * Hauling shape: `HaulingMissionPayload` when `type === 'hauling'`.
 */
export const missions = pgTable(
  "missions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    type: missionTypeEnum("type").notNull().default("hauling"),
    title: text("title").notNull(),
    status: missionStatusEnum("status").notNull().default("planned"),
    sortOrder: integer("sort_order").notNull().default(0),
    /** Large structured mission body (routes, cargo, template checklist, etc.) */
    payload: jsonb("payload")
      .$type<MissionPayload>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("missions_session_idx").on(table.sessionId),
    index("missions_session_status_idx").on(table.sessionId, table.status),
    index("missions_type_idx").on(table.type),
  ],
);

/**
 * Per-player checklist item progress for a mission.
 * `itemKey` matches keys in the mission payload checklist template.
 * Session-wide “done” is derived by aggregating player rows (avoids NULL unique issues).
 */
export const checklistProgress = pgTable(
  "checklist_progress",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    missionId: uuid("mission_id")
      .notNull()
      .references(() => missions.id, { onDelete: "cascade" }),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    itemKey: text("item_key").notNull(),
    completed: boolean("completed").notNull().default(false),
    notes: text("notes"),
    meta: jsonb("meta").$type<ChecklistItemProgressMeta>().default({}),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("checklist_progress_mission_idx").on(table.missionId),
    uniqueIndex("checklist_progress_unique_uidx").on(
      table.missionId,
      table.playerId,
      table.itemKey,
    ),
  ],
);

export const playersRelations = relations(players, ({ many }) => ({
  sessionMemberships: many(sessionPlayers),
  checklistProgress: many(checklistProgress),
}));

export const sessionsRelations = relations(sessions, ({ many }) => ({
  members: many(sessionPlayers),
  missions: many(missions),
}));

export const sessionPlayersRelations = relations(sessionPlayers, ({ one }) => ({
  session: one(sessions, {
    fields: [sessionPlayers.sessionId],
    references: [sessions.id],
  }),
  player: one(players, {
    fields: [sessionPlayers.playerId],
    references: [players.id],
  }),
}));

export const missionsRelations = relations(missions, ({ one, many }) => ({
  session: one(sessions, {
    fields: [missions.sessionId],
    references: [sessions.id],
  }),
  progress: many(checklistProgress),
}));

export const checklistProgressRelations = relations(
  checklistProgress,
  ({ one }) => ({
    mission: one(missions, {
      fields: [checklistProgress.missionId],
      references: [missions.id],
    }),
    player: one(players, {
      fields: [checklistProgress.playerId],
      references: [players.id],
    }),
  }),
);

export type Player = typeof players.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type DeliverySession = typeof deliverySessions.$inferSelect;
export type Mission = typeof missions.$inferSelect;
export type ChecklistProgress = typeof checklistProgress.$inferSelect;
export type HaulingMission = Mission & {
  type: "hauling";
  payload: HaulingMissionPayload;
};
