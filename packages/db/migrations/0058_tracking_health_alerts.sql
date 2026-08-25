-- Tracking health, alerts, cleanup audit, admin settings, per-agent policy.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "tracking_policy_enabled" boolean NOT NULL DEFAULT true;

ALTER TABLE "agent_devices"
  ADD COLUMN IF NOT EXISTS "installation_id" text,
  ADD COLUMN IF NOT EXISTS "manufacturer" text,
  ADD COLUMN IF NOT EXISTS "model" text,
  ADD COLUMN IF NOT EXISTS "os_version" text,
  ADD COLUMN IF NOT EXISTS "last_heartbeat_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "last_location_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "last_call_log_sync_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "last_known_latitude" double precision,
  ADD COLUMN IF NOT EXISTS "last_known_longitude" double precision,
  ADD COLUMN IF NOT EXISTS "last_known_accuracy" double precision,
  ADD COLUMN IF NOT EXISTS "last_known_captured_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "device_status" text NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN IF NOT EXISTS "health_status" text NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN IF NOT EXISTS "is_current" boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "replaced_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "mdm_enrolled" boolean,
  ADD COLUMN IF NOT EXISTS "mdm_compliant" boolean,
  ADD COLUMN IF NOT EXISTS "mdm_app_installed" boolean,
  ADD COLUMN IF NOT EXISTS "mdm_last_check_in_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "mdm_managed_status" text;

CREATE INDEX IF NOT EXISTS "idx_agent_devices_health"
  ON "agent_devices" ("health_status", "last_seen_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_agent_devices_user_current"
  ON "agent_devices" ("user_id", "is_current");

CREATE TABLE IF NOT EXISTS "tracking_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "enabled" boolean NOT NULL DEFAULT true,
  "timezone" text NOT NULL DEFAULT 'Asia/Kolkata',
  "start_time" text NOT NULL DEFAULT '09:30',
  "end_time" text NOT NULL DEFAULT '20:30',
  "interval_minutes" integer NOT NULL DEFAULT 30,
  "retention_days" integer NOT NULL DEFAULT 14,
  "missing_alert_minutes" integer NOT NULL DEFAULT 75,
  "heartbeat_threshold_minutes" integer NOT NULL DEFAULT 60,
  "possible_uninstall_minutes" integer NOT NULL DEFAULT 180,
  "active_days" integer[] NOT NULL DEFAULT ARRAY[0,1,2,3,4,5,6],
  "updated_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT NOW(),
  "updated_at" timestamptz NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_tracking_settings_org"
  ON "tracking_settings" ("org_id");

CREATE TABLE IF NOT EXISTS "tracking_alerts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "agent_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "device_id" text,
  "alert_type" text NOT NULL,
  "severity" text NOT NULL DEFAULT 'WARNING',
  "title" text NOT NULL,
  "message" text NOT NULL,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "is_resolved" boolean NOT NULL DEFAULT false,
  "resolved_at" timestamptz,
  "resolved_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "notified_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_tracking_alerts_org_created"
  ON "tracking_alerts" ("org_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_tracking_alerts_agent_open"
  ON "tracking_alerts" ("agent_id", "is_resolved", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_tracking_alerts_type_open"
  ON "tracking_alerts" ("alert_type", "is_resolved");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_tracking_alerts_open_dedupe"
  ON "tracking_alerts" ("agent_id", "alert_type")
  WHERE "is_resolved" = false;

CREATE TABLE IF NOT EXISTS "tracking_cleanup_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "job_id" text NOT NULL,
  "started_at" timestamptz NOT NULL,
  "completed_at" timestamptz,
  "location_records_deleted" integer NOT NULL DEFAULT 0,
  "call_log_records_deleted" integer NOT NULL DEFAULT 0,
  "temporary_records_deleted" integer NOT NULL DEFAULT 0,
  "status" text NOT NULL DEFAULT 'running',
  "error" text,
  "created_at" timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_tracking_cleanup_runs_started"
  ON "tracking_cleanup_runs" ("started_at" DESC);
