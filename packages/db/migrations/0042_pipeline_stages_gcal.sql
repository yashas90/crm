-- Custom pipeline stages
CREATE TABLE IF NOT EXISTS "pipeline_stages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "name" text NOT NULL,
  "color" text NOT NULL DEFAULT '#6366f1',
  "position" integer NOT NULL DEFAULT 0,
  "is_default" boolean NOT NULL DEFAULT false,
  "maps_to_status" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE("org_id", "name")
);
CREATE INDEX IF NOT EXISTS "pipeline_stages_org_id_idx" ON "pipeline_stages" ("org_id", "position");

-- Google Calendar OAuth tokens per user
CREATE TABLE IF NOT EXISTS "google_calendar_tokens" (
  "user_id" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "access_token" text NOT NULL,
  "refresh_token" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "scope" text,
  "calendar_id" text NOT NULL DEFAULT 'primary',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
