CREATE TABLE "ship_bay_preferences" (
	"ship_slug" text PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"updated_by" text DEFAULT 'mcp' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
