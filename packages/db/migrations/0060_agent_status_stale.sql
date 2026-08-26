-- Agent availability status (active | stale | offline) + align stale threshold to 45 minutes.
-- agent_locations remains the ping store; agent_location_pings is a compatibility view.

ALTER TABLE "agent_devices"
  ADD COLUMN IF NOT EXISTS "agent_status" text NOT NULL DEFAULT 'offline';

CREATE INDEX IF NOT EXISTS "idx_agent_devices_agent_status"
  ON "agent_devices" ("agent_status", "last_location_at");

-- Align org defaults / existing rows with TRACKING_DEFAULTS.missingAlertMinutes (45).
UPDATE "tracking_settings"
SET "missing_alert_minutes" = 45
WHERE "missing_alert_minutes" = 75;

ALTER TABLE "tracking_settings"
  ALTER COLUMN "missing_alert_minutes" SET DEFAULT 45;

-- Spec-facing view over agent_locations (ping_id, agent_id, lat/lng, battery, source).
CREATE OR REPLACE VIEW "agent_location_pings" AS
SELECT
  "id" AS "ping_id",
  "user_id" AS "agent_id",
  "latitude" AS "lat",
  "longitude" AS "lng",
  "accuracy",
  "battery_level",
  "captured_at" AS "timestamp",
  CASE
    WHEN "source" IN ('foreground', 'mobile_foreground') THEN 'foreground'
    WHEN "source" IN ('terminated', 'mobile_terminated', 'mobile_watchdog_catchup') THEN 'terminated'
    ELSE 'background'
  END AS "source"
FROM "agent_locations";
