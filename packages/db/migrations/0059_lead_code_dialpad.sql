-- Human-readable lead IDs (PROP-0001) + dial-pad call source
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "lead_code" text;

WITH numbered AS (
  SELECT
    id,
    row_number() OVER (PARTITION BY org_id ORDER BY created_at ASC, id ASC) AS rn
  FROM "leads"
  WHERE "lead_code" IS NULL OR btrim("lead_code") = ''
)
UPDATE "leads" AS l
SET "lead_code" = 'PROP-' || lpad(n.rn::text, 4, '0')
FROM numbered AS n
WHERE l.id = n.id;

-- Deduplicate any colliding codes within an org before unique index
WITH ranked AS (
  SELECT
    id,
    org_id,
    lead_code,
    row_number() OVER (PARTITION BY org_id, lead_code ORDER BY created_at ASC, id ASC) AS dup_n
  FROM "leads"
  WHERE lead_code IS NOT NULL
),
max_codes AS (
  SELECT
    org_id,
    coalesce(
      max(
        CASE
          WHEN lead_code ~ '^PROP-[0-9]+$'
          THEN cast(substring(lead_code from 6) as integer)
          ELSE 0
        END
      ),
      0
    ) AS max_n
  FROM "leads"
  GROUP BY org_id
),
to_fix AS (
  SELECT
    r.id,
    'PROP-' || lpad((m.max_n + row_number() OVER (PARTITION BY r.org_id ORDER BY r.id))::text, 4, '0') AS new_code
  FROM ranked r
  JOIN max_codes m ON m.org_id = r.org_id
  WHERE r.dup_n > 1
)
UPDATE "leads" AS l
SET "lead_code" = f.new_code
FROM to_fix AS f
WHERE l.id = f.id;

ALTER TABLE "leads" ALTER COLUMN "lead_code" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "leads_org_lead_code_uidx" ON "leads" ("org_id", "lead_code");
CREATE INDEX IF NOT EXISTS "leads_lead_code_idx" ON "leads" ("lead_code");

ALTER TABLE "call_records" DROP CONSTRAINT IF EXISTS "call_records_source_check";
ALTER TABLE "call_records" ADD CONSTRAINT "call_records_source_check"
  CHECK ("source" in ('mobile-manual', 'mobile-auto', 'web-manual', 'mobile-dialpad'));
