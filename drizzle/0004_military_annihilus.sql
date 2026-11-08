CREATE TYPE "public"."catalog_mission_note_sentiment" AS ENUM('good', 'bad', 'neutral');--> statement-breakpoint
CREATE TABLE "catalog_mission_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mission_id" uuid NOT NULL,
	"body" text NOT NULL,
	"sentiment" "catalog_mission_note_sentiment",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog_mission_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mission_id" uuid NOT NULL,
	"duration_ms" integer NOT NULL,
	"offer_location_slug" text,
	"delivery_session_id" uuid,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog_missions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "mission_type" DEFAULT 'hauling' NOT NULL,
	"fingerprint" text NOT NULL,
	"title" text NOT NULL,
	"contractor" text,
	"reward_auec" integer,
	"offer_location_slug" text,
	"total_scu" integer DEFAULT 0 NOT NULL,
	"max_container_scu" integer,
	"box_breakdown" jsonb DEFAULT '{"size1":0,"size2":0,"size4":0,"size8":0}'::jsonb NOT NULL,
	"payload" jsonb NOT NULL,
	"latest_screenshot_path" text,
	"run_count" integer DEFAULT 0 NOT NULL,
	"total_duration_ms" integer DEFAULT 0 NOT NULL,
	"avg_duration_ms" integer,
	"last_observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "catalog_mission_notes" ADD CONSTRAINT "catalog_mission_notes_mission_id_catalog_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."catalog_missions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_mission_runs" ADD CONSTRAINT "catalog_mission_runs_mission_id_catalog_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."catalog_missions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_mission_runs" ADD CONSTRAINT "catalog_mission_runs_delivery_session_id_delivery_sessions_id_fk" FOREIGN KEY ("delivery_session_id") REFERENCES "public"."delivery_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "catalog_mission_notes_mission_idx" ON "catalog_mission_notes" USING btree ("mission_id");--> statement-breakpoint
CREATE INDEX "catalog_mission_runs_mission_idx" ON "catalog_mission_runs" USING btree ("mission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_missions_fingerprint_uidx" ON "catalog_missions" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "catalog_missions_offer_location_idx" ON "catalog_missions" USING btree ("offer_location_slug");--> statement-breakpoint
CREATE INDEX "catalog_missions_type_idx" ON "catalog_missions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "catalog_missions_title_idx" ON "catalog_missions" USING btree ("title");