-- Expand lead_status check constraint to include 'not_interested' and 'dropped'
-- These statuses route leads to the admin-only NA Leads bucket and auto-unassign them from agents.

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_lead_status_check;

ALTER TABLE leads ADD CONSTRAINT leads_lead_status_check
  CHECK (lead_status IN ('new', 'contacted', 'qualified', 'negotiation', 'won', 'lost', 'not_interested', 'dropped'));
