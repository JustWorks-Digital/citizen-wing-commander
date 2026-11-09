ALTER TABLE "catalog_missions" ADD COLUMN "rewards" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
UPDATE "catalog_missions"
SET "rewards" = CASE
  WHEN "reward_auec" IS NOT NULL AND "reward_auec" > 0
    THEN jsonb_build_array(jsonb_build_object('kind', 'auec', 'amount', "reward_auec"))
  ELSE '[]'::jsonb
END;--> statement-breakpoint
ALTER TABLE "catalog_missions" DROP COLUMN "reward_auec";
