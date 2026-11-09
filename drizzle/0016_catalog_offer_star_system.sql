ALTER TABLE "catalog_missions" ADD COLUMN "offer_star_system_slug" text;--> statement-breakpoint
CREATE INDEX "catalog_missions_offer_star_system_idx" ON "catalog_missions" USING btree ("offer_star_system_slug");
