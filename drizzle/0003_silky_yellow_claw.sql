CREATE TABLE "ships" (
	"id" integer PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"name_full" text NOT NULL,
	"manufacturer" text,
	"cargo_scu" integer DEFAULT 0 NOT NULL,
	"is_cargo" boolean DEFAULT false NOT NULL,
	"container_sizes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_selectable" boolean DEFAULT false NOT NULL,
	"source" text DEFAULT 'uex' NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "ships_slug_uidx" ON "ships" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "ships_selectable_idx" ON "ships" USING btree ("is_selectable");--> statement-breakpoint
-- Seed current session dropdown ships (UEX stats; refresh via npm run db:sync-ships).
INSERT INTO "ships" (
  "id", "slug", "name", "name_full", "manufacturer", "cargo_scu", "is_cargo",
  "container_sizes", "is_selectable", "source"
) VALUES
  (
    35,
    'c2-hercules-starlifter',
    'C2 Hercules Starlifter',
    'Crusader C2 Hercules Starlifter',
    'Crusader Industries',
    696,
    true,
    '[1,2,4,8,16,24,32]'::jsonb,
    true,
    'uex'
  ),
  (
    292,
    'constellation-mk-v-centaurus',
    'Constellation Mk V Centaurus',
    'RSI Constellation Mk V Centaurus',
    'Roberts Space Industries',
    240,
    false,
    '[]'::jsonb,
    true,
    'uex'
  )
ON CONFLICT ("id") DO NOTHING;