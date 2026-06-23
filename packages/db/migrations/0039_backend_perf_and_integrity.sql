-- Performance indexes and data-integrity fixes identified in backend audit.

-- 1. tcf_consents: index on lead_id (full table scan on every consent lookup)
CREATE INDEX tcf_consents_lead_id_idx ON tcf_consents (lead_id);

-- 2. tasks: composite index for the most common query pattern
--    (open tasks due today/overdue for an org — used by listDueToday, getOverdueCounts, main list)
CREATE INDEX tasks_org_status_due_at_idx ON tasks (org_id, status, due_at);

-- 3. whatsapp_messages: index on org_id (org-wide message queries had no index)
CREATE INDEX whatsapp_messages_org_id_idx ON whatsapp_messages (org_id);

-- 4. lead_activities: index on org_id (report queries scoped to org had no index)
CREATE INDEX lead_activities_org_id_idx ON lead_activities (org_id);

-- 5. integration_sync_state: unique constraint on (integration, org_id)
--    PK was only on integration — duplicate rows possible in future multi-tenant setup.
CREATE UNIQUE INDEX integration_sync_state_integration_org_id_idx
  ON integration_sync_state (integration, org_id);
