-- Performance indexes and data-integrity fixes identified in backend audit.

CREATE INDEX IF NOT EXISTS tcf_consents_lead_id_idx ON tcf_consents (lead_id);

CREATE INDEX IF NOT EXISTS tasks_org_status_due_at_idx ON tasks (org_id, status, due_at);

CREATE INDEX IF NOT EXISTS whatsapp_messages_org_id_idx ON whatsapp_messages (org_id);

CREATE INDEX IF NOT EXISTS lead_activities_org_id_idx ON lead_activities (org_id);

CREATE UNIQUE INDEX IF NOT EXISTS integration_sync_state_integration_org_id_idx
  ON integration_sync_state (integration, org_id);
