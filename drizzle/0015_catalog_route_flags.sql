ALTER TABLE "catalog_missions" ADD COLUMN "is_direct" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog_missions" ADD COLUMN "is_one_pickup" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog_missions" ADD COLUMN "is_one_delivery" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "catalog_missions_is_direct_idx" ON "catalog_missions" USING btree ("is_direct");--> statement-breakpoint
CREATE INDEX "catalog_missions_is_one_pickup_idx" ON "catalog_missions" USING btree ("is_one_pickup");--> statement-breakpoint
CREATE INDEX "catalog_missions_is_one_delivery_idx" ON "catalog_missions" USING btree ("is_one_delivery");
