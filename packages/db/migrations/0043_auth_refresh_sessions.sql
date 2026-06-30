CREATE TABLE IF NOT EXISTS "auth_refresh_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "revoked_at" timestamptz,
  "user_agent" text,
  "ip_address" text,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "auth_refresh_sessions_token_hash_idx" ON "auth_refresh_sessions" ("token_hash");
CREATE INDEX IF NOT EXISTS "auth_refresh_sessions_user_id_idx" ON "auth_refresh_sessions" ("user_id");
CREATE INDEX IF NOT EXISTS "auth_refresh_sessions_expires_at_idx" ON "auth_refresh_sessions" ("expires_at");
