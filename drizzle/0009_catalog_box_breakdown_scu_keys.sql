-- Rename box_breakdown JSON keys: size1/2/4/8 → scuOne/Two/Four/Eight
ALTER TABLE "catalog_missions"
  ALTER COLUMN "box_breakdown"
  SET DEFAULT '{"scuOne":0,"scuTwo":0,"scuFour":0,"scuEight":0}'::jsonb;--> statement-breakpoint
UPDATE "catalog_missions"
SET
  "box_breakdown" = jsonb_build_object(
    'scuOne', COALESCE(("box_breakdown"->>'scuOne')::int, ("box_breakdown"->>'size1')::int, 0),
    'scuTwo', COALESCE(("box_breakdown"->>'scuTwo')::int, ("box_breakdown"->>'size2')::int, 0),
    'scuFour', COALESCE(("box_breakdown"->>'scuFour')::int, ("box_breakdown"->>'size4')::int, 0),
    'scuEight', COALESCE(("box_breakdown"->>'scuEight')::int, ("box_breakdown"->>'size8')::int, 0)
  ),
  "payload" = jsonb_set(
    "payload",
    '{boxBreakdown}',
    jsonb_build_object(
      'scuOne', COALESCE(
        ("payload"->'boxBreakdown'->>'scuOne')::int,
        ("payload"->'boxBreakdown'->>'size1')::int,
        0
      ),
      'scuTwo', COALESCE(
        ("payload"->'boxBreakdown'->>'scuTwo')::int,
        ("payload"->'boxBreakdown'->>'size2')::int,
        0
      ),
      'scuFour', COALESCE(
        ("payload"->'boxBreakdown'->>'scuFour')::int,
        ("payload"->'boxBreakdown'->>'size4')::int,
        0
      ),
      'scuEight', COALESCE(
        ("payload"->'boxBreakdown'->>'scuEight')::int,
        ("payload"->'boxBreakdown'->>'size8')::int,
        0
      )
    ),
    true
  );
