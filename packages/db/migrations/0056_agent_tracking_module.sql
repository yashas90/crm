-- Agent tracking enrichment: devices, location metadata, OS call-log metadata, 14-day retention indexes.

ALTER TABLE "agent_locations"
  ADD COLUMN IF NOT EXISTS "event_id" text,
  ADD COLUMN IF NOT EXISTS "device_id" text,
  ADD COLUMN IF NOT EXISTS "battery_level" integer,
  ADD COLUMN IF NOT EXISTS "network_status" text,
  ADD COLUMN IF NOT EXISTS "source" text DEFAULT 'mobile_background',
  ADD COLUMN IF NOT EXISTS "speed" double precision,
  ADD COLUMN IF NOT EXISTS "heading" double precision,
  ADD COLUMN IF NOT EXISTS "altitude" double precision;

CREATE UNIQUE INDEX IF NOT EXISTS "idx_agent_locations_user_event"
  ON "agent_locations" ("user_id", "event_id")
  WHERE "event_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_agent_locations_device_captured"
  ON "agent_locations" ("device_id", "captured_at" DESC)
  WHERE "device_id" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "agent_devices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "device_id" text NOT NULL,
  "platform" text NOT NULL,
  "app_version" text,
  "location_permission_status" text,
  "call_log_permission_status" text,
  "tracking_enabled" boolean NOT NULL DEFAULT true,
  "last_seen_at" timestamptz NOT NULL DEFAULT NOW(),
  "battery_level" integer,
  "network_status" text,
  "created_at" timestamptz NOT NULL DEFAULT NOW(),
  "updated_at" timestamptz NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_agent_devices_user_device"
  ON "agent_devices" ("user_id", "device_id");

CREATE INDEX IF NOT EXISTS "idx_agent_devices_user_seen"
  ON "agent_devices" ("user_id", "last_seen_at" DESC);

CREATE TABLE IF NOT EXISTS "agent_call_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_id" text NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "device_id" text NOT NULL,
  "call_log_id" text,
  "phone_number" text,
  "call_type" text NOT NULL,
  "call_start_time" timestamptz NOT NULL,
  "call_end_time" timestamptz,
  "duration_seconds" integer,
  "created_at" timestamptz NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_agent_call_logs_user_event"
  ON "agent_call_logs" ("user_id", "event_id");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_agent_call_logs_device_call"
  ON "agent_call_logs" ("device_id", "call_log_id")
  WHERE "call_log_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_agent_call_logs_user_start"
  ON "agent_call_logs" ("user_id", "call_start_time" DESC);

CREATE INDEX IF NOT EXISTS "idx_agent_call_logs_start"
  ON "agent_call_logs" ("call_start_time" DESC);

CREATE TABLE IF NOT EXISTS "tracking_audit_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "admin_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "action" text NOT NULL,
  "agent_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "ip_address" text,
  "user_agent" text,
  "created_at" timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_tracking_audit_admin_created"
  ON "tracking_audit_logs" ("admin_id", "created_at" DESC);
