ALTER TABLE "site_visits" ADD COLUMN IF NOT EXISTS "unit_id" uuid REFERENCES "project_units"("id") ON DELETE SET NULL;
ALTER TABLE "site_visits" ADD COLUMN IF NOT EXISTS "tower" text;
ALTER TABLE "site_visits" ADD COLUMN IF NOT EXISTS "maps_link" text;
ALTER TABLE "site_visits" ADD COLUMN IF NOT EXISTS "meeting_location" text;
ALTER TABLE "site_visits" ADD COLUMN IF NOT EXISTS "customer_email" text;
ALTER TABLE "site_visits" ADD COLUMN IF NOT EXISTS "google_calendar_event_id" text;
ALTER TABLE "site_visits" ADD COLUMN IF NOT EXISTS "google_calendar_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "site_visits" ADD COLUMN IF NOT EXISTS "reminders_sent" jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS "site_visits_unit_id_idx" ON "site_visits" ("unit_id");
CREATE INDEX IF NOT EXISTS "site_visits_google_calendar_event_id_idx" ON "site_visits" ("google_calendar_event_id");

ALTER TABLE "lead_activities" DROP CONSTRAINT IF EXISTS "lead_activities_type_check";
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_type_check"
  CHECK ("type" in ('call', 'note', 'status_change', 'meeting', 'task', 'follow_up', 'assignment_change', 'site_visit'));
