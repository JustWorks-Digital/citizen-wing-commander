-- Rename box_breakdown → scu_box_splits (column + payload key)
ALTER TABLE "catalog_missions" RENAME COLUMN "box_breakdown" TO "scu_box_splits";--> statement-breakpoint
ALTER TABLE "catalog_missions"
  ALTER COLUMN "scu_box_splits"
  SET DEFAULT '{"scuOne":0,"scuTwo":0,"scuFour":0,"scuEight":0}'::jsonb;--> statement-breakpoint
UPDATE "catalog_missions"
SET "payload" = CASE
  WHEN "payload" ? 'boxBreakdown' AND NOT ("payload" ? 'scuBoxSplits')
    THEN ("payload" - 'boxBreakdown') || jsonb_build_object(
      'scuBoxSplits', "payload"->'boxBreakdown'
    )
  WHEN "payload" ? 'boxBreakdown' AND ("payload" ? 'scuBoxSplits')
    THEN "payload" - 'boxBreakdown'
  ELSE "payload"
END;
