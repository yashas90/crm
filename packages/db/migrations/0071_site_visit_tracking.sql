ALTER TABLE "site_visits" DROP CONSTRAINT IF EXISTS "site_visits_status_check";

ALTER TABLE "site_visits" ADD COLUMN IF NOT EXISTS "property_name" text;
ALTER TABLE "site_visits" ADD COLUMN IF NOT EXISTS "property_lat" numeric(10, 7);
ALTER TABLE "site_visits" ADD COLUMN IF NOT EXISTS "property_lng" numeric(10, 7);
ALTER TABLE "site_visits" ADD COLUMN IF NOT EXISTS "scheduled_at" timestamp with time zone;
ALTER TABLE "site_visits" ADD COLUMN IF NOT EXISTS "scheduled_by" uuid REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "site_visits" ADD COLUMN IF NOT EXISTS "checkin_at" timestamp with time zone;
ALTER TABLE "site_visits" ADD COLUMN IF NOT EXISTS "checkin_lat" numeric(10, 7);
ALTER TABLE "site_visits" ADD COLUMN IF NOT EXISTS "checkin_lng" numeric(10, 7);
ALTER TABLE "site_visits" ADD COLUMN IF NOT EXISTS "distance_meters" integer;
ALTER TABLE "site_visits" ADD COLUMN IF NOT EXISTS "checkin_verified" boolean NOT NULL DEFAULT false;
ALTER TABLE "site_visits" ADD COLUMN IF NOT EXISTS "checkout_at" timestamp with time zone;
ALTER TABLE "site_visits" ADD COLUMN IF NOT EXISTS "duration_minutes" integer;
ALTER TABLE "site_visits" ADD COLUMN IF NOT EXISTS "customer_present" text;
ALTER TABLE "site_visits" ADD COLUMN IF NOT EXISTS "companions" text;
ALTER TABLE "site_visits" ADD COLUMN IF NOT EXISTS "next_action" text;
ALTER TABLE "site_visits" ADD COLUMN IF NOT EXISTS "next_action_date" timestamp with time zone;
ALTER TABLE "site_visits" ADD COLUMN IF NOT EXISTS "feedback" jsonb;
ALTER TABLE "site_visits" ADD COLUMN IF NOT EXISTS "agent_notes" text;
ALTER TABLE "site_visits" ADD COLUMN IF NOT EXISTS "visit_photos" jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "site_visits" ADD COLUMN IF NOT EXISTS "customer_signature" text;
ALTER TABLE "site_visits" ADD COLUMN IF NOT EXISTS "overdue_alert_sent" boolean NOT NULL DEFAULT false;

-- visit_time is a time column (0018), so date + time is the IST wall clock.
UPDATE "site_visits"
SET "scheduled_at" = (("visit_date"::timestamp + "visit_time") AT TIME ZONE 'Asia/Kolkata')
WHERE "scheduled_at" IS NULL;

ALTER TABLE "site_visits" ADD CONSTRAINT "site_visits_status_check" CHECK (
  "status" IN (
    'scheduled',
    'reminder_sent',
    'checked_in',
    'in_progress',
    'completed',
    'cancelled',
    'no_show',
    'rescheduled'
  )
);

CREATE TABLE IF NOT EXISTS "site_visit_feedback" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "visit_id" uuid NOT NULL REFERENCES "site_visits"("id") ON DELETE CASCADE,
  "question" text NOT NULL,
  "answer" text NOT NULL,
  "answer_type" text NOT NULL,
  "recorded_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "site_visit_feedback_visit_id_idx" ON "site_visit_feedback" ("visit_id");

CREATE TABLE IF NOT EXISTS "property_checkin_zones" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "project_id" uuid REFERENCES "projects"("id") ON DELETE SET NULL,
  "property_name" text NOT NULL,
  "address" text,
  "lat" double precision NOT NULL,
  "lng" double precision NOT NULL,
  "radius_meters" integer NOT NULL DEFAULT 200,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "property_checkin_zones_org_id_idx" ON "property_checkin_zones" ("org_id");
CREATE INDEX IF NOT EXISTS "property_checkin_zones_project_id_idx" ON "property_checkin_zones" ("project_id");

CREATE TABLE IF NOT EXISTS "visit_reminders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "visit_id" uuid NOT NULL REFERENCES "site_visits"("id") ON DELETE CASCADE,
  "kind" text NOT NULL,
  "scheduled_for" timestamp with time zone NOT NULL,
  "is_sent" boolean NOT NULL DEFAULT false,
  "sent_at" timestamp with time zone,
  CONSTRAINT "visit_reminders_kind_check" CHECK ("kind" IN ('24h', '2h', '30min', 'now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "visit_reminders_visit_kind_idx" ON "visit_reminders" ("visit_id", "kind");
CREATE INDEX IF NOT EXISTS "visit_reminders_unsent_idx" ON "visit_reminders" ("is_sent", "scheduled_for");
