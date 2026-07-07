-- Analytics performance indexes
-- Speeds up: analytics dashboard KPIs, report queries, lead scoring job
-- NOTE: Do not use CONCURRENTLY here — drizzle-kit migrate runs in a transaction.

CREATE INDEX IF NOT EXISTS leads_org_id_created_at_idx
  ON leads (org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS lead_activities_org_id_type_idx
  ON lead_activities (org_id, type);

CREATE INDEX IF NOT EXISTS site_visits_org_id_status_idx
  ON site_visits (org_id, status);
