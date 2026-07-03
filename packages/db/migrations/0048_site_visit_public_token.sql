ALTER TABLE "site_visits" ADD COLUMN IF NOT EXISTS "public_token" text;

UPDATE "site_visits"
SET "public_token" = 'SV-' || to_char(created_at AT TIME ZONE 'UTC', 'YYYY') || '-' || upper(substr(replace(id::text, '-', ''), 1, 8))
WHERE "public_token" IS NULL;

ALTER TABLE "site_visits" ALTER COLUMN "public_token" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "site_visits_public_token_idx" ON "site_visits" ("public_token");
