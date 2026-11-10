ALTER TABLE "catalog_missions" ADD COLUMN "variant_group_id" uuid;--> statement-breakpoint
ALTER TABLE "catalog_missions" ADD COLUMN "variant_family_key" text;--> statement-breakpoint
UPDATE "catalog_missions" SET "variant_group_id" = "id" WHERE "variant_group_id" IS NULL;--> statement-breakpoint
UPDATE "catalog_missions" SET "variant_family_key" = "fingerprint" WHERE "variant_family_key" IS NULL;--> statement-breakpoint
ALTER TABLE "catalog_missions" ALTER COLUMN "variant_group_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog_missions" ALTER COLUMN "variant_family_key" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "catalog_missions_variant_group_idx" ON "catalog_missions" USING btree ("variant_group_id");--> statement-breakpoint
CREATE INDEX "catalog_missions_variant_family_idx" ON "catalog_missions" USING btree ("variant_family_key");
