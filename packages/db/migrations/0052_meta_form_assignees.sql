ALTER TABLE "facebook_forms"
  ADD COLUMN IF NOT EXISTS "assignee_ids" text[] DEFAULT '{}' NOT NULL,
  ADD COLUMN IF NOT EXISTS "assignment_strategy" text DEFAULT 'round_robin' NOT NULL,
  ADD COLUMN IF NOT EXISTS "last_assigned_index" integer DEFAULT -1 NOT NULL;

DO $$ BEGIN
  ALTER TABLE "facebook_forms"
    ADD CONSTRAINT "facebook_forms_assignment_strategy_check"
    CHECK ("assignment_strategy" IN ('round_robin', 'first'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
