ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "sessions_revoked_at" timestamp with time zone;

CREATE TABLE IF NOT EXISTS "token_blocklist" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "jti" uuid NOT NULL,
  "user_id" uuid REFERENCES "public"."users"("id") ON DELETE CASCADE,
  "expires_at" timestamp with time zone NOT NULL,
  "reason" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "token_blocklist_jti_idx" ON "token_blocklist" ("jti");
CREATE INDEX IF NOT EXISTS "token_blocklist_expires_at_idx" ON "token_blocklist" ("expires_at");

CREATE TABLE IF NOT EXISTS "password_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE CASCADE,
  "password_hash" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "password_history_user_id_idx"
  ON "password_history" ("user_id", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "login_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE CASCADE,
  "ip_address" text,
  "user_agent" text,
  "device" text NOT NULL,
  "location_city" text,
  "location_country" text,
  "is_new_device" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "login_events_user_id_idx"
  ON "login_events" ("user_id", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "user_invites" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "token" uuid NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE CASCADE,
  "email" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "accepted_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_invites_token_idx" ON "user_invites" ("token");
