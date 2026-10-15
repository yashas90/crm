-- Morning brief lookups.
-- Skipped because they already exist:
--   leads_lead_status_assigned_to_idx (lead_status, assigned_to) — reverse column order
--   contact_pool_assigned_agent_idx (assigned_to_agent_id)
--   notifications_user_id_created_at_idx, notifications_user_id_unread_idx
--   idx_agent_locations_user_captured, idx_agent_locations_captured
-- This leads index leads with the assigned agent, which the morning brief filters on.

CREATE INDEX IF NOT EXISTS leads_assigned_to_status_active_idx
  ON leads (assigned_to, lead_status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS transaction_closures_org_status_invoice_idx
  ON transaction_closures (org_id, status, invoice_status);
