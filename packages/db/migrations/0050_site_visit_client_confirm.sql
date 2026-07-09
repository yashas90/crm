ALTER TABLE "site_visits"
  ADD COLUMN IF NOT EXISTS "confirmed_by_client" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "confirmed_by_client_at" timestamptz;
