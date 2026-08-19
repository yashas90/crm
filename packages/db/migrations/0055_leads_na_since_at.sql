-- Track when a lead entered the NA pool (not_interested / dropped) for 1-week purge.
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "na_since_at" timestamptz;

UPDATE "leads" l
SET "na_since_at" = COALESCE(
  (
    SELECT MAX(la.created_at)
    FROM "lead_activities" la
    WHERE la.lead_id = l.id
      AND la.type = 'status_change'
      AND la.metadata->>'to' IN ('not_interested', 'dropped')
  ),
  l.created_at
)
WHERE l.lead_status IN ('not_interested', 'dropped')
  AND l.deleted_at IS NULL
  AND l.na_since_at IS NULL;

CREATE INDEX IF NOT EXISTS "leads_org_na_since_at_idx"
  ON "leads" ("org_id", "na_since_at")
  WHERE "lead_status" IN ('not_interested', 'dropped') AND "deleted_at" IS NULL;
