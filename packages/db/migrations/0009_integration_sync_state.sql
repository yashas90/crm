CREATE TABLE IF NOT EXISTS "integration_sync_state" (
  "integration" text PRIMARY KEY,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "last_success_at" timestamptz,
  "last_error" text,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
