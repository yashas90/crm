CREATE TABLE IF NOT EXISTS "security_alerts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid REFERENCES "public"."users"("id") ON DELETE SET NULL,
  "alert_type" text NOT NULL,
  "details" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "ip_address" text,
  "resolved" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "security_alerts_unresolved_idx"
  ON "security_alerts" ("resolved", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "security_alerts_user_id_idx"
  ON "security_alerts" ("user_id");
