-- Bulletproof tracking: STALE = likely uninstall (24h), not overnight / phone-off.
-- Persist boot + offline-queue signals so the server never marks those as STALE.

ALTER TABLE "agent_devices"
  ADD COLUMN IF NOT EXISTS "last_boot_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "queued_offline_ping_count" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "permission_denied_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "permission_denied_count" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "battery_optimization_ignored" boolean;

ALTER TABLE "tracking_settings"
  ALTER COLUMN "possible_uninstall_minutes" SET DEFAULT 1440;

UPDATE "tracking_settings"
SET "possible_uninstall_minutes" = 1440
WHERE "possible_uninstall_minutes" = 180;
