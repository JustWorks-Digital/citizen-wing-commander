ALTER TABLE "catalog_missions" ADD COLUMN "scu_location_splits" jsonb;--> statement-breakpoint
UPDATE "catalog_missions"
SET "scu_location_splits" = "payload"->'scuLocationSplits'
WHERE "payload" ? 'scuLocationSplits';
