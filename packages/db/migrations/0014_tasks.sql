CREATE TABLE IF NOT EXISTS "tasks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "lead_id" uuid REFERENCES "leads"("id"),
  "assigned_to" uuid REFERENCES "users"("id"),
  "created_by" uuid NOT NULL REFERENCES "users"("id"),
  "title" text NOT NULL,
  "description" text,
  "due_at" timestamptz,
  "priority" text NOT NULL DEFAULT 'medium',
  "status" text NOT NULL DEFAULT 'pending',
  "task_type" text NOT NULL DEFAULT 'follow_up',
  "completed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "tasks_priority_check" CHECK ("priority" IN ('low', 'medium', 'high', 'urgent')),
  CONSTRAINT "tasks_status_check" CHECK ("status" IN ('pending', 'in_progress', 'completed', 'cancelled')),
  CONSTRAINT "tasks_task_type_check" CHECK ("task_type" IN ('call', 'meeting', 'follow_up', 'document', 'site_visit', 'other'))
);

CREATE INDEX IF NOT EXISTS "tasks_org_id_idx" ON "tasks" ("org_id");
CREATE INDEX IF NOT EXISTS "tasks_lead_id_idx" ON "tasks" ("lead_id");
CREATE INDEX IF NOT EXISTS "tasks_assigned_to_idx" ON "tasks" ("assigned_to");
CREATE INDEX IF NOT EXISTS "tasks_due_at_idx" ON "tasks" ("due_at");
CREATE INDEX IF NOT EXISTS "tasks_status_idx" ON "tasks" ("status");
