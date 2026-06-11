CREATE TABLE IF NOT EXISTS "notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "type" text NOT NULL,
  "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "is_read" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "notifications_user_id_created_at_idx" ON "notifications" ("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "notifications_user_id_unread_idx" ON "notifications" ("user_id", "is_read") WHERE "is_read" = false;
