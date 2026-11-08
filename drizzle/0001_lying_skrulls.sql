CREATE TABLE "delivery_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"checklist" jsonb DEFAULT '{"sessionName":"","shipSlugs":[],"rows":[]}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "delivery_sessions_active_updated_idx" ON "delivery_sessions" USING btree ("is_active","updated_at");