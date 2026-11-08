CREATE TYPE "public"."mission_status" AS ENUM('planned', 'active', 'blocked', 'completed', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."mission_type" AS ENUM('hauling');--> statement-breakpoint
CREATE TYPE "public"."session_role" AS ENUM('owner', 'member', 'spectator');--> statement-breakpoint
CREATE TABLE "checklist_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mission_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"item_key" text NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"notes" text,
	"meta" jsonb DEFAULT '{}'::jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "missions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"type" "mission_type" DEFAULT 'hauling' NOT NULL,
	"title" text NOT NULL,
	"status" "mission_status" DEFAULT 'planned' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text NOT NULL,
	"handle" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_players" (
	"session_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"role" "session_role" DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_players_session_id_player_id_pk" PRIMARY KEY("session_id","player_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"join_code" text NOT NULL,
	"name" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "checklist_progress" ADD CONSTRAINT "checklist_progress_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_progress" ADD CONSTRAINT "checklist_progress_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "missions" ADD CONSTRAINT "missions_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_players" ADD CONSTRAINT "session_players_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_players" ADD CONSTRAINT "session_players_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "checklist_progress_mission_idx" ON "checklist_progress" USING btree ("mission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "checklist_progress_unique_uidx" ON "checklist_progress" USING btree ("mission_id","player_id","item_key");--> statement-breakpoint
CREATE INDEX "missions_session_idx" ON "missions" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "missions_session_status_idx" ON "missions" USING btree ("session_id","status");--> statement-breakpoint
CREATE INDEX "missions_type_idx" ON "missions" USING btree ("type");--> statement-breakpoint
CREATE UNIQUE INDEX "players_handle_uidx" ON "players" USING btree ("handle");--> statement-breakpoint
CREATE INDEX "session_players_player_idx" ON "session_players" USING btree ("player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_join_code_uidx" ON "sessions" USING btree ("join_code");