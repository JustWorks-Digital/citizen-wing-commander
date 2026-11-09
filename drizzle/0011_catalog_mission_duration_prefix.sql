ALTER TABLE "catalog_missions" RENAME COLUMN "run_count" TO "mission_run_count";--> statement-breakpoint
ALTER TABLE "catalog_missions" RENAME COLUMN "total_duration_ms" TO "mission_total_duration_ms";--> statement-breakpoint
ALTER TABLE "catalog_missions" RENAME COLUMN "avg_duration_ms" TO "mission_avg_duration_ms";
