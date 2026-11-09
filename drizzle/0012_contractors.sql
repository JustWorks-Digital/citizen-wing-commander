CREATE TABLE "contractors" (
	"slug" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"aliases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "contractors_name_idx" ON "contractors" USING btree ("name");--> statement-breakpoint
INSERT INTO "contractors" ("slug", "name", "aliases") VALUES
  (
    'covalex-independent-contractors',
    'Covalex Independent Contractors',
    '["Covalex","Covalex Shipping","Covalex Independent Contractor"]'::jsonb
  ),
  (
    'ling-family-hauling',
    'Ling Family Hauling',
    '["Ling Family","Ling Hauling"]'::jsonb
  ),
  (
    'red-wind',
    'Red Wind',
    '["Red Wind Shipping"]'::jsonb
  ),
  (
    'hd-mining',
    'HD Mining',
    '["Hurston Dynamics Mining","HD"]'::jsonb
  );--> statement-breakpoint
ALTER TABLE "catalog_missions" ADD COLUMN "contractor_slug" text;--> statement-breakpoint
UPDATE "catalog_missions" SET "contractor_slug" = CASE
  WHEN lower(trim(coalesce("contractor", ''))) IN (
    'covalex independent contractors',
    'covalex shipping',
    'covalex',
    'covalex independent contractor',
    'covalex-independent-contractors'
  ) THEN 'covalex-independent-contractors'
  WHEN lower(trim(coalesce("contractor", ''))) IN (
    'ling family hauling',
    'ling family',
    'ling hauling',
    'ling-family-hauling'
  ) THEN 'ling-family-hauling'
  WHEN lower(trim(coalesce("contractor", ''))) IN (
    'red wind',
    'red wind shipping',
    'red-wind'
  ) THEN 'red-wind'
  WHEN lower(trim(coalesce("contractor", ''))) IN (
    'hd mining',
    'hurston dynamics mining',
    'hd',
    'hd-mining'
  ) THEN 'hd-mining'
  ELSE NULL
END;--> statement-breakpoint
UPDATE "catalog_missions"
SET "payload" = CASE
  WHEN "contractor_slug" IS NOT NULL THEN
    ("payload" - 'contractor') || jsonb_build_object('contractorSlug', "contractor_slug")
  WHEN "payload" ? 'contractor' THEN
    "payload" - 'contractor'
  ELSE "payload"
END;--> statement-breakpoint
ALTER TABLE "catalog_missions" DROP COLUMN "contractor";--> statement-breakpoint
ALTER TABLE "catalog_missions" ADD CONSTRAINT "catalog_missions_contractor_slug_contractors_slug_fk" FOREIGN KEY ("contractor_slug") REFERENCES "public"."contractors"("slug") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "catalog_missions_contractor_slug_idx" ON "catalog_missions" USING btree ("contractor_slug");
