-- Feature: Lost/Not-Interested reason capture
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "close_reason" text;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "close_reason_note" text;

-- Feature: Lead SLA tracking
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "last_activity_at" timestamp with time zone;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "sla_breached_at" timestamp with time zone;

-- Feature: Site visit outcome
ALTER TABLE "site_visits" ADD COLUMN IF NOT EXISTS "outcome" text;
ALTER TABLE "site_visits" ADD COLUMN IF NOT EXISTS "outcome_note" text;

-- Feature: Agent targets
CREATE TABLE IF NOT EXISTS "agent_targets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "month" text NOT NULL,
  "target_calls" integer NOT NULL DEFAULT 0,
  "target_site_visits" integer NOT NULL DEFAULT 0,
  "target_bookings" integer NOT NULL DEFAULT 0,
  "target_revenue" numeric(16, 2) NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE("org_id", "user_id", "month")
);
CREATE INDEX IF NOT EXISTS "agent_targets_org_id_month_idx" ON "agent_targets" ("org_id", "month");
CREATE INDEX IF NOT EXISTS "agent_targets_user_id_idx" ON "agent_targets" ("user_id");

-- Feature: Lead auto-assignment rules
CREATE TABLE IF NOT EXISTS "lead_assignment_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "name" text NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "strategy" text NOT NULL DEFAULT 'round_robin',
  "conditions" jsonb NOT NULL DEFAULT '{}',
  "assignee_ids" text[] NOT NULL DEFAULT '{}',
  "priority" integer NOT NULL DEFAULT 0,
  "created_by" uuid NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "lead_assignment_rules_org_id_idx" ON "lead_assignment_rules" ("org_id", "is_active");

-- Feature: Round-robin state tracking
CREATE TABLE IF NOT EXISTS "assignment_rule_state" (
  "rule_id" uuid PRIMARY KEY REFERENCES "lead_assignment_rules"("id") ON DELETE CASCADE,
  "last_assigned_index" integer NOT NULL DEFAULT 0,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Feature: Email logs
CREATE TABLE IF NOT EXISTS "email_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "lead_id" uuid REFERENCES "leads"("id"),
  "sent_by" uuid NOT NULL REFERENCES "users"("id"),
  "to_email" text NOT NULL,
  "subject" text NOT NULL,
  "body" text NOT NULL,
  "status" text NOT NULL DEFAULT 'sent',
  "error" text,
  "sent_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "email_logs_lead_id_idx" ON "email_logs" ("lead_id");
CREATE INDEX IF NOT EXISTS "email_logs_org_id_idx" ON "email_logs" ("org_id");

-- Index: last_activity_at for SLA queries
CREATE INDEX IF NOT EXISTS "leads_last_activity_at_idx" ON "leads" ("org_id", "last_activity_at");
CREATE INDEX IF NOT EXISTS "leads_sla_breached_idx" ON "leads" ("org_id", "sla_breached_at") WHERE "sla_breached_at" IS NOT NULL;
