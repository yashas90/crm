-- Performance indexes for common CRM query patterns.
-- Column names map to API field names: assigned_to=assignedTo, lead_status=stage,
-- lead_source=source, user_id=agentId, started_at=calledAt.

-- LEADS
CREATE INDEX IF NOT EXISTS "leads_assigned_to_idx" ON "leads" USING btree ("assigned_to");
CREATE INDEX IF NOT EXISTS "leads_lead_status_idx" ON "leads" USING btree ("lead_status");
CREATE INDEX IF NOT EXISTS "leads_lead_source_idx" ON "leads" USING btree ("lead_source");
CREATE INDEX IF NOT EXISTS "leads_created_at_idx" ON "leads" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "leads_next_followup_at_idx" ON "leads" USING btree ("next_followup_at");
CREATE INDEX IF NOT EXISTS "leads_last_contacted_at_idx" ON "leads" USING btree ("last_contacted_at");
CREATE INDEX IF NOT EXISTS "leads_assigned_to_created_at_idx" ON "leads" USING btree ("assigned_to", "created_at");
CREATE INDEX IF NOT EXISTS "leads_lead_status_assigned_to_idx" ON "leads" USING btree ("lead_status", "assigned_to");

-- CALL_RECORDS (calls table)
CREATE INDEX IF NOT EXISTS "call_records_user_id_idx" ON "call_records" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "call_records_lead_id_idx" ON "call_records" USING btree ("lead_id");
CREATE INDEX IF NOT EXISTS "call_records_started_at_idx" ON "call_records" USING btree ("started_at");
CREATE INDEX IF NOT EXISTS "call_records_outcome_idx" ON "call_records" USING btree ("outcome");
CREATE INDEX IF NOT EXISTS "call_records_user_id_started_at_idx" ON "call_records" USING btree ("user_id", "started_at");

-- TASKS (single-column indexes exist from 0014; add composite for open tasks per agent)
CREATE INDEX IF NOT EXISTS "tasks_assigned_to_status_idx" ON "tasks" USING btree ("assigned_to", "status");

-- SITE_VISITS indexes (agent_id, visit_date, status, agent_date) exist from 0018

-- NOTIFICATIONS: (user_id, is_read) covered by notifications_user_id_unread_idx from 0012
