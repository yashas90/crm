-- Human-readable lead IDs (PROP-0001) + dial-pad call source
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "lead_code" text;

WITH numbered AS (
  SELECT
    id,
    row_number() OVER (PARTITION BY org_id ORDER BY created_at ASC, id ASC) AS rn
  FROM "leads"
  WHERE "lead_code" IS NULL
)
UPDATE "leads" AS l
SET "lead_code" = 'PROP-' || lpad(n.rn::text, 4, '0')
FROM numbered AS n
WHERE l.id = n.id;

ALTER TABLE "leads" ALTER COLUMN "lead_code" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "leads_org_lead_code_uidx" ON "leads" ("org_id", "lead_code");
CREATE INDEX IF NOT EXISTS "leads_lead_code_idx" ON "leads" ("lead_code");

ALTER TABLE "call_records" DROP CONSTRAINT IF EXISTS "call_records_source_check";
ALTER TABLE "call_records" ADD CONSTRAINT "call_records_source_check"
  CHECK ("source" in ('mobile-manual', 'mobile-auto', 'web-manual', 'mobile-dialpad'));
