CREATE TABLE IF NOT EXISTS "site_visits" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "lead_id" uuid NOT NULL REFERENCES "leads"("id"),
  "project_id" uuid REFERENCES "projects"("id"),
  "agent_id" uuid NOT NULL REFERENCES "users"("id"),
  "visit_date" date NOT NULL,
  "visit_time" time NOT NULL,
  "duration" integer DEFAULT 60 NOT NULL,
  "status" text DEFAULT 'scheduled' NOT NULL,
  "notes" text,
  "property_address" text,
  "reminder_sent" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "site_visits_status_check" CHECK ("status" IN ('scheduled', 'completed', 'cancelled', 'no_show'))
);

CREATE INDEX IF NOT EXISTS "site_visits_org_id_idx" ON "site_visits" ("org_id");
CREATE INDEX IF NOT EXISTS "site_visits_lead_id_idx" ON "site_visits" ("lead_id");
CREATE INDEX IF NOT EXISTS "site_visits_agent_id_idx" ON "site_visits" ("agent_id");
CREATE INDEX IF NOT EXISTS "site_visits_visit_date_idx" ON "site_visits" ("visit_date");
CREATE INDEX IF NOT EXISTS "site_visits_status_idx" ON "site_visits" ("status");
CREATE INDEX IF NOT EXISTS "site_visits_agent_date_idx" ON "site_visits" ("agent_id", "visit_date");
