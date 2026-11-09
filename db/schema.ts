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
  CatalogMissionNoteSentiment,
  HaulingCatalogMissionPayload,
  ScuLocationSplits,
} from "@/lib/missions/catalogMission";
import type { MissionRank } from "@/lib/missions/missionRank";
import type {
  ChecklistItemProgressMeta,
  HaulingMissionPayload,
  MissionPayload,
} from "@/lib/missions/types";
import type { ShipBayPreferencePayload } from "@/lib/ships/shipBayPreferences";

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

export const catalogMissionNoteSentimentEnum = pgEnum(
  "catalog_mission_note_sentiment",
  ["good", "bad", "neutral"],
);

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

/**
 * Ship / vehicle stats synced from UEX (spaceships).
 * Session UI currently offers a small selectable subset via `isSelectable`.
 */
export const ships = pgTable(
  "ships",
  {
    /** UEX vehicle id when known; otherwise a stable local id. */
    id: integer("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    nameFull: text("name_full").notNull(),
    manufacturer: text("manufacturer"),
    cargoScu: integer("cargo_scu").notNull().default(0),
    isCargo: boolean("is_cargo").notNull().default(false),
    containerSizes: jsonb("container_sizes")
      .$type<number[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    /** Offered in the session ship dropdown. */
    isSelectable: boolean("is_selectable").notNull().default(false),
    source: text("source").notNull().default("uex"),
    syncedAt: timestamp("synced_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("ships_slug_uidx").on(table.slug),
    index("ships_selectable_idx").on(table.isSelectable),
  ],
);

/**
 * Per-ship cargo bay organization preferences.
 * DB is the live source of truth (MCP updates accumulate here).
 * A committed file fixture mirrors defaults; DB wins when both exist.
 */
export const shipBayPreferences = pgTable("ship_bay_preferences", {
  shipSlug: text("ship_slug").primaryKey(),
  payload: jsonb("payload")
    .$type<ShipBayPreferencePayload>()
    .notNull(),
  /** Who/what last wrote: mcp | manual | import */
  updatedBy: text("updated_by").notNull().default("mcp"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

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

/**
 * Contractors / orgs that post missions (MobiGlas “Contracted by”).
 * Seeded from `lib/fixtures/contractors.json`; catalog missions store `contractorSlug`.
 */
export const contractors = pgTable(
  "contractors",
  {
    slug: text("slug").primaryKey(),
    name: text("name").notNull(),
    aliases: jsonb("aliases")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("contractors_name_idx").on(table.name)],
);

/**
 * Planning catalog of observed missions (not live checklist `missions` rows).
 * Dedupe via `fingerprint`. Timing averages come from `catalog_mission_runs`.
 */
export const catalogMissions = pgTable(
  "catalog_missions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    type: missionTypeEnum("type").notNull().default("hauling"),
    /** sha256 of normalized title/contractorSlug/offer/from/to/cargo */
    fingerprint: text("fingerprint").notNull(),
    title: text("title").notNull(),
    /**
     * Hauling career rank (Trainee…Master), without the word “Rank” in the value.
     * Also stored on `payload.rank`.
     */
    rank: text("rank").$type<MissionRank | null>(),
    /** FK to `contractors.slug` (fixture-backed catalog). */
    contractorSlug: text("contractor_slug").references(() => contractors.slug, {
      onDelete: "set null",
    }),
    /**
     * Payout lines: [{ kind: "auec", amount }, { kind: "blueprint", name, slug? }, …].
     * Hauling is usually a single aUEC line; other mission types may mix rewards.
     */
    rewards: jsonb("rewards")
      .$type<HaulingCatalogMissionPayload["rewards"]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    /** Where the offer was seen / screenshot taken. */
    offerLocationSlug: text("offer_location_slug"),
    /**
     * Star system where the offer was seen (`stanton` / `pyro` / `nyx`, …).
     * No DB default — set on create; backfill existing rows to stanton.
     */
    offerStarSystemSlug: text("offer_star_system_slug"),
    scuTotal: integer("scu_total").notNull().default(0),
    scuMaxContainerSize: integer("scu_max_container_size"),
    /** Crate counts: { scuOne, scuTwo, scuFour, scuEight }. */
    scuBoxSplits: jsonb("scu_box_splits")
      .$type<HaulingCatalogMissionPayload["scuBoxSplits"]>()
      .notNull()
      .default(
        sql`'{"scuOne":0,"scuTwo":0,"scuFour":0,"scuEight":0}'::jsonb`,
      ),
    /** SCU totals per location: { from: { slug: scu }, to: { slug: scu } }. */
    scuLocationSplits: jsonb("scu_location_splits").$type<ScuLocationSplits | null>(),
    /**
     * Route shape from `scuLocationSplits` (1→1 = direct).
     * Non-direct is `!isDirect` — not stored separately.
     */
    isDirect: boolean("is_direct").notNull().default(false),
    /** Exactly one pickup location. */
    isOnePickup: boolean("is_one_pickup").notNull().default(false),
    /** Exactly one delivery location. */
    isOneDelivery: boolean("is_one_delivery").notNull().default(false),
    /** Full structured contract body. */
    payload: jsonb("payload")
      .$type<HaulingCatalogMissionPayload>()
      .notNull(),
    latestScreenshotPath: text("latest_screenshot_path"),
    missionRunCount: integer("mission_run_count").notNull().default(0),
    missionTotalDurationMs: integer("mission_total_duration_ms")
      .notNull()
      .default(0),
    missionAvgDurationMs: integer("mission_avg_duration_ms"),
    lastObservedAt: timestamp("last_observed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("catalog_missions_fingerprint_uidx").on(table.fingerprint),
    index("catalog_missions_offer_location_idx").on(table.offerLocationSlug),
    index("catalog_missions_offer_star_system_idx").on(
      table.offerStarSystemSlug,
    ),
    index("catalog_missions_contractor_slug_idx").on(table.contractorSlug),
    index("catalog_missions_type_idx").on(table.type),
    index("catalog_missions_title_idx").on(table.title),
    index("catalog_missions_is_direct_idx").on(table.isDirect),
    index("catalog_missions_is_one_pickup_idx").on(table.isOnePickup),
    index("catalog_missions_is_one_delivery_idx").on(table.isOneDelivery),
  ],
);

export const catalogMissionNotes = pgTable(
  "catalog_mission_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    missionId: uuid("mission_id")
      .notNull()
      .references(() => catalogMissions.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    sentiment: catalogMissionNoteSentimentEnum("sentiment"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("catalog_mission_notes_mission_idx").on(table.missionId)],
);

export const catalogMissionRuns = pgTable(
  "catalog_mission_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    missionId: uuid("mission_id")
      .notNull()
      .references(() => catalogMissions.id, { onDelete: "cascade" }),
    durationMs: integer("duration_ms").notNull(),
    offerLocationSlug: text("offer_location_slug"),
    /** Optional live delivery-session link. */
    deliverySessionId: uuid("delivery_session_id").references(
      () => deliverySessions.id,
      { onDelete: "set null" },
    ),
    completedAt: timestamp("completed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("catalog_mission_runs_mission_idx").on(table.missionId)],
);

export const contractorsRelations = relations(contractors, ({ many }) => ({
  catalogMissions: many(catalogMissions),
}));

export const catalogMissionsRelations = relations(
  catalogMissions,
  ({ many, one }) => ({
    notes: many(catalogMissionNotes),
    runs: many(catalogMissionRuns),
    contractor: one(contractors, {
      fields: [catalogMissions.contractorSlug],
      references: [contractors.slug],
    }),
  }),
);

export const catalogMissionNotesRelations = relations(
  catalogMissionNotes,
  ({ one }) => ({
    mission: one(catalogMissions, {
      fields: [catalogMissionNotes.missionId],
      references: [catalogMissions.id],
    }),
  }),
);

export const catalogMissionRunsRelations = relations(
  catalogMissionRuns,
  ({ one }) => ({
    mission: one(catalogMissions, {
      fields: [catalogMissionRuns.missionId],
      references: [catalogMissions.id],
    }),
    deliverySession: one(deliverySessions, {
      fields: [catalogMissionRuns.deliverySessionId],
      references: [deliverySessions.id],
    }),
  }),
);

export type Player = typeof players.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type DeliverySession = typeof deliverySessions.$inferSelect;
export type Ship = typeof ships.$inferSelect;
export type ShipBayPreference = typeof shipBayPreferences.$inferSelect;
export type Mission = typeof missions.$inferSelect;
export type ChecklistProgress = typeof checklistProgress.$inferSelect;
export type Contractor = typeof contractors.$inferSelect;
export type CatalogMission = typeof catalogMissions.$inferSelect;
export type CatalogMissionNote = typeof catalogMissionNotes.$inferSelect;
export type CatalogMissionRun = typeof catalogMissionRuns.$inferSelect;
export type HaulingMission = Mission & {
  type: "hauling";
  payload: HaulingMissionPayload;
};

export type { CatalogMissionNoteSentiment };
