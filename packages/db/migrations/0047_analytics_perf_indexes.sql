-- Analytics performance indexes
-- Speeds up: analytics dashboard KPIs, report queries, lead scoring job

-- leads: composite (org_id, created_at) for date-range analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS leads_org_id_created_at_idx
  ON leads (org_id, created_at DESC);

-- lead_activities: composite (org_id, type) for type-filtered aggregations
CREATE INDEX CONCURRENTLY IF NOT EXISTS lead_activities_org_id_type_idx
  ON lead_activities (org_id, type);

-- site_visits: composite (org_id, status) for visit status aggregations
CREATE INDEX CONCURRENTLY IF NOT EXISTS site_visits_org_id_status_idx
  ON site_visits (org_id, status);
