CREATE TABLE IF NOT EXISTS "message_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "name" text NOT NULL,
  "content" text NOT NULL,
  "category" text NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_by" uuid NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "message_templates_category_check" CHECK (
    "category" IN ('greeting', 'project_details', 'follow_up', 'site_visit', 'custom')
  )
);

CREATE INDEX IF NOT EXISTS "message_templates_org_id_idx" ON "message_templates" ("org_id");
CREATE INDEX IF NOT EXISTS "message_templates_org_active_idx" ON "message_templates" ("org_id", "is_active");
