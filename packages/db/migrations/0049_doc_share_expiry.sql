-- Add expiry to document share tokens (30-day default)
ALTER TABLE "lead_document_shares"
  ADD COLUMN IF NOT EXISTS "expires_at" timestamptz NOT NULL
  DEFAULT NOW() + INTERVAL '30 days';

-- Backfill: set existing shares to 30 days from when they were shared
UPDATE "lead_document_shares"
SET "expires_at" = "shared_at" + INTERVAL '30 days'
WHERE "expires_at" = NOW() + INTERVAL '30 days';

CREATE INDEX IF NOT EXISTS lead_document_shares_expires_at_idx
  ON lead_document_shares (expires_at);
